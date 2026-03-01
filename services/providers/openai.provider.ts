import OpenAI from 'openai';
import { Challenge, EvaluationResult, SystemComponent, Connection, HintResult, SolutionResult } from "../../types";
import { DifficultyLevel } from "../gemini";
import { AIProvider, ChatSession, ProviderError, ReasoningLevel } from "./ai-provider.interface";

// JSON Schema definitions for structured output (mirrors Gemini's responseSchema)
const CHALLENGE_SCHEMA = {
  type: 'object',
  properties: {
    title:        { type: 'string' },
    description:  { type: 'string' },
    requirements: { type: 'array', items: { type: 'string' } },
    constraints:  { type: 'array', items: { type: 'string' } },
    difficulty:   { type: 'string', enum: ['Junior', 'Mid', 'Senior', 'Principal'] }
  },
  required: ['title', 'description', 'requirements', 'constraints', 'difficulty'],
  additionalProperties: false
} as const;

const HINT_SCHEMA = {
  type: 'object',
  properties: {
    suggestedComponents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          layer:     { type: 'string' },
          component: { type: 'string' },
          reason:    { type: 'string' }
        },
        required: ['layer', 'component', 'reason'],
        additionalProperties: false
      }
    },
    architectureStrategy: { type: 'string' },
    keyConsiderations:    { type: 'array', items: { type: 'string' } }
  },
  required: ['suggestedComponents', 'architectureStrategy', 'keyConsiderations'],
  additionalProperties: false
} as const;

const EVALUATION_SCHEMA = {
  type: 'object',
  properties: {
    score:           { type: 'number', minimum: 0, maximum: 100 },
    summary:         { type: 'string' },
    pros:            { type: 'array', items: { type: 'string' } },
    cons:            { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    securityConcerns:{ type: 'array', items: { type: 'string' } }
  },
  required: ['score', 'summary', 'pros', 'cons', 'recommendations', 'securityConcerns'],
  additionalProperties: false
} as const;

const COMPONENT_SCHEMA = {
  type: 'object',
  properties: {
    id:    { type: 'string' },
    type:  { type: 'string' },
    tool:  { type: 'string' },
    label: { type: 'string' }
  },
  required: ['id', 'type', 'tool', 'label'],
  additionalProperties: false
} as const;

const CONNECTION_SCHEMA = {
  type: 'object',
  properties: {
    sourceId: { type: 'string' },
    targetId: { type: 'string' },
    label:    { type: 'string' },
    type:     { type: 'string', enum: ['directed', 'undirected'] }
  },
  required: ['sourceId', 'targetId', 'label', 'type'],
  additionalProperties: false
} as const;

const SOLUTION_SCHEMA = {
  type: 'object',
  properties: {
    architectureOverview: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:                { type: 'string' },
          explanation:          { type: 'string' },
          requirementsAddressed:{ type: 'array', items: { type: 'number' } },
          components:           { type: 'array', items: COMPONENT_SCHEMA },
          connections:          { type: 'array', items: CONNECTION_SCHEMA }
        },
        required: ['title', 'explanation', 'requirementsAddressed', 'components', 'connections'],
        additionalProperties: false
      }
    },
    finalNotes: { type: 'string' }
  },
  required: ['architectureOverview', 'steps', 'finalNotes'],
  additionalProperties: false
} as const;

const IMPROVEMENT_SCHEMA = {
  type: 'object',
  properties: {
    improvementOverview:    { type: 'string' },
    expectedScoreImprovement: { type: 'number' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:          { type: 'string' },
          explanation:    { type: 'string' },
          issueAddressed: { type: 'string' },
          components:     { type: 'array', items: COMPONENT_SCHEMA },
          connections:    { type: 'array', items: CONNECTION_SCHEMA }
        },
        required: ['title', 'explanation', 'issueAddressed', 'components', 'connections'],
        additionalProperties: false
      }
    }
  },
  required: ['improvementOverview', 'expectedScoreImprovement', 'steps'],
  additionalProperties: false
} as const;

function jsonSchema(name: string, schema: object) {
  return { type: 'json_schema' as const, json_schema: { name, strict: true, schema } };
}

const REASONING_EFFORT_MAP: Record<ReasoningLevel, 'low' | 'medium' | 'high' | undefined> = {
  minimal: undefined,
  low: 'low',
  medium: 'medium',
  high: 'high'
};

export class OpenAIProvider implements AIProvider {
  readonly providerType = 'openai' as const;
  private client: OpenAI;
  private model: string;
  private reasoningEffort: 'low' | 'medium' | 'high' | undefined;

  constructor(apiKey: string, model: string = 'gpt-5-nano', reasoningLevel: ReasoningLevel = 'medium') {
    if (!apiKey) {
      throw new Error('NO_API_KEY');
    }
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
    this.reasoningEffort = REASONING_EFFORT_MAP[reasoningLevel];
  }

  private tokenLimit(n: number): { max_completion_tokens: number } {
    return { max_completion_tokens: n };
  }

  private reasoning(): { reasoning_effort: 'low' | 'medium' | 'high' } | {} {
    return this.reasoningEffort ? { reasoning_effort: this.reasoningEffort } : {};
  }

  async generateChallenge(topic?: string, difficulty: DifficultyLevel = 'Medium'): Promise<Challenge> {
    const difficultyMapping: Record<DifficultyLevel, string> = {
      'Easy': 'Junior',
      'Medium': 'Mid',
      'Hard': 'Senior'
    };
    const targetDifficulty = difficultyMapping[difficulty];

    const prompt = topic
      ? `Generate a ${difficulty.toUpperCase()} difficulty system design interview question about: ${topic}. Make it interesting, realistic, and practical.`
      : `Generate a ${difficulty.toUpperCase()} difficulty system design interview question. Choose a creative and interesting topic appropriate for this difficulty level.`;

    const systemInstruction = `You are a Principal Software Engineer creating system design interview questions.

DIFFICULTY: ${difficulty.toUpperCase()} → difficulty field MUST be "${targetDifficulty}"

EASY (Junior): Simple 2-3 component architecture, basic CRUD. 2-4 requirements.
MEDIUM (Mid): Thousands of users, load balancing, caching. 4-6 requirements.
HARD (Senior): Millions of users, distributed systems, fault tolerance. 6-10 requirements.

Return a JSON object with exactly these fields:
- title: short challenge title
- description: 1-2 sentence problem description
- requirements: array of functional requirement strings
- constraints: array of technical constraint strings
- difficulty: must be "${targetDifficulty}"`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        response_format: jsonSchema('challenge', CHALLENGE_SCHEMA),
        ...this.tokenLimit(2048),
        ...this.reasoning()
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from OpenAI");
      return JSON.parse(content) as Challenge;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async generateHints(challenge: Challenge): Promise<HintResult> {
    const prompt = `I am solving this System Design challenge:
TITLE: ${challenge.title}
DESCRIPTION: ${challenge.description}
REQUIREMENTS: ${challenge.requirements.join(', ')}
CONSTRAINTS: ${challenge.constraints.join(', ')}

Provide a starter kit with:
1. Essential components to drag onto the canvas (layer, component name, reason)
2. A 2-3 sentence high-level architecture strategy
3. 2-3 key technical gotchas or considerations (include cost optimization)`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: "You are a helpful mentor guiding a student through system design. Include cost-conscious recommendations." },
          { role: 'user', content: prompt }
        ],
        response_format: jsonSchema('hints', HINT_SCHEMA),
        ...this.tokenLimit(2048),
        ...this.reasoning()
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from OpenAI");
      return JSON.parse(content) as HintResult;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async evaluateDesign(
    challenge: Challenge,
    components: SystemComponent[],
    connections: Connection[]
  ): Promise<EvaluationResult> {
    const designJson = JSON.stringify({
      components: components.map(c => ({
        id: c.id,
        layer: c.type,
        subType: c.subType || 'Generic',
        tool: c.tool || c.customLabel || 'Not specified',
        label: c.label
      })),
      connections: connections.map(c => ({
        from: c.sourceId,
        to: c.targetId,
        label: c.label || 'connects_to'
      }))
    }, null, 2);

    const difficultyGuidelines: Record<string, string> = {
      'Junior': 'EVALUATION LEVEL: JUNIOR/EASY - Focus ONLY on whether basic functional requirements are met. Generic component types are acceptable. Be encouraging.',
      'Mid': 'EVALUATION LEVEL: MID/MEDIUM - Evaluate against stated requirements and constraints. Expect reasonable component choices.',
      'Senior': 'EVALUATION LEVEL: SENIOR/HARD - Full critical review. Expect specific tool choices and production-ready thinking.',
      'Principal': 'EVALUATION LEVEL: PRINCIPAL/EXPERT - Strictest evaluation. Expect comprehensive production-ready design.'
    };

    const systemInstructions: Record<string, string> = {
      'Junior': "You are a supportive mentor reviewing a junior engineer's first system design. Be encouraging. Score on a scale of 0–100 (integers only).",
      'Mid': "You are a senior engineer reviewing a mid-level design. Balance criticism with recognition of good choices. Score on a scale of 0–100 (integers only).",
      'Senior': "You are a principal architect reviewing a senior engineer's design. Be thorough and critical. Score on a scale of 0–100 (integers only).",
      'Principal': "You are a distinguished engineer reviewing an expert-level design. Apply the highest standards. Score on a scale of 0–100 (integers only)."
    };

    const prompt = `Evaluate this system design for the following challenge:

CHALLENGE: ${challenge.title}
DESCRIPTION: ${challenge.description}
DIFFICULTY: ${challenge.difficulty}

REQUIREMENTS:
${challenge.requirements.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}

CONSTRAINTS:
${challenge.constraints.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}

USER DESIGN:
${designJson}

${difficultyGuidelines[challenge.difficulty] || difficultyGuidelines['Mid']}

Evaluate ONLY against the stated requirements and constraints. Do not penalise for things not asked for.
The score MUST be an integer between 0 and 100 (not 0–10).`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemInstructions[challenge.difficulty] || systemInstructions['Mid'] },
          { role: 'user', content: prompt }
        ],
        response_format: jsonSchema('evaluation', EVALUATION_SCHEMA),
        ...this.tokenLimit(4096),
        ...this.reasoning()
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from OpenAI");
      return JSON.parse(content) as EvaluationResult;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async generateSolution(challenge: Challenge, hints?: HintResult | null): Promise<SolutionResult> {
    const hintsContext = hints ? `
HINTS:
- Strategy: ${hints.architectureStrategy}
- Components: ${hints.suggestedComponents.map(c => `${c.layer}: ${c.component} (${c.reason})`).join('; ')}
- Considerations: ${hints.keyConsiderations.join('; ')}
` : '';

    const solutionGuidelines: Record<string, string> = {
      'Junior': 'JUNIOR: Simple, generic names (Database not PostgreSQL, Cache not Redis). 3-5 steps max. Basic data flow only.',
      'Mid': 'MID: Balanced. Specific tools optional. Include load balancing/caching if relevant. 5-7 steps.',
      'Senior': 'SENIOR: Production-ready. Specific tools (PostgreSQL, Redis, Kafka). Security, observability, scalability. 7-10 steps.',
      'Principal': 'PRINCIPAL: Enterprise-grade. Specific tools with justification. DR, multi-region, full observability. 8-12 steps.'
    };

    const graphRule = "CRITICAL GRAPH RULE: The solution must be a single connected graph. Step 1 must introduce a Start node (type='Start', id='start-node'). The final step must introduce an End node (type='End', id='end-node'). Every component across all steps must be reachable from start-node, and end-node must be reachable from every component. Each step must include connections that integrate its new components into the existing graph. No orphaned or disconnected components.";

    const systemInstructions: Record<string, string> = {
      'Junior': `You are a friendly mentor teaching system design basics. Use generic component names. Focus only on what was asked. Keep it simple. ${graphRule}`,
      'Mid': `You are a senior engineer creating a balanced solution. Use specific tools where helpful. Don't over-engineer. ${graphRule}`,
      'Senior': `You are a principal architect creating a production-ready solution. Use specific tools, include security/observability/scalability. ${graphRule}`,
      'Principal': `You are a distinguished engineer creating an enterprise-grade solution. Maximum detail, specific tools, comprehensive infrastructure. ${graphRule}`
    };

    const prompt = `Generate a step-by-step system design solution:

CHALLENGE: ${challenge.title}
DESCRIPTION: ${challenge.description}
DIFFICULTY: ${challenge.difficulty}

REQUIREMENTS (0-indexed):
${challenge.requirements.map((r, i) => `  ${i}: ${r}`).join('\n')}

CONSTRAINTS: ${challenge.constraints.join(', ')}
${hintsContext}
${solutionGuidelines[challenge.difficulty] || solutionGuidelines['Mid']}

MANDATORY STRUCTURE RULES:
1. Step 1 MUST contain a component with type='Start' and id='start-node'. No exceptions.
2. The final step MUST contain a component with type='End' and id='end-node'. No exceptions.
3. The entire solution MUST form a single connected graph. Every component must be reachable from 'start-node' and every component must have a path to 'end-node'. No isolated or disconnected components.
4. When a new step introduces components, it MUST include connections linking those components to components from previous steps, maintaining the single connected graph.
5. Component types MUST be one of: 'Clients & Entry', 'Traffic Management', 'Compute & App', 'Data Storage', 'Caching', 'Messaging & Streaming', 'File & Blob Storage', 'Content Delivery', 'Observability', 'Security', 'Reliability & FT', 'Scalability', 'Data Governance', 'DevOps & Ops', 'Config & State', 'Governance & Risk', 'Start', 'End'
6. All connection labels must be non-empty strings describing the data flow (e.g. 'HTTP request', 'query', 'publishes event').`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemInstructions[challenge.difficulty] || systemInstructions['Mid'] },
          { role: 'user', content: prompt }
        ],
        response_format: jsonSchema('solution', SOLUTION_SCHEMA),
        ...this.tokenLimit(8192),
        ...this.reasoning()
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from OpenAI");
      return JSON.parse(content) as SolutionResult;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async improveSolution(
    challenge: Challenge,
    currentComponents: SystemComponent[],
    currentConnections: Connection[],
    evaluation: EvaluationResult
  ): Promise<{
    improvementOverview: string;
    steps: any[];
    expectedScoreImprovement: number;
  }> {
    const designJson = JSON.stringify({
      components: currentComponents.map(c => ({ id: c.id, layer: c.type, tool: c.tool || c.label, label: c.label })),
      connections: currentConnections.map(c => ({ from: c.sourceId, to: c.targetId, label: c.label || '' }))
    }, null, 2);

    const prompt = `Improve this system design based on the evaluation:

CHALLENGE: ${challenge.title}
REQUIREMENTS: ${challenge.requirements.join(', ')}
CONSTRAINTS: ${challenge.constraints.join(', ')}

CURRENT DESIGN:
${designJson}

EVALUATION:
- Score: ${evaluation.score}/100
- Summary: ${evaluation.summary}
- Issues: ${evaluation.cons.join('; ')}
- Recommendations: ${evaluation.recommendations.join('; ')}
- Security: ${evaluation.securityConcerns.join('; ')}

Generate 2-4 improvement steps. Use 'imp-' prefix for new component IDs. Connection labels must be non-empty strings.
Component types MUST be one of: 'Clients & Entry', 'Traffic Management', 'Compute & App', 'Data Storage', 'Caching', 'Messaging & Streaming', 'File & Blob Storage', 'Content Delivery', 'Observability', 'Security', 'Reliability & FT', 'Scalability', 'Data Governance', 'DevOps & Ops', 'Config & State', 'Governance & Risk'`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: "You are a Principal Software Architect improving a system design. Focus on production-readiness, reliability, security, and scalability." },
          { role: 'user', content: prompt }
        ],
        response_format: jsonSchema('improvement', IMPROVEMENT_SCHEMA),
        ...this.tokenLimit(4096),
        ...this.reasoning()
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from OpenAI");

      const result = JSON.parse(content);
      return {
        improvementOverview: result.improvementOverview,
        expectedScoreImprovement: result.expectedScoreImprovement,
        steps: result.steps.map((step: any) => ({
          title: step.title,
          explanation: step.explanation,
          requirementsAddressed: [],
          components: step.components,
          connections: step.connections
        }))
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  createChatSession(systemPrompt: string): ChatSession {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    return {
      sendMessage: async (message: string) => {
        messages.push({ role: 'user', content: message });

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages
        });

        const assistantMessage = response.choices[0]?.message?.content || '';
        messages.push({ role: 'assistant', content: assistantMessage });
        return { text: assistantMessage };
      }
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_completion_tokens: 5
      });

      if (response.choices?.length > 0) {
        return { success: true, message: `Connection successful! Using model: ${this.model}` };
      }
      return { success: false, message: 'Unexpected response from OpenAI API' };
    } catch (error) {
      return { success: false, message: this.mapError(error).message };
    }
  }

  mapError(error: any): ProviderError {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || error?.status || error?.error?.code || 'UNKNOWN';

    if (errorMessage === 'NO_API_KEY' || errorCode === 'NO_API_KEY') {
      return { code: 'NO_API_KEY', message: 'OpenAI API key is required', originalError: error, isAuthError: true };
    }
    if (errorCode === 401 || errorCode === 'invalid_api_key' || errorMessage.includes('API key')) {
      return { code: 'INVALID_API_KEY', message: 'Invalid OpenAI API key', originalError: error, isAuthError: true };
    }
    if (errorCode === 429 || errorCode === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
      return { code: 'QUOTA_EXCEEDED', message: 'OpenAI API rate limit exceeded', originalError: error, isQuotaError: true };
    }
    if (errorCode === 503 || errorCode === 'service_unavailable' || errorMessage.includes('unavailable')) {
      return { code: 'SERVICE_UNAVAILABLE', message: 'OpenAI service temporarily unavailable', originalError: error, isNetworkError: true };
    }
    return { code: 'PROVIDER_ERROR', message: `OpenAI error: ${errorMessage}`, originalError: error };
  }
}

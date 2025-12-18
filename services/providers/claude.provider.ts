import Anthropic from '@anthropic-ai/sdk';
import { Challenge, EvaluationResult, SystemComponent, Connection, HintResult, SolutionResult } from "../../types";
import { DifficultyLevel } from "../gemini";
import { AIProvider, ChatSession, ProviderError } from "./ai-provider.interface";

export class ClaudeProvider implements AIProvider {
  readonly providerType = 'claude' as const;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-5-20250929') {
    if (!apiKey) {
      throw new Error('NO_API_KEY');
    }
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  private async generateWithTool<T>(
    systemPrompt: string,
    userPrompt: string,
    toolName: string,
    toolDescription: string,
    toolSchema: any,
    temperature: number = 0.7
  ): Promise<T> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [{
        name: toolName,
        description: toolDescription,
        input_schema: toolSchema
      }],
      tool_choice: { type: 'tool', name: toolName }
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUse) {
      throw new Error('No tool use in response');
    }

    return toolUse.input as T;
  }

  async generateChallenge(topic?: string, difficulty: DifficultyLevel = 'Medium'): Promise<Challenge> {
    const difficultyMapping: Record<DifficultyLevel, string> = {
      'Easy': 'Junior',
      'Medium': 'Mid',
      'Hard': 'Senior'
    };

    const prompt = topic
      ? `Generate a ${difficulty.toUpperCase()} difficulty system design interview question about: ${topic}. Make it interesting, realistic, and practical.`
      : `Generate a ${difficulty.toUpperCase()} difficulty system design interview question. Choose a creative and interesting topic appropriate for this difficulty level. Pick something realistic that people would actually want to build.`;

    const systemInstruction = `You are a Principal Software Engineer creating interesting and varied system design interview questions.

Choose creative, realistic topics that span different industries and use cases. Each question should feel fresh and practical.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

EASY (Junior): For beginners learning system design fundamentals.
- Scale: Single server or simple 2-3 component architecture
- Complexity: Basic CRUD operations, simple data flow
- Topic examples: Personal task manager, Recipe sharing app, Simple blog, etc.
- 2-4 simple requirements, basic constraints

MEDIUM (Mid): For mid-level engineers with some system design experience.
- Scale: Moderate - thousands of users, basic scaling needed
- Complexity: Load balancing, caching, background jobs
- Topic examples: Event ticketing system, Restaurant reservation platform, Job board, etc.
- 4-6 requirements covering both functional and basic non-functional needs

HARD (Senior): For senior/principal engineers.
- Scale: Enterprise/global - millions of users, high throughput
- Complexity: Distributed systems, consistency, fault tolerance, multi-region
- Topic examples: Payment processing, video streaming platform, search engine, etc.
- 6-10 comprehensive requirements including production concerns

The difficulty field in your response MUST be "${difficultyMapping[difficulty]}".`;

    try {
      return await this.generateWithTool<Challenge>(
        systemInstruction,
        prompt,
        'generate_challenge',
        'Generate a system design challenge',
        {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            requirements: { type: 'array', items: { type: 'string' } },
            constraints: { type: 'array', items: { type: 'string' } },
            difficulty: { type: 'string', enum: ['Junior', 'Mid', 'Senior', 'Principal'] }
          },
          required: ['title', 'description', 'requirements', 'constraints', 'difficulty']
        },
        0.8
      );
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async generateHints(challenge: Challenge): Promise<HintResult> {
    const prompt = `I am a candidate trying to solve this System Design challenge:
TITLE: ${challenge.title}
DESCRIPTION: ${challenge.description}
REQUIREMENTS: ${challenge.requirements.join(', ')}
CONSTRAINTS: ${challenge.constraints.join(', ')}

I am stuck and need a "Starter Kit" or hints to get going.

1. List the essential components I should probably drag onto the canvas to satisfy the requirements (e.g., Load Balancer, Cache, Database type, etc.).
2. Provide a 2-3 sentence high-level strategy on how to connect them (e.g., "Start with the client, put a load balancer in front of stateless services...").
3. List 2-3 key technical "gotchas" or considerations for this specific problem, INCLUDING cost optimization opportunities.`;

    try {
      return await this.generateWithTool<HintResult>(
        "You are a helpful mentor guiding a student. Do not give the full answer code, just architectural building blocks and high-level strategy. Include cost-conscious recommendations.",
        prompt,
        'generate_hints',
        'Generate hints for the system design challenge',
        {
          type: 'object',
          properties: {
            suggestedComponents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  layer: { type: 'string' },
                  component: { type: 'string' },
                  reason: { type: 'string' }
                },
                required: ['layer', 'component', 'reason']
              }
            },
            architectureStrategy: { type: 'string' },
            keyConsiderations: { type: 'array', items: { type: 'string' } }
          },
          required: ['suggestedComponents', 'architectureStrategy', 'keyConsiderations']
        }
      );
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
      'Senior': 'EVALUATION LEVEL: SENIOR/HARD - Full critical review expected. Expect specific tool choices and production-ready thinking.',
      'Principal': 'EVALUATION LEVEL: PRINCIPAL/EXPERT - Strictest evaluation. Expect comprehensive production-ready design with specific tools.'
    };

    const systemInstructions: Record<string, string> = {
      'Junior': "You are a supportive mentor reviewing a junior engineer's first system design. Focus on whether they understood the problem and got the basics right.",
      'Mid': "You are a senior engineer reviewing a mid-level design. Balance criticism with recognition of good choices.",
      'Senior': "You are a principal architect reviewing a senior engineer's design. Be thorough and critical.",
      'Principal': "You are a distinguished engineer reviewing an expert-level design. Apply the highest standards."
    };

    const prompt = `Evaluate this system design solution for the following challenge:

CHALLENGE: ${challenge.title}
DESCRIPTION: ${challenge.description}
DIFFICULTY: ${challenge.difficulty}

REQUIREMENTS (evaluate against THESE specifically):
${challenge.requirements.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}

CONSTRAINTS (evaluate against THESE specifically):
${challenge.constraints.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}

USER DESIGN (JSON Graph):
${designJson}

${difficultyGuidelines[challenge.difficulty] || difficultyGuidelines['Mid']}`;

    try {
      return await this.generateWithTool<EvaluationResult>(
        systemInstructions[challenge.difficulty] || systemInstructions['Mid'],
        prompt,
        'evaluate_design',
        'Evaluate the system design',
        {
          type: 'object',
          properties: {
            score: { type: 'number' },
            summary: { type: 'string' },
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            securityConcerns: { type: 'array', items: { type: 'string' } }
          },
          required: ['score', 'summary', 'pros', 'cons', 'recommendations', 'securityConcerns']
        },
        0.5
      );
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async generateSolution(challenge: Challenge, hints?: HintResult | null): Promise<SolutionResult> {
    const hintsContext = hints ? `
HINTS ALREADY PROVIDED (incorporate these into your solution):
- Architecture Strategy: ${hints.architectureStrategy}
- Suggested Components: ${hints.suggestedComponents.map(c => `${c.layer}: ${c.component} (${c.reason})`).join('; ')}
- Key Considerations: ${hints.keyConsiderations.join('; ')}
` : '';

    const solutionGuidelines: Record<string, string> = {
      'Junior': 'SOLUTION LEVEL: JUNIOR/EASY - Keep it SIMPLE! Use GENERAL/GENERIC component names (Database, Cache, API Server - NOT specific tools). 3-5 simple steps maximum.',
      'Mid': 'SOLUTION LEVEL: MID/MEDIUM - Balanced approach. Can use specific tools OR general names. 5-7 steps.',
      'Senior': 'SOLUTION LEVEL: SENIOR/HARD - Production-ready. Use SPECIFIC tool names (PostgreSQL, Redis, Kafka). Include security/observability/scalability. 7-10 detailed steps.',
      'Principal': 'SOLUTION LEVEL: PRINCIPAL/EXPERT - Enterprise-grade. Specific tools with justification, comprehensive infrastructure, trade-off analysis. 8-12 detailed steps.'
    };

    const systemInstructions: Record<string, string> = {
      'Junior': "You are a friendly mentor teaching system design basics. Create a SIMPLE solution using general component names. Focus only on what was asked.",
      'Mid': "You are a senior engineer creating a balanced solution. Use specific tools where it adds clarity. Don't over-engineer.",
      'Senior': "You are a principal architect creating a production-ready solution. Use specific tools, include security/observability/scalability.",
      'Principal': "You are a distinguished engineer creating an enterprise-grade solution. Maximum detail, specific tools, comprehensive infrastructure."
    };

    const prompt = `Generate a step-by-step system design solution for this challenge:

CHALLENGE: ${challenge.title}
DESCRIPTION: ${challenge.description}
DIFFICULTY: ${challenge.difficulty}

REQUIREMENTS (indexed from 0) - Address ONLY these:
${challenge.requirements.map((r, i) => `  ${i}: ${r}`).join('\n')}

CONSTRAINTS - Respect these:
${challenge.constraints.join(', ')}
${hintsContext}

${solutionGuidelines[challenge.difficulty] || solutionGuidelines['Mid']}

Component types MUST be one of: 'Clients & Entry', 'Traffic Management', 'Compute & App', 'Data Storage', 'Caching', 'Messaging & Streaming', 'File & Blob Storage', 'Content Delivery', 'Observability', 'Security', 'Reliability & FT', 'Scalability', 'Data Governance', 'DevOps & Ops', 'Config & State', 'Governance & Risk', 'Start', 'End'`;

    try {
      return await this.generateWithTool<SolutionResult>(
        systemInstructions[challenge.difficulty] || systemInstructions['Mid'],
        prompt,
        'generate_solution',
        'Generate a step-by-step solution',
        {
          type: 'object',
          properties: {
            architectureOverview: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  explanation: { type: 'string' },
                  requirementsAddressed: { type: 'array', items: { type: 'number' } },
                  components: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        type: { type: 'string' },
                        tool: { type: 'string' },
                        label: { type: 'string' }
                      },
                      required: ['id', 'type', 'tool', 'label']
                    }
                  },
                  connections: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sourceId: { type: 'string' },
                        targetId: { type: 'string' },
                        label: { type: 'string' },
                        type: { type: 'string' }
                      },
                      required: ['sourceId', 'targetId', 'type']
                    }
                  }
                },
                required: ['title', 'explanation', 'requirementsAddressed', 'components', 'connections']
              }
            },
            finalNotes: { type: 'string' }
          },
          required: ['architectureOverview', 'steps', 'finalNotes']
        }
      );
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
      components: currentComponents.map(c => ({
        id: c.id,
        layer: c.type,
        tool: c.tool || c.label,
        label: c.label
      })),
      connections: currentConnections.map(c => ({
        from: c.sourceId,
        to: c.targetId,
        label: c.label || ''
      }))
    }, null, 2);

    const prompt = `Improve this system design based on the evaluation feedback:

CHALLENGE: ${challenge.title}
REQUIREMENTS: ${challenge.requirements.join(', ')}
CONSTRAINTS: ${challenge.constraints.join(', ')}

CURRENT DESIGN:
${designJson}

EVALUATION RESULTS:
- Score: ${evaluation.score}/100
- Summary: ${evaluation.summary}
- Cons/Issues: ${evaluation.cons.join('; ')}
- Recommendations: ${evaluation.recommendations.join('; ')}
- Security Concerns: ${evaluation.securityConcerns.join('; ')}

Generate 2-4 improvement steps that address the most critical issues.
Use 'imp-' prefix for new component IDs (e.g., 'imp-cache-1').`;

    try {
      const result = await this.generateWithTool<any>(
        "You are a Principal Software Architect improving a system design. Focus on production-readiness, reliability, security, and scalability.",
        prompt,
        'improve_solution',
        'Generate improvements for the system design',
        {
          type: 'object',
          properties: {
            improvementOverview: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  explanation: { type: 'string' },
                  issueAddressed: { type: 'string' },
                  components: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        type: { type: 'string' },
                        tool: { type: 'string' },
                        label: { type: 'string' }
                      },
                      required: ['id', 'type', 'tool', 'label']
                    }
                  },
                  connections: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sourceId: { type: 'string' },
                        targetId: { type: 'string' },
                        label: { type: 'string' },
                        type: { type: 'string' }
                      },
                      required: ['sourceId', 'targetId', 'type']
                    }
                  }
                },
                required: ['title', 'explanation', 'issueAddressed', 'components', 'connections']
              }
            },
            expectedScoreImprovement: { type: 'number' }
          },
          required: ['improvementOverview', 'steps', 'expectedScoreImprovement']
        },
        0.6
      );

      return {
        improvementOverview: result.improvementOverview,
        steps: result.steps.map((step: any) => ({
          title: step.title,
          explanation: step.explanation,
          requirementsAddressed: [],
          components: step.components,
          connections: step.connections
        })),
        expectedScoreImprovement: result.expectedScoreImprovement
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  createChatSession(systemPrompt: string): ChatSession {
    const messages: Array<Anthropic.Messages.MessageParam> = [];

    return {
      sendMessage: async (message: string) => {
        messages.push({ role: 'user', content: message });

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 2048,
          temperature: 0.7,
          system: systemPrompt,
          messages: messages
        });

        const textContent = response.content.find(
          (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
        );

        const assistantMessage = textContent?.text || '';
        messages.push({ role: 'assistant', content: assistantMessage });

        return { text: assistantMessage };
      }
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Make a simple test request to verify the API key works
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say "Connection successful" if you can read this.' }]
      });

      if (response.content && response.content.length > 0) {
        return {
          success: true,
          message: 'Connection successful! Anthropic API key is valid.'
        };
      }

      return {
        success: false,
        message: 'Unexpected response from Anthropic API'
      };
    } catch (error) {
      const mappedError = this.mapError(error);
      return {
        success: false,
        message: mappedError.message
      };
    }
  }

  mapError(error: any): ProviderError {
    const errorMessage = error?.message || String(error);
    const errorType = error?.error?.type || error?.type || 'unknown';
    const errorCode = error?.status || error?.error?.error?.code || 'UNKNOWN';

    if (errorMessage === 'NO_API_KEY' || errorCode === 'NO_API_KEY') {
      return {
        code: 'NO_API_KEY',
        message: 'Anthropic API key is required',
        originalError: error,
        isAuthError: true
      };
    }

    if (errorCode === 401 || errorType === 'authentication_error' || errorMessage.includes('API key')) {
      return {
        code: 'INVALID_API_KEY',
        message: 'Invalid Anthropic API key',
        originalError: error,
        isAuthError: true
      };
    }

    if (errorCode === 429 || errorType === 'rate_limit_error' || errorMessage.includes('rate limit')) {
      return {
        code: 'QUOTA_EXCEEDED',
        message: 'Anthropic API rate limit exceeded',
        originalError: error,
        isQuotaError: true
      };
    }

    if (errorCode === 529 || errorType === 'overloaded_error' || errorMessage.includes('overloaded')) {
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Anthropic service temporarily overloaded',
        originalError: error,
        isNetworkError: true
      };
    }

    return {
      code: 'PROVIDER_ERROR',
      message: `Claude error: ${errorMessage}`,
      originalError: error
    };
  }
}

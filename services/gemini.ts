import { GoogleGenAI, Type, Schema, Chat } from "@google/genai";
import { Challenge, EvaluationResult, SystemComponent, Connection, HintResult, SolutionResult, SolutionStep } from "../types";
import { decryptApiKey } from "../utils/crypto";

// Get API key from runtime config (Docker) or build-time env (development)
const getAppApiKey = (): string => {
  // First try runtime config (Docker production)
  if (typeof window !== 'undefined' && (window as any).ENV?.GEMINI_API_KEY) {
    return (window as any).ENV.GEMINI_API_KEY;
  }
  // Fallback to build-time env (local development)
  return process.env.API_KEY || '';
};

// Get user's API key from localStorage (used by AI Tutor)
export const getUserApiKey = (): string | null => {
  try {
    const storedKey = localStorage.getItem('gemini_user_api_key');
    if (storedKey) {
      return decryptApiKey(storedKey);
    }
  } catch (e) {
    console.error("Failed to get user API key:", e);
  }
  return null;
};

// Check if we have any working API key (app or user)
export const hasAnyApiKey = (): boolean => {
  return !!(getAppApiKey() || getUserApiKey());
};

// Get the best available API key (prefer user key, fallback to app key)
const getApiKey = (): string => {
  const userKey = getUserApiKey();
  if (userKey) return userKey;
  return getAppApiKey() || '';
};

// Create a Gemini client with a specific API key
const createClient = (customApiKey?: string): GoogleGenAI => {
  const key = customApiKey || getApiKey();
  if (!key) {
    throw new Error('NO_API_KEY');
  }
  return new GoogleGenAI({ apiKey: key });
};

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    requirements: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    constraints: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    difficulty: { type: Type.STRING, enum: ['Junior', 'Mid', 'Senior', 'Principal'] }
  },
  required: ['title', 'description', 'requirements', 'constraints', 'difficulty']
};

const evaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: "Score out of 100" },
    summary: { type: Type.STRING },
    pros: { type: Type.ARRAY, items: { type: Type.STRING } },
    cons: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    securityConcerns: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['score', 'summary', 'pros', 'cons', 'recommendations', 'securityConcerns']
};

const hintSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    suggestedComponents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          layer: { type: Type.STRING, description: "The general layer name (e.g. Data Storage)" },
          component: { type: Type.STRING, description: "Specific component (e.g. Relational DB)" },
          reason: { type: Type.STRING, description: "Why this component is needed for this challenge" }
        }
      }
    },
    architectureStrategy: { type: Type.STRING, description: "A high-level paragraph on how to approach the design." },
    keyConsiderations: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['suggestedComponents', 'architectureStrategy', 'keyConsiderations']
};

const solutionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    architectureOverview: {
      type: Type.STRING,
      description: "High-level overview of the solution architecture (2-3 paragraphs)"
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short title for this step (e.g., 'Setting Up the Data Layer')" },
          explanation: { type: Type.STRING, description: "Detailed explanation of what we're adding and why (2-3 sentences)" },
          requirementsAddressed: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Array of requirement indices (0-based) that this step addresses"
          },
          components: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique ID for this component (e.g., 'db-1', 'cache-1')" },
                type: { type: Type.STRING, description: "Must be one of: 'Clients & Entry', 'Traffic Management', 'Compute & App', 'Data Storage', 'Caching', 'Messaging & Streaming', 'File & Blob Storage', 'Content Delivery', 'Observability', 'Security', 'Reliability & FT', 'Scalability', 'Data Governance', 'DevOps & Ops', 'Config & State', 'Governance & Risk'" },
                tool: { type: Type.STRING, description: "Specific tool name (e.g., 'PostgreSQL', 'Redis', 'Nginx', 'Kafka')" },
                label: { type: Type.STRING, description: "Display label for this component" }
              },
              required: ['id', 'type', 'tool', 'label']
            }
          },
          connections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sourceId: { type: Type.STRING, description: "ID of the source component" },
                targetId: { type: Type.STRING, description: "ID of the target component" },
                label: { type: Type.STRING, description: "Connection label (e.g., 'queries', 'publishes to')" },
                type: { type: Type.STRING, enum: ['directed', 'undirected'], description: "Connection type" }
              },
              required: ['sourceId', 'targetId', 'type']
            }
          }
        },
        required: ['title', 'explanation', 'requirementsAddressed', 'components', 'connections']
      }
    },
    finalNotes: {
      type: Type.STRING,
      description: "Summary notes, trade-offs considered, and suggestions for further improvement"
    }
  },
  required: ['architectureOverview', 'steps', 'finalNotes']
};

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export const generateChallenge = async (topic?: string, difficulty: DifficultyLevel = 'Medium'): Promise<Challenge> => {
  // Create a fresh client each time to pick up any newly added user API key
  const client = createClient();

  const difficultyMapping: Record<DifficultyLevel, string> = {
    'Easy': 'Junior',
    'Medium': 'Mid',
    'Hard': 'Senior'
  };

  const prompt = topic
    ? `Generate a ${difficulty.toUpperCase()} difficulty system design interview question about: ${topic}. Make it interesting, realistic, and practical.`
    : `Generate a ${difficulty.toUpperCase()} difficulty system design interview question. Choose a creative and interesting topic appropriate for this difficulty level. Pick something realistic that people would actually want to build.`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: challengeSchema,
        systemInstruction: `You are a Principal Software Engineer creating interesting and varied system design interview questions.

Choose creative, realistic topics that span different industries and use cases. Each question should feel fresh and practical.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

EASY (Junior): For beginners learning system design fundamentals.
- Scale: Single server or simple 2-3 component architecture
- Complexity: Basic CRUD operations, simple data flow
- Topic examples (choose varied topics like these):
  * Personal task manager with reminders
  * Recipe sharing app with search
  * Simple blog with comments
  * Bookmark manager with tags
  * Weather dashboard with favorites
  * Book reading tracker with progress
  * Expense tracker with categories
  * Contact manager with notes
  * Simple poll/voting system
  * Habit tracker with streaks
- 2-4 simple requirements, basic constraints

MEDIUM (Mid): For mid-level engineers with some system design experience.
- Scale: Moderate - thousands of users, basic scaling needed
- Complexity: Load balancing, caching, background jobs
- Topic examples (choose varied topics like these):
  * Event ticketing system with seat selection
  * Restaurant reservation platform
  * Collaborative document editor (lightweight)
  * Job board with search and filters
  * Social media feed with follows
  * E-learning platform with video streaming
  * Ride-sharing app (simplified)
  * Food delivery tracking system
  * Multiplayer game leaderboard
  * Real-time chat application
  * Appointment scheduling system
  * File sharing with permissions
- 4-6 requirements covering both functional and basic non-functional needs

HARD (Senior): For senior/principal engineers.
- Scale: Enterprise/global - millions of users, high throughput
- Complexity: Distributed systems, consistency, fault tolerance, multi-region
- Topic examples: Payment processing, video streaming platform, search engine, distributed file system, real-time analytics, global messaging platform
- 6-10 comprehensive requirements including production concerns

GUIDELINES:
- **Be creative** - Rotate between different industries: social, productivity, entertainment, business, education, health, travel, finance, gaming, etc.
- **Make it practical** - Choose topics that feel like real products people would use
- **Vary the domain** - Don't repeat similar topics back-to-back
- **Appropriate complexity** - Match the scale and requirements to the difficulty level

The difficulty field in your response MUST be "${difficultyMapping[difficulty]}".`
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Challenge;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini Challenge Error:", error);
    throw error; // Re-throw so the UI can handle it
  }
};

export const generateHints = async (challenge: Challenge): Promise<HintResult> => {
  const client = createClient();
  try {
    const prompt = `
      I am a candidate trying to solve this System Design challenge:
      TITLE: ${challenge.title}
      DESCRIPTION: ${challenge.description}
      REQUIREMENTS: ${challenge.requirements.join(', ')}
      CONSTRAINTS: ${challenge.constraints.join(', ')}

      I am stuck and need a "Starter Kit" or hints to get going.

      1. List the essential components I should probably drag onto the canvas to satisfy the requirements (e.g., Load Balancer, Cache, Database type, etc.).
      2. Provide a 2-3 sentence high-level strategy on how to connect them (e.g., "Start with the client, put a load balancer in front of stateless services...").
      3. List 2-3 key technical "gotchas" or considerations for this specific problem, INCLUDING cost optimization opportunities.

      Return the response in JSON format.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: hintSchema,
        systemInstruction: "You are a helpful mentor guiding a student. Do not give the full answer code, just architectural building blocks and high-level strategy. Include cost-conscious recommendations - mention when cheaper alternatives exist or when cost optimization techniques (caching, CDN, etc.) should be considered."
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as HintResult;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini Hint Error:", error);
    throw error;
  }
};

export const evaluateDesign = async (
  challenge: Challenge,
  components: SystemComponent[],
  connections: Connection[]
): Promise<EvaluationResult> => {
  const client = createClient();
  try {
    // Construct a textual representation of the graph
    // We now include subType and tool to give the AI context about specific choices
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

    // Difficulty-aware evaluation guidelines
    const difficultyGuidelines: Record<string, string> = {
      'Junior': `
        EVALUATION LEVEL: JUNIOR/EASY
        - Focus ONLY on whether the basic functional requirements are met
        - Generic component types (e.g., "Database", "Cache", "API") are PERFECTLY ACCEPTABLE - do NOT criticize for lack of specific tools
        - The design should show understanding of basic client-server architecture
        - Do NOT expect or penalize for missing: security layers, CDN, observability, DevOps, scalability patterns
        - Score generously if they got the basic data flow correct
        - EXTRA CREDIT (mention in pros, don't penalize if missing): any security, caching, or error handling they included`,
      'Mid': `
        EVALUATION LEVEL: MID/MEDIUM
        - Evaluate against the stated requirements and constraints
        - Expect reasonable component choices but specific tools are optional
        - Should show understanding of load balancing and basic caching
        - Only criticize missing security/scalability IF it was mentioned in requirements
        - EXTRA CREDIT: specific tool choices, observability, advanced patterns`,
      'Senior': `
        EVALUATION LEVEL: SENIOR/HARD
        - Full critical review expected - this is enterprise-level
        - Expect specific tool choices and justification
        - Should address all requirements plus implicit production concerns
        - Criticize missing security, scalability, observability for production systems
        - High bar for architecture decisions and trade-off analysis`,
      'Principal': `
        EVALUATION LEVEL: PRINCIPAL/EXPERT
        - Strictest evaluation - expect comprehensive production-ready design
        - Must have specific tools, security, observability, disaster recovery
        - Should demonstrate deep understanding of trade-offs
        - Criticize any gaps in production readiness`
    };

    const evalGuideline = difficultyGuidelines[challenge.difficulty] || difficultyGuidelines['Mid'];

    const prompt = `
      Evaluate this system design solution for the following challenge:

      CHALLENGE: ${challenge.title}
      DESCRIPTION: ${challenge.description}
      DIFFICULTY: ${challenge.difficulty}

      REQUIREMENTS (evaluate against THESE specifically):
      ${challenge.requirements.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}

      CONSTRAINTS (evaluate against THESE specifically):
      ${challenge.constraints.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}

      USER DESIGN (JSON Graph):
      ${designJson}

      ${evalGuideline}

      CRITICAL EVALUATION RULES:
      1. **ONLY evaluate against the stated requirements and constraints above**
      2. **Do NOT penalize for missing things that were NOT asked for** (e.g., if security wasn't in requirements, don't mark down for no security)
      3. **Give EXTRA CREDIT in pros** for anything beyond requirements (security, monitoring, etc.) but never penalize for their absence unless required
      4. **Primary question: Did they solve what was asked?** Score based on this.
      5. For Junior level: Be encouraging, focus on what they got right, suggest improvements gently
      6. For Senior/Principal: Be thorough and critical, expect production-ready thinking

      Check each requirement - was it addressed? Check each constraint - was it respected?
    `;

    const systemInstructions: Record<string, string> = {
      'Junior': "You are a supportive mentor reviewing a junior engineer's first system design. Focus on whether they understood the problem and got the basics right. Be encouraging but point out any fundamental misunderstandings. Generic components are fine at this level.",
      'Mid': "You are a senior engineer reviewing a mid-level design. Balance criticism with recognition of good choices. Focus on the requirements asked.",
      'Senior': "You are a principal architect reviewing a senior engineer's design. Be thorough and critical. Expect production-ready thinking and specific technical choices.",
      'Principal': "You are a distinguished engineer reviewing an expert-level design. Apply the highest standards. Every architectural decision should be justified."
    };

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evaluationSchema,
        systemInstruction: systemInstructions[challenge.difficulty] || systemInstructions['Mid']
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as EvaluationResult;
    }
    throw new Error("No response text from Gemini");

  } catch (error) {
    console.error("Gemini Evaluation Error:", error);
    throw error;
  }
};

// Create a chat session for the AI Tutor using a custom API key
export const createTutorChat = (apiKey: string, systemInstruction: string): Chat => {
  const client = new GoogleGenAI({ apiKey });
  return client.chats.create({
    model: 'gemini-2.5-flash',
    config: { systemInstruction }
  });
};

// Generate a complete step-by-step solution for the challenge
export const generateSolution = async (
  challenge: Challenge,
  hints?: HintResult | null
): Promise<SolutionResult> => {
  const client = createClient();
  try {
    const hintsContext = hints ? `
      HINTS ALREADY PROVIDED (incorporate these into your solution):
      - Architecture Strategy: ${hints.architectureStrategy}
      - Suggested Components: ${hints.suggestedComponents.map(c => `${c.layer}: ${c.component} (${c.reason})`).join('; ')}
      - Key Considerations: ${hints.keyConsiderations.join('; ')}
    ` : '';

    // Difficulty-specific solution guidelines
    const solutionGuidelines: Record<string, string> = {
      'Junior': `
        SOLUTION LEVEL: JUNIOR/EASY - Keep it SIMPLE!

        RULES FOR JUNIOR SOLUTIONS:
        - Use GENERAL/GENERIC component names, NOT specific tools
          - Use "Database" not "PostgreSQL"
          - Use "Cache" not "Redis"
          - Use "API Server" not "Express.js"
          - Use "Load Balancer" not "Nginx"
          - Use "Web Client" not "React App"
        - ONLY include components needed to satisfy the stated requirements
        - Do NOT add security, CDN, observability, or DevOps unless explicitly required
        - Keep to 3-5 simple steps maximum
        - Focus on the basic data flow: Client → Server → Database
        - This is for learning fundamentals, not production architecture`,

      'Mid': `
        SOLUTION LEVEL: MID/MEDIUM - Balanced approach

        RULES FOR MID SOLUTIONS:
        - Can use specific tools OR general names depending on context
        - Include basic scalability (load balancer) if scale is mentioned in constraints
        - Include caching if performance is mentioned
        - Only add security/observability if mentioned in requirements
        - 5-7 steps is appropriate
        - Show understanding of common patterns without over-engineering`,

      'Senior': `
        SOLUTION LEVEL: SENIOR/HARD - Production-ready

        RULES FOR SENIOR SOLUTIONS:
        - Use SPECIFIC tool names (PostgreSQL, Redis, Kafka, etc.)
        - Include comprehensive infrastructure:
          - Security: Auth, API Gateway, encryption
          - Scalability: Load balancers, auto-scaling, read replicas
          - Observability: Logging, metrics, tracing
          - Reliability: Health checks, circuit breakers
        - 7-10 detailed steps
        - Address both explicit and implicit production concerns
        - Include CDN for any user-facing content`,

      'Principal': `
        SOLUTION LEVEL: PRINCIPAL/EXPERT - Enterprise-grade

        RULES FOR PRINCIPAL SOLUTIONS:
        - Specific tools with justification for choices
        - Full production stack including disaster recovery
        - Multi-region considerations if scale warrants
        - Comprehensive security posture
        - Full observability stack
        - 8-12 detailed steps with trade-off analysis`
    };

    const guideline = solutionGuidelines[challenge.difficulty] || solutionGuidelines['Mid'];

    const prompt = `
      Generate a step-by-step system design solution for this challenge:

      CHALLENGE: ${challenge.title}
      DESCRIPTION: ${challenge.description}
      DIFFICULTY: ${challenge.difficulty}

      REQUIREMENTS (indexed from 0) - Address ONLY these:
      ${challenge.requirements.map((r, i) => `  ${i}: ${r}`).join('\n')}

      CONSTRAINTS - Respect these:
      ${challenge.constraints.join(', ')}
      ${hintsContext}

      ${guideline}

      SOLUTION STRUCTURE:
      1. Architecture overview (brief for Junior, detailed for Senior)
      2. Step-by-step component additions
      3. Each step: title, explanation, requirements addressed, components, connections
      4. Final notes

      COMPONENT RULES:
      - Component types MUST be one of: 'Clients & Entry', 'Traffic Management', 'Compute & App', 'Data Storage', 'Caching', 'Messaging & Streaming', 'File & Blob Storage', 'Content Delivery', 'Observability', 'Security', 'Reliability & FT', 'Scalability', 'Data Governance', 'DevOps & Ops', 'Config & State', 'Governance & Risk', 'Start', 'End'
      - Component IDs: simple and unique (e.g., 'client-1', 'api-1', 'db-1')
      - Connections can only reference components from CURRENT or PREVIOUS steps
      - ALWAYS start with a 'Start' node (type: 'Start', tool: 'Entry Point', label: 'Start')
      - ALWAYS end with an 'End' node (type: 'End', tool: 'Exit Point', label: 'End')
      - Make sure EVERY requirement is addressed by at least one step
    `;

    const systemInstructions: Record<string, string> = {
      'Junior': "You are a friendly mentor teaching system design basics. Create a SIMPLE solution using general component names (Database, Cache, API Server - NOT specific tools). Focus only on what was asked. Keep it to 3-5 steps. This is for learning fundamentals.",
      'Mid': "You are a senior engineer creating a balanced solution. Use specific tools where it adds clarity. Include standard patterns but don't over-engineer. Focus on the requirements.",
      'Senior': "You are a principal architect creating a production-ready solution. Use specific tools, include security/observability/scalability. Be thorough and explain trade-offs.",
      'Principal': "You are a distinguished engineer creating an enterprise-grade solution. Maximum detail, specific tools, comprehensive infrastructure, trade-off analysis for every decision."
    };

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: solutionSchema,
        systemInstruction: systemInstructions[challenge.difficulty] || systemInstructions['Mid']
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SolutionResult;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini Solution Error:", error);
    throw error;
  }
};

// Schema for improvement steps
const improvementSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    improvementOverview: {
      type: Type.STRING,
      description: "Summary of what improvements are being made and why"
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short title for this improvement (e.g., 'Adding High Availability')" },
          explanation: { type: Type.STRING, description: "Detailed explanation of what we're improving and why" },
          issueAddressed: { type: Type.STRING, description: "Which issue from the evaluation this addresses" },
          components: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                tool: { type: Type.STRING },
                label: { type: Type.STRING }
              },
              required: ['id', 'type', 'tool', 'label']
            }
          },
          connections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sourceId: { type: Type.STRING },
                targetId: { type: Type.STRING },
                label: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['directed', 'undirected'] }
              },
              required: ['sourceId', 'targetId', 'type']
            }
          }
        },
        required: ['title', 'explanation', 'issueAddressed', 'components', 'connections']
      }
    },
    expectedScoreImprovement: {
      type: Type.NUMBER,
      description: "Expected score after improvements (0-100)"
    }
  },
  required: ['improvementOverview', 'steps', 'expectedScoreImprovement']
};

export interface ImprovementResult {
  improvementOverview: string;
  steps: SolutionStep[];
  expectedScoreImprovement: number;
}

// Generate improvements based on evaluation feedback
export const improveSolution = async (
  challenge: Challenge,
  currentComponents: SystemComponent[],
  currentConnections: Connection[],
  evaluation: EvaluationResult
): Promise<ImprovementResult> => {
  const client = createClient();
  try {
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

    const prompt = `
      Improve this system design based on the evaluation feedback:

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
      Each step should add NEW components or connections to fix specific problems.

      IMPORTANT:
      - Focus on the most impactful improvements first
      - Use SPECIFIC tool names
      - Component types MUST be one of: 'Clients & Entry', 'Traffic Management', 'Compute & App', 'Data Storage', 'Caching', 'Messaging & Streaming', 'File & Blob Storage', 'Content Delivery', 'Observability', 'Security', 'Reliability & FT', 'Scalability', 'Data Governance', 'DevOps & Ops', 'Config & State', 'Governance & Risk'
      - New component IDs should be unique (use 'imp-' prefix, e.g., 'imp-cache-1', 'imp-replica-1')
      - Connections can reference existing component IDs from the current design OR new components
      - Address security concerns, single points of failure, and scalability issues
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: improvementSchema,
        systemInstruction: "You are a Principal Software Architect reviewing and improving a system design. Focus on production-readiness, reliability, security, and scalability. Be specific about what needs to be added and why."
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      // Map the improvement steps to SolutionStep format
      return {
        improvementOverview: result.improvementOverview,
        steps: result.steps.map((step: any) => ({
          title: step.title,
          explanation: step.explanation,
          requirementsAddressed: [], // Improvements address issues, not requirements directly
          components: step.components,
          connections: step.connections
        })),
        expectedScoreImprovement: result.expectedScoreImprovement
      };
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini Improvement Error:", error);
    throw error;
  }
};
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Challenge, EvaluationResult, SystemComponent, Connection, HintResult } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const generateChallenge = async (topic?: string): Promise<Challenge> => {
  try {
    const prompt = topic 
      ? `Generate a system design interview challenge about: ${topic}. Focus on modern distributed systems.`
      : "Generate a random, modern system design interview challenge (e.g., social media, ride-sharing, e-commerce, streaming, fintech).";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: challengeSchema,
        systemInstruction: "You are a Principal Software Engineer at a FAANG company designing interview questions. Be specific about scale (DAU, RPM) and latency requirements."
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Challenge;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini Challenge Error:", error);
    // Fallback challenge if API fails
    return {
      title: "Design a URL Shortener",
      description: "Design a scalable URL shortening service like bit.ly.",
      requirements: ["Functional: Shorten URL, Redirect", "Non-functional: High availability, low latency"],
      constraints: ["100M new URLs per month", "100:1 read/write ratio"],
      difficulty: "Junior"
    };
  }
};

export const generateHints = async (challenge: Challenge): Promise<HintResult> => {
  try {
    const prompt = `
      I am a candidate trying to solve this System Design challenge:
      TITLE: ${challenge.title}
      DESCRIPTION: ${challenge.description}
      REQUIREMENTS: ${challenge.requirements.join(', ')}
      
      I am stuck and need a "Starter Kit" or hints to get going.
      
      1. List the essential components I should probably drag onto the canvas to satisfy the requirements (e.g., Load Balancer, Cache, Database type, etc.).
      2. Provide a 2-3 sentence high-level strategy on how to connect them (e.g., "Start with the client, put a load balancer in front of stateless services...").
      3. List 2-3 key technical "gotchas" or considerations for this specific problem.

      Return the response in JSON format.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: hintSchema,
        systemInstruction: "You are a helpful mentor guiding a student. Do not give the full answer code, just architectural building blocks and high-level strategy."
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

    const prompt = `
      Evaluate this system design (or flowchart) solution for the following challenge:
      
      CHALLENGE: ${challenge.title}
      DESCRIPTION: ${challenge.description}
      REQUIREMENTS: ${challenge.requirements.join(', ')}
      CONSTRAINTS: ${challenge.constraints.join(', ')}

      USER DESIGN (JSON Graph):
      ${designJson}

      The design components use a 16-layer classification system (e.g., 1. Clients, 4. Storage, 12. Scalability).
      
      Provide a critical architectural review. 
      If it is a High Level Design, analyze availability, scalability, latency, and consistency.
      If it is a Flowchart/Logic design, analyze the logic flow, edge cases, and error handling.
      
      Analyze the user's choice of specific tools (e.g., Redis vs Memcached, Postgres vs Mongo) if provided.
      Analyze for Single Points of Failure, Scalability bottlenecks, Security flaws, and Data consistency issues.
      
      Note: Users may use "Generic" layers or categories if they haven't selected specific tools. Criticize if specificity is required for the challenge level.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evaluationSchema,
        systemInstruction: "You are a harsh but fair System Architect reviewing a design. Focus on trade-offs, tool selection, and adherence to requirements."
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
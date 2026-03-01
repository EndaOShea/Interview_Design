import { Challenge, EvaluationResult, HintResult, SolutionResult, SystemComponent, Connection } from '../../types';
import { DifficultyLevel } from '../gemini';

export type ProviderType = 'gemini' | 'openai' | 'claude';
export type ReasoningLevel = 'minimal' | 'low' | 'medium' | 'high';

export interface ChatSession {
  sendMessage(message: string): Promise<{ text: string }>;
}

export interface ProviderError {
  code: string;
  message: string;
  originalError?: any;
  isAuthError?: boolean;
  isQuotaError?: boolean;
  isNetworkError?: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  costTier: 'free' | 'low' | 'medium' | 'high';
  supportsStructuredOutput: boolean;
}

export interface ProviderConfig {
  id: ProviderType;
  name: string;
  models: ModelConfig[];
  requiresApiKey: boolean;
}

export interface AIProvider {
  readonly providerType: ProviderType;

  generateChallenge(
    topic?: string,
    difficulty?: DifficultyLevel
  ): Promise<Challenge>;

  evaluateDesign(
    challenge: Challenge,
    components: SystemComponent[],
    connections: Connection[]
  ): Promise<EvaluationResult>;

  generateHints(challenge: Challenge): Promise<HintResult>;

  generateSolution(
    challenge: Challenge,
    hints?: HintResult | null
  ): Promise<SolutionResult>;

  improveSolution(
    challenge: Challenge,
    currentComponents: SystemComponent[],
    currentConnections: Connection[],
    evaluation: EvaluationResult
  ): Promise<{
    improvementOverview: string;
    steps: any[];
    expectedScoreImprovement: number;
  }>;

  createChatSession(systemPrompt: string): ChatSession;

  mapError(error: any): ProviderError;

  testConnection(): Promise<{ success: boolean; message: string }>;
}

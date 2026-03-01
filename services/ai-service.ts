import { Challenge, EvaluationResult, HintResult, SolutionResult, SystemComponent, Connection } from '../types';
import { DifficultyLevel } from './gemini';
import { AIProvider, ChatSession, ProviderType, ReasoningLevel } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { decryptApiKey } from '../utils/crypto';
import { getDefaultModel } from './provider-config';

export type { ReasoningLevel };

export interface StoredAIConfig {
  selectedProvider: ProviderType;
  selectedModel: string;
  reasoningLevel?: ReasoningLevel;
  fallbackProvider?: ProviderType;
  apiKeys: {
    gemini?: string;    // Encrypted
    openai?: string;    // Encrypted
    claude?: string;    // Encrypted
  };
}

const AI_CONFIG_KEY = 'ai_config';

// Get AI configuration from localStorage
function getStoredConfig(): StoredAIConfig | null {
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredAIConfig;
    }
  } catch (e) {
    console.error('Failed to load AI config:', e);
  }
  return null;
}

// App-level API keys are no longer used - users must provide their own keys
// This function is kept for backward compatibility but returns empty string
function getAppApiKey(provider: ProviderType): string {
  return '';
}

// Get user's API key for a specific provider from localStorage
async function getUserApiKey(provider: ProviderType): Promise<string | null> {
  try {
    const config = getStoredConfig();
    if (config && config.apiKeys[provider]) {
      return await decryptApiKey(config.apiKeys[provider]!);
    }
  } catch (e) {
    console.error(`Failed to get user API key for ${provider}:`, e);
  }
  return null;
}

// Get the API key for a provider (user-provided only)
async function getApiKey(provider: ProviderType): Promise<string> {
  const userKey = await getUserApiKey(provider);
  return userKey || '';
}

// Check if user has provided an API key for a provider (sync — checks presence only, no decrypt)
export function hasApiKey(provider?: ProviderType): boolean {
  const targetProvider = provider || getCurrentProvider();
  const config = getStoredConfig();
  return !!(config?.apiKeys[targetProvider]?.trim());
}

// Get current provider from config (defaults to Gemini for backward compatibility)
function getCurrentProvider(): ProviderType {
  const config = getStoredConfig();
  return config?.selectedProvider || 'gemini';
}

// Create provider instance based on type, API key, and model
function createProvider(provider: ProviderType, apiKey: string, model?: string, reasoningLevel?: ReasoningLevel): AIProvider {
  const config = getStoredConfig();
  const selectedModel = model || config?.selectedModel || getDefaultModel(provider);
  const selectedReasoning = reasoningLevel || config?.reasoningLevel || 'medium';

  switch (provider) {
    case 'gemini':
      return new GeminiProvider(apiKey, selectedModel);
    case 'openai':
      return new OpenAIProvider(apiKey, selectedModel, selectedReasoning);
    case 'claude':
      return new ClaudeProvider(apiKey, selectedModel);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Get or create the current provider instance
async function getProvider(): Promise<AIProvider> {
  const provider = getCurrentProvider();
  const apiKey = await getApiKey(provider);
  return createProvider(provider, apiKey);
}

// Execute an AI operation with automatic fallback to the configured fallback provider
async function executeWithFallback<T>(
  operation: (provider: AIProvider) => Promise<T>
): Promise<T> {
  try {
    return await operation(await getProvider());
  } catch (error) {
    const config = getStoredConfig();
    if (config?.fallbackProvider) {
      const fallbackKey = await getUserApiKey(config.fallbackProvider);
      if (fallbackKey) {
        const fallback = createProvider(config.fallbackProvider, fallbackKey);
        return await operation(fallback);
      }
    }
    throw error;
  }
}

// Public API - delegates to current provider

export async function generateChallenge(topic?: string, difficulty: DifficultyLevel = 'Medium'): Promise<Challenge> {
  return executeWithFallback(p => p.generateChallenge(topic, difficulty));
}

export async function evaluateDesign(
  challenge: Challenge,
  components: SystemComponent[],
  connections: Connection[]
): Promise<EvaluationResult> {
  return executeWithFallback(p => p.evaluateDesign(challenge, components, connections));
}

export async function generateHints(challenge: Challenge): Promise<HintResult> {
  return executeWithFallback(p => p.generateHints(challenge));
}

export async function generateSolution(
  challenge: Challenge,
  hints?: HintResult | null
): Promise<SolutionResult> {
  return executeWithFallback(p => p.generateSolution(challenge, hints));
}

export async function improveSolution(
  challenge: Challenge,
  currentComponents: SystemComponent[],
  currentConnections: Connection[],
  evaluation: EvaluationResult
): Promise<{
  improvementOverview: string;
  steps: any[];
  expectedScoreImprovement: number;
}> {
  return executeWithFallback(p => p.improveSolution(challenge, currentComponents, currentConnections, evaluation));
}

export async function createTutorChat(apiKeyParam: string, systemPrompt: string): Promise<ChatSession> {
  // For tutor chat, we use the provider based on current config
  const providerType = getCurrentProvider();
  // Use provided key or get from storage
  const apiKey = apiKeyParam || await getApiKey(providerType);
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }
  const provider = createProvider(providerType, apiKey);
  return provider.createChatSession(systemPrompt);
}

// Helper to get user API key (used by AI Tutor component)
export async function getUserApiKey_Legacy(): Promise<string | null> {
  const provider = getCurrentProvider();
  return getUserApiKey(provider);
}

// Helper to check if any API key exists (app or user)
export function hasAnyApiKey(): boolean {
  const provider = getCurrentProvider();
  return hasApiKey(provider);
}

// Test connection for a specific provider with an API key
export async function testConnection(
  providerType: ProviderType,
  apiKey?: string,
  model?: string,
  reasoningLevel?: ReasoningLevel
): Promise<{ success: boolean; message: string }> {
  // If no API key is provided, use the stored one
  const keyToTest = apiKey || await getApiKey(providerType);

  if (!keyToTest) {
    return {
      success: false,
      message: 'No API key provided for testing'
    };
  }

  try {
    const providerInstance = createProvider(providerType, keyToTest, model, reasoningLevel);
    return await providerInstance.testConnection();
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Failed to test connection'
    };
  }
}

// Export for backward compatibility and future use
export { getCurrentProvider, getStoredConfig };

import { Challenge, EvaluationResult, HintResult, SolutionResult, SystemComponent, Connection } from '../types';
import { DifficultyLevel } from './gemini';
import { AIProvider, ChatSession, ProviderType } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { decryptApiKey } from '../utils/crypto';
import { getDefaultModel } from './provider-config';

export interface StoredAIConfig {
  selectedProvider: ProviderType;
  selectedModel: string;
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
function getUserApiKey(provider: ProviderType): string | null {
  try {
    const config = getStoredConfig();
    if (config && config.apiKeys[provider]) {
      return decryptApiKey(config.apiKeys[provider]!);
    }

    // Fallback to legacy Gemini key if provider is Gemini
    if (provider === 'gemini') {
      const legacyKey = localStorage.getItem('gemini_user_api_key');
      if (legacyKey) {
        return decryptApiKey(legacyKey);
      }
    }
  } catch (e) {
    console.error(`Failed to get user API key for ${provider}:`, e);
  }
  return null;
}

// Get the API key for a provider (user-provided only)
function getApiKey(provider: ProviderType): string {
  const userKey = getUserApiKey(provider);
  return userKey || '';
}

// Check if user has provided an API key for a provider
export function hasApiKey(provider?: ProviderType): boolean {
  const targetProvider = provider || getCurrentProvider();
  const userKey = getUserApiKey(targetProvider);
  return !!userKey;
}

// Get current provider from config (defaults to Gemini for backward compatibility)
function getCurrentProvider(): ProviderType {
  const config = getStoredConfig();
  return config?.selectedProvider || 'gemini';
}

// Create provider instance based on type, API key, and model
function createProvider(provider: ProviderType, apiKey: string, model?: string): AIProvider {
  const config = getStoredConfig();
  const selectedModel = model || config?.selectedModel || getDefaultModel(provider);

  switch (provider) {
    case 'gemini':
      return new GeminiProvider(apiKey, selectedModel);
    case 'openai':
      return new OpenAIProvider(apiKey, selectedModel);
    case 'claude':
      return new ClaudeProvider(apiKey, selectedModel);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Get or create the current provider instance
function getProvider(): AIProvider {
  const provider = getCurrentProvider();
  const apiKey = getApiKey(provider);
  return createProvider(provider, apiKey);
}

// Public API - delegates to current provider

export async function generateChallenge(topic?: string, difficulty: DifficultyLevel = 'Medium'): Promise<Challenge> {
  const provider = getProvider();
  return provider.generateChallenge(topic, difficulty);
}

export async function evaluateDesign(
  challenge: Challenge,
  components: SystemComponent[],
  connections: Connection[]
): Promise<EvaluationResult> {
  const provider = getProvider();
  return provider.evaluateDesign(challenge, components, connections);
}

export async function generateHints(challenge: Challenge): Promise<HintResult> {
  const provider = getProvider();
  return provider.generateHints(challenge);
}

export async function generateSolution(
  challenge: Challenge,
  hints?: HintResult | null
): Promise<SolutionResult> {
  const provider = getProvider();
  return provider.generateSolution(challenge, hints);
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
  const provider = getProvider();
  return provider.improveSolution(challenge, currentComponents, currentConnections, evaluation);
}

export function createTutorChat(apiKeyParam: string, systemPrompt: string): ChatSession {
  // For tutor chat, we use the provider based on current config
  const providerType = getCurrentProvider();
  // Use provided key or get from storage
  const apiKey = apiKeyParam || getApiKey(providerType);
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }
  const provider = createProvider(providerType, apiKey);
  return provider.createChatSession(systemPrompt);
}

// Helper to get user API key (used by AI Tutor component)
export function getUserApiKey_Legacy(): string | null {
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
  apiKey?: string
): Promise<{ success: boolean; message: string }> {
  // If no API key is provided, use the stored one
  const keyToTest = apiKey || getApiKey(providerType);

  if (!keyToTest) {
    return {
      success: false,
      message: 'No API key provided for testing'
    };
  }

  try {
    const providerInstance = createProvider(providerType, keyToTest);
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

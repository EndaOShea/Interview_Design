import { ProviderConfig, ProviderType } from './providers/ai-provider.interface';

export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    requiresApiKey: true,
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        contextWindow: 1000000,
        costTier: 'free',
        supportsStructuredOutput: true
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1000000,
        costTier: 'free',
        supportsStructuredOutput: true
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2000000,
        costTier: 'low',
        supportsStructuredOutput: true
      }
    ]
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    models: [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        costTier: 'medium',
        supportsStructuredOutput: true
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        contextWindow: 8192,
        costTier: 'high',
        supportsStructuredOutput: true
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        contextWindow: 16385,
        costTier: 'low',
        supportsStructuredOutput: true
      },
      {
        id: 'o1',
        name: 'O1',
        contextWindow: 200000,
        costTier: 'high',
        supportsStructuredOutput: false
      },
      {
        id: 'o1-mini',
        name: 'O1 Mini',
        contextWindow: 128000,
        costTier: 'medium',
        supportsStructuredOutput: false
      }
    ]
  },

  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    requiresApiKey: true,
    models: [
      {
        id: 'claude-opus-4-5-20251101',
        name: 'Claude Opus 4.5',
        contextWindow: 200000,
        costTier: 'high',
        supportsStructuredOutput: true
      },
      {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4.5',
        contextWindow: 200000,
        costTier: 'medium',
        supportsStructuredOutput: true
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude Haiku 3.5',
        contextWindow: 200000,
        costTier: 'low',
        supportsStructuredOutput: true
      }
    ]
  }
};

export function getProviderConfig(providerId: ProviderType): ProviderConfig {
  return PROVIDER_CONFIGS[providerId];
}

export function getModelConfig(providerId: ProviderType, modelId: string) {
  const provider = PROVIDER_CONFIGS[providerId];
  return provider.models.find(m => m.id === modelId);
}

export function getDefaultModel(providerId: ProviderType): string {
  const provider = PROVIDER_CONFIGS[providerId];
  // Return the first free/low tier model as default
  const defaultModel = provider.models.find(m => m.costTier === 'free' || m.costTier === 'low');
  return defaultModel?.id || provider.models[0].id;
}

export const ALL_PROVIDERS = Object.values(PROVIDER_CONFIGS);

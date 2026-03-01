import { ProviderConfig, ProviderType } from './providers/ai-provider.interface';

export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    requiresApiKey: true,
    models: [
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash Preview',
        contextWindow: 1000000,
        costTier: 'free',
        supportsStructuredOutput: true
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        contextWindow: 1000000,
        costTier: 'free',
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
        id: 'gpt-5',
        name: 'GPT-5',
        contextWindow: 128000,
        costTier: 'high',
        supportsStructuredOutput: true
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        contextWindow: 128000,
        costTier: 'medium',
        supportsStructuredOutput: true
      },
      {
        id: 'gpt-5-nano',
        name: 'GPT-5 Nano',
        contextWindow: 128000,
        costTier: 'low',
        supportsStructuredOutput: true
      },
    ]
  },

  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    requiresApiKey: true,
    models: [
      {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        contextWindow: 200000,
        costTier: 'high',
        supportsStructuredOutput: true
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        contextWindow: 200000,
        costTier: 'medium',
        supportsStructuredOutput: true
      },
      {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
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

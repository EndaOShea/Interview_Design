import { decryptApiKey, encryptApiKey } from './crypto';

const LEGACY_KEY = 'gemini_user_api_key';
const AI_CONFIG_KEY = 'ai_config';
const MIGRATION_FLAG = 'ai_config_migrated';

export interface StoredAIConfig {
  selectedProvider: 'gemini' | 'openai' | 'claude';
  selectedModel: string;
  apiKeys: {
    gemini?: string;
    openai?: string;
    claude?: string;
  };
}

/**
 * Migrate from legacy gemini_user_api_key to new ai_config format
 * This runs once on app mount to ensure seamless upgrade for existing users
 */
export async function migrateToMultiProvider(): Promise<boolean> {
  try {
    // Check if already migrated
    const migrated = localStorage.getItem(MIGRATION_FLAG);
    if (migrated) {
      return false; // Already migrated
    }

    // Check if new config already exists
    const existingConfig = localStorage.getItem(AI_CONFIG_KEY);
    if (existingConfig) {
      // Mark as migrated and return
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return false;
    }

    // Check for legacy Gemini key
    const legacyKey = localStorage.getItem(LEGACY_KEY);
    if (!legacyKey) {
      // No legacy key, no migration needed
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return false;
    }

    // Decrypt legacy key
    const decryptedKey = await decryptApiKey(legacyKey);
    if (!decryptedKey) {
      console.error('Failed to decrypt legacy API key');
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return false;
    }

    // Create new config with Gemini as default provider
    const newConfig: StoredAIConfig = {
      selectedProvider: 'gemini',
      selectedModel: 'gemini-2.5-flash',
      apiKeys: {
        gemini: await encryptApiKey(decryptedKey)
      }
    };

    // Save new config
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(newConfig));

    // Mark as migrated (but keep legacy key for rollback safety)
    localStorage.setItem(MIGRATION_FLAG, 'true');

    console.log('Successfully migrated to multi-provider config');
    return true; // Migration performed
  } catch (error) {
    console.error('Migration failed:', error);
    localStorage.setItem(MIGRATION_FLAG, 'true'); // Mark as attempted to avoid retry loops
    return false;
  }
}

/**
 * Get current AI configuration from localStorage
 */
export function getAIConfig(): StoredAIConfig | null {
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

/**
 * Save AI configuration to localStorage
 */
export function saveAIConfig(config: StoredAIConfig): boolean {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Failed to save AI config:', e);
    return false;
  }
}

/**
 * Update API key for a specific provider
 */
export async function updateProviderKey(
  provider: 'gemini' | 'openai' | 'claude',
  apiKey: string
): Promise<boolean> {
  try {
    const config = getAIConfig() || {
      selectedProvider: provider,
      selectedModel: provider === 'gemini' ? 'gemini-2.5-flash' :
                     provider === 'openai' ? 'gpt-4-turbo' :
                     'claude-sonnet-4-5-20250929',
      apiKeys: {}
    };

    const encrypted = await encryptApiKey(apiKey);
    if (!encrypted) {
      return false;
    }

    config.apiKeys[provider] = encrypted;
    return saveAIConfig(config);
  } catch (e) {
    console.error(`Failed to update ${provider} key:`, e);
    return false;
  }
}

/**
 * Clear API key for a specific provider
 */
export function clearProviderKey(provider: 'gemini' | 'openai' | 'claude'): boolean {
  try {
    const config = getAIConfig();
    if (!config) return true; // Nothing to clear

    delete config.apiKeys[provider];
    return saveAIConfig(config);
  } catch (e) {
    console.error(`Failed to clear ${provider} key:`, e);
    return false;
  }
}

/**
 * Switch to a different provider/model
 */
export function switchProvider(
  provider: 'gemini' | 'openai' | 'claude',
  model: string
): boolean {
  try {
    const config = getAIConfig() || {
      selectedProvider: provider,
      selectedModel: model,
      apiKeys: {}
    };

    config.selectedProvider = provider;
    config.selectedModel = model;

    return saveAIConfig(config);
  } catch (e) {
    console.error('Failed to switch provider:', e);
    return false;
  }
}

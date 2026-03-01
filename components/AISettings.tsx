import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, AlertCircle, Key } from 'lucide-react';
import { ProviderType } from '../services/providers/ai-provider.interface';
import { PROVIDER_CONFIGS, getDefaultModel } from '../services/provider-config';
import { encryptApiKey, decryptApiKey } from '../utils/crypto';
import { StoredAIConfig, ReasoningLevel, testConnection } from '../services/ai-service';
import { trackProviderConfigured } from '../utils/analytics';

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const COST_TIER_COLORS = {
  free: 'bg-green-900/50 text-green-300 border-green-700',
  low: 'bg-blue-900/50 text-blue-300 border-blue-700',
  medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  high: 'bg-red-900/50 text-red-300 border-red-700'
};

const COST_TIER_LABELS = {
  free: 'Free',
  low: 'Low Cost',
  medium: 'Medium Cost',
  high: 'High Cost'
};

const AI_CONFIG_KEY = 'ai_config';

const AISettings: React.FC<AISettingsProps> = ({ isOpen, onClose, onSave }) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('medium');
  const [fallbackProvider, setFallbackProvider] = useState<ProviderType | ''>('');
  const [apiKeys, setApiKeys] = useState<Record<ProviderType, string>>({
    gemini: '',
    openai: '',
    claude: ''
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current configuration on mount
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const stored = localStorage.getItem(AI_CONFIG_KEY);
      if (stored) {
        const config: StoredAIConfig = JSON.parse(stored);
        setSelectedProvider(config.selectedProvider);
        const providerModels = PROVIDER_CONFIGS[config.selectedProvider]?.models || [];
        const modelValid = providerModels.some(m => m.id === config.selectedModel);
        setSelectedModel(modelValid ? config.selectedModel : getDefaultModel(config.selectedProvider));
        setReasoningLevel(config.reasoningLevel || 'medium');

        // Decrypt stored API keys
        const decryptedKeys: Record<ProviderType, string> = {
          gemini: config.apiKeys.gemini ? await decryptApiKey(config.apiKeys.gemini) : '',
          openai: config.apiKeys.openai ? await decryptApiKey(config.apiKeys.openai) : '',
          claude: config.apiKeys.claude ? await decryptApiKey(config.apiKeys.claude) : ''
        };
        setApiKeys(decryptedKeys);
        setFallbackProvider(config.fallbackProvider ?? '');
      } else {
        // Set default model for new users
        setSelectedModel(getDefaultModel('gemini'));
      }
      setHasChanges(false);
      setTestResult(null);
    } catch (e) {
      console.error('Failed to load AI config:', e);
    }
  };

  const handleProviderChange = (provider: ProviderType) => {
    setSelectedProvider(provider);
    const providerConfig = PROVIDER_CONFIGS[provider];
    if (providerConfig && providerConfig.models.length > 0) {
      const modelExists = providerConfig.models.some(m => m.id === selectedModel);
      if (!modelExists) {
        setSelectedModel(getDefaultModel(provider));
      }
    }
    setHasChanges(true);
    setTestResult(null);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    setHasChanges(true);
    setTestResult(null);
  };

  const handleApiKeyChange = (provider: ProviderType, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
    setHasChanges(true);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    const currentKey = apiKeys[selectedProvider];
    if (!currentKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key first' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    // Test the actual API connection
    const result = await testConnection(selectedProvider, currentKey, selectedModel, reasoningLevel);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSave = async () => {
    try {
      // Encrypt API keys before saving
      const encryptedKeys: Record<string, string> = {};
      for (const [provider, key] of Object.entries(apiKeys)) {
        if (key.trim()) {
          encryptedKeys[provider] = await encryptApiKey(key);
        }
      }

      const config: StoredAIConfig = {
        selectedProvider,
        selectedModel,
        reasoningLevel,
        fallbackProvider: fallbackProvider || undefined,
        apiKeys: encryptedKeys as any
      };

      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      setHasChanges(false);

      // Notify ProviderBadge and other listeners that config changed
      window.dispatchEvent(new Event('ai-config-updated'));

      // Track provider configuration
      trackProviderConfigured(selectedProvider);

      if (onSave) {
        onSave();
      }

      onClose();
    } catch (e) {
      console.error('Failed to save AI config:', e);
      setTestResult({ success: false, message: 'Failed to save configuration' });
    }
  };

  const handleClear = (provider: ProviderType) => {
    setApiKeys(prev => ({ ...prev, [provider]: '' }));
    setHasChanges(true);
    setTestResult(null);
  };

  if (!isOpen) return null;

  const currentProviderConfig = PROVIDER_CONFIGS[selectedProvider];
  const currentModelConfig = currentProviderConfig?.models.find(m => m.id === selectedModel);
  const configuredProviders = (Object.entries(apiKeys) as [ProviderType, string][])
    .filter(([, key]) => key.trim())
    .map(([id]) => id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">AI Provider Settings</h2>
            <p className="text-sm text-slate-400 mt-1">Configure your AI provider and models</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Welcome Banner for First-Time Users */}
          {!apiKeys[selectedProvider] && (
            <div className="p-4 bg-indigo-900/30 border border-indigo-500/50 rounded-lg">
              <h3 className="text-sm font-semibold text-indigo-300 mb-2">👋 Welcome to Systems Architect!</h3>
              <p className="text-xs text-slate-300">
                To get started, please select an AI provider and enter your API key below.
                Your key will be stored securely in your browser and never sent to our servers.
              </p>
            </div>
          )}

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">AI Provider</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(PROVIDER_CONFIGS).map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    selectedProvider === provider.id
                      ? 'border-indigo-500 bg-indigo-900/30'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-semibold text-white text-sm">{provider.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          {currentProviderConfig && (
            <div>
              <label className="block text-sm font-semibold text-white mb-3">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {currentProviderConfig.models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {COST_TIER_LABELS[model.costTier]}
                  </option>
                ))}
              </select>

              {/* Model Info */}
              {currentModelConfig && (
                <div className="mt-3 flex items-center gap-3">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${COST_TIER_COLORS[currentModelConfig.costTier]}`}>
                    {COST_TIER_LABELS[currentModelConfig.costTier]}
                  </span>
                  <span className="text-xs text-slate-400">
                    Context: {(currentModelConfig.contextWindow / 1000).toFixed(0)}K tokens
                  </span>
                  {currentModelConfig.supportsStructuredOutput && (
                    <span className="text-xs text-green-400">
                      ✓ Structured Output
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reasoning Level — only shown for OpenAI */}
          {selectedProvider === 'openai' && (
            <div>
              <label className="block text-sm font-semibold text-white mb-1">Thinking Level</label>
              <p className="text-xs text-slate-400 mb-3">Controls how much internal reasoning the model uses</p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { value: 'minimal', label: 'Minimal', desc: 'Fastest, no reasoning tokens' },
                  { value: 'low',     label: 'Low',     desc: 'Light reasoning, quick answers' },
                  { value: 'medium',  label: 'Medium',  desc: 'Balanced speed and depth' },
                  { value: 'high',    label: 'High',    desc: 'Deep multistep reasoning' },
                ] as { value: ReasoningLevel; label: string; desc: string }[]).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => { setReasoningLevel(value); setHasChanges(true); }}
                    title={desc}
                    className={`py-2 px-3 rounded-lg text-sm border transition-all ${
                      reasoningLevel === value
                        ? 'border-indigo-500 bg-indigo-900/30 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {reasoningLevel === 'minimal' && 'Optimized for maximum speed — few or no reasoning tokens.'}
                {reasoningLevel === 'low'     && 'Light reasoning with quick judgement — suitable for simple tasks.'}
                {reasoningLevel === 'medium'  && 'Balanced default — good mix of speed and depth for most tasks.'}
                {reasoningLevel === 'high'    && 'Deep multistep reasoning — best for complex planning and analysis.'}
              </p>
            </div>
          )}

          {/* Fallback Provider — only shown when 2+ keys configured */}
          {configuredProviders.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-white mb-1">Fallback Provider</label>
              <p className="text-xs text-slate-400 mb-3">Used automatically if the primary provider fails</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setFallbackProvider(''); setHasChanges(true); }}
                  className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                    fallbackProvider === ''
                      ? 'border-indigo-500 bg-indigo-900/30 text-white'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  None
                </button>
                {configuredProviders
                  .filter(p => p !== selectedProvider)
                  .map(p => (
                    <button
                      key={p}
                      onClick={() => { setFallbackProvider(p); setHasChanges(true); }}
                      className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                        fallbackProvider === p
                          ? 'border-indigo-500 bg-indigo-900/30 text-white'
                          : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {PROVIDER_CONFIGS[p].name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              API Key for {currentProviderConfig?.name}
            </label>
            <div className="space-y-3">
              <div className="relative">
                <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={apiKeys[selectedProvider]}
                  onChange={(e) => handleApiKeyChange(selectedProvider, e.target.value)}
                  placeholder={`Enter your ${currentProviderConfig?.name} API key...`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {apiKeys[selectedProvider] && (
                <button
                  onClick={() => handleClear(selectedProvider)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear this API key
                </button>
              )}

              {/* Test Connection Button */}
              <button
                onClick={handleTestConnection}
                disabled={!apiKeys[selectedProvider].trim() || isTesting}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Test Connection
                  </>
                )}
              </button>

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-green-900/30 border-green-700 text-green-300'
                    : 'bg-red-900/30 border-red-700 text-red-300'
                }`}>
                  {testResult.success ? (
                    <Check size={16} className="mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}
            </div>

            {/* API Key Help */}
            <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <p className="text-xs text-slate-400">
                Get your API key from:{' '}
                {selectedProvider === 'gemini' && (
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                    Google AI Studio
                  </a>
                )}
                {selectedProvider === 'openai' && (
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                    OpenAI Platform
                  </a>
                )}
                {selectedProvider === 'claude' && (
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                    Anthropic Console
                  </a>
                )}
              </p>
            </div>
          </div>

          {/* Other Provider Keys (Collapsible) */}
          <div className="pt-4 border-t border-slate-700">
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-white mb-3 flex items-center justify-between">
                <span>Configure Other Providers (Optional)</span>
                <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="space-y-4 mt-3">
                {Object.values(PROVIDER_CONFIGS)
                  .filter(p => p.id !== selectedProvider)
                  .map(provider => (
                    <div key={provider.id}>
                      <label className="block text-xs font-medium text-slate-400 mb-2">
                        {provider.name} API Key
                      </label>
                      <input
                        type="password"
                        value={apiKeys[provider.id]}
                        onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                        placeholder={`Optional: ${provider.name} API key`}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  ))}
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {hasChanges && <span className="text-amber-400">• Unsaved changes</span>}
            {!apiKeys[selectedProvider] && <span className="text-orange-400">• API key required to continue</span>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedProvider || !selectedModel || !apiKeys[selectedProvider]}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              title={!apiKeys[selectedProvider] ? 'Please enter an API key' : 'Save your settings'}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISettings;

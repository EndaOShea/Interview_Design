import React, { useState, useEffect } from 'react';
import { Settings, Zap } from 'lucide-react';
import { ProviderType } from '../services/providers/ai-provider.interface';
import { PROVIDER_CONFIGS, getModelConfig } from '../services/provider-config';
import { StoredAIConfig } from '../services/ai-service';

interface ProviderBadgeProps {
  onClick?: () => void;
}

const PROVIDER_COLORS: Record<ProviderType, { bg: string; text: string; border: string; hover: string }> = {
  gemini: {
    bg: 'bg-blue-900/30',
    text: 'text-blue-300',
    border: 'border-blue-700',
    hover: 'hover:bg-blue-900/50'
  },
  openai: {
    bg: 'bg-emerald-900/30',
    text: 'text-emerald-300',
    border: 'border-emerald-700',
    hover: 'hover:bg-emerald-900/50'
  },
  claude: {
    bg: 'bg-amber-900/30',
    text: 'text-amber-300',
    border: 'border-amber-700',
    hover: 'hover:bg-amber-900/50'
  }
};

const AI_CONFIG_KEY = 'ai_config';

const ProviderBadge: React.FC<ProviderBadgeProps> = ({ onClick }) => {
  const [provider, setProvider] = useState<ProviderType>('gemini');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [hasUserKey, setHasUserKey] = useState(false);

  useEffect(() => {
    loadConfig();

    // Listen for config changes (e.g., when settings are saved)
    const handleStorageChange = () => {
      loadConfig();
    };

    window.addEventListener('storage', handleStorageChange);

    // Custom event for same-tab updates
    window.addEventListener('ai-config-updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ai-config-updated', handleStorageChange);
    };
  }, []);

  const loadConfig = () => {
    try {
      const stored = localStorage.getItem(AI_CONFIG_KEY);
      if (stored) {
        const config: StoredAIConfig = JSON.parse(stored);
        setProvider(config.selectedProvider);
        setModel(config.selectedModel);
        setHasUserKey(!!config.apiKeys[config.selectedProvider]);
      } else {
        // Default to Gemini
        setProvider('gemini');
        setModel('gemini-2.5-flash');

        // Check for legacy Gemini key
        const legacyKey = localStorage.getItem('gemini_user_api_key');
        setHasUserKey(!!legacyKey);
      }
    } catch (e) {
      console.error('Failed to load AI config:', e);
    }
  };

  const providerConfig = PROVIDER_CONFIGS[provider];
  const modelConfig = getModelConfig(provider, model);
  const colors = PROVIDER_COLORS[provider];

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${colors.bg} ${colors.border} ${colors.hover} group`}
      title="Click to change AI provider settings"
    >
      {/* Provider Icon/Indicator */}
      <div className={`p-1 rounded ${colors.bg}`}>
        <Zap size={12} className={colors.text} />
      </div>

      {/* Provider & Model Name */}
      <div className="flex flex-col items-start">
        <span className={`text-[10px] font-semibold ${colors.text} leading-tight`}>
          {providerConfig?.name || 'Unknown'}
        </span>
        <span className="text-[9px] text-slate-400 leading-tight">
          {modelConfig?.name || model}
        </span>
      </div>

      {/* Settings Icon */}
      <Settings size={12} className="text-slate-500 group-hover:text-slate-300 transition-colors" />

      {/* User Key Indicator */}
      {hasUserKey && (
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Using your API key" />
      )}
    </button>
  );
};

export default ProviderBadge;

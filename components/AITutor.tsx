import React, { useState, useEffect, useRef } from 'react';
import { Challenge, HintResult, SystemComponent, Connection } from '../types';
import { createTutorChat, hasApiKey, getCurrentProvider, getStoredConfig } from '../services/ai-service';
import { ChatSession } from '../services/providers/ai-provider.interface';
import { PROVIDER_CONFIGS } from '../services/provider-config';
import { COMPONENT_SPECS } from '../constants';
import { MessageCircle, X, Send, Settings2, Bot, User, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface AITutorProps {
  challenge: Challenge | null;
  hints: HintResult | null;
  forceOpen?: boolean;
  apiKeyNeededMessage?: string | null;
  onApiKeyReady?: () => void;
  configVersion?: number;
  components?: SystemComponent[];
  connections?: Connection[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AITutor: React.FC<AITutorProps> = ({ challenge, hints, forceOpen, apiKeyNeededMessage, onApiKeyReady, configVersion, components = [], connections = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [hasConfiguredKey, setHasConfiguredKey] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle forceOpen prop
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Initialize Chat Session when Challenge/Hints change, or when API key is configured
  useEffect(() => {
    // Re-check API key whenever challenge, hints, or configVersion changes
    const keyPresent = hasApiKey();
    setHasConfiguredKey(keyPresent);

    if (!keyPresent) {
      setChatSession(null);
      return;
    }

    if (challenge && challenge.title) {
      // Generate Context about available tools
      const componentContext = Object.values(COMPONENT_SPECS).map(spec => {
        const subTypes = spec.subTypes?.map(s => `${s.label}`).join(', ');
        return `- ${spec.label}: ${spec.description}${subTypes ? ` (Includes: ${subTypes})` : ''}`;
      }).join('\n');

      const systemPrompt = `You are a focused system design coach. Be direct, brief, and actionable — like a trainer standing next to the user.

CHALLENGE: ${challenge?.title || 'N/A'}
Requirements: ${challenge?.requirements?.join('; ') || 'None'}
Constraints: ${challenge?.constraints?.join('; ') || 'None'}
${hints ? `\nArchitecture strategy: ${hints.architectureStrategy}` : ''}

AVAILABLE COMPONENTS (sidebar): ${componentContext}

RESPONSE RULES — follow these strictly:
1. Answer ONLY what was asked. Do not recap the challenge, summarise what they've done, or explain the full solution.
2. Each reply must be 1–3 sentences max unless the user explicitly asks for more detail.
3. If the canvas is empty or incomplete, tell the user exactly ONE next component to add and why — nothing more.
4. If the user asks about a specific component or decision, answer that question only.
5. Never give a full architecture walkthrough unprompted.
6. Refer to components by their sidebar names so the user can find them.
7. If the user is on the right track, confirm it in one sentence and give the next nudge.
8. Use plain language. No bullet-point essays. No preamble.`;

      (async () => {
        try {
          // createTutorChat uses the stored API key from multi-provider system
          const session = await createTutorChat('', systemPrompt);
          setChatSession(session);
          setMessages([{ role: 'model', text: `Ready. What's your first question, or just start building and ask me when you're stuck.` }]);
        } catch (error) {
          console.error("Failed to init chat", error);
          setHasConfiguredKey(false);
        }
      })();
    }
  }, [challenge, hints, configVersion]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const buildGraphContext = (): string => {
    if (components.length === 0) return '';

    const compLines = components
      .filter(c => !['Rectangle', 'Circle', 'Freehand', 'Text'].includes(c.type))
      .map(c => {
        const name = c.customLabel || c.label || c.type;
        const detail = c.tool ? ` (${c.tool})` : '';
        return `  • ${name}${detail} [${c.type}]`;
      });

    const connLines = connections.map(conn => {
      const src = components.find(c => c.id === conn.sourceId);
      const tgt = components.find(c => c.id === conn.targetId);
      const srcName = src ? (src.customLabel || src.label || src.type) : conn.sourceId;
      const tgtName = tgt ? (tgt.customLabel || tgt.label || tgt.type) : conn.targetId;
      const label = conn.label ? ` "${conn.label}"` : '';
      return `  • ${srcName} →${label} ${tgtName}`;
    });

    const parts = [`[Current canvas — ${components.length} component(s)]`];
    if (compLines.length) parts.push('Components:\n' + compLines.join('\n'));
    if (connLines.length) parts.push('Connections:\n' + connLines.join('\n'));
    return parts.join('\n') + '\n\n';
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatSession) return;

    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const graphContext = buildGraphContext();
      const fullMessage = graphContext ? `${graphContext}User question: ${userMsg}` : userMsg;
      const result = await chatSession.sendMessage(fullMessage);
      if (result.text) {
        setMessages(prev => [...prev, { role: 'model', text: result.text }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting. Please check your API Key." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-6 right-6 z-50 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 group"
        title="Open AI Tutor"
      >
        <Bot size={22} />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700">
          Need help?
        </span>
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-60 sm:w-80 flex flex-col overflow-hidden h-[500px] max-h-[80vh]">
        
        {/* Header */}
        <div className="p-3 bg-indigo-900/30 border-b border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Tutor</h3>
              <p className="text-[10px] text-indigo-300">
                {(() => {
                  const cfg = getStoredConfig();
                  const provider = cfg?.selectedProvider || 'gemini';
                  return `Powered by ${PROVIDER_CONFIGS[provider]?.name ?? 'AI'}`;
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {!hasConfiguredKey ? (
          <div className="flex-1 p-6 flex flex-col justify-center items-center bg-slate-900">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-indigo-900/50">
              <Settings2 size={24} className="text-indigo-400" />
            </div>
            <h4 className="text-white font-bold mb-2">API Key Required</h4>
            <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed max-w-xs">
              Please configure your AI provider and API key using the Settings button (⚙️) in the top bar.
            </p>
          </div>
        ) : (
          <>
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50 custom-scrollbar">
              {messages.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 opacity-50">
                    <MessageCircle size={32} />
                    <span className="text-xs">Start a conversation...</span>
                 </div>
              )}
              
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                    {msg.role === 'user' ? <User size={14} className="text-slate-300" /> : <Bot size={14} className="text-white" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-800 text-slate-200 rounded-tr-none'
                      : 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/20 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                   <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                      <Bot size={14} className="text-white" />
                   </div>
                   <div className="bg-indigo-900/40 border border-indigo-500/20 rounded-2xl rounded-tl-none px-4 py-3">
                      <Loader2 size={16} className="text-indigo-400 animate-spin" />
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-slate-900 border-t border-slate-800">
               <div className="flex gap-2">
                 <input
                   type="text"
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   onKeyDown={(e) => {
                     e.stopPropagation();
                     if (e.key === 'Enter') handleSendMessage();
                   }}
                   onClick={(e) => e.stopPropagation()}
                   placeholder={challenge ? "Ask about the design..." : "Generate a challenge first..."}
                   disabled={!challenge || isLoading}
                   className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                 />
                 <button
                   onClick={handleSendMessage}
                   disabled={!inputValue.trim() || !challenge || isLoading}
                   className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors"
                 >
                   <Send size={18} />
                 </button>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AITutor;
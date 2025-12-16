import React, { useState, useEffect, useRef } from 'react';
import { Challenge, HintResult } from '../types';
import { createTutorChat } from '../services/gemini';
import { COMPONENT_SPECS } from '../constants';
import { encryptApiKey, decryptApiKey } from '../utils/crypto';
import { Chat, GenerateContentResponse } from '@google/genai';
import { MessageCircle, X, Send, Settings, Key, Bot, User, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface AITutorProps {
  challenge: Challenge | null;
  hints: HintResult | null;
  forceOpen?: boolean;
  apiKeyNeededMessage?: string | null;
  onApiKeyReady?: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AITutor: React.FC<AITutorProps> = ({ challenge, hints, forceOpen, apiKeyNeededMessage, onApiKeyReady }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tempKey, setTempKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle forceOpen prop
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      if (!apiKey || apiKeyNeededMessage) {
        setShowSettings(true);
      }
    }
  }, [forceOpen, apiKey, apiKeyNeededMessage]);

  // Load API Key from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_user_api_key');
    if (storedKey) {
      try {
        const decrypted = decryptApiKey(storedKey);
        if (decrypted) {
          setApiKey(decrypted);
        } else {
          localStorage.removeItem('gemini_user_api_key');
          setShowSettings(true);
        }
      } catch (e) {
        console.error("Invalid key stored - clearing");
        localStorage.removeItem('gemini_user_api_key');
        setShowSettings(true);
      }
    } else {
      setShowSettings(true);
    }
  }, []);

  // Initialize Chat Session when Key or Challenge/Hints change
  useEffect(() => {
    if (apiKey && challenge) {
      // Generate Context about available tools
      const componentContext = Object.values(COMPONENT_SPECS).map(spec => {
        const subTypes = spec.subTypes?.map(s => `${s.label}`).join(', ');
        return `- ${spec.label}: ${spec.description}${subTypes ? ` (Includes: ${subTypes})` : ''}`;
      }).join('\n');

      const systemPrompt = `
        You are an expert System Design Tutor. Your goal is to help the user learn by guiding them through the current challenge.
        
        CURRENT CHALLENGE:
        Title: ${challenge.title}
        Description: ${challenge.description}
        Requirements: ${challenge.requirements.join('; ')}
        Constraints: ${challenge.constraints.join('; ')}
        
        ${hints ? `GENERATED HINTS CONTEXT:
        Strategy: ${hints.architectureStrategy}
        Recommended Components: ${hints.suggestedComponents.map(c => c.component).join(', ')}
        ` : ''}
        
        AVAILABLE TOOLBOX & UI CONTEXT:
        The user is working in a drag-and-drop editor with the following capabilities:
        
        1. **System Layers & Components** (Available in Sidebar):
        ${componentContext}
        
        2. **Logic & Flow Items**:
           - Start, End, Process, Decision, Data I/O, Loop, Timer, Event.
        
        3. **Bottom Toolbar Tools**:
           - Selection Tool (Move/Edit)
           - Connectors: Arrow (Directed), Line (Undirected), Loop (Self/Curved)
           - Annotations: Text, Rectangle, Circle
           - Pen (Freehand Drawing)
        
        4. **Customization**:
           - Users can create "Custom Tools" in the sidebar if a specific technology is missing from the presets.
           - Users can configure specific technologies (e.g., choosing "PostgreSQL" for a generic "Relational DB" node).

        GUIDELINES:
        1. Be helpful, encouraging, and Socratic. Don't just give the answer; ask leading questions.
        2. Keep answers concise (max 3-4 sentences) unless asked for details.
        3. If the user asks about specific technologies, explain trade-offs (e.g., SQL vs NoSQL).
        4. Focus on the requirements of the current challenge.
        5. When suggesting components, refer to the names listed in the Toolbox so the user can find them.
      `;

      try {
        const session = createTutorChat(apiKey, systemPrompt);
        setChatSession(session);
        setMessages([{ role: 'model', text: `Hi! I'm your System Design Tutor. I can help you with the "${challenge.title}" challenge. Where would you like to start?` }]);
      } catch (error) {
        console.error("Failed to init chat", error);
      }
    }
  }, [apiKey, challenge, hints]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSaveKey = () => {
    if (tempKey.trim()) {
      const encrypted = encryptApiKey(tempKey.trim());
      if (encrypted) {
        setApiKey(tempKey.trim());
        localStorage.setItem('gemini_user_api_key', encrypted);
        setTempKey('');
        setShowSettings(false);
        // Notify parent that API key is now available
        if (onApiKeyReady) {
          onApiKeyReady();
        }
      } else {
        console.error('Failed to encrypt API key');
      }
    }
  };

  const handleClearKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_user_api_key');
    setChatSession(null);
    setMessages([]);
    setShowSettings(true);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatSession) return;

    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result: GenerateContentResponse = await chatSession.sendMessage(userMsg);
      const text = result.text;
      if (text) {
        setMessages(prev => [...prev, { role: 'model', text }]);
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
              <p className="text-[10px] text-indigo-300">Powered by Gemini 2.5</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {showSettings || !apiKey ? (
          <div className="flex-1 p-6 flex flex-col justify-center items-center bg-slate-900">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${apiKeyNeededMessage ? 'bg-amber-900/50' : 'bg-slate-800'}`}>
              <Key size={24} className={apiKeyNeededMessage ? 'text-amber-400' : 'text-indigo-400'} />
            </div>
            <h4 className="text-white font-bold mb-2">
              {apiKeyNeededMessage ? 'API Key Required' : 'Setup Tutor API Key'}
            </h4>
            {apiKeyNeededMessage && (
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs text-amber-300 text-center leading-relaxed">
                  {apiKeyNeededMessage}
                </p>
              </div>
            )}
            <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">
              {apiKey
                ? "Your API key will be used for all AI features."
                : "Please provide your Google Gemini API Key. It will be stored locally in your browser."
              }
            </p>
            
            <div className="w-full space-y-3">
              <input
                type="password"
                placeholder="Paste API Key here..."
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSaveKey}
                disabled={!tempKey.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save & Start Chatting
              </button>
              
              {apiKey && (
                 <button
                  onClick={handleClearKey}
                  className="w-full py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear Saved Key
                </button>
              )}
              
              <div className="text-[10px] text-slate-600 text-center mt-4">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-indigo-400">Get an API Key</a>
              </div>
            </div>
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
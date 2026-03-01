import React, { useState, useEffect, useRef } from 'react';
import { Challenge, HintResult, SolutionResult, SystemComponent, Connection } from '../types';
import { createTutorChat, hasApiKey, getStoredConfig } from '../services/ai-service';
import { ChatSession } from '../services/providers/ai-provider.interface';
import { PROVIDER_CONFIGS } from '../services/provider-config';
import { COMPONENT_SPECS } from '../constants';
import {
  FileText, Bot, Lightbulb, Play, X, Send, Loader2, User, Settings2, Minus, Plus
} from 'lucide-react';
import SolutionPlayer from './SolutionPlayer';

export type HubPanel = 'requirements' | 'tutor' | 'hints' | 'solution' | null;

interface CanvasHubProps {
  challenge: Challenge | null;
  hintResult: HintResult | null;
  hasSolution: boolean;
  solution?: SolutionResult | null;
  solutionStep?: number;
  onSolutionStepChange?: (step: number) => void;
  onSolutionReset?: () => void;
  onSolutionComplete?: () => void;
  isSolutionEvaluating?: boolean;
  solutionEvaluationScore?: number | null;
  hasAppliedSolution?: boolean;
  configVersion?: number;
  components?: SystemComponent[];
  connections?: Connection[];
  requestOpenPanel?: { panel: HubPanel; version: number } | null;
}

// ── SVG sector helpers ────────────────────────────────────────────────────────

const toRad = (deg: number) => (deg * Math.PI) / 180;

const polarXY = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos(toRad(deg)),
  y: cy + r * Math.sin(toRad(deg)),
});

const sectorPath = (
  cx: number, cy: number, ri: number, ro: number,
  startDeg: number, endDeg: number
): string => {
  if (endDeg < startDeg) endDeg += 360;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const p1 = polarXY(cx, cy, ro, startDeg);
  const p2 = polarXY(cx, cy, ro, endDeg);
  const p3 = polarXY(cx, cy, ri, endDeg);
  const p4 = polarXY(cx, cy, ri, startDeg);
  return `M ${p1.x} ${p1.y} A ${ro} ${ro} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${ri} ${ri} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
};

// ── Sector definitions ────────────────────────────────────────────────────────

const CX = 65, CY = 65, RI = 22, RO = 58;
const ICON_R = (RI + RO) / 2;
const GAP = 4; // degrees gap between sectors

const SECTORS = [
  {
    id: 'requirements' as HubPanel,
    label: 'Brief',
    Icon: FileText,
    color: '#f97316',
    hoverColor: '#fb923c',
    startDeg: 225 + GAP / 2,
    endDeg:   315 - GAP / 2,
    iconAngle: 270,
  },
  {
    id: 'tutor' as HubPanel,
    label: 'Tutor',
    Icon: Bot,
    color: '#3b82f6',
    hoverColor: '#60a5fa',
    startDeg: 315 + GAP / 2,
    endDeg:   45  - GAP / 2,
    iconAngle: 0,
  },
  {
    id: 'hints' as HubPanel,
    label: 'Hints',
    Icon: Lightbulb,
    color: '#eab308',
    hoverColor: '#facc15',
    startDeg: 45  + GAP / 2,
    endDeg:   135 - GAP / 2,
    iconAngle: 90,
  },
  {
    id: 'solution' as HubPanel,
    label: 'Solve',
    Icon: Play,
    color: '#9333ea',
    hoverColor: '#a855f7',
    startDeg: 135 + GAP / 2,
    endDeg:   225 - GAP / 2,
    iconAngle: 180,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

const CanvasHub: React.FC<CanvasHubProps> = ({
  challenge,
  hintResult,
  hasSolution,
  solution = null,
  solutionStep = -1,
  onSolutionStepChange,
  onSolutionReset,
  onSolutionComplete,
  isSolutionEvaluating = false,
  solutionEvaluationScore = null,
  hasAppliedSolution = false,
  configVersion,
  components = [],
  connections = [],
  requestOpenPanel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<HubPanel>(null);
  const [hovered, setHovered] = useState<HubPanel>(null);
  const [fontSize, setFontSize] = useState(13);

  // AI Tutor state
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [hasConfiguredKey, setHasConfiguredKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Respond to external open requests (e.g. after hints are fetched)
  useEffect(() => {
    if (!requestOpenPanel) return;
    setIsOpen(true);
    setActivePanel(requestOpenPanel.panel);
  }, [requestOpenPanel?.version]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activePanel]);

  // Chat session init
  useEffect(() => {
    const keyPresent = hasApiKey();
    setHasConfiguredKey(keyPresent);
    if (!keyPresent || !challenge?.title) { setChatSession(null); return; }

    const componentContext = Object.values(COMPONENT_SPECS)
      .map(spec => {
        const subs = spec.subTypes?.map(s => s.label).join(', ');
        return `- ${spec.label}: ${spec.description}${subs ? ` (Includes: ${subs})` : ''}`;
      })
      .join('\n');

    const systemPrompt = `You are a focused system design coach. Be direct, brief, and actionable — like a trainer standing next to the user.

CHALLENGE: ${challenge.title}
Requirements: ${challenge.requirements.join('; ')}
Constraints: ${challenge.constraints.join('; ')}${hintResult ? `\nArchitecture strategy: ${hintResult.architectureStrategy}` : ''}

AVAILABLE COMPONENTS (sidebar): ${componentContext}

RESPONSE RULES — follow these strictly:
1. Answer ONLY what was asked. Do not recap the challenge or explain the full solution.
2. Each reply must be 1–3 sentences max unless the user explicitly asks for more detail.
3. If the canvas is empty or incomplete, tell the user exactly ONE next component to add and why — nothing more.
4. If the user asks about a specific component or decision, answer that question only.
5. Never give a full architecture walkthrough unprompted.
6. Refer to components by their sidebar names so the user can find them.
7. If the user is on the right track, confirm it in one sentence and give the next nudge.
8. Use plain language. No bullet-point essays. No preamble.`;

    (async () => {
      try {
        const session = await createTutorChat('', systemPrompt);
        setChatSession(session);
        setMessages([{ role: 'model', text: `Ready. What's your first question, or start building and ask when you're stuck.` }]);
      } catch { setHasConfiguredKey(false); }
    })();
  }, [challenge, hintResult, configVersion]);

  // Build graph context for each tutor message
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
      const sName = src ? (src.customLabel || src.label || src.type) : conn.sourceId;
      const tName = tgt ? (tgt.customLabel || tgt.label || tgt.type) : conn.targetId;
      const lbl = conn.label ? ` "${conn.label}"` : '';
      return `  • ${sName} →${lbl} ${tName}`;
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
      const ctx = buildGraphContext();
      const full = ctx ? `${ctx}User question: ${userMsg}` : userMsg;
      const result = await chatSession.sendMessage(full);
      if (result.text) setMessages(prev => [...prev, { role: 'model', text: result.text }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting. Please check your API key." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Which sectors are interactive
  const isEnabled = (id: HubPanel) => {
    if (id === 'requirements') return !!challenge;
    if (id === 'tutor')        return true;
    if (id === 'hints')        return !!hintResult;
    if (id === 'solution')     return hasSolution;
    return false;
  };

  const handleSectorClick = (id: HubPanel) => {
    if (!isEnabled(id)) return;
    setActivePanel(prev => (prev === id ? null : id));
  };

  // ── Panel content ───────────────────────────────────────────────────────────

  const renderPanelContent = () => {
    if (activePanel === 'requirements' && challenge) {
      return (
        <div className="space-y-4">
          <div className="pb-3 border-b border-slate-800">
            <p className="text-slate-300 leading-relaxed" style={{ fontSize }}>{challenge.description}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Requirements</h4>
            <ul className="space-y-1.5">
              {challenge.requirements.map((r, i) => (
                <li key={i} className="flex gap-2 text-slate-300 leading-relaxed" style={{ fontSize }}>
                  <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>{r}
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-3 border-t border-slate-800">
            <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2">Constraints</h4>
            <ul className="space-y-1.5">
              {challenge.constraints.map((c, i) => (
                <li key={i} className="flex gap-2 text-slate-300 leading-relaxed" style={{ fontSize }}>
                  <span className="text-orange-400 shrink-0">→</span>{c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    if (activePanel === 'tutor') {
      const cfg = getStoredConfig();
      const providerName = PROVIDER_CONFIGS[cfg?.selectedProvider || 'gemini']?.name ?? 'AI';
      return (
        <div className="flex flex-col h-full min-h-0">
          <p className="text-[10px] text-slate-500 mb-2 shrink-0">Powered by {providerName}</p>
          {!hasConfiguredKey ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-4">
              <Settings2 size={22} className="text-indigo-400" />
              <p className="text-xs text-slate-400">Configure your API key in Settings ⚙️ to use the tutor.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1 min-h-0">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                      {msg.role === 'user'
                        ? <User size={11} className="text-slate-300" />
                        : <Bot  size={11} className="text-white" />}
                    </div>
                    <div className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-slate-800 text-slate-200 rounded-tr-none'
                        : 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/20 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                      <Bot size={11} className="text-white" />
                    </div>
                    <div className="bg-indigo-900/40 border border-indigo-500/20 rounded-xl rounded-tl-none px-3 py-2">
                      <Loader2 size={12} className="text-indigo-400 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2 shrink-0">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleSendMessage(); }}
                  onClick={e => e.stopPropagation()}
                  placeholder={challenge ? 'Ask about your design…' : 'Generate a challenge first…'}
                  disabled={!challenge || isLoading}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || !challenge || isLoading}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    if (activePanel === 'hints' && hintResult) {
      return (
        <div className="space-y-4">
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3">
            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">Strategy</h4>
            <p className="text-slate-300 text-xs leading-relaxed">{hintResult.architectureStrategy}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Key Components</h4>
            <ul className="space-y-2">
              {hintResult.suggestedComponents.map((c, i) => (
                <li key={i} className="bg-slate-800/50 rounded-lg p-2.5">
                  <div className="font-semibold text-slate-200 text-xs">{c.component}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{c.layer}</div>
                  <div className="text-slate-400 text-xs mt-1 leading-relaxed">{c.reason}</div>
                </li>
              ))}
            </ul>
          </div>
          {hintResult.keyConsiderations.length > 0 && (
            <div className="pt-3 border-t border-slate-800">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Considerations</h4>
              <ul className="space-y-1.5">
                {hintResult.keyConsiderations.map((c, i) => (
                  <li key={i} className="flex gap-2 text-slate-300 text-xs leading-relaxed">
                    <span className="text-yellow-400 shrink-0">•</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (activePanel === 'solution' && solution) {
      return (
        <SolutionPlayer
          embedded
          isOpen={true}
          onClose={() => setActivePanel(null)}
          solution={solution}
          challenge={challenge}
          currentStep={solutionStep}
          onStepChange={onSolutionStepChange ?? (() => {})}
          onReset={onSolutionReset ?? (() => {})}
          onComplete={onSolutionComplete ?? (() => {})}
          isEvaluating={isSolutionEvaluating}
          evaluationScore={solutionEvaluationScore}
          hasAppliedSolution={hasAppliedSolution}
        />
      );
    }

    return null;
  };

  // Panel titles
  const PANEL_TITLES: Record<string, string> = {
    requirements: 'Requirements',
    tutor: 'AI Tutor',
    hints: 'Design Hints',
    solution: 'AI Solution',
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="absolute top-2 bottom-16 right-4 z-40 flex flex-col items-end justify-end">

      {/* Side panel */}
      {isOpen && activePanel && (
        <div
          className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl flex flex-col mb-3 flex-1 min-h-0"
          style={{ width: 300 }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 shrink-0">
            <h3
              className="text-xs font-bold uppercase tracking-wider truncate pr-2"
              style={{ color: SECTORS.find(s => s.id === activePanel)?.color ?? '#e2e8f0' }}
            >
              {PANEL_TITLES[activePanel] ?? ''}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {activePanel === 'requirements' && (
                <>
                  <button
                    onClick={() => setFontSize(s => Math.max(10, s - 1))}
                    className="text-slate-500 hover:text-white transition-colors p-0.5 rounded hover:bg-slate-700"
                    title="Decrease font size"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-[10px] text-slate-500 w-5 text-center">{fontSize}</span>
                  <button
                    onClick={() => setFontSize(s => Math.min(20, s + 1))}
                    className="text-slate-500 hover:text-white transition-colors p-0.5 rounded hover:bg-slate-700"
                    title="Increase font size"
                  >
                    <Plus size={12} />
                  </button>
                </>
              )}
              <button
                onClick={() => setActivePanel(null)}
                className="text-slate-500 hover:text-white transition-colors ml-1"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className={`flex-1 min-h-0 ${activePanel === 'tutor' || activePanel === 'solution' ? 'flex flex-col' : 'overflow-y-auto custom-scrollbar p-3.5'}`}>
            {renderPanelContent()}
          </div>
        </div>
      )}

      {/* Hub button — collapsed */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          title="Open panel"
          className="shrink-0 w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 shadow-xl flex items-center justify-center transition-all hover:scale-105"
        >
          <div className="grid grid-cols-2 gap-[5px]">
            <div className="w-2 h-2 rounded-sm bg-orange-400" />
            <div className="w-2 h-2 rounded-sm bg-blue-400" />
            <div className="w-2 h-2 rounded-sm bg-yellow-400" />
            <div className="w-2 h-2 rounded-sm bg-purple-500" />
          </div>
        </button>
      ) : (
        /* Hub — open (radial pie) */
        <svg
          width={130}
          height={130}
          viewBox="0 0 130 130"
          className="shrink-0 select-none drop-shadow-xl"
        >
          {SECTORS.map(s => {
            const enabled   = isEnabled(s.id);
            const isActive  = activePanel === s.id;
            const isHov     = hovered === s.id;
            const iconPos   = polarXY(CX, CY, ICON_R, s.iconAngle);

            // fill
            const fill = !enabled
              ? '#1e293b'
              : isActive
              ? s.hoverColor
              : isHov
              ? s.color
              : s.color + 'aa';

            return (
              <g key={s.id as string}>
                {/* Sector arc */}
                <path
                  d={sectorPath(CX, CY, RI, RO, s.startDeg, s.endDeg)}
                  fill={fill}
                  stroke="#000000"
                  strokeWidth={1.5}
                  style={{ cursor: enabled ? 'pointer' : 'default', transition: 'fill 0.12s' }}
                  onMouseEnter={() => enabled && setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleSectorClick(s.id)}
                />

                {/* Icon (foreignObject for Lucide) */}
                <foreignObject
                  x={iconPos.x - 9}
                  y={iconPos.y - 9}
                  width={18}
                  height={18}
                  style={{ pointerEvents: 'none', opacity: enabled ? 1 : 0.25 }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <s.Icon size={13} color="#fff" />
                  </div>
                </foreignObject>

              </g>
            );
          })}

          {/* Centre close button */}
          <circle
            cx={CX} cy={CY} r={RI - 2}
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onClick={() => { setIsOpen(false); setActivePanel(null); }}
          />
          <foreignObject x={CX - 10} y={CY - 10} width={20} height={20} style={{ pointerEvents: 'none' }}>
            <div className="w-full h-full flex items-center justify-center">
              <X size={14} color="#ef4444" strokeWidth={3.5} />
            </div>
          </foreignObject>
        </svg>
      )}
    </div>
  );
};

export default CanvasHub;

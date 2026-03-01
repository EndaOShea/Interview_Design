import React, { useState } from 'react';
import { Challenge } from '../types';
import { ChevronDown, ChevronUp, FileText, Maximize2, Minus, Plus, X } from 'lucide-react';

interface RequirementsPanelProps {
  challenge: Challenge | null;
  isExpanded?: boolean;
  onExpandChange?: (v: boolean) => void;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  Junior:    'bg-green-500/10 text-green-400 border-green-500/30',
  Mid:       'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Senior:    'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Principal: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const RequirementsPanel: React.FC<RequirementsPanelProps> = ({ challenge, isExpanded: expandedProp, onExpandChange, collapsed: collapsedProp, onCollapsedChange }) => {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);

  const isCollapsed = collapsedProp ?? localCollapsed;
  const setIsCollapsed = (v: boolean) => { onCollapsedChange ? onCollapsedChange(v) : setLocalCollapsed(v); };
  const [fontSize, setFontSize] = useState(13);
  const adjustFont = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFontSize(s => Math.min(18, Math.max(10, s + delta)));
  };

  const isExpanded = expandedProp ?? localExpanded;
  const setIsExpanded = (v: boolean) => { onExpandChange ? onExpandChange(v) : setLocalExpanded(v); };

  if (!challenge || !challenge.requirements || !challenge.constraints) {
    return null;
  }

  const diffStyle = DIFFICULTY_STYLES[challenge.difficulty] || DIFFICULTY_STYLES['Mid'];

  return (
    <>
      {/* ── Expanded modal ─────────────────────────────────────────────── */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-700">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wider border ${diffStyle}`}>
                    {challenge.difficulty}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white leading-snug">{challenge.title}</h2>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{challenge.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={e => adjustFont(-1, e)}
                  className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
                  title="Decrease font size"
                >
                  <Minus size={14} />
                </button>
                <span className="text-xs text-slate-500 w-6 text-center">{fontSize}</span>
                <button
                  onClick={e => adjustFont(1, e)}
                  className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
                  title="Increase font size"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-slate-500 hover:text-white transition-colors ml-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Functional Requirements
                </h3>
                <ul className="space-y-2">
                  {challenge.requirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-200 leading-relaxed" style={{ fontSize }}>
                      <span className="text-indigo-400 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Constraints
                </h3>
                <ul className="space-y-2">
                  {challenge.constraints.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-200 leading-relaxed" style={{ fontSize }}>
                      <span className="text-orange-400 font-bold shrink-0 mt-0.5">→</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Side panel ─────────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end">
        <div
          className={`bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-xl transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${
            isCollapsed ? 'w-40' : 'w-80 sm:w-96 h-[500px] max-h-[80vh]'
          }`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-2.5 bg-slate-800/50 cursor-pointer border-b border-transparent hover:border-slate-700 transition-colors"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <div className="flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Requirements
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {!isCollapsed && (
                <>
                  <button
                    className="text-slate-500 hover:text-white transition-colors"
                    onClick={e => adjustFont(-1, e)}
                    title="Decrease font size"
                  >
                    <Minus size={13} />
                  </button>
                  <button
                    className="text-slate-500 hover:text-white transition-colors"
                    onClick={e => adjustFont(1, e)}
                    title="Increase font size"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    className="text-slate-500 hover:text-indigo-400 transition-colors"
                    onClick={e => { e.stopPropagation(); setIsExpanded(true); }}
                    title="Expand"
                  >
                    <Maximize2 size={14} />
                  </button>
                </>
              )}
              <button className="text-slate-500 hover:text-white">
                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {/* Content */}
          {!isCollapsed && (
            <div
              className="flex-1 p-4 overflow-y-auto custom-scrollbar cursor-pointer group"
              onClick={() => setIsExpanded(true)}
              title="Click to expand"
            >
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  Functional
                </h4>
                <ul className="list-disc list-inside text-slate-300 space-y-1.5 marker:text-indigo-500" style={{ fontSize }}>
                  {challenge.requirements.map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  Constraints
                </h4>
                <ul className="list-disc list-inside text-slate-300 space-y-1.5 marker:text-orange-500" style={{ fontSize }}>
                  {challenge.constraints.map((c, i) => <li key={i} className="leading-relaxed">{c}</li>)}
                </ul>
              </div>

              <p className="text-[9px] text-slate-600 mt-3 text-center group-hover:text-slate-500 transition-colors">
                Click to expand
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RequirementsPanel;
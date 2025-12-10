import React from 'react';
import { Challenge } from '../types';
import { Sparkles, Play, RotateCcw, Lightbulb } from 'lucide-react';

interface TopBarProps {
  challenge: Challenge | null;
  onGenerateChallenge: () => void;
  onEvaluate: () => void;
  onGetHint: () => void;
  isGenerating: boolean;
  isEvaluating: boolean;
  isGettingHint: boolean;
  hasHints: boolean;
  onClear: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ 
  challenge, 
  onGenerateChallenge, 
  onEvaluate,
  onGetHint,
  isGenerating,
  isEvaluating,
  isGettingHint,
  hasHints,
  onClear
}) => {
  return (
    <div className="min-h-[4rem] border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between px-6 py-3 shrink-0 shadow-sm z-20 gap-4">
      
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={onGenerateChallenge}
          disabled={isGenerating}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
        >
          {isGenerating ? (
             <span className="animate-pulse">Thinking...</span>
          ) : (
            <>
              <Sparkles size={16} />
              New Challenge
            </>
          )}
        </button>

        {challenge && (
          <div className="flex flex-col justify-center ml-4 border-l border-slate-700 pl-4 flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-100">{challenge.title}</h2>
            <div className="flex items-start gap-2 text-xs text-slate-400 mt-1">
               <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0 mt-0.5
                 ${challenge.difficulty === 'Junior' ? 'bg-green-500/10 text-green-400' : 
                   challenge.difficulty === 'Mid' ? 'bg-yellow-500/10 text-yellow-400' :
                   challenge.difficulty === 'Senior' ? 'bg-orange-500/10 text-orange-400' :
                   'bg-red-500/10 text-red-400'
                 }`}>
                 {challenge.difficulty}
               </span>
               <span className="break-words leading-relaxed">{challenge.description}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button 
          onClick={onClear}
          className="px-3 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
          title="Clear Board"
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={onGetHint}
          disabled={isGettingHint || !challenge}
          className={`flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${hasHints 
              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/20' 
              : 'bg-slate-800 hover:bg-slate-700 text-yellow-400 border-slate-700'
            }`}
          title={hasHints ? "Show cached hints" : "Get AI Hints"}
        >
           {isGettingHint ? (
            <span className="animate-pulse">Asking...</span>
           ) : (
            <>
              <Lightbulb size={16} className={hasHints ? "fill-current" : ""} />
              <span className="hidden sm:inline">{hasHints ? 'Show Hints' : 'Hints'}</span>
            </>
           )}
        </button>

        <button
          onClick={onEvaluate}
          disabled={isEvaluating || !challenge}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
        >
          {isEvaluating ? 'Reviewing...' : (
            <>
              <Play size={16} />
              Evaluate Design
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TopBar;
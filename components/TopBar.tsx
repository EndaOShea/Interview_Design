import React from 'react';
import { Challenge } from '../types';
import { Sparkles, Play, RotateCcw, Lightbulb, Wand2, ChevronDown, LayoutGrid, RefreshCw } from 'lucide-react';
import { DifficultyLevel } from '../services/gemini';
import ProviderBadge from './ProviderBadge';

interface TopBarProps {
  challenge: Challenge | null;
  onGenerateChallenge: (difficulty: DifficultyLevel) => void;
  onEvaluate: () => void;
  onGetHint: () => void;
  onRegenHint: () => void;
  onAISolve: () => void;
  onRegenSolution: () => void;
  onAutoLayout: () => void;
  onOpenSettings: () => void;
  highlightSettings?: boolean;
  isGenerating: boolean;
  isEvaluating: boolean;
  isGettingHint: boolean;
  isGeneratingSolution: boolean;
  hasHints: boolean;
  hasSolution: boolean;
  onClear: () => void;
  selectedDifficulty: DifficultyLevel;
  onDifficultyChange: (difficulty: DifficultyLevel) => void;
  onExpandChallenge?: () => void;
}

const difficultyColors: Record<DifficultyLevel, string> = {
  Easy: 'bg-green-600 hover:bg-green-500',
  Medium: 'bg-yellow-600 hover:bg-yellow-500',
  Hard: 'bg-red-600 hover:bg-red-500'
};

const TopBar: React.FC<TopBarProps> = ({
  challenge,
  onGenerateChallenge,
  onEvaluate,
  onGetHint,
  onRegenHint,
  onAISolve,
  onRegenSolution,
  onAutoLayout,
  onOpenSettings,
  highlightSettings = false,
  isGenerating,
  isEvaluating,
  isGettingHint,
  isGeneratingSolution,
  hasHints,
  hasSolution,
  onClear,
  selectedDifficulty,
  onDifficultyChange,
  onExpandChallenge
}) => {
  const [showDifficultyMenu, setShowDifficultyMenu] = React.useState(false);
  return (
    <div className="min-h-[4rem] border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between px-6 py-3 shrink-0 shadow-sm z-20 gap-4">
      
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="flex">
            <button
              onClick={() => onGenerateChallenge(selectedDifficulty)}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-3 py-1.5 ${difficultyColors[selectedDifficulty]} text-white rounded-l-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
            >
              {isGenerating ? (
                <span className="animate-pulse">Thinking...</span>
              ) : (
                <>
                  <Sparkles size={13} />
                  New Challenge
                </>
              )}
            </button>
            <button
              onClick={() => setShowDifficultyMenu(!showDifficultyMenu)}
              disabled={isGenerating}
              className={`flex items-center px-1.5 py-1.5 ${difficultyColors[selectedDifficulty]} text-white rounded-r-md border-l border-white/20 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ChevronDown size={13} />
            </button>
          </div>
          {showDifficultyMenu && (
            <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 min-w-[112px]">
              {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    onDifficultyChange(level);
                    setShowDifficultyMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                    selectedDifficulty === level ? 'bg-slate-700' : ''
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    level === 'Easy' ? 'bg-green-500' :
                    level === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>

        {challenge && (
          <div
            className="flex flex-col justify-center ml-4 border-l border-slate-700 pl-4 flex-1 min-w-0 cursor-pointer group"
            onClick={onExpandChallenge}
            title="Click to expand challenge"
          >
            <h2 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">{challenge.title}</h2>
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
        <div className={highlightSettings ? 'animate-pulse ring-2 ring-indigo-500 rounded-lg' : ''}>
          <ProviderBadge onClick={onOpenSettings} />
        </div>

        <button
          onClick={onClear}
          className="px-2 py-1.5 text-slate-400 hover:text-white text-xs font-medium transition-colors"
          title="Clear Board"
        >
          <RotateCcw size={13} />
        </button>

        <button
          onClick={onAutoLayout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-md text-xs font-medium transition-colors"
          title="Auto-arrange components to avoid overlaps"
        >
          <LayoutGrid size={13} />
          <span className="hidden sm:inline">Auto-Layout</span>
        </button>

        <div className="flex items-center">
          <button
            onClick={onGetHint}
            disabled={isGettingHint || !challenge}
            className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${hasHints ? 'rounded-l-md border-r-0' : 'rounded-md'}
              ${hasHints
                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-yellow-400 border-slate-700'
              }`}
            title={hasHints ? "Show hints" : "Get AI Hints"}
          >
            {isGettingHint ? (
              <span className="animate-pulse">Asking...</span>
            ) : (
              <>
                <Lightbulb size={13} className={hasHints ? "fill-current" : ""} />
                <span className="hidden sm:inline">{hasHints ? 'Show Hints' : 'Hints'}</span>
              </>
            )}
          </button>
          {hasHints && (
            <button
              onClick={onRegenHint}
              disabled={isGettingHint || !challenge}
              className="flex items-center px-2 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/50 rounded-r-md hover:bg-yellow-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Regenerate hints with current model"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center">
          <button
            onClick={onAISolve}
            disabled={isGeneratingSolution || !challenge}
            className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${hasSolution ? 'rounded-l-md border-r-0' : 'rounded-md'}
              ${hasSolution
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/50 hover:bg-purple-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-purple-400 border-slate-700'
              }`}
            title={hasSolution ? "Show AI Solution" : "Generate AI Solution"}
          >
            {isGeneratingSolution ? (
              <span className="animate-pulse">Solving...</span>
            ) : (
              <>
                <Wand2 size={13} className={hasSolution ? "fill-current" : ""} />
                <span className="hidden sm:inline">{hasSolution ? 'Show Solution' : 'Solve'}</span>
              </>
            )}
          </button>
          {hasSolution && (
            <button
              onClick={onRegenSolution}
              disabled={isGeneratingSolution || !challenge}
              className="flex items-center px-2 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/50 rounded-r-md hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Regenerate solution with current model"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        <button
          onClick={onEvaluate}
          disabled={isEvaluating || !challenge}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
        >
          {isEvaluating ? 'Reviewing...' : (
            <>
              <Play size={13} />
              Evaluate
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TopBar;
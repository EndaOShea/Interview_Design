import React, { useState, useEffect, useRef } from 'react';
import { SolutionResult, Challenge } from '../types';
import {
  Play,
  X,
  ChevronRight,
  CheckCircle2,
  Lightbulb,
  Layers,
  RotateCcw,
  Sparkles,
  TrendingUp
} from 'lucide-react';

interface SolutionPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  solution: SolutionResult | null;
  challenge: Challenge | null;
  currentStep: number;
  onStepChange: (step: number) => void;
  onReset: () => void;
  onComplete: () => void;
  isEvaluating?: boolean;
  evaluationScore?: number | null;
  hasAppliedSolution?: boolean;
}

const SolutionPlayer: React.FC<SolutionPlayerProps> = ({
  isOpen,
  onClose,
  solution,
  challenge,
  currentStep,
  onStepChange,
  onReset,
  onComplete,
  isEvaluating = false,
  evaluationScore = null,
  hasAppliedSolution = false
}) => {
  const [showOverview, setShowOverview] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current step
  useEffect(() => {
    if (contentRef.current && !showOverview) {
      const stepElement = contentRef.current.querySelector(`[data-step="${currentStep}"]`);
      if (stepElement) {
        stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentStep, showOverview]);

  if (!isOpen || !solution) return null;

  const totalSteps = solution.steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const currentStepData = solution.steps[currentStep];
  const isComplete = currentStep >= totalSteps - 1 && !showOverview;

  const handleNext = () => {
    if (showOverview) {
      setShowOverview(false);
      onStepChange(0);
    } else if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const handleStartOver = () => {
    setShowOverview(true);
    onReset();
  };

  return (
    <div className="fixed bottom-[130px] right-4 w-[336px] max-h-[70vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-white">AI Solution Walkthrough</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Progress Bar */}
      {!showOverview && (
        <div className="px-4 py-2 bg-slate-800/50">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {showOverview ? (
          /* Architecture Overview */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Layers className="w-5 h-5" />
              <span className="font-semibold">Architecture Overview</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {solution.architectureOverview}
            </p>

            {/* Requirements Checklist */}
            {challenge && (
              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Requirements to Address
                </div>
                <ul className="space-y-1">
                  {challenge.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-slate-500 font-mono">{idx}.</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasAppliedSolution ? (
              <div className="p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Solution already applied to canvas</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Click "Start Over" below to reset and re-apply the solution.
                </p>
              </div>
            ) : (
              <button
                onClick={handleNext}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
              >
                Start Walkthrough
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {hasAppliedSolution && (
              <button
                onClick={onReset}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
            )}
          </div>
        ) : isComplete ? (
          /* Completion / Final Notes */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">Solution Complete!</span>
            </div>

            {evaluationScore !== null && (
              <div className={`p-3 rounded-lg border ${
                evaluationScore >= 80
                  ? 'bg-green-900/20 border-green-800/30'
                  : evaluationScore >= 60
                    ? 'bg-yellow-900/20 border-yellow-800/30'
                    : 'bg-red-900/20 border-red-800/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Evaluation Score
                  </span>
                  <span className={`text-2xl font-bold ${
                    evaluationScore >= 80
                      ? 'text-green-400'
                      : evaluationScore >= 60
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}>
                    {evaluationScore}/100
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Final Notes & Trade-offs
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {solution.finalNotes}
              </p>
            </div>

            <button
              onClick={onComplete}
              disabled={isEvaluating}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              {isEvaluating ? (
                <span className="animate-pulse flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  {evaluationScore === null ? 'Evaluating Design...' : 'Generating Improvements...'}
                </span>
              ) : evaluationScore !== null && evaluationScore < 85 ? (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Apply Next Improvement
                </>
              ) : evaluationScore !== null ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  View Full Evaluation
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Evaluate & Improve
                </>
              )}
            </button>

            {evaluationScore !== null && evaluationScore < 85 && (
              <p className="text-xs text-center text-slate-400">
                Score below 85 - click to apply AI improvements
              </p>
            )}

            <button
              onClick={handleStartOver}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Start Over
            </button>
          </div>
        ) : (
          /* Current Step */
          <div className="space-y-4" data-step={currentStep}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {currentStep + 1}
              </div>
              <h3 className="font-semibold text-white">{currentStepData.title}</h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {currentStepData.explanation}
            </p>

            {/* Requirements Addressed */}
            {currentStepData.requirementsAddressed.length > 0 && challenge && (
              <div className="p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Requirements Addressed
                </div>
                <ul className="space-y-1">
                  {currentStepData.requirementsAddressed.map(reqIdx => (
                    <li key={reqIdx} className="text-xs text-green-300 flex items-start gap-2">
                      <span className="text-green-500 font-mono">#{reqIdx}</span>
                      <span>{challenge.requirements[reqIdx]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Components Added */}
            {currentStepData.components.length > 0 && (
              <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                  Components Added
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentStepData.components.map(comp => (
                    <span
                      key={comp.id}
                      className="px-2 py-1 bg-blue-800/40 text-blue-200 rounded text-xs font-medium"
                    >
                      {comp.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connections Added */}
            {currentStepData.connections.length > 0 && (
              <div className="p-3 bg-purple-900/20 border border-purple-800/30 rounded-lg">
                <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                  Connections
                </div>
                <ul className="space-y-1">
                  {currentStepData.connections.map((conn, idx) => (
                    <li key={idx} className="text-xs text-purple-300">
                      {conn.sourceId} → {conn.targetId}
                      {conn.label && <span className="text-purple-400 ml-1">({conn.label})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step Navigation Dots (visual only - no going back) */}
      {!showOverview && (
        <div className="px-4 py-2 flex justify-center gap-1.5">
          {solution.steps.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentStep
                  ? 'bg-purple-500 w-4'
                  : idx < currentStep
                    ? 'bg-purple-400/50'
                    : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}

      {/* Controls - only show Next button when not in overview */}
      {!showOverview && (
        <div className="flex items-center justify-end px-4 py-3 bg-slate-800/50 border-t border-slate-700">
          <button
            onClick={handleNext}
            disabled={isComplete}
            className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SolutionPlayer;

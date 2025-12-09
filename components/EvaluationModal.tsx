import React from 'react';
import { EvaluationResult } from '../types';
import { X, CheckCircle, AlertTriangle, ShieldAlert, Award } from 'lucide-react';

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: EvaluationResult | null;
}

const EvaluationModal: React.FC<EvaluationModalProps> = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900 sticky top-0">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="text-purple-400" />
              Design Evaluation
            </h2>
            <p className="text-slate-400 text-sm mt-1">AI Architect Review</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Score</div>
              <div className={`text-3xl font-black ${getScoreColor(result.score)}`}>{result.score}/100</div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Summary */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-200 leading-relaxed italic">"{result.summary}"</p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Pros */}
            <div>
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle size={16} /> Strengths
              </h3>
              <ul className="space-y-2">
                {result.pros.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-slate-300 text-sm bg-emerald-950/20 p-2 rounded border border-emerald-900/30">
                    <span className="text-emerald-500">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div>
              <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle size={16} /> Improvements Needed
              </h3>
              <ul className="space-y-2">
                {result.cons.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-slate-300 text-sm bg-orange-950/20 p-2 rounded border border-orange-900/30">
                    <span className="text-orange-500">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Security */}
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldAlert size={16} /> Security Risks
            </h3>
            <div className="grid grid-cols-1 gap-2">
               {result.securityConcerns.length > 0 ? result.securityConcerns.map((item, idx) => (
                  <div key={idx} className="flex gap-3 text-slate-300 text-sm bg-red-950/20 p-3 rounded border border-red-900/30">
                    <span className="text-red-500 font-bold">!</span>
                    {item}
                  </div>
                )) : (
                  <div className="text-slate-500 text-sm italic">No major security risks detected. Good job!</div>
                )}
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">Architect Recommendations</h3>
            <ul className="space-y-2 list-disc list-inside text-slate-300 text-sm">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="leading-relaxed pl-2">{rec}</li>
              ))}
            </ul>
          </div>

        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm font-medium transition-colors">
              Close Evaluation
            </button>
        </div>
      </div>
    </div>
  );
};

export default EvaluationModal;

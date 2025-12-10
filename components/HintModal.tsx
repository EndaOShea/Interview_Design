import React from 'react';
import { HintResult } from '../types';
import { X, Lightbulb, Puzzle, BookOpen, AlertCircle } from 'lucide-react';

interface HintModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: HintResult | null;
}

const HintModal: React.FC<HintModalProps> = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="text-yellow-400" />
              Design Starter Kit
            </h2>
            <p className="text-slate-400 text-xs mt-1">AI-generated blueprint to get you moving</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Strategy */}
          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-lg p-4">
             <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
               <BookOpen size={16} /> Strategy
             </h3>
             <p className="text-slate-300 text-sm leading-relaxed">
               {result.architectureStrategy}
             </p>
          </div>

          {/* Component Suggestions */}
          <div>
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
               <Puzzle size={16} /> Recommended Components
            </h3>
            <div className="grid gap-3">
              {result.suggestedComponents.map((item, idx) => (
                <div key={idx} className="bg-slate-800/50 p-3 rounded border border-slate-700 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="sm:w-1/3 shrink-0">
                    <div className="text-xs text-slate-500 uppercase font-semibold">{item.layer}</div>
                    <div className="text-white font-medium">{item.component}</div>
                  </div>
                  <div className="text-xs text-slate-400 border-l border-slate-700 pl-4 sm:flex-1">
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gotchas */}
          <div>
            <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertCircle size={16} /> Key Considerations
            </h3>
            <ul className="space-y-2">
              {result.keyConsiderations.map((item, idx) => (
                <li key={idx} className="flex gap-3 text-slate-300 text-sm bg-orange-950/10 p-2 rounded border border-orange-900/20">
                  <span className="text-orange-500 font-bold">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
            <button onClick={onClose} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors shadow-lg shadow-blue-500/20">
              Got it, let's build!
            </button>
        </div>
      </div>
    </div>
  );
};

export default HintModal;
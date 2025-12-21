import React, { useState } from 'react';
import { Challenge } from '../types';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';

interface RequirementsPanelProps {
  challenge: Challenge | null;
}

const RequirementsPanel: React.FC<RequirementsPanelProps> = ({ challenge }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!challenge || !challenge.requirements || !challenge.constraints) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end">
      <div
        className={`bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-xl transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${
          isCollapsed ? 'w-40' : 'w-80 sm:w-96 h-[500px] max-h-[80vh]'
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-2 bg-slate-800/50 cursor-pointer border-b border-transparent hover:border-slate-700 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-1.5">
            <FileText size={11} className="text-indigo-400" />
            <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
              Requirements
            </h3>
          </div>
          <button className="text-slate-500 hover:text-white">
            {isCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <div className="mb-4">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                 Functional
               </h4>
               <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5 marker:text-indigo-500">
                 {challenge.requirements.map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}
               </ul>
            </div>
            
            <div className="pt-3 border-t border-slate-800">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                 Constraints
               </h4>
               <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5 marker:text-orange-500">
                 {challenge.constraints.map((c, i) => <li key={i} className="leading-relaxed">{c}</li>)}
               </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequirementsPanel;
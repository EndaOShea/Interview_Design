import React, { useState, useEffect } from 'react';
import { ComponentDefinition, ComponentSubType } from '../types';
import { Info, Check, Wrench } from 'lucide-react';

interface ComponentConfigDialogProps {
  isOpen: boolean;
  definition: ComponentDefinition | null;
  initialSubTypeId?: string;
  onComplete: (subType: string, tool: string) => void;
  onCancel: () => void;
}

const ComponentConfigDialog: React.FC<ComponentConfigDialogProps> = ({
  isOpen,
  definition,
  initialSubTypeId,
  onComplete,
  onCancel,
}) => {
  const [selectedSubTypeId, setSelectedSubTypeId] = useState<string>('');
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [customTool, setCustomTool] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedSubTypeId(initialSubTypeId || '');
      setSelectedTool('');
      setCustomTool('');
    }
  }, [isOpen, definition, initialSubTypeId]);

  if (!isOpen || !definition) return null;

  const subTypes = definition.subTypes || [];
  const activeSubType = subTypes.find(s => s.id === selectedSubTypeId);

  // Group subTypes for display
  const groupedSubTypes: Record<string, ComponentSubType[]> = {};
  subTypes.forEach(sub => {
    const cat = sub.category || 'General';
    if (!groupedSubTypes[cat]) groupedSubTypes[cat] = [];
    groupedSubTypes[cat].push(sub);
  });

  const handleSave = () => {
    const finalTool = customTool.trim() || selectedTool;
    if (subTypes.length > 0 && !selectedSubTypeId) return;
    onComplete(selectedSubTypeId, finalTool);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg text-blue-400">
              {definition.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configure {definition.label}</h2>
              <p className="text-slate-400 text-sm">{definition.description}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">Cancel</button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left: SubTypes List (Grouped) */}
          <div className="w-1/3 border-r border-slate-800 overflow-y-auto p-4 bg-slate-900/50 custom-scrollbar">
            {Object.entries(groupedSubTypes).map(([category, items]) => (
              <div key={category} className="mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 px-1 sticky top-0 bg-slate-900/90 py-1 backdrop-blur-sm z-10">{category}</h3>
                <div className="space-y-1">
                  {items.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setSelectedSubTypeId(sub.id);
                        setSelectedTool(''); 
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm ${
                        selectedSubTypeId === sub.id
                          ? 'bg-blue-600/20 border-blue-500/50 text-white'
                          : 'bg-slate-800/50 border-transparent text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {subTypes.length === 0 && <div className="text-slate-500 text-sm p-2 italic">No subtypes available</div>}
          </div>

          {/* Right: Details & Tool Selection */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 relative custom-scrollbar">
            {activeSubType ? (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                
                {/* Description Box */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <Info size={18} className="text-blue-400" />
                    About {activeSubType.label}
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {activeSubType.description}
                  </p>
                </div>

                {/* Tool Selection */}
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Select Specific Tool</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    {activeSubType.tools.map((tool) => (
                      <button
                        key={tool}
                        onClick={() => {
                          setSelectedTool(tool);
                          setCustomTool('');
                        }}
                        className={`p-3 rounded border text-sm font-medium transition-all text-center flex flex-col items-center justify-center gap-2 h-20 ${
                          selectedTool === tool
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                         {selectedTool === tool && <Check size={16} />}
                         {tool}
                      </button>
                    ))}
                  </div>

                  {/* OR Custom Input */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-950 px-2 text-slate-500">Or use custom tool</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1 focus-within:border-blue-500 transition-colors">
                      <div className="p-2 text-slate-500"><Wrench size={16} /></div>
                      <input 
                        type="text" 
                        value={customTool}
                        onChange={(e) => {
                          setCustomTool(e.target.value);
                          setSelectedTool(''); 
                        }}
                        placeholder="Enter custom tool name"
                        className="bg-transparent border-none focus:outline-none text-sm text-white w-full py-2 placeholder-slate-600"
                      />
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Info size={48} className="mb-4 opacity-20" />
                <p>Select a type from the left to configure.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-slate-400 hover:text-white text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!selectedSubTypeId}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            Add Component
          </button>
        </div>

      </div>
    </div>
  );
};

export default ComponentConfigDialog;
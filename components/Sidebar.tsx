import React, { useState, useMemo } from 'react';
import { COMPONENT_SPECS } from '../constants';
import { ComponentType, ComponentSubType } from '../types';
import { Plus, Trash2, Wrench, ChevronDown, ChevronRight, GripVertical, Box } from 'lucide-react';

interface CustomTool {
  name: string;
  type: ComponentType;
}

const Sidebar: React.FC = () => {
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [newToolName, setNewToolName] = useState('');
  const [newToolType, setNewToolType] = useState<string>(''); // Stores the selected ComponentType
  
  // State for expanded layers (Level 1)
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});

  const toggleLayer = (type: string) => {
    setExpandedLayers(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleDragStart = (
    e: React.DragEvent, 
    type: ComponentType, 
    label?: string, 
    subTypeId?: string
  ) => {
    e.dataTransfer.setData('application/reactflow', type);
    if (label) {
      e.dataTransfer.setData('application/reactflow-label', label);
    }
    if (subTypeId) {
      e.dataTransfer.setData('application/reactflow-subtype', subTypeId);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const addCustomTool = () => {
    if (newToolName.trim() && newToolType) {
      setCustomTools([...customTools, { name: newToolName.trim(), type: newToolType as ComponentType }]);
      setNewToolName('');
      // We keep the selected type for convenience, or could reset it: setNewToolType('');
    }
  };

  const removeCustomTool = (index: number) => {
    setCustomTools(customTools.filter((_, i) => i !== index));
  };

  // Organize components by their 1-16 index (relying on insertion order in constants or helper)
  // We want to skip Flow/Structure types AND Annotation types in the main list
  const systemLayers = useMemo(() => {
    return Object.values(COMPONENT_SPECS).filter(spec => 
      spec.type !== ComponentType.FLOW_START &&
      spec.type !== ComponentType.FLOW_END &&
      spec.type !== ComponentType.FLOW_PROCESS &&
      spec.type !== ComponentType.FLOW_DECISION &&
      spec.type !== ComponentType.FLOW_DATA &&
      spec.type !== ComponentType.FLOW_LOOP &&
      spec.type !== ComponentType.FLOW_TIMER &&
      spec.type !== ComponentType.FLOW_EVENT &&
      spec.type !== ComponentType.STRUCTURE_LAYER &&
      spec.type !== ComponentType.CUSTOM &&
      spec.type !== ComponentType.ANNOTATION_TEXT &&
      spec.type !== ComponentType.ANNOTATION_RECT &&
      spec.type !== ComponentType.ANNOTATION_CIRCLE
    );
  }, []);

  const flowTools = [
    ComponentType.FLOW_PROCESS, ComponentType.FLOW_DECISION, 
    ComponentType.FLOW_DATA, ComponentType.FLOW_START, ComponentType.FLOW_END,
    ComponentType.STRUCTURE_LAYER
  ];

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 z-10 shadow-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span className="bg-blue-600 w-2 h-6 rounded-sm"></span>
          ArchitectAI
        </h1>
        <p className="text-xs text-slate-400 mt-1">System Design Studio</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-4">
          
          {/* Quick Flow Tools */}
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-800">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Logic & Flow</h2>
            <div className="grid grid-cols-3 gap-2">
               {flowTools.map(type => {
                 const spec = COMPONENT_SPECS[type];
                 return (
                   <div 
                      key={type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, type, spec.label)}
                      className="flex flex-col items-center justify-center p-2 bg-slate-800 rounded border border-slate-700 hover:border-blue-500 cursor-grab transition-colors gap-1"
                      title={spec.label}
                   >
                     <div className="text-slate-400">{spec.icon}</div>
                     <span className="text-[9px] text-slate-300 truncate w-full text-center">{spec.label}</span>
                   </div>
                 )
               })}
            </div>
          </div>

          {/* 16 Layers Accordion */}
          <div className="space-y-1">
            {systemLayers.map((spec) => {
              const isExpanded = expandedLayers[spec.type];
              
              // Group SubTypes by Category (Level 2)
              const categories: Record<string, ComponentSubType[]> = {};
              spec.subTypes?.forEach(sub => {
                const cat = sub.category || 'General';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(sub);
              });

              return (
                <div key={spec.type} className="rounded-lg overflow-hidden border border-transparent hover:border-slate-800 transition-colors">
                  {/* Level 1: Layer Header */}
                  <div 
                    className={`flex items-center gap-2 p-2 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                    onClick={() => toggleLayer(spec.type)}
                    draggable // Allow dragging the entire layer as a generic component
                    onDragStart={(e) => handleDragStart(e, spec.type, spec.label)}
                  >
                    <button className="text-slate-500 hover:text-white">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="text-blue-400">{spec.icon}</div>
                    <span className="text-sm font-semibold text-slate-200 flex-1 truncate">{spec.label}</span>
                    <GripVertical size={12} className="text-slate-600 opacity-50" />
                  </div>

                  {/* Level 2 & 3: Nested Content */}
                  {isExpanded && (
                    <div className="bg-slate-900/50 border-t border-slate-800 pb-2">
                      {Object.entries(categories).map(([catName, subTypes]) => (
                        <div key={catName} className="mt-2 pl-4 pr-2">
                          {/* Level 2: Category Header */}
                          <div 
                            draggable
                            onDragStart={(e) => handleDragStart(e, spec.type, catName)}
                            className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2 cursor-grab hover:text-slate-300 transition-colors"
                          >
                            <span>{catName}</span>
                          </div>

                          {/* Level 3: Component Items */}
                          <div className="space-y-1 pl-2 border-l border-slate-800 ml-1">
                            {subTypes.map(sub => (
                              <div
                                key={sub.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, spec.type, undefined, sub.id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 cursor-grab group transition-colors"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-blue-500 transition-colors"></div>
                                <span className="text-xs text-slate-400 group-hover:text-slate-100 transition-colors">{sub.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom Tools */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center justify-between tracking-wider px-2">
              Custom Tools
            </h2>
            <div className="flex flex-col gap-2 mb-3 px-2">
              <input
                type="text"
                value={newToolName}
                onChange={(e) => setNewToolName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomTool()}
                placeholder="Tool Name..."
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <select
                  value={newToolType}
                  onChange={(e) => setNewToolType(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Layer...</option>
                  {systemLayers.map(layer => (
                    <option key={layer.type} value={layer.type}>{layer.label}</option>
                  ))}
                </select>
                <button 
                  onClick={addCustomTool}
                  disabled={!newToolName.trim() || !newToolType}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-1.5 rounded transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            
            <div className="space-y-1 px-2">
              {customTools.map((tool, idx) => {
                const spec = COMPONENT_SPECS[tool.type];
                return (
                  <div
                    key={`custom-${idx}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tool.type, tool.name)}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700/50 cursor-grab hover:bg-slate-700 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-slate-400">{spec?.icon || <Box size={12}/>}</div>
                      <span className="text-xs text-slate-300 truncate max-w-[120px]" title={tool.name}>{tool.name}</span>
                    </div>
                    <button 
                      onClick={() => removeCustomTool(idx)}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              {customTools.length === 0 && (
                <div className="text-[10px] text-slate-500 text-center py-2 italic">
                  Create tools mapped to specific layers above.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Sidebar;
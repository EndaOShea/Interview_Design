import React, { useState, useMemo } from 'react';
import { COMPONENT_SPECS } from '../constants';
import { ComponentType, ComponentSubType } from '../types';
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Box } from 'lucide-react';

interface CustomTool {
  name: string;
  type: ComponentType;
}

const DEFAULT_NAVY = '#1e3a8a';

const Sidebar: React.FC = () => {
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [newToolName, setNewToolName] = useState('');
  const [newToolType, setNewToolType] = useState<string>('');
  
  // Single global color for all components
  const [globalColor, setGlobalColor] = useState(DEFAULT_NAVY);
  
  // State for expanded layers (Level 1)
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});

  const toggleLayer = (type: string) => {
    setExpandedLayers(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleDragStart = (
    e: React.DragEvent,
    type: ComponentType,
    label?: string,
    subTypeId?: string,
    customKey?: string
  ) => {
    e.dataTransfer.setData('application/reactflow', type);
    if (label) {
      e.dataTransfer.setData('application/reactflow-label', label);
    }
    if (subTypeId) {
      e.dataTransfer.setData('application/reactflow-subtype', subTypeId);
    }

    // Use global color for all components
    e.dataTransfer.setData('application/reactflow-color', globalColor);

    e.dataTransfer.effectAllowed = 'move';
  };

  const addCustomTool = () => {
    if (newToolName.trim() && newToolType) {
      setCustomTools([...customTools, { name: newToolName.trim(), type: newToolType as ComponentType }]);
      setNewToolName('');
    }
  };

  const removeCustomTool = (index: number) => {
    setCustomTools(customTools.filter((_, i) => i !== index));
    // Optional: cleanup color state? Not strictly necessary.
  };

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
      spec.type !== ComponentType.ANNOTATION_CIRCLE &&
      spec.type !== ComponentType.ANNOTATION_DRAW
    );
  }, []);

  const flowTools = [
    ComponentType.FLOW_PROCESS, ComponentType.FLOW_DECISION, 
    ComponentType.FLOW_DATA, ComponentType.FLOW_START, ComponentType.FLOW_END,
    ComponentType.STRUCTURE_LAYER
  ];


  return (
    <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 z-10 shadow-xl overflow-hidden">
      <div className="px-3 pt-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark */}
            <div className="flex-shrink-0 w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-900/40">
              <span className="text-[11px] font-black text-white tracking-tight leading-none">SA</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-[13px] font-semibold text-slate-100 tracking-tight leading-tight truncate">
                Systems Architect
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight mt-px">Design Studio</p>
            </div>
          </div>
          {/* Color picker */}
          <div className="flex-shrink-0 relative group" title="Component color">
            <input
              type="color"
              value={globalColor}
              onChange={(e) => setGlobalColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className="w-6 h-6 rounded-md border border-white/10 shadow-sm group-hover:ring-2 group-hover:ring-blue-500/60 transition-all"
              style={{ backgroundColor: globalColor }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-4">

          {/* Quick Flow Tools */}
          <div className="bg-slate-800/30 rounded-lg p-2 border border-slate-800">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Logic & Flow</h2>
            <div className="grid grid-cols-2 gap-1">
               {flowTools.map(type => {
                 const spec = COMPONENT_SPECS[type];
                 return (
                   <div
                      key={type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, type, spec.label)}
                      className="relative flex flex-col items-center justify-center p-1 bg-slate-800 rounded border border-slate-700 hover:border-blue-500 cursor-grab transition-colors group"
                      title={spec.label}
                   >
                     <div className="text-slate-400 [&>svg]:w-3 [&>svg]:h-3">{spec.icon}</div>
                     <span className="text-[8px] text-slate-300 truncate w-full text-center leading-tight">{spec.label}</span>
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
                    className={`flex items-center gap-1.5 px-1.5 py-1 cursor-pointer transition-colors group ${isExpanded ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                    onClick={() => toggleLayer(spec.type)}
                    draggable // Allow dragging the entire layer as a generic component
                    onDragStart={(e) => handleDragStart(e, spec.type, spec.label)}
                  >
                    <button className="text-slate-500 hover:text-white">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <div className="text-blue-400 [&>svg]:w-3.5 [&>svg]:h-3.5">{spec.icon}</div>
                    <span className="text-xs font-medium text-slate-200 flex-1 truncate">{spec.label}</span>
                    <GripVertical size={10} className="text-slate-600 opacity-50" />
                  </div>

                  {/* Level 2 & 3: Nested Content */}
                  {isExpanded && (
                    <div className="bg-slate-900/50 border-t border-slate-800 pb-1">
                      {Object.entries(categories).map(([catName, subTypes]) => (
                        <div key={catName} className="mt-1 pl-3 pr-1">
                          {/* Level 2: Category Header */}
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, spec.type, catName)}
                            className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center cursor-grab hover:text-slate-300 transition-colors"
                          >
                            {catName}
                          </div>

                          {/* Level 3: Component Items */}
                          <div className="space-y-0 pl-1.5 border-l border-slate-800 ml-0.5">
                            {subTypes.map(sub => (
                              <div
                                key={sub.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, spec.type, undefined, sub.id)}
                                className="flex items-center px-1.5 py-0.5 rounded hover:bg-slate-800 cursor-grab group transition-colors"
                              >
                                <span className="text-[10px] text-slate-400 group-hover:text-slate-100 transition-colors">{sub.label}</span>
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
          <div className="mt-3 pt-2 border-t border-slate-800">
            <h2 className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider px-1">
              Custom Tools
            </h2>
            <div className="flex flex-col gap-1 mb-2 px-1">
              <input
                type="text"
                value={newToolName}
                onChange={(e) => setNewToolName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomTool()}
                placeholder="Tool Name..."
                className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-1">
                <select
                  value={newToolType}
                  onChange={(e) => setNewToolType(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Layer...</option>
                  {systemLayers.map(layer => (
                    <option key={layer.type} value={layer.type}>{layer.label}</option>
                  ))}
                </select>
                <button
                  onClick={addCustomTool}
                  disabled={!newToolName.trim() || !newToolType}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-1 rounded transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div className="space-y-0.5 px-1">
              {customTools.map((tool, idx) => {
                const spec = COMPONENT_SPECS[tool.type];
                const customId = `custom-${idx}`;
                return (
                  <div
                    key={customId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tool.type, tool.name, undefined, customId)}
                    className="flex items-center justify-between px-1.5 py-1 bg-slate-800/50 rounded border border-slate-700/50 cursor-grab hover:bg-slate-700 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="text-slate-400 [&>svg]:w-3 [&>svg]:h-3">{spec?.icon || <Box size={10}/>}</div>
                      <span className="text-[10px] text-slate-300 truncate max-w-[70px]" title={tool.name}>{tool.name}</span>
                    </div>
                    <button
                      onClick={() => removeCustomTool(idx)}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                );
              })}
              {customTools.length === 0 && (
                <div className="text-[9px] text-slate-500 text-center py-1 italic">
                  Create tools mapped to layers.
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
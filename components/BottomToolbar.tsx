import React, { useState, useEffect } from 'react';
import { 
  MousePointer2, ArrowRight, Minus, Type, Square, Circle, 
  ZoomIn, ZoomOut, RotateCw, PenTool, Undo2
} from 'lucide-react';

export type ToolType = 'select' | 'connect_arrow' | 'connect_line' | 'connect_loop' | 'text' | 'rect' | 'circle' | 'pen';

interface BottomToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomReset: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

const DEFAULT_NAVY = '#1e3a8a';
const DEFAULT_YELLOW = '#eab308'; // for loop

const BottomToolbar: React.FC<BottomToolbarProps> = ({ 
  activeTool, 
  setActiveTool, 
  setSelectedColor,
  zoom,
  onZoomChange,
  onZoomReset,
  onUndo,
  canUndo = false
}) => {
  // Local state for tool colors
  const [toolColors, setToolColors] = useState<Record<string, string>>({
    connect_arrow: DEFAULT_NAVY,
    connect_line: DEFAULT_NAVY,
    connect_loop: DEFAULT_YELLOW, // Loop default yellow
    text: DEFAULT_NAVY,
    rect: DEFAULT_NAVY,
    circle: DEFAULT_NAVY,
    pen: DEFAULT_NAVY
  });

  // When active tool changes, propagate its color to the App's selectedColor
  useEffect(() => {
    if (activeTool !== 'select' && toolColors[activeTool]) {
      setSelectedColor(toolColors[activeTool]);
    }
  }, [activeTool, toolColors, setSelectedColor]);

  const handleToolColorChange = (tool: string, color: string) => {
    setToolColors(prev => ({ ...prev, [tool]: color }));
    // If we are changing the color of the *current* tool, update global selection immediately
    if (activeTool === tool) {
      setSelectedColor(color);
    }
  };

  const ToolButton = ({ tool, icon, label }: { tool: ToolType, icon: React.ReactNode, label: string }) => {
    const isActive = activeTool === tool;
    // Don't show picker for select tool
    const hasPicker = tool !== 'select';
    
    return (
      <div className="relative group flex items-center">
         <button
          onClick={() => setActiveTool(tool)}
          className={`p-2 rounded-lg transition-all flex items-center justify-center relative ${
            isActive 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
          title={label}
        >
          {icon}
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {label}
          </span>
        </button>
        
        {/* Tiny Color Picker beside the tool */}
        {hasPicker && (
           <div className="absolute -right-1 bottom-1 w-2.5 h-2.5 z-10 hover:scale-125 transition-transform">
             <label 
                htmlFor={`tool-color-${tool}`}
                className="block w-full h-full rounded-full cursor-pointer border border-slate-900 shadow-sm"
                style={{ backgroundColor: toolColors[tool] }}
              />
              <input
                id={`tool-color-${tool}`}
                type="color"
                value={toolColors[tool]}
                onChange={(e) => handleToolColorChange(tool, e.target.value)}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
              />
           </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
      
      {/* Main Toolbar */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-1 rounded-xl shadow-2xl flex items-center gap-2 px-3">
        
        <ToolButton tool="select" icon={<MousePointer2 size={16} />} label="Select / Move" />
        
        <div className="w-px h-6 bg-slate-700 mx-1" />
        
        <ToolButton tool="connect_arrow" icon={<ArrowRight size={16} />} label="Arrow Connector" />
        <ToolButton tool="connect_line" icon={<Minus size={16} />} label="Line Connector" />
        <ToolButton tool="connect_loop" icon={<RotateCw size={16} />} label="Loop Connector" />
        <ToolButton tool="pen" icon={<PenTool size={16} />} label="Pen" />
        
        <div className="w-px h-6 bg-slate-700 mx-1" />
        
        <ToolButton tool="text" icon={<Type size={16} />} label="Text" />
        <ToolButton tool="rect" icon={<Square size={16} />} label="Rectangle" />
        <ToolButton tool="circle" icon={<Circle size={16} />} label="Circle" />
        
        <div className="w-px h-6 bg-slate-700 mx-1" />

        {/* Undo Button */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-all flex items-center justify-center relative group ${
            canUndo
              ? 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              : 'text-slate-700 cursor-not-allowed'
          }`}
          title="Undo"
        >
          <Undo2 size={16} />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Undo
          </span>
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 px-1">
          <button 
            onClick={() => onZoomChange(Math.max(0.1, zoom - 0.1))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
          >
            <ZoomOut size={16} />
          </button>
          
          <button 
             onClick={onZoomReset}
             className="w-10 text-[10px] font-mono text-slate-400 hover:text-white text-center hover:bg-slate-700/50 rounded py-1"
             title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button 
            onClick={() => onZoomChange(Math.min(4, zoom + 0.1))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
          >
            <ZoomIn size={16} />
          </button>
        </div>
        
      </div>

    </div>
  );
};

export default BottomToolbar;
import React, { useState } from 'react';
import { 
  MousePointer2, ArrowRight, Minus, Type, Square, Circle, 
  Palette, Check, ZoomIn, ZoomOut, Maximize
} from 'lucide-react';

export type ToolType = 'select' | 'connect_arrow' | 'connect_line' | 'text' | 'rect' | 'circle';

interface BottomToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomReset: () => void;
}

const COLORS = [
  { label: 'Slate', value: '#64748b' }, // Default
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#f8fafc' },
];

const BottomToolbar: React.FC<BottomToolbarProps> = ({ 
  activeTool, 
  setActiveTool, 
  selectedColor, 
  setSelectedColor,
  zoom,
  onZoomChange,
  onZoomReset
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const ToolButton = ({ tool, icon, label }: { tool: ToolType, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => setActiveTool(tool)}
      className={`p-3 rounded-xl transition-all flex items-center justify-center relative group ${
        activeTool === tool 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      }`}
      title={label}
    >
      {icon}
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </button>
  );

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
      
      {/* Main Toolbar */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-1.5 rounded-2xl shadow-2xl flex items-center gap-1">
        
        <ToolButton tool="select" icon={<MousePointer2 size={20} />} label="Select / Move" />
        
        <div className="w-px h-8 bg-slate-700 mx-1" />
        
        <ToolButton tool="connect_arrow" icon={<ArrowRight size={20} />} label="Arrow Connector" />
        <ToolButton tool="connect_line" icon={<Minus size={20} />} label="Line Connector" />
        
        <div className="w-px h-8 bg-slate-700 mx-1" />
        
        <ToolButton tool="text" icon={<Type size={20} />} label="Text" />
        <ToolButton tool="rect" icon={<Square size={20} />} label="Rectangle" />
        <ToolButton tool="circle" icon={<Circle size={20} />} label="Circle" />
        
        <div className="w-px h-8 bg-slate-700 mx-1" />

        {/* Color Picker Button */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`p-3 rounded-xl transition-all flex items-center justify-center relative ${
              showColorPicker 
                ? 'bg-slate-700 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <div className="relative">
              <Palette size={20} />
              <div 
                className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900"
                style={{ backgroundColor: selectedColor }}
              />
            </div>
          </button>
          
          {/* Popover */}
          {showColorPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl grid grid-cols-4 gap-2 w-48 animate-in slide-in-from-bottom-2 fade-in">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => {
                    setSelectedColor(c.value);
                    setShowColorPicker(false);
                  }}
                  className="w-8 h-8 rounded-full border border-slate-700 hover:scale-110 transition-transform flex items-center justify-center relative"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                >
                  {selectedColor === c.value && (
                    <Check size={14} className={c.value === '#f8fafc' ? 'text-black' : 'text-white'} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-slate-700 mx-1" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 px-1">
          <button 
            onClick={() => onZoomChange(Math.max(0.1, zoom - 0.1))}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
          >
            <ZoomOut size={16} />
          </button>
          
          <button 
             onClick={onZoomReset}
             className="w-12 text-xs font-mono text-slate-400 hover:text-white text-center hover:bg-slate-700/50 rounded py-1"
             title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button 
            onClick={() => onZoomChange(Math.min(4, zoom + 0.1))}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
          >
            <ZoomIn size={16} />
          </button>
        </div>
        
      </div>

    </div>
  );
};

export default BottomToolbar;
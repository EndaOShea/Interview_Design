import React from 'react';
import {
  MousePointer2, ArrowRight, Minus, Type, Square, Circle,
  ZoomIn, ZoomOut, RotateCw, PenTool, Undo2
} from 'lucide-react';
import { ComponentType } from '../types';

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

const BottomToolbar: React.FC<BottomToolbarProps> = ({
  activeTool,
  setActiveTool,
  zoom,
  onZoomChange,
  onZoomReset,
  onUndo,
  canUndo = false
}) => {

  const ToolButton = ({ tool, icon, label, draggable, componentType }: {
    tool: ToolType,
    icon: React.ReactNode,
    label: string,
    draggable?: boolean,
    componentType?: string
  }) => {
    const isActive = activeTool === tool;

    const handleDragStart = (e: React.DragEvent) => {
      if (draggable && componentType) {
        e.dataTransfer.setData('application/reactflow', componentType);
        e.dataTransfer.setData('application/reactflow-label', label);
        e.dataTransfer.effectAllowed = 'move';
      }
    };

    return (
      <button
        onClick={() => setActiveTool(tool)}
        draggable={draggable}
        onDragStart={handleDragStart}
        className={`p-2 rounded-lg transition-all flex items-center justify-center relative group ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        title={label}
      >
        {icon}
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          {label}
        </span>
      </button>
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
        
        <ToolButton tool="text" icon={<Type size={16} />} label="Text" draggable={true} componentType={ComponentType.ANNOTATION_TEXT} />
        <ToolButton tool="rect" icon={<Square size={16} />} label="Rectangle" draggable={true} componentType={ComponentType.ANNOTATION_RECT} />
        <ToolButton tool="circle" icon={<Circle size={16} />} label="Circle" draggable={true} componentType={ComponentType.ANNOTATION_CIRCLE} />
        
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
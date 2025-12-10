import React, { useRef, useState, useEffect } from 'react';
import { SystemComponent, Connection, ComponentType } from '../types';
import { getIconForType, COMPONENT_SPECS } from '../constants';
import { ToolType } from './BottomToolbar';
import { X } from 'lucide-react';
import { ViewState } from '../App';

interface CanvasProps {
  components: SystemComponent[];
  connections: Connection[];
  setComponents: React.Dispatch<React.SetStateAction<SystemComponent[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedColor: string;
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
}

const COMPONENT_WIDTH = 140;
const COMPONENT_HEIGHT = 80;

const Canvas: React.FC<CanvasProps> = ({
  components,
  connections,
  setComponents,
  setConnections,
  onDrop,
  onDragOver,
  activeTool,
  setActiveTool,
  selectedColor,
  viewState,
  setViewState
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedComponent, setDraggedComponent] = useState<{id: string, startX: number, startY: number} | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Apply selected color to currently selected item if it changes
  useEffect(() => {
    if (selectedId) {
      setComponents(prev => prev.map(c => c.id === selectedId ? { ...c, color: selectedColor } : c));
    }
  }, [selectedColor, selectedId]);

  // Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    // Basic zoom logic
    e.stopPropagation();
    // If pinch-zoom or Ctrl+Scroll
    const zoomSensitivity = 0.001;
    const minZoom = 0.1;
    const maxZoom = 4.0;
    
    // Calculate new zoom
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(viewState.zoom + delta, minZoom), maxZoom);

    // Zoom towards cursor would require offset math, keeping it simple center-ish or pre-clamped for now
    // A simple approach is just updating scale, user pans to adjust
    setViewState(prev => ({ ...prev, zoom: newZoom }));
  };

  const handleComponentClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Connection Logic
    const isConnecting = activeTool === 'connect_arrow' || activeTool === 'connect_line' || e.shiftKey;
    
    if (isConnecting) {
      if (!connectingSourceId) {
        setConnectingSourceId(id);
      } else {
        if (connectingSourceId !== id) {
          const type = activeTool === 'connect_line' ? 'undirected' : 'directed';
          const newConnection: Connection = {
            id: `c-${Date.now()}`,
            sourceId: connectingSourceId,
            targetId: id,
            label: '',
            type,
            color: selectedColor
          };
          const exists = connections.some(
            c => c.sourceId === newConnection.sourceId && c.targetId === newConnection.targetId
          );
          if (!exists) {
            setConnections(prev => [...prev, newConnection]);
          }
        }
        setConnectingSourceId(null);
      }
      return;
    }

    setSelectedId(id === selectedId ? null : id);
    setConnectingSourceId(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Check for Pan triggers (Middle Mouse or Space+Left)
    if (e.button === 1 || (e.button === 0 && e.getModifierState("Space"))) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    // Normal Click Logic
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Convert screen to canvas coordinates
    const x = (e.clientX - rect.left - viewState.x) / viewState.zoom;
    const y = (e.clientY - rect.top - viewState.y) / viewState.zoom;

    if (activeTool === 'text') {
      const newComp: SystemComponent = {
        id: `text-${Date.now()}`,
        type: ComponentType.ANNOTATION_TEXT,
        x: x - 50, y: y - 15,
        label: 'Text',
        color: selectedColor
      };
      setComponents(prev => [...prev, newComp]);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'rect') {
      const newComp: SystemComponent = {
        id: `rect-${Date.now()}`,
        type: ComponentType.ANNOTATION_RECT,
        x: x - 100, y: y - 75,
        label: '',
        color: selectedColor
      };
      setComponents(prev => [...prev, newComp]);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'circle') {
       const newComp: SystemComponent = {
        id: `circ-${Date.now()}`,
        type: ComponentType.ANNOTATION_CIRCLE,
        x: x - 75, y: y - 75,
        label: '',
        color: selectedColor
      };
      setComponents(prev => [...prev, newComp]);
      setActiveTool('select');
      return;
    }

    setSelectedId(null);
    setConnectingSourceId(null);
    setEditingConnectionId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setComponents(prev => prev.filter(c => c.id !== id));
    setConnections(prev => prev.filter(c => c.sourceId !== id && c.targetId !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDeleteConnection = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     setConnections(prev => prev.filter(c => c.id !== id));
  };

  const handleMouseDownComponent = (e: React.MouseEvent, id: string) => {
    // Allow panning if space is held even if over a component
    if (e.button === 1 || (e.button === 0 && e.getModifierState("Space"))) {
      handleCanvasMouseDown(e);
      return;
    }

    if (activeTool !== 'select') return;
    if (e.shiftKey) return;
    e.stopPropagation();
    setDraggedComponent({ id, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Panning
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Dragging Component
    if (draggedComponent) {
      const dx = (e.clientX - draggedComponent.startX) / viewState.zoom;
      const dy = (e.clientY - draggedComponent.startY) / viewState.zoom;

      setComponents(prev => prev.map(c => {
        if (c.id === draggedComponent.id) {
          return { ...c, x: c.x + dx, y: c.y + dy };
        }
        return c;
      }));

      setDraggedComponent({ ...draggedComponent, startX: e.clientX, startY: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDraggedComponent(null);
    setIsPanning(false);
  };

  const updateConnectionLabel = (id: string, label: string) => {
     setConnections(prev => prev.map(c => c.id === id ? { ...c, label } : c));
     setEditingConnectionId(null);
  };

  const handleLabelChange = (id: string, newLabel: string) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, customLabel: newLabel } : c));
  };

  const getDimensions = (comp: SystemComponent) => {
    const { type } = comp;
    if (type === ComponentType.FLOW_START || type === ComponentType.FLOW_END) return { w: 60, h: 60 };
    if (type === ComponentType.FLOW_DECISION) return { w: 100, h: 100 };
    if (type === ComponentType.STRUCTURE_LAYER) return { w: 400, h: 250 };
    if (type === ComponentType.ANNOTATION_RECT) return { w: 200, h: 150 };
    if (type === ComponentType.ANNOTATION_CIRCLE) return { w: 150, h: 150 };
    if (type === ComponentType.ANNOTATION_TEXT) return { w: 120, h: 40 }; 
    return { w: COMPONENT_WIDTH, h: COMPONENT_HEIGHT };
  };

  const getCenter = (id: string) => {
    const comp = components.find(c => c.id === id);
    if (!comp) return { x: 0, y: 0 };
    const dims = getDimensions(comp);
    return {
      x: comp.x + dims.w / 2,
      y: comp.y + dims.h / 2
    };
  };

  const getCursorClass = () => {
    if (isPanning) return 'cursor-grabbing';
    if (activeTool === 'select') return 'cursor-default';
    if (activeTool === 'text') return 'cursor-text';
    if (activeTool === 'connect_arrow' || activeTool === 'connect_line') return 'cursor-crosshair';
    return 'cursor-crosshair';
  };

  return (
    <div 
      ref={canvasRef}
      className={`flex-1 relative bg-white overflow-hidden ${getCursorClass()}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Transform Container */}
      <div 
        className="absolute top-0 left-0 w-full h-full origin-top-left will-change-transform"
        style={{ transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})` }}
      >
        {/* Infinite Grid Background - Scaled to be virtually infinite compared to view */}
        <div 
          className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] bg-cross-pattern pointer-events-none" 
        />

        {/* SVG Layer for Connections */}
        <svg className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] pointer-events-none overflow-visible z-10">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-current" />
            </marker>
          </defs>
          {connections.map(conn => {
            const start = getCenter(conn.sourceId);
            const end = getCenter(conn.targetId);
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const isDirected = conn.type !== 'undirected';
            const strokeColor = conn.color || '#475569';
            
            // Adjust coordinates for the massive SVG offset
            const offsetX = 5000;
            const offsetY = 5000;

            return (
              <g key={conn.id} className="pointer-events-auto group" style={{ color: strokeColor }}>
                {/* Invisible wide stroke for easier selection */}
                <line
                  x1={start.x + offsetX} y1={start.y + offsetY} x2={end.x + offsetX} y2={end.y + offsetY}
                  stroke="transparent" strokeWidth="15"
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setEditingConnectionId(conn.id); }}
                />
                <line
                  x1={start.x + offsetX} y1={start.y + offsetY} x2={end.x + offsetX} y2={end.y + offsetY}
                  stroke={strokeColor} strokeWidth="2"
                  markerEnd={isDirected ? "url(#arrowhead)" : undefined}
                  className="transition-colors opacity-80 group-hover:opacity-100"
                />
                {/* Label */}
                {(conn.label || editingConnectionId === conn.id) && (
                  <g transform={`translate(${midX + offsetX}, ${midY + offsetY})`}>
                      <rect x="-20" y="-12" width="40" height="24" rx="4" fill="#0f172a" stroke={strokeColor} />
                      {editingConnectionId === conn.id ? (
                        <foreignObject x="-30" y="-12" width="60" height="24">
                          <input
                            autoFocus
                            className="w-full h-full bg-transparent text-center text-[10px] text-white focus:outline-none"
                            defaultValue={conn.label}
                            onBlur={(e) => updateConnectionLabel(conn.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && updateConnectionLabel(conn.id, e.currentTarget.value)}
                          />
                        </foreignObject>
                      ) : (
                        <text 
                          x="0" y="4" textAnchor="middle" fill="#cbd5e1" fontSize="10px"
                          className="pointer-events-none select-none"
                        >
                          {conn.label}
                        </text>
                      )}
                  </g>
                )}
                {/* Delete button on hover */}
                <foreignObject x={midX + offsetX + 20} y={midY + offsetY - 10} width="20" height="20" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => handleDeleteConnection(conn.id, e)}
                    className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                    >
                    <X size={10} />
                  </button>
                </foreignObject>
              </g>
            );
          })}
          {connectingSourceId && (
            <text x={5020} y={5030} fill="#3b82f6" className="text-sm font-mono font-bold drop-shadow-md">
              • Select target...
            </text>
          )}
        </svg>

        {/* Components */}
        {components.map((comp) => {
          const isSelected = selectedId === comp.id;
          const isSource = connectingSourceId === comp.id;
          const dims = getDimensions(comp);
          const spec = COMPONENT_SPECS[comp.type];
          
          const isLayer = comp.type === ComponentType.STRUCTURE_LAYER;
          const isStart = comp.type === ComponentType.FLOW_START;
          const isEnd = comp.type === ComponentType.FLOW_END;
          const isDecision = comp.type === ComponentType.FLOW_DECISION;
          const isData = comp.type === ComponentType.FLOW_DATA;
          const isText = comp.type === ComponentType.ANNOTATION_TEXT;
          const isRect = comp.type === ComponentType.ANNOTATION_RECT;
          const isCircle = comp.type === ComponentType.ANNOTATION_CIRCLE;
          
          let displayName = comp.tool || comp.customLabel || comp.label;
          if (!displayName && !isText) {
            const subType = spec?.subTypes?.find(s => s.id === comp.subType);
            displayName = subType?.label || spec?.label || 'Unknown';
          }
          
          let typeName = spec?.label;
          const showTypeName = !isStart && !isEnd && !isDecision && !isText && !isRect && !isCircle && typeName && displayName !== typeName;

          let baseClasses = "absolute flex flex-col items-center justify-center select-none transition-all shadow-lg";
          let shapeStyles: React.CSSProperties = {
            borderColor: comp.color, 
          };

          if (isLayer) {
            baseClasses += " border-2 border-dashed bg-slate-900/50 text-left items-start justify-start p-2 rounded-lg";
          } else if (isStart || isEnd) {
            baseClasses += " rounded-full border-4";
          } else if (isDecision || isData) {
            baseClasses += " z-20";
          } else if (isText) {
            baseClasses = "absolute flex items-center justify-center z-30 min-w-[100px] p-1";
            shapeStyles.color = comp.color || '#475569'; // Default text color dark slate on white
          } else if (isRect) {
            baseClasses += " border-2 rounded-lg bg-slate-200/20 backdrop-blur-sm z-10";
          } else if (isCircle) {
            baseClasses += " border-2 rounded-full bg-slate-200/20 backdrop-blur-sm z-10";
          } else {
            baseClasses += " rounded-lg border-2 p-2";
          }
          
          let colorClasses = "";
          // Check if this component usually needs a background (is not a special shape or layer)
          const isStandardNode = !isLayer && !isText && !isRect && !isCircle && !isDecision && !isData;

          if (isSelected) {
            colorClasses = "border-blue-500 ring-2 ring-blue-500/50 z-30 shadow-blue-500/20";
            if (isStandardNode) colorClasses += " bg-slate-900";
          } else if (isSource) {
            colorClasses = "border-blue-400 ring-2 ring-blue-400 z-30 animate-pulse";
            if (isStandardNode) colorClasses += " bg-slate-900";
          } else {
            if (!comp.color) {
              if (isLayer) colorClasses = "border-slate-300 hover:border-slate-400 z-0";
              else if (isStart) colorClasses = "border-green-600 bg-slate-900 hover:border-green-400 z-20";
              else if (isEnd) colorClasses = "border-red-600 bg-slate-900 hover:border-red-400 z-20";
              else if (isStandardNode) colorClasses = "border-slate-700 bg-slate-900 hover:border-slate-500 z-20";
            } else {
              // Standard components still use dark bg for contrast
              colorClasses = "bg-slate-900 z-20";
              if (isRect || isCircle) colorClasses = "z-10";
            }
          }

          const renderContent = () => {
            if (isText) {
              return (
                <input 
                  autoFocus={!comp.customLabel}
                  value={comp.customLabel || comp.label}
                  onChange={(e) => handleLabelChange(comp.id, e.target.value)}
                  className="bg-transparent border-none text-center focus:outline-none w-full h-full font-bold text-lg"
                  style={{ color: comp.color || '#475569' }}
                  onKeyDown={(e) => { e.stopPropagation(); }}
                />
              );
            }
            return (
              <>
                <div className={`mb-1 ${isSelected ? 'text-blue-400' : (isStart ? 'text-green-500' : (isEnd ? 'text-red-500' : 'text-slate-400'))}`} style={comp.color ? { color: comp.color } : {}}>
                    {getIconForType(comp.type)}
                  </div>
                  <div className="text-xs font-bold text-center text-slate-200 truncate w-full px-1" title={displayName}>
                    {displayName}
                  </div>
                  {showTypeName && (
                    <div className="text-[9px] text-center text-slate-500 truncate w-full px-1">
                      {typeName}
                    </div>
                  )}
              </>
            );
          };

          return (
            <div
              key={comp.id}
              style={{
                transform: `translate(${comp.x}px, ${comp.y}px)`,
                width: dims.w,
                height: dims.h,
                ...shapeStyles
              }}
              className={`${baseClasses} ${!isDecision && !isData ? colorClasses : ''}`}
              onMouseDown={(e) => handleMouseDownComponent(e, comp.id)}
              onClick={(e) => handleComponentClick(comp.id, e)}
            >
              {isSelected && (
                <button
                  onClick={(e) => handleDelete(comp.id, e)}
                  className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md z-40 transform hover:scale-110 transition-transform"
                >
                  <X size={12} />
                </button>
              )}

              {isDecision ? (
                <div className={`w-full h-full transform rotate-45 border-2 bg-slate-900 flex items-center justify-center ${isSelected ? 'border-blue-500' : 'hover:border-slate-500'}`} style={{ borderColor: comp.color || (isSelected ? undefined : '#ca8a04') }}>
                  <div className="transform -rotate-45 flex flex-col items-center w-full">
                      {renderContent()}
                  </div>
                </div>
              ) : isData ? (
                <div className={`w-full h-full transform -skew-x-12 border-2 bg-slate-900 flex items-center justify-center ${isSelected ? 'border-blue-500' : 'hover:border-slate-500'}`} style={{ borderColor: comp.color || (isSelected ? undefined : '#9333ea') }}>
                    <div className="transform skew-x-12 flex flex-col items-center w-full px-4">
                      {renderContent()}
                    </div>
                </div>
              ) : isLayer ? (
                <div className="w-full h-full relative">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    {getIconForType(comp.type)}
                    <span className="text-xs font-bold uppercase tracking-widest">{displayName}</span>
                  </div>
                </div>
              ) : (
                renderContent()
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Canvas;
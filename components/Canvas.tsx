import React, { useRef, useState, useEffect, useMemo } from 'react';
import { SystemComponent, Connection, ComponentType } from '../types';
import { getIconForType, COMPONENT_SPECS } from '../constants';
import { ToolType } from './BottomToolbar';
import { X, Scaling, ArrowUp, ArrowDown } from 'lucide-react';
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
  onSnapshot: () => void;
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
  setViewState,
  onSnapshot
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [tempConnectionTarget, setTempConnectionTarget] = useState<{x: number, y: number} | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedComponent, setDraggedComponent] = useState<{id: string, startX: number, startY: number} | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  const [marqueeStart, setMarqueeStart] = useState<{x: number, y: number} | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{x: number, y: number} | null>(null);

  // Resize State
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startCompX: number;
    startCompY: number;
    handle: string; // 'nw', 'ne', 'sw', 'se'
  } | null>(null);

  // Apply selected color to currently selected items ONLY when color changes (not on selection)
  useEffect(() => {
    if (selectedId) {
      setComponents(prev => prev.map(c => c.id === selectedId ? { ...c, color: selectedColor } : c));
    } else if (selectedIds.length > 0) {
      setComponents(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, color: selectedColor } : c));
    }
  }, [selectedColor]); // Removed selectedId from dependencies

  // Keyboard Event Listener for Deletion and Layering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedId) {
          e.preventDefault();
          onSnapshot(); // Save state before delete
          setComponents(prev => prev.filter(c => c.id !== selectedId));
          setConnections(prev => prev.filter(c => c.sourceId !== selectedId && c.targetId !== selectedId));
          setSelectedId(null);
        } else if (selectedIds.length > 0) {
          e.preventDefault();
          onSnapshot(); // Save state before delete
          setComponents(prev => prev.filter(c => !selectedIds.includes(c.id)));
          setConnections(prev => prev.filter(c => !selectedIds.includes(c.sourceId) && !selectedIds.includes(c.targetId)));
          setSelectedIds([]);
        }
      }

      // Bring to front: Ctrl/Cmd + ]
      if ((e.metaKey || e.ctrlKey) && e.key === ']' && selectedId) {
        e.preventDefault();
        onSnapshot();
        const maxZ = Math.max(...components.map(c => c.zOrder || 0), 0);
        setComponents(prev => prev.map(c =>
          c.id === selectedId ? { ...c, zOrder: maxZ + 1 } : c
        ));
      }

      // Send to back: Ctrl/Cmd + [
      if ((e.metaKey || e.ctrlKey) && e.key === '[' && selectedId) {
        e.preventDefault();
        onSnapshot();
        const minZ = Math.min(...components.map(c => c.zOrder || 0), 0);
        setComponents(prev => prev.map(c =>
          c.id === selectedId ? { ...c, zOrder: minZ - 1 } : c
        ));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, components, setComponents, setConnections, onSnapshot]);

  const getDimensions = (comp: SystemComponent) => {
    // If custom width/height set by resize, use them
    if (comp.width && comp.height) return { w: comp.width, h: comp.height };

    const { type } = comp;
    if (type === ComponentType.FLOW_START || type === ComponentType.FLOW_END) return { w: 60, h: 60 };
    if (type === ComponentType.FLOW_DECISION) return { w: 100, h: 100 };
    if (type === ComponentType.STRUCTURE_LAYER) return { w: 400, h: 250 };
    if (type === ComponentType.ANNOTATION_RECT) return { w: 200, h: 150 };
    if (type === ComponentType.ANNOTATION_CIRCLE) return { w: 150, h: 150 };
    if (type === ComponentType.ANNOTATION_TEXT) return { w: 120, h: 40 }; 
    // Freehand drawing defaults mostly irrelevant as we rely on points bounding box conceptually, but needed for selection
    if (type === ComponentType.ANNOTATION_DRAW) return { w: 100, h: 100 }; 
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

  // Calculate intersection point between line segment (center -> target) and component boundary
  const getIntersection = (sourceId: string, targetCenter: {x: number, y: number}) => {
    const comp = components.find(c => c.id === sourceId);
    if (!comp) return targetCenter; // Fallback

    const center = getCenter(sourceId);
    const dims = getDimensions(comp);
    const w = dims.w;
    const h = dims.h;

    const dx = targetCenter.x - center.x;
    const dy = targetCenter.y - center.y;

    if (dx === 0 && dy === 0) return center;

    // Check shapes
    if (comp.type === ComponentType.FLOW_DECISION) {
      // Diamond
      const slope = Math.abs(dy/dx);
      let absX = 0;
      if (dx === 0) {
          absX = 0;
      } else {
          absX = 1 / ( (2/w) + (2 * slope / h) );
      }
      
      const xOffset = (dx >= 0 ? 1 : -1) * absX;
      const yOffset = dx === 0 ? (dy > 0 ? h/2 : -h/2) : xOffset * (dy/dx);
      
      return { x: center.x + xOffset, y: center.y + yOffset };

    } else if (comp.type === ComponentType.FLOW_START || comp.type === ComponentType.FLOW_END || comp.type === ComponentType.ANNOTATION_CIRCLE) {
      // Circle
      const theta = Math.atan2(dy, dx);
      return {
        x: center.x + (w/2) * Math.cos(theta),
        y: center.y + (h/2) * Math.sin(theta)
      };

    } else {
      // Rectangle
      const slope = dy / dx;
      const aspect = h / w;
      
      let xOffset = 0;
      let yOffset = 0;

      if (Math.abs(slope) < aspect) {
        xOffset = (dx > 0 ? 1 : -1) * (w / 2);
        yOffset = xOffset * slope;
      } else {
        yOffset = (dy > 0 ? 1 : -1) * (h / 2);
        if (dy !== 0) xOffset = yOffset / slope;
      }
      
      return { x: center.x + xOffset, y: center.y + yOffset };
    }
  };

  // Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const zoomSensitivity = 0.001;
    const minZoom = 0.01; 
    const maxZoom = 4.0;
    
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(viewState.zoom + delta, minZoom), maxZoom);

    setViewState(prev => ({ ...prev, zoom: newZoom }));
  };

  const handleComponentClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool === 'select') {
       setSelectedId(id === selectedId ? null : id);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isLeftClick = e.button === 0;
    const isMiddleClick = e.button === 1;
    const isSpaceDown = e.getModifierState("Space");

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - viewState.x) / viewState.zoom;
    const y = (e.clientY - rect.top - viewState.y) / viewState.zoom;

    // Panning with middle mouse or space+drag
    if (isMiddleClick || (isLeftClick && isSpaceDown)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Start marquee selection with select tool
    if (isLeftClick && activeTool === 'select') {
      setMarqueeStart({ x, y });
      setMarqueeEnd({ x, y });
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }

    // Creation Tools
    if (['text', 'rect', 'circle', 'pen'].includes(activeTool)) {
      onSnapshot(); // Save state before creation
    }

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

    if (activeTool === 'pen') {
       const id = `draw-${Date.now()}`;
       const newComp: SystemComponent = {
        id,
        type: ComponentType.ANNOTATION_DRAW,
        x: x, 
        y: y,
        points: [{x: 0, y: 0}], // Relative to x,y
        color: selectedColor
      };
      setComponents(prev => [...prev, newComp]);
      setCurrentDrawingId(id);
      return;
    }

    setSelectedId(null);
    setEditingConnectionId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSnapshot(); // Save state before delete
    setComponents(prev => prev.filter(c => c.id !== id));
    setConnections(prev => prev.filter(c => c.sourceId !== id && c.targetId !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDeleteConnection = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     onSnapshot(); // Save state before delete
     setConnections(prev => prev.filter(c => c.id !== id));
  };

  const handleMouseDownComponent = (e: React.MouseEvent, id: string) => {
    if (e.button === 1 || (e.button === 0 && e.getModifierState("Space"))) {
      handleCanvasMouseDown(e);
      return;
    }

    // Connection Logic: Drag to Connect
    if (activeTool === 'connect_arrow' || activeTool === 'connect_line' || activeTool === 'connect_loop') {
      e.stopPropagation();
      setConnectingSourceId(id);
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
         const x = (e.clientX - rect.left - viewState.x) / viewState.zoom;
         const y = (e.clientY - rect.top - viewState.y) / viewState.zoom;
         setTempConnectionTarget({ x, y });
      }
      return;
    }

    if (activeTool !== 'select') return;
    if (e.shiftKey) return;
    e.stopPropagation();
    
    onSnapshot(); // Save state before starting drag
    setDraggedComponent({ id, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseUpComponent = (e: React.MouseEvent, targetId: string) => {
    // NOTE: We do NOT stop propagation here so that the canvas handleMouseUp can fire
    // and clear drag states (draggedComponent, resizing).
    
    // Complete Connection
    if (connectingSourceId) {
       // Loop connector allows sourceId === targetId
       if (connectingSourceId !== targetId || activeTool === 'connect_loop') {
          let type: 'directed' | 'undirected' | 'loop' = 'directed';
          if (activeTool === 'connect_line') type = 'undirected';
          if (activeTool === 'connect_loop') type = 'loop';

          // Set default colors: black for arrows, yellow for loops, selected color for others
          let connectionColor = selectedColor;
          if (type === 'directed' && activeTool === 'connect_arrow') {
            connectionColor = '#000000'; // Black for arrows
          } else if (type === 'loop') {
            connectionColor = '#eab308'; // Yellow for loops
          }

          const newConnection: Connection = {
            id: `c-${Date.now()}`,
            sourceId: connectingSourceId,
            targetId: targetId,
            label: '',
            type,
            color: connectionColor
          };
          
          // Prevent duplicates
          const exists = connections.some(
            c => c.id !== newConnection.id && 
                 c.type === newConnection.type &&
                 c.sourceId === newConnection.sourceId && 
                 c.targetId === newConnection.targetId
          );
          
          if (!exists) {
            onSnapshot(); // Save state before adding connection
            setConnections(prev => [...prev, newConnection]);
          }
       }
    }
    
    setConnectingSourceId(null);
    setTempConnectionTarget(null);
  };

  const handleResizeStart = (e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    onSnapshot(); // Save state before resizing
    const comp = components.find(c => c.id === id);
    if (!comp) return;

    const { w, h } = getDimensions(comp);

    setResizing({
      id,
      startX: e.clientX,
      startY: e.clientY,
      startW: w,
      startH: h,
      startCompX: comp.x,
      startCompY: comp.y,
      handle
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Drawing
    if (currentDrawingId && activeTool === 'pen') {
       const rect = canvasRef.current?.getBoundingClientRect();
       if (rect) {
          const rawX = (e.clientX - rect.left - viewState.x) / viewState.zoom;
          const rawY = (e.clientY - rect.top - viewState.y) / viewState.zoom;
          
          setComponents(prev => prev.map(c => {
             if (c.id === currentDrawingId) {
                // Points are relative to component X,Y
                const relX = rawX - c.x;
                const relY = rawY - c.y;
                return { ...c, points: [...(c.points || []), {x: relX, y: relY}] };
             }
             return c;
          }));
       }
       return;
    }

    // Resizing
    if (resizing) {
      const dx = (e.clientX - resizing.startX) / viewState.zoom;
      const dy = (e.clientY - resizing.startY) / viewState.zoom;
      
      let newW = resizing.startW;
      let newH = resizing.startH;
      let newX = resizing.startCompX;
      let newY = resizing.startCompY;

      // Min dimensions
      const minSize = 20;

      if (resizing.handle.includes('e')) {
        newW = Math.max(minSize, resizing.startW + dx);
      }
      if (resizing.handle.includes('s')) {
        newH = Math.max(minSize, resizing.startH + dy);
      }
      if (resizing.handle.includes('w')) {
        const proposedW = resizing.startW - dx;
        if (proposedW >= minSize) {
           newW = proposedW;
           newX = resizing.startCompX + dx;
        }
      }
      if (resizing.handle.includes('n')) {
        const proposedH = resizing.startH - dy;
        if (proposedH >= minSize) {
          newH = proposedH;
          newY = resizing.startCompY + dy;
        }
      }

      setComponents(prev => prev.map(c => 
        c.id === resizing.id ? { ...c, x: newX, y: newY, width: newW, height: newH } : c
      ));
      return;
    }

    // Dragging Connection
    if (connectingSourceId && tempConnectionTarget) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            const x = (e.clientX - rect.left - viewState.x) / viewState.zoom;
            const y = (e.clientY - rect.top - viewState.y) / viewState.zoom;
            setTempConnectionTarget({ x, y });
        }
        return;
    }

    // Marquee Selection
    if (marqueeStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - viewState.x) / viewState.zoom;
        const y = (e.clientY - rect.top - viewState.y) / viewState.zoom;
        setMarqueeEnd({ x, y });

        // Calculate which components are within the marquee
        const minX = Math.min(marqueeStart.x, x);
        const maxX = Math.max(marqueeStart.x, x);
        const minY = Math.min(marqueeStart.y, y);
        const maxY = Math.max(marqueeStart.y, y);

        const selected = components.filter(comp => {
          const dims = getDimensions(comp);
          const compMinX = comp.x;
          const compMaxX = comp.x + dims.w;
          const compMinY = comp.y;
          const compMaxY = comp.y + dims.h;

          // Check if component overlaps with marquee
          return !(compMaxX < minX || compMinX > maxX || compMaxY < minY || compMinY > maxY);
        }).map(c => c.id);

        setSelectedIds(selected);
      }
      return;
    }

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
    // Finalize marquee selection
    if (marqueeStart) {
      setMarqueeStart(null);
      setMarqueeEnd(null);
      // selectedIds is already set from mouse move
    }

    setDraggedComponent(null);
    setResizing(null);
    setIsPanning(false);
    setCurrentDrawingId(null);
    
    // If we were dragging a connection and didn't hit a component, cancel it
    if (connectingSourceId) {
        setConnectingSourceId(null);
        setTempConnectionTarget(null);
    }
  };

  const updateConnectionLabel = (id: string, label: string) => {
     setConnections(prev => prev.map(c => c.id === id ? { ...c, label } : c));
     setEditingConnectionId(null);
  };

  const handleLabelChange = (id: string, newLabel: string) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, customLabel: newLabel } : c));
  };

  const handleBringToFront = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSnapshot();
    setComponents(prev => {
      const maxZ = Math.max(...prev.map(c => c.zOrder || 0), 0);
      return prev.map(c => c.id === id ? { ...c, zOrder: maxZ + 1 } : c);
    });
  };

  const handleSendToBack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSnapshot();
    setComponents(prev => {
      const minZ = Math.min(...prev.map(c => c.zOrder || 0), 0);
      return prev.map(c => c.id === id ? { ...c, zOrder: minZ - 1 } : c);
    });
  };

  const getCursorClass = () => {
    if (resizing) return 'cursor-nwse-resize';
    if (isPanning) return 'cursor-grabbing';
    if (draggedComponent) return 'cursor-grabbing';
    if (activeTool === 'select' && hoveredId) return 'cursor-grab';
    if (activeTool === 'select') return 'cursor-default';
    if (activeTool === 'text') return 'cursor-text';
    if (activeTool === 'pen') return 'cursor-crosshair';
    if (activeTool.startsWith('connect_')) return 'cursor-crosshair';
    return 'cursor-crosshair';
  };

  // Generate unique markers for every color used
  const uniqueColors = useMemo(() => {
    const colors = new Set<string>();
    connections.forEach(c => {
      if (c.color) colors.add(c.color);
    });
    // Add default colors for connectors
    colors.add('#000000'); // Black for arrows
    colors.add('#eab308'); // Yellow for loops
    colors.add(selectedColor); // Current selected color
    return Array.from(colors);
  }, [connections, selectedColor]);

  const getMarkerId = (color: string) => `arrowhead-${color.replace('#', '')}`;

  return (
    <div
      ref={canvasRef}
      className={`flex-1 relative bg-slate-50 overflow-hidden ${getCursorClass()}`}
      style={{}}
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
        {/* SVG Layer for Connections */}
        <svg className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] pointer-events-none overflow-visible z-10">
          <defs>
             {/* Generate a specific marker for each unique color used */}
            {uniqueColors.map(color => (
              <marker 
                key={color} 
                id={getMarkerId(color)} 
                markerWidth="10" 
                markerHeight="7" 
                refX="9" 
                refY="3.5" 
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={color} />
              </marker>
            ))}
          </defs>
          
          {/* Temporary Connection Line being dragged */}
          {connectingSourceId && tempConnectionTarget && (
             <line 
                x1={getIntersection(connectingSourceId, tempConnectionTarget).x + 5000}
                y1={getIntersection(connectingSourceId, tempConnectionTarget).y + 5000}
                x2={tempConnectionTarget.x + 5000}
                y2={tempConnectionTarget.y + 5000}
                stroke={activeTool === 'connect_arrow' ? '#000000' : (activeTool === 'connect_loop' ? '#eab308' : selectedColor)}
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd={activeTool === 'connect_arrow' ? `url(#${getMarkerId('#000000')})` : undefined}
                className="opacity-60"
             />
          )}

          {connections.map(conn => {
            const sourceComp = components.find(c => c.id === conn.sourceId);
            const sourceCenter = getCenter(conn.sourceId);
            const targetCenter = getCenter(conn.targetId);
            const isLoop = conn.type === 'loop';
            const isDirected = conn.type === 'directed';
            const strokeColor = conn.color || '#475569';
            
            // Adjust coordinates for the massive SVG offset
            const offsetX = 5000;
            const offsetY = 5000;

            let pathData = '';
            let midX = 0;
            let midY = 0;

            if (isLoop && conn.sourceId === conn.targetId) {
                // Self Loop with Right-side visibility
                // Calculate Right Edge of component
                const dims = sourceComp ? getDimensions(sourceComp) : { w: 140, h: 80 };
                const halfW = dims.w / 2;
                
                // Start and End at the Right Edge of the component
                const startX = sourceCenter.x + offsetX + halfW;
                const startY = sourceCenter.y + offsetY - 15; // Slightly above center
                const endX = sourceCenter.x + offsetX + halfW;
                const endY = sourceCenter.y + offsetY + 15; // Slightly below center
                
                // Balloon out to the right
                // Control points further right
                const cp1x = startX + 60;
                const cp1y = startY - 40;
                const cp2x = endX + 60;
                const cp2y = endY + 40;

                pathData = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
                
                midX = startX + 50;
                midY = sourceCenter.y + offsetY;

            } else if (isLoop) {
                // Curved connection between different nodes
                // Quadratic Bezier?
                const start = getIntersection(conn.sourceId, targetCenter);
                const end = getIntersection(conn.targetId, sourceCenter);
                const sx = start.x + offsetX;
                const sy = start.y + offsetY;
                const ex = end.x + offsetX;
                const ey = end.y + offsetY;

                // Control point perpendicular to midpoint
                const mx = (sx + ex) / 2;
                const my = (sy + ey) / 2;
                const dist = Math.sqrt(Math.pow(ex-sx, 2) + Math.pow(ey-sy, 2));
                // Offset control point by 20% of distance
                const offset = dist * 0.3; 
                // Normal vector (-dy, dx)
                let nx = -(ey - sy);
                let ny = (ex - sx);
                const len = Math.sqrt(nx*nx + ny*ny);
                nx = nx / len;
                ny = ny / len;

                const cx = mx + nx * offset;
                const cy = my + ny * offset;

                pathData = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
                midX = cx;
                midY = cy;
            } else {
                // Straight Line
                const start = getIntersection(conn.sourceId, targetCenter);
                const end = getIntersection(conn.targetId, sourceCenter);
                pathData = `M ${start.x + offsetX} ${start.y + offsetY} L ${end.x + offsetX} ${end.y + offsetY}`;
                midX = (start.x + end.x) / 2 + offsetX;
                midY = (start.y + end.y) / 2 + offsetY;
            }

            return (
              <g key={conn.id} className="pointer-events-auto group" style={{ color: strokeColor }}>
                {/* Invisible wide stroke for easier selection */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent" 
                  strokeWidth="15"
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setEditingConnectionId(conn.id); }}
                />
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor} 
                  strokeWidth="2"
                  markerEnd={isDirected || (isLoop && conn.sourceId === conn.targetId) ? `url(#${getMarkerId(strokeColor)})` : undefined}
                  className="transition-colors opacity-80 group-hover:opacity-100"
                />
                
                {/* Label */}
                {(conn.label || editingConnectionId === conn.id) && (
                  <g transform={`translate(${midX}, ${midY})`}>
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
                <foreignObject x={midX + 20} y={midY - 10} width="20" height="20" className="opacity-0 group-hover:opacity-100 transition-opacity">
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
        </svg>

        {/* Components */}
        {[...components].sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0)).map((comp) => {
          const isSelected = selectedId === comp.id || selectedIds.includes(comp.id);
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
          const isDraw = comp.type === ComponentType.ANNOTATION_DRAW;
          
          // Build hierarchy breadcrumb
          let displayName = comp.tool || comp.customLabel || comp.label;
          let hierarchyParts: string[] = [];

          if (!isText) {
            const subType = spec?.subTypes?.find(s => s.id === comp.subType);

            if (!displayName) {
              displayName = subType?.label || spec?.label || 'Unknown';
            }

            // Build breadcrumb from most specific to least specific
            if (comp.tool && subType) {
              // Tool level: show subType → category → spec
              hierarchyParts.push(subType.label);
              if (subType.category) hierarchyParts.push(subType.category);
              if (spec?.label) hierarchyParts.push(spec.label);
            } else if (comp.subType && subType) {
              // SubType level: show category → spec
              if (subType.category) hierarchyParts.push(subType.category);
              if (spec?.label) hierarchyParts.push(spec.label);
            } else if (displayName === subType?.category && spec?.label) {
              // Category level: show only spec
              hierarchyParts.push(spec.label);
            } else if (comp.label && !comp.subType && spec?.label && displayName !== spec.label) {
              // Generic component with just a label: show spec if different
              hierarchyParts.push(spec.label);
            }
            // If only spec level, no breadcrumb needed
          }

          const showHierarchy = hierarchyParts.length > 0 && !isStart && !isEnd && !isDecision && !isText && !isRect && !isCircle && !isDraw;

          let baseClasses = "absolute flex flex-col items-center justify-center select-none transition-all shadow-lg";
          let shapeStyles: React.CSSProperties = {
            backgroundColor: comp.color || '#1e3a8a',
          };

          // Special rendering for drawings
          if (isDraw) {
             const points = comp.points || [];
             const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');
             
             return (
               <div
                 key={comp.id}
                 style={{
                   transform: `translate(${comp.x}px, ${comp.y}px)`,
                   overflow: 'visible',
                   width: 0, height: 0
                 }}
                 className="absolute z-20"
                 onMouseDown={(e) => handleMouseDownComponent(e, comp.id)}
                 onMouseUp={(e) => handleMouseUpComponent(e, comp.id)}
                 onClick={(e) => handleComponentClick(comp.id, e)}
                 onMouseEnter={() => setHoveredId(comp.id)}
                 onMouseLeave={() => setHoveredId(null)}
               >
                 <svg className="overflow-visible pointer-events-none">
                    <polyline 
                      points={pointsString} 
                      fill="none" 
                      stroke={comp.color || selectedColor} 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="pointer-events-auto" // Capture clicks on the line itself
                    />
                    {/* Invisible thicker line for easier selection */}
                    <polyline 
                      points={pointsString} 
                      fill="none" 
                      stroke="transparent" 
                      strokeWidth="15" 
                      className="pointer-events-auto cursor-pointer" 
                    />
                 </svg>
                 {isSelected && (
                   <button
                    onClick={(e) => handleDelete(comp.id, e)}
                    className="absolute -top-5 left-0 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md z-40 transform hover:scale-110 transition-transform"
                   >
                    <X size={12} />
                   </button>
                 )}
               </div>
             );
          }

          if (isLayer) {
            baseClasses += " border-2 border-dashed border-slate-600 text-left items-start justify-start p-2 rounded-lg z-0";
            shapeStyles = {
              backgroundColor: 'transparent',
              borderColor: comp.color || '#64748b'
            };
          } else if (isStart || isEnd) {
            baseClasses += " rounded-full border-2 border-slate-700";
          } else if (isDecision || isData) {
            baseClasses += " z-20";
          } else if (isText) {
            baseClasses = "absolute flex items-center justify-center z-30 min-w-[100px] p-2 border-2 border-black rounded";
            shapeStyles = { backgroundColor: 'transparent' };
          } else if (isRect) {
            baseClasses += " border-2 rounded-lg z-10";
            shapeStyles = {
              backgroundColor: 'transparent',
              borderColor: comp.color || '#64748b'
            };
          } else if (isCircle) {
            baseClasses += " border-2 rounded-full z-10";
            shapeStyles = {
              backgroundColor: 'transparent',
              borderColor: comp.color || '#64748b'
            };
          } else {
            baseClasses += " rounded-lg border-2 border-slate-700 p-2";
          }
          
          let colorClasses = "";
          const isStandardNode = !isLayer && !isText && !isRect && !isCircle && !isDecision && !isData;

          if (isSelected) {
            if (isLayer) {
              colorClasses = "border-blue-500 ring-2 ring-blue-500/50 z-0 shadow-blue-500/20";
            } else {
              colorClasses = "border-blue-500 ring-2 ring-blue-500/50 z-30 shadow-blue-500/20";
            }
          } else if (isSource) {
            colorClasses = "border-blue-400 ring-2 ring-blue-400 z-30 animate-pulse";
          } else {
            if (isLayer) colorClasses = "border-slate-600 hover:border-slate-400 z-0";
            else if (isRect || isCircle) colorClasses = "z-10";
            else colorClasses = "z-20";
          }

          const renderContent = () => {
            if (isText) {
              return (
                <textarea
                  autoFocus={!comp.customLabel}
                  value={comp.customLabel || ''}
                  placeholder="Text"
                  onChange={(e) => handleLabelChange(comp.id, e.target.value)}
                  className="bg-transparent border-none text-center focus:outline-none w-full h-full font-bold text-lg text-black resize-none overflow-hidden placeholder:text-gray-400"
                  onKeyDown={(e) => { e.stopPropagation(); }}
                  style={{ minHeight: '24px' }}
                />
              );
            }
            return (
              <>
                <div className="mb-1 text-white">
                    {getIconForType(comp.type)}
                  </div>
                  <div className="text-xs font-bold text-center text-white truncate w-full px-1" title={displayName}>
                    {displayName}
                  </div>
                  {showHierarchy && (
                    <div className="text-[9px] text-center text-white/70 w-full px-1 leading-tight">
                      {hierarchyParts.join(' → ')}
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
              onMouseUp={(e) => handleMouseUpComponent(e, comp.id)}
              onClick={(e) => handleComponentClick(comp.id, e)}
              onMouseEnter={() => setHoveredId(comp.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {isSelected && (
                <>
                  {/* Action Buttons */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex gap-1">
                    <button
                      onClick={(e) => handleBringToFront(comp.id, e)}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 shadow-md z-40 transform hover:scale-110 transition-transform"
                      title="Bring to Front"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={(e) => handleSendToBack(comp.id, e)}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 shadow-md z-40 transform hover:scale-110 transition-transform"
                      title="Send to Back"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(comp.id, e)}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md z-40 transform hover:scale-110 transition-transform"
                      title="Delete"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Resize Handles - Show for all components except flow items and drawings */}
                  {!isStart && !isEnd && !isDecision && !isData && !isDraw && (
                    <>
                      {/* NW */}
                      <div 
                        className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white z-50 cursor-nw-resize"
                        onMouseDown={(e) => handleResizeStart(e, comp.id, 'nw')}
                      />
                      {/* NE */}
                      <div 
                        className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white z-50 cursor-ne-resize"
                        onMouseDown={(e) => handleResizeStart(e, comp.id, 'ne')}
                      />
                      {/* SW */}
                      <div 
                        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white z-50 cursor-sw-resize"
                        onMouseDown={(e) => handleResizeStart(e, comp.id, 'sw')}
                      />
                      {/* SE */}
                      <div 
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white z-50 cursor-se-resize"
                        onMouseDown={(e) => handleResizeStart(e, comp.id, 'se')}
                      />
                    </>
                  )}
                </>
              )}

              {isDecision ? (
                <div className={`w-full h-full transform rotate-45 border-2 border-slate-700 flex items-center justify-center ${isSelected ? 'ring-2 ring-blue-500/50' : ''}`} style={{ backgroundColor: comp.color || '#ca8a04' }}>
                  <div className="transform -rotate-45 flex flex-col items-center w-full">
                      {renderContent()}
                  </div>
                </div>
              ) : isData ? (
                <div className={`w-full h-full transform -skew-x-12 border-2 border-slate-700 flex items-center justify-center ${isSelected ? 'ring-2 ring-blue-500/50' : ''}`} style={{ backgroundColor: comp.color || '#9333ea' }}>
                    <div className="transform skew-x-12 flex flex-col items-center w-full px-4">
                      {renderContent()}
                    </div>
                </div>
              ) : isLayer ? (
                <div className="w-full h-full relative">
                  <div className="flex items-center gap-2 text-white mb-2">
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

        {/* Marquee Selection Box */}
        {marqueeStart && marqueeEnd && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(marqueeStart.x, marqueeEnd.x),
              top: Math.min(marqueeStart.y, marqueeEnd.y),
              width: Math.abs(marqueeEnd.x - marqueeStart.x),
              height: Math.abs(marqueeEnd.y - marqueeStart.y),
              border: '2px dashed #3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Canvas;
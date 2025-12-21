import React, { useRef, useState, useEffect, useMemo } from 'react';
import { SystemComponent, Connection, ComponentType } from '../types';
import { getIconForType, COMPONENT_SPECS } from '../constants';
import { ToolType } from './BottomToolbar';
import { X, Scaling, ArrowUp, ArrowDown, Pin, PinOff } from 'lucide-react';
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

const COMPONENT_WIDTH = 111;  // Reduced by 30% from 158
const COMPONENT_HEIGHT = 63;  // Reduced by 30% from 90

// Merged connection group for auto-layout
interface MergedConnectionGroup {
  originalIds: string[];
  sources: string[];
  targetId: string;
  label: string;
  mergePoint: {x: number, y: number};
  color: string;
  type: 'directed' | 'undirected' | 'loop';
}

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
  // Use selectedIds as the unified selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Helper to get single selected ID (for backwards compatibility)
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingSourceAnchor, setConnectingSourceAnchor] = useState<'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const [tempConnectionTarget, setTempConnectionTarget] = useState<{x: number, y: number} | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedComponent, setDraggedComponent] = useState<{id: string, startX: number, startY: number} | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  const [marqueeStart, setMarqueeStart] = useState<{x: number, y: number} | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{x: number, y: number} | null>(null);
  const [marqueeAdditive, setMarqueeAdditive] = useState(false); // Track if Ctrl/Shift was held at start
  const [preMarqueeSelection, setPreMarqueeSelection] = useState<string[]>([]); // Selection before marquee
  const [draggingWaypoint, setDraggingWaypoint] = useState<{connectionId: string, waypointIndex: number, startX: number, startY: number} | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<{connectionId: string, startX: number, startY: number, initialOffset: {x: number, y: number}} | null>(null);

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
    if (selectedIds.length > 0) {
      setComponents(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, color: selectedColor } : c));
    }
  }, [selectedColor]); // Only trigger on color change, not selection

  // Keyboard Event Listener for Deletion and Layering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const activeType = (document.activeElement as HTMLInputElement)?.type?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      // Also check for password inputs specifically
      if (activeType === 'password') return;

      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          onSnapshot(); // Save state before delete
          setComponents(prev => prev.filter(c => !selectedIds.includes(c.id)));
          setConnections(prev => prev.filter(c => !selectedIds.includes(c.sourceId) && !selectedIds.includes(c.targetId)));
          setSelectedIds([]);
        }
      }

      // Escape key to deselect all
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setEditingConnectionId(null);
      }

      // Ctrl/Cmd + A to select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(components.map(c => c.id));
      }

      // Bring to front: Ctrl/Cmd + ]
      if ((e.metaKey || e.ctrlKey) && e.key === ']' && selectedIds.length > 0) {
        e.preventDefault();
        onSnapshot();
        const maxZ = Math.max(...components.map(c => c.zOrder || 0), 0);
        setComponents(prev => prev.map(c =>
          selectedIds.includes(c.id) ? { ...c, zOrder: maxZ + 1 + selectedIds.indexOf(c.id) } : c
        ));
      }

      // Send to back: Ctrl/Cmd + [
      if ((e.metaKey || e.ctrlKey) && e.key === '[' && selectedIds.length > 0) {
        e.preventDefault();
        onSnapshot();
        const minZ = Math.min(...components.map(c => c.zOrder || 0), 0);
        setComponents(prev => prev.map(c =>
          selectedIds.includes(c.id) ? { ...c, zOrder: minZ - 1 - selectedIds.indexOf(c.id) } : c
        ));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, components, setComponents, setConnections, onSnapshot]);

  const getDimensions = (comp: SystemComponent) => {
    // If custom width/height set by resize, use them
    if (comp.width && comp.height) return { w: comp.width, h: comp.height };

    const { type } = comp;
    if (type === ComponentType.FLOW_START || type === ComponentType.FLOW_END) return { w: 84, h: 84 };
    if (type === ComponentType.FLOW_DECISION) return { w: 140, h: 140 };
    if (type === ComponentType.STRUCTURE_LAYER) return { w: 800, h: 500 };
    if (type === ComponentType.ANNOTATION_RECT) return { w: 400, h: 300 };
    if (type === ComponentType.ANNOTATION_CIRCLE) return { w: 300, h: 300 };
    if (type === ComponentType.ANNOTATION_TEXT) return { w: 240, h: 80 };
    // Freehand drawing defaults mostly irrelevant as we rely on points bounding box conceptually, but needed for selection
    if (type === ComponentType.ANNOTATION_DRAW) return { w: 200, h: 200 };
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

  // Get anchor point position on a component
  const getAnchorPoint = (
    id: string,
    anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ): {x: number, y: number} => {
    const comp = components.find(c => c.id === id);
    if (!comp) return { x: 0, y: 0 };

    const dims = getDimensions(comp);
    const { x, y } = comp;
    const w = dims.w;
    const h = dims.h;

    switch (anchor) {
      case 'top': return { x: x + w / 2, y: y };
      case 'bottom': return { x: x + w / 2, y: y + h };
      case 'left': return { x: x, y: y + h / 2 };
      case 'right': return { x: x + w, y: y + h / 2 };
      case 'top-left': return { x: x, y: y };
      case 'top-right': return { x: x + w, y: y };
      case 'bottom-left': return { x: x, y: y + h };
      case 'bottom-right': return { x: x + w, y: y + h };
      case 'center':
      default:
        return { x: x + w / 2, y: y + h / 2 };
    }
  };

  // Check if a component is inside a container (layer, rect, circle)
  const isComponentInside = (childComp: SystemComponent, containerComp: SystemComponent): boolean => {
    const containerDims = getDimensions(containerComp);
    const childDims = getDimensions(childComp);

    const containerType = containerComp.type;

    if (containerType === ComponentType.STRUCTURE_LAYER || containerType === ComponentType.ANNOTATION_RECT) {
      // Rectangle bounds check
      return (
        childComp.x >= containerComp.x &&
        childComp.y >= containerComp.y &&
        (childComp.x + childDims.w) <= (containerComp.x + containerDims.w) &&
        (childComp.y + childDims.h) <= (containerComp.y + containerDims.h)
      );
    } else if (containerType === ComponentType.ANNOTATION_CIRCLE) {
      // Circle bounds check - check if child center is inside circle
      const childCenterX = childComp.x + childDims.w / 2;
      const childCenterY = childComp.y + childDims.h / 2;
      const circleCenterX = containerComp.x + containerDims.w / 2;
      const circleCenterY = containerComp.y + containerDims.h / 2;
      const radiusX = containerDims.w / 2;
      const radiusY = containerDims.h / 2;

      const normalizedX = (childCenterX - circleCenterX) / radiusX;
      const normalizedY = (childCenterY - circleCenterY) / radiusY;

      return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
    }

    return false;
  };

  // Toggle pinning: detect all components inside container and pin/unpin them
  const handleTogglePin = (containerId: string) => {
    onSnapshot(); // Save state before change

    const container = components.find(c => c.id === containerId);
    if (!container) return;

    const isPinned = (container.childIds && container.childIds.length > 0);

    if (isPinned) {
      // Unpin all children
      setComponents(prev => prev.map(c => {
        if (c.id === containerId) {
          return { ...c, childIds: [] };
        }
        if (c.parentId === containerId) {
          const { parentId, ...rest } = c;
          return rest;
        }
        return c;
      }));
    } else {
      // Pin all components inside this container
      const childrenInside = components.filter(c =>
        c.id !== containerId &&
        isComponentInside(c, container)
      );

      const childIds = childrenInside.map(c => c.id);

      setComponents(prev => prev.map(c => {
        if (c.id === containerId) {
          return { ...c, childIds };
        }
        if (childIds.includes(c.id)) {
          return { ...c, parentId: containerId };
        }
        return c;
      }));
    }
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

  // Detect and group connections that can be merged (same label, same target)
  const detectMergeableConnections = (
    connections: Connection[],
    components: SystemComponent[]
  ): { merged: MergedConnectionGroup[], unmerged: Connection[] } => {
    // Filter out connections with empty labels or self-loops
    const candidateConnections = connections.filter(
      c => c.label && c.label.trim() !== '' && c.sourceId !== c.targetId
    );

    // Group by targetId + label + type
    const groups = new Map<string, Connection[]>();
    candidateConnections.forEach(conn => {
      const key = `${conn.targetId}|||${conn.label}|||${conn.type || 'directed'}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(conn);
    });

    const merged: MergedConnectionGroup[] = [];
    const unmerged: Connection[] = [];

    // Process groups
    groups.forEach((conns, key) => {
      if (conns.length >= 2) {
        // Merge this group
        const targetId = conns[0].targetId;
        const label = conns[0].label!;
        const sources = conns.map(c => c.sourceId);
        const mergePoint = calculateMergePoint(sources, targetId);

        merged.push({
          originalIds: conns.map(c => c.id),
          sources,
          targetId,
          label,
          mergePoint,
          color: conns[0].color || '#000000',
          type: conns[0].type || 'directed'
        });
      } else {
        // Single connection, don't merge
        unmerged.push(conns[0]);
      }
    });

    // Add connections that weren't candidates (empty labels, self-loops)
    connections.forEach(conn => {
      if (!conn.label || conn.label.trim() === '' || conn.sourceId === conn.targetId) {
        unmerged.push(conn);
      }
    });

    return { merged, unmerged };
  };

  // Calculate merge point for grouped connections
  const calculateMergePoint = (
    sourceIds: string[],
    targetId: string
  ): {x: number, y: number} => {
    // Get target center
    const targetComp = components.find(c => c.id === targetId);
    if (!targetComp) return { x: 0, y: 0 };

    const targetDims = getDimensions(targetComp);
    const targetCenter = {
      x: targetComp.x + targetDims.w / 2,
      y: targetComp.y + targetDims.h / 2
    };

    // Calculate centroid of all sources
    let sourceCentroidX = 0;
    let sourceCentroidY = 0;

    sourceIds.forEach(srcId => {
      const srcComp = components.find(c => c.id === srcId);
      if (srcComp) {
        const srcDims = getDimensions(srcComp);
        sourceCentroidX += srcComp.x + srcDims.w / 2;
        sourceCentroidY += srcComp.y + srcDims.h / 2;
      }
    });

    sourceCentroidX /= sourceIds.length;
    sourceCentroidY /= sourceIds.length;

    // Position merge point at 65% along the path from source centroid to target
    const t = 0.65;
    return {
      x: sourceCentroidX + (targetCenter.x - sourceCentroidX) * t,
      y: sourceCentroidY + (targetCenter.y - sourceCentroidY) * t
    };
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
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isSelected = selectedIds.includes(id);

      if (isCtrlOrCmd) {
        // Ctrl+click: Toggle selection
        if (isSelected) {
          setSelectedIds(prev => prev.filter(i => i !== id));
        } else {
          setSelectedIds(prev => [...prev, id]);
        }
      } else if (isShift) {
        // Shift+click: Add to selection (without removing others)
        if (!isSelected) {
          setSelectedIds(prev => [...prev, id]);
        }
      } else {
        // Regular click: Select this item only
        // If multiple items are selected and we click one, select only that one
        // If only this item is selected, keep it selected
        if (!isSelected || selectedIds.length > 1) {
          setSelectedIds([id]);
        }
      }
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

    // Panning with middle mouse, space+drag, or pan tool
    if (isMiddleClick || (isLeftClick && isSpaceDown) || (isLeftClick && activeTool === 'pan')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Start marquee selection with select tool
    if (isLeftClick && activeTool === 'select') {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAdditive = isCtrlOrCmd || isShift;

      setMarqueeStart({ x, y });
      setMarqueeEnd({ x, y });
      setMarqueeAdditive(isAdditive);

      // Save current selection for additive mode
      if (isAdditive) {
        setPreMarqueeSelection([...selectedIds]);
      } else {
        setPreMarqueeSelection([]);
        setSelectedIds([]);
      }
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
        x: x - 120, y: y - 40,
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
        x: x - 200, y: y - 150,
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
        x: x - 150, y: y - 150,
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

    setSelectedIds([]);
    setEditingConnectionId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSnapshot(); // Save state before delete
    // If deleting a selected item, delete all selected items
    if (selectedIds.includes(id)) {
      setComponents(prev => prev.filter(c => !selectedIds.includes(c.id)));
      setConnections(prev => prev.filter(c => !selectedIds.includes(c.sourceId) && !selectedIds.includes(c.targetId)));
      setSelectedIds([]);
    } else {
      // Delete just this one item
      setComponents(prev => prev.filter(c => c.id !== id));
      setConnections(prev => prev.filter(c => c.sourceId !== id && c.targetId !== id));
    }
  };

  const handleDeleteConnection = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     onSnapshot(); // Save state before delete
     setConnections(prev => prev.filter(c => c.id !== id));
  };

  const handleAddWaypoint = (connectionId: string, x: number, y: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onSnapshot(); // Save state before adding waypoint

    setConnections(prev => prev.map(conn => {
      if (conn.id === connectionId) {
        const waypoints = conn.waypoints || [];
        return {
          ...conn,
          waypoints: [...waypoints, { x, y }]
        };
      }
      return conn;
    }));
  };

  const handleAnchorClick = (e: React.MouseEvent, componentId: string, anchor: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.stopPropagation();

    if (activeTool === 'connect_arrow' || activeTool === 'connect_line' || activeTool === 'connect_loop') {
      if (!connectingSourceId) {
        // Starting a new connection from this anchor
        setConnectingSourceId(componentId);
        setConnectingSourceAnchor(anchor);

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left - viewState.x) / viewState.zoom;
          const y = (e.clientY - rect.top - viewState.y) / viewState.zoom;
          setTempConnectionTarget({ x, y });
        }
      }
    }
  };

  const handleMouseDownComponent = (e: React.MouseEvent, id: string) => {
    if (e.button === 1 || (e.button === 0 && e.getModifierState("Space"))) {
      handleCanvasMouseDown(e);
      return;
    }

    // Connection Logic: Drag to Connect (fallback to center if no anchor clicked)
    if (activeTool === 'connect_arrow' || activeTool === 'connect_line' || activeTool === 'connect_loop') {
      e.stopPropagation();
      setConnectingSourceId(id);
      setConnectingSourceAnchor('center'); // Default to center

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
         const x = (e.clientX - rect.left - viewState.x) / viewState.zoom;
         const y = (e.clientY - rect.top - viewState.y) / viewState.zoom;
         setTempConnectionTarget({ x, y });
      }
      return;
    }

    if (activeTool !== 'select') return;
    e.stopPropagation();

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlreadySelected = selectedIds.includes(id);

    // Handle selection on mouse down (similar to Windows Explorer)
    if (isCtrlOrCmd) {
      // Ctrl+click: Will toggle on click, just start drag for now if selected
      if (!isAlreadySelected) {
        // Add to selection and start dragging the new item
        setSelectedIds(prev => [...prev, id]);
      }
    } else if (isShift) {
      // Shift+click: Add to selection without removing
      if (!isAlreadySelected) {
        setSelectedIds(prev => [...prev, id]);
      }
    } else {
      // Regular click on unselected item: select only this one
      if (!isAlreadySelected) {
        setSelectedIds([id]);
      }
      // If already selected, keep current selection (allows dragging multiple)
    }

    onSnapshot(); // Save state before starting drag
    setDraggedComponent({ id, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseUpComponent = (e: React.MouseEvent, targetId: string, targetAnchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
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
            color: connectionColor,
            sourceAnchor: connectingSourceAnchor || undefined,
            targetAnchor: targetAnchor || 'center'
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
    setConnectingSourceAnchor(null);
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
    // Dragging Label
    if (draggingLabel) {
      const dx = (e.clientX - draggingLabel.startX) / viewState.zoom;
      const dy = (e.clientY - draggingLabel.startY) / viewState.zoom;

      setConnections(prev => prev.map(conn => {
        if (conn.id === draggingLabel.connectionId) {
          const newOffset = {
            x: draggingLabel.initialOffset.x + dx,
            y: draggingLabel.initialOffset.y + dy
          };
          return { ...conn, labelOffset: newOffset };
        }
        return conn;
      }));

      setDraggingLabel({
        ...draggingLabel,
        startX: e.clientX,
        startY: e.clientY,
        initialOffset: {
          x: draggingLabel.initialOffset.x + dx,
          y: draggingLabel.initialOffset.y + dy
        }
      });
      return;
    }

    // Dragging Waypoint
    if (draggingWaypoint) {
      const dx = (e.clientX - draggingWaypoint.startX) / viewState.zoom;
      const dy = (e.clientY - draggingWaypoint.startY) / viewState.zoom;

      setConnections(prev => prev.map(conn => {
        if (conn.id === draggingWaypoint.connectionId) {
          const waypoints = [...(conn.waypoints || [])];
          if (waypoints[draggingWaypoint.waypointIndex]) {
            waypoints[draggingWaypoint.waypointIndex] = {
              x: waypoints[draggingWaypoint.waypointIndex].x + dx,
              y: waypoints[draggingWaypoint.waypointIndex].y + dy
            };
          }
          return { ...conn, waypoints };
        }
        return conn;
      }));

      setDraggingWaypoint({
        ...draggingWaypoint,
        startX: e.clientX,
        startY: e.clientY
      });
      return;
    }

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

        const marqueeSelected = components.filter(comp => {
          const dims = getDimensions(comp);
          const compMinX = comp.x;
          const compMaxX = comp.x + dims.w;
          const compMinY = comp.y;
          const compMaxY = comp.y + dims.h;

          // Check if component overlaps with marquee
          return !(compMaxX < minX || compMinX > maxX || compMaxY < minY || compMinY > maxY);
        }).map(c => c.id);

        // Combine with pre-marquee selection if additive mode
        if (marqueeAdditive) {
          const combined = new Set([...preMarqueeSelection, ...marqueeSelected]);
          setSelectedIds(Array.from(combined));
        } else {
          setSelectedIds(marqueeSelected);
        }
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

    // Dragging Component(s)
    if (draggedComponent) {
      const dx = (e.clientX - draggedComponent.startX) / viewState.zoom;
      const dy = (e.clientY - draggedComponent.startY) / viewState.zoom;

      // Determine which components to move
      const componentsToMove = new Set<string>();

      // If the dragged component is in the selection, move all selected
      if (selectedIds.includes(draggedComponent.id)) {
        selectedIds.forEach(id => componentsToMove.add(id));
      } else {
        // Only move the dragged component
        componentsToMove.add(draggedComponent.id);
      }

      // Add all pinned children of the components being moved
      components.forEach(comp => {
        if (componentsToMove.has(comp.id) && comp.childIds) {
          comp.childIds.forEach(childId => componentsToMove.add(childId));
        }
      });

      setComponents(prev => prev.map(c => {
        if (componentsToMove.has(c.id)) {
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
      setMarqueeAdditive(false);
      setPreMarqueeSelection([]);
      // selectedIds is already set from mouse move
    }

    setDraggedComponent(null);
    setResizing(null);
    setIsPanning(false);
    setCurrentDrawingId(null);
    setDraggingWaypoint(null);
    setDraggingLabel(null);

    // If we were dragging a connection and didn't hit a component, cancel it
    if (connectingSourceId) {
        setConnectingSourceId(null);
        setConnectingSourceAnchor(null);
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
    // If item is selected, bring all selected to front
    const idsToMove = selectedIds.includes(id) ? selectedIds : [id];
    setComponents(prev => {
      const maxZ = Math.max(...prev.map(c => c.zOrder || 0), 0);
      return prev.map((c, idx) => idsToMove.includes(c.id) ? { ...c, zOrder: maxZ + 1 + idsToMove.indexOf(c.id) } : c);
    });
  };

  const handleSendToBack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSnapshot();
    // If item is selected, send all selected to back
    const idsToMove = selectedIds.includes(id) ? selectedIds : [id];
    setComponents(prev => {
      const minZ = Math.min(...prev.map(c => c.zOrder || 0), 0);
      return prev.map((c, idx) => idsToMove.includes(c.id) ? { ...c, zOrder: minZ - 1 - idsToMove.indexOf(c.id) } : c);
    });
  };

  const getCursorClass = () => {
    if (resizing) return 'cursor-nwse-resize';
    if (isPanning) return 'cursor-grabbing';
    if (draggedComponent) return 'cursor-grabbing';
    if (activeTool === 'pan') return isPanning ? 'cursor-grabbing' : 'cursor-grab';
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
          {connectingSourceId && tempConnectionTarget && (() => {
            let startPoint: {x: number, y: number};
            if (connectingSourceAnchor) {
              startPoint = getAnchorPoint(connectingSourceId, connectingSourceAnchor);
            } else {
              startPoint = getIntersection(connectingSourceId, tempConnectionTarget);
            }

            return (
              <line
                x1={startPoint.x + 5000}
                y1={startPoint.y + 5000}
                x2={tempConnectionTarget.x + 5000}
                y2={tempConnectionTarget.y + 5000}
                stroke={activeTool === 'connect_arrow' ? '#000000' : (activeTool === 'connect_loop' ? '#eab308' : selectedColor)}
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd={activeTool === 'connect_arrow' ? `url(#${getMarkerId('#000000')})` : undefined}
                className="opacity-60"
              />
            );
          })()}

          {(() => {
            // Detect and separate merged vs unmerged connections
            const { merged, unmerged } = useMemo(
              () => detectMergeableConnections(connections, components),
              [connections, components]
            );

            const offsetX = 5000;
            const offsetY = 5000;

            return (
              <>
                {/* Render merged connection groups */}
                {merged.map(group => {
                  const targetComp = components.find(c => c.id === group.targetId);
                  if (!targetComp) return null;

                  const targetDims = getDimensions(targetComp);
                  const targetCenter = {
                    x: targetComp.x + targetDims.w / 2,
                    y: targetComp.y + targetDims.h / 2
                  };

                  const mergeX = group.mergePoint.x + offsetX;
                  const mergeY = group.mergePoint.y + offsetY;

                  // Calculate end point at target boundary
                  const targetComp2 = components.find(c => c.id === group.targetId);
                  const endPoint = targetComp2 ? getIntersection(group.targetId, group.mergePoint) : targetCenter;

                  return (
                    <g key={`merged-${group.originalIds.join('-')}`} className="merged-connection-group">
                      {/* Individual source → merge point paths */}
                      {group.sources.map((sourceId, idx) => {
                        const sourceComp = components.find(c => c.id === sourceId);
                        if (!sourceComp) return null;

                        const sourceDims = getDimensions(sourceComp);
                        const sourceCenter = {
                          x: sourceComp.x + sourceDims.w / 2,
                          y: sourceComp.y + sourceDims.h / 2
                        };

                        const startPoint = getIntersection(sourceId, group.mergePoint);

                        return (
                          <path
                            key={`source-${sourceId}-${idx}`}
                            d={`M ${startPoint.x + offsetX} ${startPoint.y + offsetY} L ${mergeX} ${mergeY}`}
                            stroke={group.color}
                            strokeWidth="2"
                            fill="none"
                            opacity="0.8"
                            className="pointer-events-none"
                          />
                        );
                      })}

                      {/* Merge point → target path with arrowhead */}
                      <path
                        d={`M ${mergeX} ${mergeY} L ${endPoint.x + offsetX} ${endPoint.y + offsetY}`}
                        stroke={group.color}
                        strokeWidth="3"
                        fill="none"
                        markerEnd={group.type === 'directed' ? `url(#${getMarkerId(group.color)})` : undefined}
                        className="pointer-events-none"
                      />

                      {/* Merge point marker (small circle) */}
                      <circle
                        cx={mergeX}
                        cy={mergeY}
                        r="5"
                        fill={group.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="pointer-events-none"
                      />

                      {/* Count badge label at merge point */}
                      <g transform={`translate(${mergeX}, ${mergeY - 30})`}>
                        <rect
                          x={-group.label.length * 3 - 15}
                          y={-14}
                          width={group.label.length * 6 + 30}
                          height={28}
                          rx={14}
                          fill="#ffffff"
                          stroke={group.color}
                          strokeWidth="2"
                          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                        />
                        {/* Count badge circle */}
                        <circle
                          cx={-group.label.length * 3}
                          cy={0}
                          r={10}
                          fill={group.color}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <text
                          x={-group.label.length * 3}
                          y={4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10px"
                          fontWeight="bold"
                        >
                          {group.sources.length}
                        </text>
                        {/* Label text */}
                        <text
                          x={5}
                          y={4}
                          textAnchor="start"
                          fill="#000000"
                          fontSize="11px"
                          fontWeight="600"
                        >
                          {group.label} ({group.sources.length}×)
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Render unmerged connections (original logic) */}
                {unmerged.map(conn => {
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
                // Straight Line or with Waypoints
                // Use anchor points if specified, otherwise use center intersection
                let start: {x: number, y: number};
                let end: {x: number, y: number};

                if (conn.sourceAnchor) {
                  start = getAnchorPoint(conn.sourceId, conn.sourceAnchor);
                } else {
                  start = getIntersection(conn.sourceId, targetCenter);
                }

                if (conn.targetAnchor) {
                  end = getAnchorPoint(conn.targetId, conn.targetAnchor);
                } else {
                  end = getIntersection(conn.targetId, sourceCenter);
                }

                // Build path with waypoints if they exist
                pathData = `M ${start.x + offsetX} ${start.y + offsetY}`;

                if (conn.waypoints && conn.waypoints.length > 0) {
                  conn.waypoints.forEach(wp => {
                    pathData += ` L ${wp.x + offsetX} ${wp.y + offsetY}`;
                  });
                }

                pathData += ` L ${end.x + offsetX} ${end.y + offsetY}`;

                // Position label at 75% along the path (closer to arrowhead/target)
                if (conn.waypoints && conn.waypoints.length > 0) {
                  // Use last waypoint or interpolate towards end
                  const lastWaypoint = conn.waypoints[conn.waypoints.length - 1];
                  midX = lastWaypoint.x + (end.x - lastWaypoint.x) * 0.5 + offsetX;
                  midY = lastWaypoint.y + (end.y - lastWaypoint.y) * 0.5 + offsetY;
                } else {
                  midX = start.x + (end.x - start.x) * 0.75 + offsetX;
                  midY = start.y + (end.y - start.y) * 0.75 + offsetY;
                }
            }

            return (
              <g key={conn.id} className="pointer-events-auto group" style={{ color: strokeColor }}>
                {/* Invisible wide stroke for easier selection and waypoint addition */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="15"
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setEditingConnectionId(conn.id); }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    // Calculate position in world coordinates (remove SVG offset)
                    const x = e.nativeEvent.offsetX - offsetX;
                    const y = e.nativeEvent.offsetY - offsetY;
                    handleAddWaypoint(conn.id, x, y, e);
                  }}
                />
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2"
                  markerEnd={isDirected || (isLoop && conn.sourceId === conn.targetId) ? `url(#${getMarkerId(strokeColor)})` : undefined}
                  className="transition-colors opacity-80 group-hover:opacity-100"
                />

                {/* Waypoint Handles - Show as draggable circles */}
                {conn.waypoints && conn.waypoints.map((waypoint, idx) => (
                  <circle
                    key={`waypoint-${idx}`}
                    cx={waypoint.x + offsetX}
                    cy={waypoint.y + offsetY}
                    r="4"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="1.5"
                    className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSnapshot(); // Save state before dragging waypoint
                      setDraggingWaypoint({
                        connectionId: conn.id,
                        waypointIndex: idx,
                        startX: e.clientX,
                        startY: e.clientY
                      });
                    }}
                  />
                ))}

                {/* Label */}
                {(conn.label || editingConnectionId === conn.id) && (() => {
                  // Calculate line angle to determine automatic offset
                  let autoOffsetY = 0;

                  if (!isLoop || conn.sourceId !== conn.targetId) {
                    // For straight lines and connections between different nodes
                    // Calculate the angle/slope at the label position
                    let dx = 0;
                    let dy = 0;

                    if (conn.waypoints && conn.waypoints.length > 0) {
                      // Use angle from last waypoint to end
                      const lastWaypoint = conn.waypoints[conn.waypoints.length - 1];
                      const end = conn.targetAnchor
                        ? getAnchorPoint(conn.targetId, conn.targetAnchor)
                        : getIntersection(conn.targetId, getCenter(conn.sourceId));
                      dx = end.x - lastWaypoint.x;
                      dy = end.y - lastWaypoint.y;
                    } else {
                      // Use angle from start to end
                      const start = conn.sourceAnchor
                        ? getAnchorPoint(conn.sourceId, conn.sourceAnchor)
                        : getIntersection(conn.sourceId, getCenter(conn.targetId));
                      const end = conn.targetAnchor
                        ? getAnchorPoint(conn.targetId, conn.targetAnchor)
                        : getIntersection(conn.targetId, getCenter(conn.sourceId));
                      dx = end.x - start.x;
                      dy = end.y - start.y;
                    }

                    // If line is mostly horizontal (abs(dy) < abs(dx) * 0.5), offset label above
                    if (Math.abs(dy) < Math.abs(dx) * 0.5) {
                      autoOffsetY = -20; // Offset 20px above the line
                    }
                  }

                  // Apply both automatic offset and manual user offset
                  const labelX = midX + (conn.labelOffset?.x || 0);
                  const labelY = midY + autoOffsetY + (conn.labelOffset?.y || 0);

                  return (
                    <g transform={`translate(${labelX}, ${labelY})`}>
                        <rect
                          x="-20" y="-12" width="40" height="24" rx="4"
                          fill="#ffffff" stroke={strokeColor} strokeWidth="1"
                          className="cursor-move"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onSnapshot(); // Save state before dragging label
                            setDraggingLabel({
                              connectionId: conn.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              initialOffset: conn.labelOffset || { x: 0, y: 0 }
                            });
                          }}
                        />
                        {editingConnectionId === conn.id ? (
                          <foreignObject x="-30" y="-12" width="60" height="24">
                            <input
                              autoFocus
                              className="w-full h-full bg-transparent text-center text-[10px] text-black focus:outline-none"
                              defaultValue={conn.label}
                              onBlur={(e) => updateConnectionLabel(conn.id, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && updateConnectionLabel(conn.id, e.currentTarget.value)}
                            />
                          </foreignObject>
                        ) : (
                          <text
                            x="0" y="4" textAnchor="middle" fill="#000000" fontSize="10px" fontWeight="500"
                            className="pointer-events-none select-none"
                          >
                            {conn.label}
                          </text>
                        )}
                    </g>
                  );
                })()}
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
              </>
            );
          })()}
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
          const isProcess = comp.type === ComponentType.FLOW_PROCESS;
          const isDecision = comp.type === ComponentType.FLOW_DECISION;
          const isData = comp.type === ComponentType.FLOW_DATA;
          const isLoop = comp.type === ComponentType.FLOW_LOOP;
          const isTimer = comp.type === ComponentType.FLOW_TIMER;
          const isEvent = comp.type === ComponentType.FLOW_EVENT;
          const isText = comp.type === ComponentType.ANNOTATION_TEXT;
          const isRect = comp.type === ComponentType.ANNOTATION_RECT;
          const isCircle = comp.type === ComponentType.ANNOTATION_CIRCLE;
          const isDraw = comp.type === ComponentType.ANNOTATION_DRAW;

          // Check if this is any flow component
          const isFlowComponent = isStart || isEnd || isProcess || isDecision || isData || isLoop || isTimer || isEvent;
          
          // Build hierarchy breadcrumb
          let displayName = comp.tool || comp.customLabel || comp.label;
          let hierarchyParts: string[] = [];

          if (!isText) {
            const subType = spec?.subTypes?.find(s => s.id === comp.subType);

            if (!displayName) {
              displayName = subType?.label || spec?.label || 'Unknown';
            }

            // Show only the parent level (one level up from the component name)
            if (comp.tool && subType) {
              // Tool level: show only subType as parent
              hierarchyParts.push(subType.label);
            } else if (comp.subType && subType) {
              // SubType level: show only spec as parent
              if (spec?.label) hierarchyParts.push(spec.label);
            }
            // Only show one parent level, not entire hierarchy
          }

          const showHierarchy = hierarchyParts.length > 0 && !isStart && !isEnd && !isDecision && !isText && !isRect && !isCircle && !isDraw;

          let baseClasses = "absolute flex flex-col items-center justify-center select-none transition-all shadow-lg";
          let shapeStyles: React.CSSProperties = {
            backgroundColor: isFlowComponent ? 'transparent' : (comp.color || '#1e3a8a'),
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
            // Don't render content for rect and circle annotations - they're just visual containers
            if (isRect || isCircle) {
              return null;
            }
            return (
              <>
                <div className={`mb-1 ${isLayer || isFlowComponent ? 'text-black' : 'text-white'}`} style={{ transform: 'scale(1.125)' }}>
                    {getIconForType(comp.type)}
                  </div>
                  <div className={`text-xs font-bold text-center truncate w-full px-1 ${isLayer || isFlowComponent ? 'text-black' : 'text-white'}`} title={displayName}>
                    {displayName}
                  </div>
                  {showHierarchy && (
                    <div className={`text-[9px] text-center w-full px-1 leading-tight ${isLayer || isFlowComponent ? 'text-black/70' : 'text-white/70'}`}>
                      {hierarchyParts[0]}
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
                    {/* Pin/Unpin button - only for containers (layer, rect, circle) */}
                    {(isLayer || isRect || isCircle) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(comp.id);
                        }}
                        className={`${
                          comp.childIds && comp.childIds.length > 0
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-slate-500 hover:bg-slate-600'
                        } text-white rounded-full p-1 shadow-md z-40 transform hover:scale-110 transition-transform`}
                        title={comp.childIds && comp.childIds.length > 0 ? `Unpin ${comp.childIds.length} items` : 'Pin items inside'}
                      >
                        {comp.childIds && comp.childIds.length > 0 ? <Pin size={12} /> : <PinOff size={12} />}
                      </button>
                    )}
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

                  {/* Connection Anchor Points - Show when in connection mode */}
                  {(activeTool === 'connect_arrow' || activeTool === 'connect_line' || activeTool === 'connect_loop') && !isText && !isDraw && (
                    <>
                      {/* Center */}
                      <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Center"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'center')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'center')}
                      />
                      {/* Top */}
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Top"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'top')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'top')}
                      />
                      {/* Bottom */}
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Bottom"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'bottom')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'bottom')}
                      />
                      {/* Left */}
                      <div
                        className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Left"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'left')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'left')}
                      />
                      {/* Right */}
                      <div
                        className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Right"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'right')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'right')}
                      />
                      {/* Corners */}
                      <div
                        className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Top-Left"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'top-left')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'top-left')}
                      />
                      <div
                        className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Top-Right"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'top-right')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'top-right')}
                      />
                      <div
                        className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Bottom-Left"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'bottom-left')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'bottom-left')}
                      />
                      <div
                        className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-green-500 rounded-full opacity-70 hover:opacity-100 hover:scale-150 transition-all z-50 cursor-pointer"
                        title="Bottom-Right"
                        onMouseDown={(e) => handleAnchorClick(e, comp.id, 'bottom-right')}
                        onMouseUp={(e) => handleMouseUpComponent(e, comp.id, 'bottom-right')}
                      />
                    </>
                  )}

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
                <div className={`w-full h-full transform rotate-45 border-2 border-slate-700 flex items-center justify-center ${isSelected ? 'ring-2 ring-blue-500/50' : ''}`} style={{ backgroundColor: 'transparent' }}>
                  <div className="transform -rotate-45 flex flex-col items-center w-full">
                      {renderContent()}
                  </div>
                </div>
              ) : isData ? (
                <div className={`w-full h-full transform -skew-x-12 border-2 border-slate-700 flex items-center justify-center ${isSelected ? 'ring-2 ring-blue-500/50' : ''}`} style={{ backgroundColor: 'transparent' }}>
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
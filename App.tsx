import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import TopBar from './components/TopBar';
import BottomToolbar, { ToolType } from './components/BottomToolbar';
import EvaluationModal from './components/EvaluationModal';
import HintModal from './components/HintModal';
import ComponentConfigDialog from './components/ComponentConfigDialog';
import RequirementsPanel from './components/RequirementsPanel';
import AITutor from './components/AITutor';
import AISettings from './components/AISettings';
import SolutionPlayer from './components/SolutionPlayer';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { generateChallenge, evaluateDesign, generateHints, generateSolution, improveSolution, ImprovementResult, DifficultyLevel, getUserApiKey } from './services/gemini';
import { hasApiKey } from './services/ai-service';
import { SystemComponent, Connection, ComponentType, Challenge, EvaluationResult, HintResult, SolutionResult, SolutionComponent, SolutionConnection } from './types';
import { COMPONENT_SPECS } from './constants';
import * as analytics from './utils/analytics';

export interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

interface HistoryState {
  components: SystemComponent[];
  connections: Connection[];
}

const App: React.FC = () => {
  // State
  const [components, setComponents] = useState<SystemComponent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [hintResult, setHintResult] = useState<HintResult | null>(null);
  
  // History for Undo
  const [history, setHistory] = useState<HistoryState[]>([]);

  // View State (Pan & Zoom)
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, zoom: 0.7 });

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGettingHint, setIsGettingHint] = useState(false);
  
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showChallengeExpanded, setShowChallengeExpanded] = useState(false);
  const [requirementsCollapsed, setRequirementsCollapsed] = useState(false);
  const [lastEvaluatedDesignHash, setLastEvaluatedDesignHash] = useState<string | null>(null);

  // Solution Player State
  const [solutionResult, setSolutionResult] = useState<SolutionResult | null>(null);
  const [isGeneratingSolution, setIsGeneratingSolution] = useState(false);
  const [showSolutionPlayer, setShowSolutionPlayer] = useState(false);
  const [solutionStep, setSolutionStep] = useState(-1); // Start at -1 so step 0 gets applied on first walkthrough
  const [solutionIdMap, setSolutionIdMap] = useState<Record<string, string>>({}); // Maps solution IDs to canvas IDs

  // Improvement State
  const [isEvaluatingForImprovement, setIsEvaluatingForImprovement] = useState(false);
  const [solutionEvaluationScore, setSolutionEvaluationScore] = useState<number | null>(null);
  const [improvementResult, setImprovementResult] = useState<ImprovementResult | null>(null);
  const [isImproving, setIsImproving] = useState(false);

  // Tools State
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#1e3a8a'); // Default Navy

  // Difficulty Selection
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('Medium');

  // AI Tutor control state (for API key prompting)
  const [forceOpenTutor, setForceOpenTutor] = useState(false);
  const [apiKeyNeededMessage, setApiKeyNeededMessage] = useState<string | null>(null);

  // AI Settings Modal
  const [showAISettings, setShowAISettings] = useState(false);
  const [highlightSettings, setHighlightSettings] = useState(false);
  const [hasClosedSettingsOnce, setHasClosedSettingsOnce] = useState(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Configuration Dialog State
  const [configDialog, setConfigDialog] = useState<{
    isOpen: boolean;
    componentType: ComponentType | null;
    draftComponent: Partial<SystemComponent> | null;
    initialSubTypeId?: string; // Pre-select if dropped from Level 3
  }>({
    isOpen: false,
    componentType: null,
    draftComponent: null
  });

  // Permanent constraint: always keep at least one Start and one End node
  useEffect(() => {
    const hasStart = components.some(c => c.type === ComponentType.FLOW_START);
    const hasEnd   = components.some(c => c.type === ComponentType.FLOW_END);
    if (hasStart && hasEnd) return;
    setComponents(prev => {
      const updated = [...prev];
      if (!updated.some(c => c.type === ComponentType.FLOW_START)) {
        updated.unshift({ id: `start-${Date.now()}`, type: ComponentType.FLOW_START, x: 300, y: 300, label: 'Start' });
      }
      if (!updated.some(c => c.type === ComponentType.FLOW_END)) {
        updated.push({ id: `end-${Date.now()}`, type: ComponentType.FLOW_END, x: 900, y: 600, label: 'End' });
      }
      return updated;
    });
  }, [components]);

  // Check if user has an API key on first load and show settings
  useEffect(() => {
    const hasVisited = localStorage.getItem('has_visited');
    const hasKey = hasApiKey();

    // Track session start
    analytics.trackSessionStart();

    if (!hasKey) {
      // No API key configured - open settings immediately
      setShowAISettings(true);
      setApiKeyNeededMessage('Welcome! Please configure your AI provider and API key to get started.');

      if (!hasVisited) {
        localStorage.setItem('has_visited', 'true');
      }
    }
  }, []);

  // Undo / History Logic
  const handleSnapshot = useCallback(() => {
    setHistory(prev => {
      const newState = { components, connections };
      // Keep last 30 states
      const newHistory = [...prev, newState].slice(-30);
      return newHistory;
    });
  }, [components, connections]);

  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const lastState = prev[prev.length - 1];
      const newHistory = prev.slice(0, -1);

      setComponents(lastState.components);
      setConnections(lastState.connections);

      return newHistory;
    });
  }, []);

  // Toast Notification Helpers
  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (activeTool !== 'select') setActiveTool('select');

    const type = event.dataTransfer.getData('application/reactflow') as ComponentType;
    const customLabel = event.dataTransfer.getData('application/reactflow-label');
    const subTypeId = event.dataTransfer.getData('application/reactflow-subtype');
    const dropColor = event.dataTransfer.getData('application/reactflow-color'); // Get color from Sidebar drag
    
    if (!type) return;

    // Calculate Position relative to Canvas World Space
    // Sidebar width = 224px (w-56), TopBar height ~64px
    const sidebarWidth = 224;
    const topBarHeight = 64;
    
    // Convert screen coordinates to canvas world coordinates
    const worldX = (event.clientX - sidebarWidth - viewState.x) / viewState.zoom;
    const worldY = (event.clientY - topBarHeight - viewState.y) / viewState.zoom;

    const spec = COMPONENT_SPECS[type];
    
    let label = spec?.label;
    if (customLabel) label = customLabel;
    if (subTypeId && spec?.subTypes) {
      const sub = spec.subTypes.find(s => s.id === subTypeId);
      if (sub) label = sub.label;
    }

    const draft = {
      id: `node-${Date.now()}`,
      type,
      x: worldX - 140, // Center approx component width (doubled)
      y: worldY - 80, // Center approx component height (doubled)
      label: label,
      customLabel: customLabel || undefined,
      subType: subTypeId || undefined,
      color: dropColor || selectedColor // Use dropped color or fallback
    };

    const hasSubTypes = spec?.subTypes && spec.subTypes.length > 0;
    const hasPredefinedLabel = !!customLabel;

    if (hasSubTypes && !hasPredefinedLabel) {
      setConfigDialog({
        isOpen: true,
        componentType: type,
        draftComponent: draft,
        initialSubTypeId: subTypeId
      });
    } else {
      // Save state before adding
      handleSnapshot();
      setComponents((prev) => [...prev, draft as SystemComponent]);

      // Track component added
      analytics.trackComponentAdded(type);
    }
  };

  const handleConfigComplete = (subType: string, tool: string) => {
    if (!configDialog.draftComponent) return;

    const newComponent: SystemComponent = {
      ...(configDialog.draftComponent as SystemComponent),
      subType,
      tool,
      label: tool || configDialog.draftComponent.label
    };

    // Save state before adding
    handleSnapshot();
    setComponents(prev => [...prev, newComponent]);
    setConfigDialog({ isOpen: false, componentType: null, draftComponent: null });

    // Track component added with tool name
    analytics.trackComponentAdded(`${configDialog.componentType}:${tool}`);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleGenerateChallenge = async (difficulty: DifficultyLevel) => {
    setIsGenerating(true);

    // Clear everything BEFORE generating new challenge to avoid race conditions
    setChallenge(null);
    setComponents([]);
    setConnections([]);
    setHistory([]);

    // Reset all evaluation state
    setEvaluation(null);
    setShowEvaluation(false);
    setLastEvaluatedDesignHash(null);
    setIsEvaluating(false);

    // Reset all hint state
    setHintResult(null);
    setShowHint(false);
    setIsGettingHint(false);

    // Reset all solution state
    setSolutionResult(null);
    setShowSolutionPlayer(false);
    setSolutionStep(-1);
    setSolutionIdMap({});
    setIsGeneratingSolution(false);
    setSolutionEvaluationScore(null);

    // Reset all improvement state
    setImprovementResult(null);
    setIsImproving(false);
    setIsEvaluatingForImprovement(false);

    // Clear any API key error state
    setApiKeyNeededMessage(null);
    setForceOpenTutor(false);

    try {
      // Now generate the new challenge
      const newChallenge = await generateChallenge(undefined, difficulty);
      setChallenge(newChallenge);

      // Track successful challenge generation
      analytics.trackChallengeGenerated(difficulty);
    } catch (error: any) {
      // Track error
      analytics.trackError('challenge_generation', error?.message || 'Unknown error');
      console.error("Challenge generation error:", error);

      // Check for service unavailable errors first (503/UNAVAILABLE)
      if (error?.error?.code === 503 || error?.error?.status === 'UNAVAILABLE') {
        showToast("The AI service is busy right now. Please try again in a moment.");
        return;
      }

      // Check if this is an API key, authentication, or quota issue
      const userHasKey = getUserApiKey();
      if (error?.message === 'NO_API_KEY' || error?.status === 401 || error?.status === 403 || error?.error?.code === 429 || error?.status === 429) {
        if (userHasKey) {
          if (error?.error?.code === 429 || error?.status === 429) {
            setApiKeyNeededMessage("The app's API key has exceeded its quota. Your saved API key will be used for all AI features.");
          } else {
            setApiKeyNeededMessage("The app's API key is unavailable. Your saved API key will be used for all AI features.");
          }
        } else {
          if (error?.error?.code === 429 || error?.status === 429) {
            setApiKeyNeededMessage("The app's API key has exceeded its quota. Please enter your Google Gemini API key to continue.");
          } else {
            setApiKeyNeededMessage("No API key configured. Please enter your Google Gemini API key to use AI features.");
          }
        }
        setForceOpenTutor(true);
      } else {
        // Other error - show user-friendly message
        showToast("Unable to generate challenge. Please try again.");
        if (!userHasKey) {
          setApiKeyNeededMessage("AI service error. Please provide your own API key to continue.");
          setForceOpenTutor(true);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Callback when user provides API key through AI Tutor
  const handleApiKeyReady = () => {
    setApiKeyNeededMessage(null);
    setForceOpenTutor(false);
    // Optionally auto-retry the last action
  };

  // Create a simple hash of the design to detect changes
  const getDesignHash = () => {
    const designData = {
      components: components.map(c => ({ id: c.id, type: c.type, label: c.label, tool: c.tool })),
      connections: connections.map(c => ({ sourceId: c.sourceId, targetId: c.targetId }))
    };
    return JSON.stringify(designData);
  };

  const handleEvaluate = async () => {
    if (!challenge) return;

    const currentHash = getDesignHash();

    // If we have a cached evaluation and design hasn't changed, just show it
    if (evaluation && lastEvaluatedDesignHash === currentHash) {
      setShowEvaluation(true);
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await evaluateDesign(challenge, components, connections);
      setEvaluation(result);
      setLastEvaluatedDesignHash(currentHash);
      setShowEvaluation(true);

      // Track successful evaluation
      analytics.trackDesignEvaluated(result.score, components.length);
    } catch (error: any) {
      analytics.trackError('design_evaluation', error?.message || 'Unknown error');
      console.error("Evaluation failed:", error);

      // Check for service unavailable errors first (503/UNAVAILABLE)
      if (error?.error?.code === 503 || error?.error?.status === 'UNAVAILABLE') {
        showToast("The AI service is busy. Please try evaluating again in a moment.");
        return;
      }

      const userHasKey = getUserApiKey();
      if (error?.error?.code === 429 || error?.status === 429) {
        // Quota exceeded - prompt for user's API key
        if (userHasKey) {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Your saved API key will be used.");
        } else {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Please enter your Google Gemini API key to continue.");
        }
        setForceOpenTutor(true);
      } else {
        showToast("Unable to evaluate your design right now. Please try again.");
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGetHints = async () => {
    if (!challenge) return;
    if (hintResult) {
      setShowHint(true);
      return;
    }
    setIsGettingHint(true);
    try {
      const result = await generateHints(challenge);
      setHintResult(result);
      setShowHint(true);

      // Track hints requested
      analytics.trackHintsRequested();
    } catch (error: any) {
      analytics.trackError('hints_generation', error?.message || 'Unknown error');
      console.error("Failed to get hints:", error);

      // Check for service unavailable errors first (503/UNAVAILABLE)
      if (error?.error?.code === 503 || error?.error?.status === 'UNAVAILABLE') {
        showToast("The AI service is busy. Please try again in a moment.");
        return;
      }

      const userHasKey = getUserApiKey();
      if (error?.error?.code === 429 || error?.status === 429) {
        // Quota exceeded - prompt for user's API key
        if (userHasKey) {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Your saved API key will be used.");
        } else {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Please enter your Google Gemini API key to continue.");
        }
        setForceOpenTutor(true);
      } else {
        showToast("Unable to generate hints right now. Please try again.");
      }
    } finally {
      setIsGettingHint(false);
    }
  };

  // Component dimensions for collision detection (matches Canvas default flow component size)
  const COMPONENT_WIDTH = 167;  // 50% wider
  const COMPONENT_HEIGHT = 79;  // 25% taller
  const PADDING = 40; // Padding between components

  // Check if a position overlaps with existing components
  const isPositionOccupied = (
    x: number,
    y: number,
    existingComponents: SystemComponent[],
    width: number = COMPONENT_WIDTH,
    height: number = COMPONENT_HEIGHT
  ): boolean => {
    for (const comp of existingComponents) {
      const compWidth = comp.width || COMPONENT_WIDTH;
      const compHeight = comp.height || COMPONENT_HEIGHT;

      // Check for overlap with padding
      const overlapX = x < comp.x + compWidth + PADDING && x + width + PADDING > comp.x;
      const overlapY = y < comp.y + compHeight + PADDING && y + height + PADDING > comp.y;

      if (overlapX && overlapY) {
        return true;
      }
    }
    return false;
  };

  // Find a free position for a component
  const findFreePosition = (
    preferredX: number,
    preferredY: number,
    existingComponents: SystemComponent[]
  ): { x: number, y: number } => {
    // If preferred position is free, use it
    if (!isPositionOccupied(preferredX, preferredY, existingComponents)) {
      return { x: preferredX, y: preferredY };
    }

    // Try positions in a spiral pattern around the preferred position
    const spiralStep = COMPONENT_WIDTH + PADDING;
    const maxAttempts = 50;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Try right
      const rightX = preferredX + (spiralStep * attempt);
      if (!isPositionOccupied(rightX, preferredY, existingComponents)) {
        return { x: rightX, y: preferredY };
      }

      // Try left
      const leftX = preferredX - (spiralStep * attempt);
      if (leftX >= 50 && !isPositionOccupied(leftX, preferredY, existingComponents)) {
        return { x: leftX, y: preferredY };
      }

      // Try below
      const belowY = preferredY + (COMPONENT_HEIGHT + PADDING) * attempt;
      if (!isPositionOccupied(preferredX, belowY, existingComponents)) {
        return { x: preferredX, y: belowY };
      }

      // Try above
      const aboveY = preferredY - (COMPONENT_HEIGHT + PADDING) * attempt;
      if (aboveY >= 50 && !isPositionOccupied(preferredX, aboveY, existingComponents)) {
        return { x: preferredX, y: aboveY };
      }

      // Try diagonal positions
      if (!isPositionOccupied(rightX, belowY, existingComponents)) {
        return { x: rightX, y: belowY };
      }
      if (leftX >= 50 && !isPositionOccupied(leftX, belowY, existingComponents)) {
        return { x: leftX, y: belowY };
      }
    }

    // Fallback: place far to the right
    return { x: preferredX + (spiralStep * (maxAttempts + 1)), y: preferredY };
  };

  // Auto-layout positioning based on component type
  const getLayerPosition = (layerType: string, existingComponents: SystemComponent[]): { x: number, y: number } => {
    // Define Y positions for different layer types (top to bottom flow)
    const layerYPositions: Record<string, number> = {
      'Start': 0,
      'Clients & Entry': 130,
      'Content Delivery': 260,
      'Traffic Management': 390,
      'Security': 520,
      'Compute & App': 650,
      'Caching': 780,
      'Data Storage': 910,
      'Messaging & Streaming': 1040,
      'File & Blob Storage': 1170,
      'Observability': 1300,
      'Reliability & FT': 1430,
      'Scalability': 1560,
      'Data Governance': 1690,
      'DevOps & Ops': 1820,
      'Config & State': 1950,
      'Governance & Risk': 2080,
      'End': 2210
    };

    const baseY = layerYPositions[layerType] || 650;
    const baseX = 100;

    // Find a free position starting from the base position
    return findFreePosition(baseX, baseY, existingComponents);
  };

  // Core layout computation — pure function, takes arrays and returns arranged arrays
  const computeAutoLayout = useCallback((
    comps: SystemComponent[],
    conns: Connection[]
  ): { layoutComps: SystemComponent[], layoutConns: Connection[] } => {
    if (comps.length === 0) return { layoutComps: comps, layoutConns: conns };

    const layerOrder: string[] = [
      'Start',
      'Clients & Entry',
      'Content Delivery',
      'Traffic Management',
      'Security',
      'Compute & App',
      'Caching',
      'Data Storage',
      'Messaging & Streaming',
      'File & Blob Storage',
      'Observability',
      'Reliability & FT',
      'Scalability',
      'Data Governance',
      'DevOps & Ops',
      'Config & State',
      'Governance & Risk',
      'End',
      'Process', 'Decision', 'Data', 'Loop', 'Timer', 'Event',
      'Layer', 'Text', 'Rectangle', 'Circle', 'Freehand', 'Custom'
    ];

    const componentsByLayer: Record<string, SystemComponent[]> = {};
    comps.forEach(comp => {
      const layer = comp.type as string;
      if (!componentsByLayer[layer]) componentsByLayer[layer] = [];
      componentsByLayer[layer].push(comp);
    });

    const incomingCount: Record<string, number> = {};
    comps.forEach(c => { incomingCount[c.id] = 0; });
    conns.forEach(conn => {
      if (incomingCount[conn.targetId] !== undefined) incomingCount[conn.targetId]++;
    });

    Object.keys(componentsByLayer).forEach(layer => {
      componentsByLayer[layer].sort((a, b) => (incomingCount[a.id] || 0) - (incomingCount[b.id] || 0));
    });

    const startX = 200;
    const startY = 150;
    // Wide columns + tall rows so straight lines run at oblique angles (not 90°/180°)
    const horizontalSpacing = COMPONENT_WIDTH + PADDING + 500;
    const verticalSpacing   = COMPONENT_HEIGHT + PADDING + 340;

    const layoutComps: SystemComponent[] = [];
    let currentY = startY;
    let maxComponentsInRow = 0;
    let rowIndex = 0;

    const presentLayers = layerOrder.filter(layer => componentsByLayer[layer]?.length > 0);

    presentLayers.forEach(layer => {
      const layerComponents = componentsByLayer[layer];
      if (!layerComponents?.length) return;

      // Stagger odd rows by half a column width so adjacent-row components
      // are never directly above/below each other (avoids 90° connections)
      const stagger = (rowIndex % 2 === 1) ? horizontalSpacing / 2 : 0;
      let currentX = startX + stagger;
      if (maxComponentsInRow > 0 && layerComponents.length < maxComponentsInRow) {
        currentX += ((maxComponentsInRow - layerComponents.length) * horizontalSpacing) / 2;
      }

      layerComponents.forEach((comp, idx) => {
        layoutComps.push({ ...comp, x: currentX + idx * horizontalSpacing, y: currentY });
      });

      maxComponentsInRow = Math.max(maxComponentsInRow, layerComponents.length);
      currentY += verticalSpacing;
      rowIndex++;
    });

    // Any components not in layerOrder
    const processedIds = new Set(layoutComps.map(c => c.id));
    comps.forEach(comp => {
      if (!processedIds.has(comp.id)) {
        layoutComps.push({ ...comp, x: startX, y: currentY });
        currentY += verticalSpacing;
      }
    });

    // ── Degree-1 proximity placement ─────────────────────────────────────────
    // Components connected to exactly one other component are placed adjacent
    // to their partner regardless of layer type.
    const getLayoutDims = (comp: SystemComponent) => {
      if (comp.width && comp.height) return { w: comp.width, h: comp.height };
      const t = comp.type as string;
      if (t === 'Start' || t === 'End') return { w: 105, h: 105 };
      if (t === 'Decision') return { w: 210, h: 175 };
      return { w: COMPONENT_WIDTH, h: COMPONENT_HEIGHT };
    };

    {
      const degree: Record<string, number> = {};
      layoutComps.forEach(c => { degree[c.id] = 0; });
      conns.forEach(conn => {
        if (conn.sourceId === conn.targetId) return;
        degree[conn.sourceId] = (degree[conn.sourceId] || 0) + 1;
        degree[conn.targetId] = (degree[conn.targetId] || 0) + 1;
      });

      // Group degree-1 nodes by the partner they are solely connected to
      const byPartner: Record<string, string[]> = {};
      conns.forEach(conn => {
        if (conn.sourceId === conn.targetId) return;
        const sd = degree[conn.sourceId] || 0;
        const td = degree[conn.targetId] || 0;
        if (sd === 1 && td > 1) {
          if (!byPartner[conn.targetId]) byPartner[conn.targetId] = [];
          if (!byPartner[conn.targetId].includes(conn.sourceId)) byPartner[conn.targetId].push(conn.sourceId);
        }
        if (td === 1 && sd > 1) {
          if (!byPartner[conn.sourceId]) byPartner[conn.sourceId] = [];
          if (!byPartner[conn.sourceId].includes(conn.targetId)) byPartner[conn.sourceId].push(conn.targetId);
        }
      });

      const proxGap = PADDING + 30;
      Object.entries(byPartner).forEach(([partnerId, depIds]) => {
        const pIdx = layoutComps.findIndex(c => c.id === partnerId);
        if (pIdx < 0) return;
        const partner = layoutComps[pIdx];
        const pd = getLayoutDims(partner);
        depIds.forEach((depId, i) => {
          const dIdx = layoutComps.findIndex(c => c.id === depId);
          if (dIdx < 0) return;
          const dd = getLayoutDims(layoutComps[dIdx]);
          layoutComps[dIdx] = {
            ...layoutComps[dIdx],
            x: partner.x + pd.w + proxGap,
            y: partner.y + i * (dd.h + proxGap),
          };
        });
      });
    }

    // ── Label collision resolution (straight lines, no waypoints) ────────────
    const LABEL_PERP = 22;
    const LABEL_HALF_H = 14;
    const placedLabels: { x: number; y: number; halfW: number }[] = [];

    const layoutConns = conns.map(conn => {
      // Clear any waypoints/anchors set by previous auto-layouts — straight lines only
      const base: Connection = { ...conn, waypoints: [], sourceAnchor: undefined, targetAnchor: undefined };

      if (!conn.label?.trim()) return base;

      const src = layoutComps.find(c => c.id === conn.sourceId);
      const tgt = layoutComps.find(c => c.id === conn.targetId);
      if (!src || !tgt) return base;

      const sx = src.x, sy = src.y, ex = tgt.x, ey = tgt.y;
      const lineLen = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
      const labelHalfW = Math.max(32, conn.label.length * 4.5 + 12);

      let perpX = 0, perpY = -LABEL_PERP;
      if (lineLen > 0) {
        const vx = ex - sx, vy = ey - sy;
        perpX = (-vy / lineLen) * LABEL_PERP;
        perpY =  (vx / lineLen) * LABEL_PERP;
        if (perpY > 0) { perpX = -perpX; perpY = -perpY; }
      }

      const candidates = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75];
      for (const t of candidates) {
        const ancX = sx + (ex - sx) * t;
        const ancY = sy + (ey - sy) * t;
        const lblX = ancX + perpX, lblY = ancY + perpY;

        const compOverlap = layoutComps.some(comp => {
          if (comp.id === conn.sourceId || comp.id === conn.targetId) return false;
          const hw = (comp.width  || COMPONENT_WIDTH)  / 2 + labelHalfW;
          const hh = (comp.height || COMPONENT_HEIGHT) / 2 + LABEL_HALF_H;
          return Math.abs(comp.x - lblX) < hw && Math.abs(comp.y - lblY) < hh;
        });
        const lblOverlap = placedLabels.some(pl =>
          Math.abs(pl.x - lblX) < pl.halfW + labelHalfW && Math.abs(pl.y - lblY) < LABEL_HALF_H * 2
        );
        if (!compOverlap && !lblOverlap) {
          placedLabels.push({ x: lblX, y: lblY, halfW: labelHalfW });
          return { ...base, labelT: t };
        }
      }

      const ancX = sx + (ex - sx) * 0.5, ancY = sy + (ey - sy) * 0.5;
      placedLabels.push({ x: ancX + perpX, y: ancY + perpY, halfW: labelHalfW });
      return { ...base, labelT: 0.5 };
    });

    return { layoutComps, layoutConns };
  }, [COMPONENT_WIDTH, COMPONENT_HEIGHT, PADDING]);

  // Auto-layout algorithm to arrange all components properly
  const handleAutoLayout = useCallback(() => {
    if (components.length === 0) return;
    handleSnapshot();
    const { layoutComps, layoutConns } = computeAutoLayout(components, connections);
    setComponents(layoutComps);
    setConnections(layoutConns);
  }, [components, connections, handleSnapshot, computeAutoLayout]);

  // Convert solution component to canvas component
  const solutionToCanvasComponent = (
    solComp: SolutionComponent,
    existingIdMap: Record<string, string>,
    allComponentsInStep: SolutionComponent[],
    currentCanvasComponents: SystemComponent[],
    alreadyPlacedInStep: SystemComponent[]
  ): SystemComponent => {
    const canvasId = `sol-${solComp.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Combine existing canvas components with components already placed in this step
    const allExistingComponents = [...currentCanvasComponents, ...alreadyPlacedInStep];

    // Find a free position based on layer type
    const position = getLayerPosition(solComp.type, allExistingComponents);

    // Map type string to ComponentType enum
    const componentType = Object.values(ComponentType).find(ct => ct === solComp.type) || ComponentType.CUSTOM;

    // Generate a color based on layer type
    const layerColors: Record<string, string> = {
      'Start': '#22c55e',
      'End': '#ef4444',
      'Clients & Entry': '#3b82f6',
      'Traffic Management': '#8b5cf6',
      'Compute & App': '#10b981',
      'Data Storage': '#f59e0b',
      'Caching': '#ef4444',
      'Messaging & Streaming': '#ec4899',
      'File & Blob Storage': '#6366f1',
      'Content Delivery': '#14b8a6',
      'Observability': '#84cc16',
      'Security': '#f97316',
      'Reliability & FT': '#06b6d4',
      'Scalability': '#a855f7',
      'Config & State': '#64748b',
      'Data Governance': '#0891b2',
      'DevOps & Ops': '#7c3aed',
      'Governance & Risk': '#be185d'
    };

    return {
      id: canvasId,
      type: componentType,
      x: position.x,
      y: position.y,
      label: solComp.label,
      tool: solComp.tool,
      color: solComp.color || layerColors[solComp.type] || '#1e3a8a'
    };
  };

  // Convert solution connection to canvas connection
  const solutionToCanvasConnection = (
    solConn: SolutionConnection,
    idMap: Record<string, string>
  ): Connection | null => {
    const sourceCanvasId = idMap[solConn.sourceId];
    const targetCanvasId = idMap[solConn.targetId];

    if (!sourceCanvasId || !targetCanvasId) {
      console.warn('Connection references unknown component:', solConn);
      return null;
    }

    return {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceId: sourceCanvasId,
      targetId: targetCanvasId,
      label: solConn.label || '',
      type: solConn.type === 'directed' ? 'directed' : 'undirected',
      color: '#475569'
    };
  };

  // Apply a solution step to the canvas

  // Handle AI Solve button click
  const handleAISolve = async () => {
    if (!challenge) return;

    // If we already have a solution, just show the player
    if (solutionResult) {
      setShowSolutionPlayer(true);
      setRequirementsCollapsed(true);
      return;
    }

    setIsGeneratingSolution(true);
    try {
      const result = await generateSolution(challenge, hintResult);
      setSolutionResult(result);
      setShowSolutionPlayer(true);
      setRequirementsCollapsed(true);
      setSolutionStep(-1); // Start at -1 so step 0 gets applied when walkthrough starts
      setSolutionIdMap({});

      // Track solution viewed
      analytics.trackSolutionViewed();
    } catch (error: any) {
      analytics.trackError('solution_generation', error?.message || 'Unknown error');
      console.error("Failed to generate solution:", error);

      // Check for service unavailable errors first (503/UNAVAILABLE)
      if (error?.error?.code === 503 || error?.error?.status === 'UNAVAILABLE') {
        showToast("The AI service is busy. Please try again in a moment.");
        return;
      }

      const userHasKey = getUserApiKey();
      if (error?.error?.code === 429 || error?.status === 429) {
        // Quota exceeded - prompt for user's API key
        if (userHasKey) {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Your saved API key will be used.");
        } else {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Please enter your Google Gemini API key to continue.");
        }
        setForceOpenTutor(true);
      } else {
        showToast("Unable to generate solution right now. Please try again.");
      }
    } finally {
      setIsGeneratingSolution(false);
    }
  };

  // Handle step change in solution player
  const handleSolutionStepChange = useCallback((newStep: number) => {
    if (!solutionResult) return;

    if (newStep > solutionStep) {
      const step = solutionResult.steps[newStep];
      if (!step) return;

      handleSnapshot();

      const newIdMap = { ...solutionIdMap };
      const addedComps: SystemComponent[] = [];
      step.components.forEach(solComp => {
        // Deduplicate: if a component with the same label or tool already exists, reuse it
        const allOnCanvas = [...components, ...addedComps];
        const existing = allOnCanvas.find(c =>
          (c.label && solComp.label && c.label.toLowerCase() === solComp.label.toLowerCase()) ||
          (c.tool  && solComp.tool  && c.tool.toLowerCase()  === solComp.tool.toLowerCase())
        );
        if (existing) {
          newIdMap[solComp.id] = existing.id;
          return; // reuse, don't add again
        }
        const canvasComp = solutionToCanvasComponent(solComp, newIdMap, step.components, components, addedComps);
        newIdMap[solComp.id] = canvasComp.id;
        addedComps.push(canvasComp);
      });

      const addedConns: Connection[] = [];
      step.connections.forEach(solConn => {
        const canvasConn = solutionToCanvasConnection(solConn, newIdMap);
        if (canvasConn) addedConns.push(canvasConn);
      });

      // Run auto-layout on the full combined set so every step is neatly arranged
      const allComps = [...components, ...addedComps];
      const allConns = [...connections, ...addedConns];

      // Ensure every leaf node (no outgoing connections) is connected to the End node
      const endNode = allComps.find(c => c.type === ComponentType.FLOW_END);
      const startNode = allComps.find(c => c.type === ComponentType.FLOW_START);
      if (endNode) {
        const outgoingIds = new Set(allConns.map(c => c.sourceId));
        allComps.forEach(comp => {
          if (comp.id === endNode.id) return;
          if (startNode && comp.id === startNode.id) return;
          if (outgoingIds.has(comp.id)) return;
          // Already connected to End?
          if (allConns.some(c => c.sourceId === comp.id && c.targetId === endNode.id)) return;
          allConns.push({
            id: `auto-end-${comp.id}`,
            sourceId: comp.id,
            targetId: endNode.id,
            label: 'completes',
            type: 'directed',
            color: '#475569'
          });
        });
      }
      const { layoutComps, layoutConns } = computeAutoLayout(allComps, allConns);

      setSolutionIdMap(newIdMap);
      setComponents(layoutComps);
      setConnections(layoutConns);
    }

    setSolutionStep(newStep);
  }, [solutionResult, solutionStep, solutionIdMap, components, connections,
      handleSnapshot, solutionToCanvasComponent, solutionToCanvasConnection, computeAutoLayout]);

  // Handle reset solution
  const handleSolutionReset = () => {
    setSolutionStep(-1); // Reset to -1 so step 0 will be applied when walkthrough starts
    setSolutionIdMap({});
    setSolutionEvaluationScore(null);
    setImprovementResult(null);
    setImprovementStep(0);
    // Clear canvas
    handleSnapshot();
    setComponents([]);
    setConnections([]);
  };

  // Check if solution has already been applied to canvas
  const hasAppliedSolution = Object.keys(solutionIdMap).length > 0;

  // Handle solution completion - evaluate and show improvement suggestions if score < 80
  const handleSolutionComplete = async () => {
    if (!challenge) return;

    // Already evaluated — just open the modal
    if (solutionEvaluationScore !== null) {
      setShowEvaluation(true);
      return;
    }

    // First time — evaluate the design
    setIsEvaluatingForImprovement(true);
    try {
      const evalResult = await evaluateDesign(challenge, components, connections);
      setEvaluation(evalResult);
      setSolutionEvaluationScore(evalResult.score);

      // If score is below 80, generate improvement suggestions (text only — no canvas changes)
      if (evalResult.score < 80) {
        setIsImproving(true);
        const improvements = await improveSolution(challenge, components, connections, evalResult);
        setImprovementResult(improvements);
        setIsImproving(false);
      }

      setShowEvaluation(true);
    } catch (error: any) {
      console.error("Evaluation/Improvement error:", error);

      // Check for service unavailable errors first (503/UNAVAILABLE)
      if (error?.error?.code === 503 || error?.error?.status === 'UNAVAILABLE') {
        showToast("The AI service is busy. Please try again in a moment.");
        return;
      }

      const userHasKey = getUserApiKey();
      if (error?.error?.code === 429 || error?.status === 429) {
        // Quota exceeded - prompt for user's API key
        if (userHasKey) {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Your saved API key will be used.");
        } else {
          setApiKeyNeededMessage("The app's API key has exceeded its quota. Please enter your Google Gemini API key to continue.");
        }
        setForceOpenTutor(true);
      } else {
        showToast("Unable to process your design right now. Please try again.");
      }
    } finally {
      setIsEvaluatingForImprovement(false);
    }
  };

  const handleClearBoard = () => {
    // Only clear if there is something to clear
    if (components.length === 0 && connections.length === 0) return;

    handleSnapshot(); // Save before clearing so user can undo
    setComponents([]);
    setConnections([]);
    setEvaluation(null);
    setViewState({ x: 0, y: 0, zoom: 0.7 }); // Reset view to default 60%
  };

  const applyColorToSelection = (color: string) => {
    setSelectedColor(color);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans">
      <TopBar
        challenge={challenge}
        onGenerateChallenge={handleGenerateChallenge}
        onEvaluate={handleEvaluate}
        onGetHint={handleGetHints}
        onAISolve={handleAISolve}
        onAutoLayout={handleAutoLayout}
        onOpenSettings={() => setShowAISettings(true)}
        highlightSettings={highlightSettings}
        isGenerating={isGenerating}
        isEvaluating={isEvaluating}
        isGettingHint={isGettingHint}
        isGeneratingSolution={isGeneratingSolution}
        hasHints={!!hintResult}
        hasSolution={!!solutionResult}
        onClear={handleClearBoard}
        selectedDifficulty={selectedDifficulty}
        onDifficultyChange={setSelectedDifficulty}
        onExpandChallenge={() => setShowChallengeExpanded(true)}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        
        <Canvas 
          components={components}
          connections={connections}
          setComponents={setComponents}
          setConnections={setConnections}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          selectedColor={selectedColor}
          viewState={viewState}
          setViewState={setViewState}
          onSnapshot={handleSnapshot}
        />

        <BottomToolbar 
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          selectedColor={selectedColor}
          setSelectedColor={applyColorToSelection}
          zoom={viewState.zoom}
          onZoomChange={(z) => setViewState(prev => ({ ...prev, zoom: z }))}
          onZoomReset={() => setViewState({ x: 0, y: 0, zoom: 0.7 })}
          onUndo={handleUndo}
          canUndo={history.length > 0}
        />
        
        {/* Requirements Panel */}
        {challenge && (
          <RequirementsPanel
            challenge={challenge}
            isExpanded={showChallengeExpanded}
            onExpandChange={setShowChallengeExpanded}
            collapsed={requirementsCollapsed}
            onCollapsedChange={setRequirementsCollapsed}
          />
        )}
        
        {/* AI Tutor */}
        <AITutor
          challenge={challenge}
          hints={hintResult}
          forceOpen={forceOpenTutor}
          apiKeyNeededMessage={apiKeyNeededMessage}
          onApiKeyReady={handleApiKeyReady}
        />

        {/* Solution Player */}
        <SolutionPlayer
          isOpen={showSolutionPlayer}
          onClose={() => setShowSolutionPlayer(false)}
          solution={solutionResult}
          challenge={challenge}
          currentStep={solutionStep}
          onStepChange={handleSolutionStepChange}
          onReset={handleSolutionReset}
          onComplete={handleSolutionComplete}
          isEvaluating={isEvaluatingForImprovement || isImproving}
          evaluationScore={solutionEvaluationScore}
          hasAppliedSolution={hasAppliedSolution}
        />

      </div>

      <EvaluationModal
        isOpen={showEvaluation}
        onClose={() => setShowEvaluation(false)}
        result={evaluation}
        improvementResult={improvementResult}
      />

      <HintModal 
        isOpen={showHint}
        onClose={() => setShowHint(false)}
        result={hintResult}
      />

      <ComponentConfigDialog
        isOpen={configDialog.isOpen}
        definition={configDialog.componentType ? COMPONENT_SPECS[configDialog.componentType] : null}
        initialSubTypeId={configDialog.initialSubTypeId}
        onComplete={handleConfigComplete}
        onCancel={() => setConfigDialog({ isOpen: false, componentType: null, draftComponent: null })}
      />

      {/* AI Settings Modal */}
      <AISettings
        isOpen={showAISettings}
        onClose={() => {
          // Only allow closing if user has configured an API key
          if (hasApiKey()) {
            setShowAISettings(false);
            setApiKeyNeededMessage(null);

            // If closing for the first time after configuring key, highlight settings button
            if (!hasClosedSettingsOnce) {
              setHasClosedSettingsOnce(true);
              setHighlightSettings(true);
              showToast('You can change your API key anytime using the Settings button ⚙️', 'success');
              // Remove highlight after 10 seconds
              setTimeout(() => setHighlightSettings(false), 10000);
            }
          } else {
            showToast('Please configure an API key to continue');
          }
        }}
        onSave={() => {
          // Close modal after saving if key is configured
          if (hasApiKey()) {
            setShowAISettings(false);
            setApiKeyNeededMessage(null);

            // If saving for the first time, highlight settings button
            if (!hasClosedSettingsOnce) {
              setHasClosedSettingsOnce(true);
              setHighlightSettings(true);
              showToast('API key saved! You can update it anytime using the Settings button ⚙️', 'success');
              // Remove highlight after 10 seconds
              setTimeout(() => setHighlightSettings(false), 10000);
            }
          }
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default App;
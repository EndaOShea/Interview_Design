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
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, zoom: 0.6 });

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGettingHint, setIsGettingHint] = useState(false);
  
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showHint, setShowHint] = useState(false);
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
  const [improvementStep, setImprovementStep] = useState(0);

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

  // Check if user has an API key on first load and show settings
  useEffect(() => {
    const hasVisited = localStorage.getItem('has_visited');
    const hasKey = hasApiKey();

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
    setImprovementStep(0);
    setIsImproving(false);
    setIsEvaluatingForImprovement(false);

    // Clear any API key error state
    setApiKeyNeededMessage(null);
    setForceOpenTutor(false);

    try {
      // Now generate the new challenge
      const newChallenge = await generateChallenge(undefined, difficulty);
      setChallenge(newChallenge);
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
  const COMPONENT_WIDTH = 111;  // Reduced by 30% to match flow components
  const COMPONENT_HEIGHT = 63;  // Reduced by 30% to match flow components
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

  // Auto-layout algorithm to arrange all components properly
  const handleAutoLayout = useCallback(() => {
    if (components.length === 0) return;

    handleSnapshot(); // Save state before layout

    // Define layer order (top to bottom)
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
      // Flow and annotation types
      'Process',
      'Decision',
      'Data',
      'Loop',
      'Timer',
      'Event',
      'Layer',
      'Text',
      'Rectangle',
      'Circle',
      'Freehand',
      'Custom'
    ];

    // Group components by their type/layer
    const componentsByLayer: Record<string, SystemComponent[]> = {};
    components.forEach(comp => {
      const layer = comp.type as string;
      if (!componentsByLayer[layer]) {
        componentsByLayer[layer] = [];
      }
      componentsByLayer[layer].push(comp);
    });

    // Calculate incoming connections for each component (for ordering)
    const incomingCount: Record<string, number> = {};
    components.forEach(c => { incomingCount[c.id] = 0; });
    connections.forEach(conn => {
      if (incomingCount[conn.targetId] !== undefined) {
        incomingCount[conn.targetId]++;
      }
    });

    // Sort components within each layer by incoming connections (sources first)
    Object.keys(componentsByLayer).forEach(layer => {
      componentsByLayer[layer].sort((a, b) => {
        const aIncoming = incomingCount[a.id] || 0;
        const bIncoming = incomingCount[b.id] || 0;
        return aIncoming - bIncoming;
      });
    });

    // Layout parameters
    const startX = 150;
    const startY = 100;
    const horizontalSpacing = COMPONENT_WIDTH + PADDING + 200; // Extra spacing for wider layout
    const verticalSpacing = COMPONENT_HEIGHT + PADDING + 50; // Extra vertical spacing

    // Position components
    const newComponents: SystemComponent[] = [];
    let currentY = startY;
    let maxComponentsInRow = 0;

    // Get layers in order
    const presentLayers = layerOrder.filter(layer => componentsByLayer[layer]?.length > 0);

    presentLayers.forEach(layer => {
      const layerComponents = componentsByLayer[layer];
      if (!layerComponents || layerComponents.length === 0) return;

      let currentX = startX;

      // Center the row if there are fewer components than the max row
      if (maxComponentsInRow > 0 && layerComponents.length < maxComponentsInRow) {
        currentX = startX + ((maxComponentsInRow - layerComponents.length) * horizontalSpacing) / 2;
      }

      layerComponents.forEach((comp, idx) => {
        newComponents.push({
          ...comp,
          x: currentX + (idx * horizontalSpacing),
          y: currentY
        });
      });

      // Track max components for centering
      maxComponentsInRow = Math.max(maxComponentsInRow, layerComponents.length);
      currentY += verticalSpacing;
    });

    // Handle any components not in layerOrder (shouldn't happen but just in case)
    const processedIds = new Set(newComponents.map(c => c.id));
    components.forEach(comp => {
      if (!processedIds.has(comp.id)) {
        newComponents.push({
          ...comp,
          x: startX,
          y: currentY
        });
        currentY += verticalSpacing;
      }
    });

    setComponents(newComponents);
  }, [components, connections, handleSnapshot]);

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
  const applySolutionStep = useCallback((stepIndex: number) => {
    if (!solutionResult || stepIndex >= solutionResult.steps.length) return;

    const step = solutionResult.steps[stepIndex];
    const newIdMap = { ...solutionIdMap };

    handleSnapshot(); // Save state before applying step

    // Add components - track already placed components to avoid overlaps within same step
    const newComponents: SystemComponent[] = [];
    step.components.forEach(solComp => {
      const canvasComp = solutionToCanvasComponent(
        solComp,
        newIdMap,
        step.components,
        components,        // Current canvas components
        newComponents      // Components already placed in this step
      );
      newIdMap[solComp.id] = canvasComp.id;
      newComponents.push(canvasComp);
    });

    // Add connections
    const newConnections: Connection[] = [];
    step.connections.forEach(solConn => {
      const canvasConn = solutionToCanvasConnection(solConn, newIdMap);
      if (canvasConn) {
        newConnections.push(canvasConn);
      }
    });

    setSolutionIdMap(newIdMap);
    setComponents(prev => [...prev, ...newComponents]);
    setConnections(prev => [...prev, ...newConnections]);
  }, [solutionResult, solutionIdMap, handleSnapshot, components]);

  // Handle AI Solve button click
  const handleAISolve = async () => {
    if (!challenge) return;

    // If we already have a solution, just show the player
    if (solutionResult) {
      setShowSolutionPlayer(true);
      return;
    }

    setIsGeneratingSolution(true);
    try {
      const result = await generateSolution(challenge, hintResult);
      setSolutionResult(result);
      setShowSolutionPlayer(true);
      setSolutionStep(-1); // Start at -1 so step 0 gets applied when walkthrough starts
      setSolutionIdMap({});
    } catch (error: any) {
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
  const handleSolutionStepChange = (newStep: number) => {
    if (!solutionResult) return;

    // If going forward (or starting fresh after reset when solutionStep is -1), apply the new step
    if (newStep > solutionStep) {
      applySolutionStep(newStep);
    }

    setSolutionStep(newStep);
  };

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

  // Handle solution completion - evaluate and improve
  const handleSolutionComplete = async () => {
    if (!challenge) return;

    // If we already have an evaluation score >= 85, just show evaluation modal
    if (solutionEvaluationScore !== null && solutionEvaluationScore >= 85) {
      setShowEvaluation(true);
      return;
    }

    // If we already have an evaluation and improvements, apply the next improvement
    if (solutionEvaluationScore !== null && improvementResult) {
      // Apply the next improvement step
      if (improvementStep < improvementResult.steps.length) {
        const step = improvementResult.steps[improvementStep];
        const newIdMap = { ...solutionIdMap };

        handleSnapshot();

        // Add components from improvement step
        const newComponents: SystemComponent[] = [];
        step.components.forEach(solComp => {
          const canvasComp = solutionToCanvasComponent(
            solComp,
            newIdMap,
            step.components,
            components,
            newComponents
          );
          newIdMap[solComp.id] = canvasComp.id;
          newComponents.push(canvasComp);
        });

        // Add connections
        const newConnections: Connection[] = [];
        step.connections.forEach(solConn => {
          const canvasConn = solutionToCanvasConnection(solConn, newIdMap);
          if (canvasConn) {
            newConnections.push(canvasConn);
          }
        });

        setSolutionIdMap(newIdMap);
        setComponents(prev => [...prev, ...newComponents]);
        setConnections(prev => [...prev, ...newConnections]);
        setImprovementStep(prev => prev + 1);

        // If all improvements applied, re-evaluate
        if (improvementStep + 1 >= improvementResult.steps.length) {
          // Show final score
          setSolutionEvaluationScore(improvementResult.expectedScoreImprovement);
          setShowEvaluation(true);
        }
      }
      return;
    }

    // First time - evaluate the design
    setIsEvaluatingForImprovement(true);
    try {
      const evalResult = await evaluateDesign(challenge, components, connections);
      setEvaluation(evalResult);
      setSolutionEvaluationScore(evalResult.score);

      // If score is below 85, generate improvements
      if (evalResult.score < 85) {
        setIsImproving(true);
        const improvements = await improveSolution(challenge, components, connections, evalResult);
        setImprovementResult(improvements);
        setIsImproving(false);
      } else {
        // Score is good, just show evaluation
        setShowEvaluation(true);
      }
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
    setViewState({ x: 0, y: 0, zoom: 0.6 }); // Reset view to default 60%
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
          onZoomReset={() => setViewState({ x: 0, y: 0, zoom: 0.6 })}
          onUndo={handleUndo}
          canUndo={history.length > 0}
        />
        
        {/* Requirements Panel */}
        {challenge && <RequirementsPanel challenge={challenge} />}
        
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
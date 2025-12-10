import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import TopBar from './components/TopBar';
import BottomToolbar, { ToolType } from './components/BottomToolbar';
import EvaluationModal from './components/EvaluationModal';
import HintModal from './components/HintModal';
import ComponentConfigDialog from './components/ComponentConfigDialog';
import RequirementsPanel from './components/RequirementsPanel';
import AITutor from './components/AITutor';
import { generateChallenge, evaluateDesign, generateHints } from './services/gemini';
import { SystemComponent, Connection, ComponentType, Challenge, EvaluationResult, HintResult } from './types';
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
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, zoom: 1 });

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGettingHint, setIsGettingHint] = useState(false);
  
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Tools State
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#1e3a8a'); // Default Navy

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

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (activeTool !== 'select') setActiveTool('select');

    const type = event.dataTransfer.getData('application/reactflow') as ComponentType;
    const customLabel = event.dataTransfer.getData('application/reactflow-label');
    const subTypeId = event.dataTransfer.getData('application/reactflow-subtype');
    const dropColor = event.dataTransfer.getData('application/reactflow-color'); // Get color from Sidebar drag
    
    if (!type) return;

    // Calculate Position relative to Canvas World Space
    // Sidebar width = 288px (w-72), TopBar height ~64px
    const sidebarWidth = 288;
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
      x: worldX - 70, // Center approx component width
      y: worldY - 40, // Center approx component height
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

  const handleGenerateChallenge = async () => {
    setIsGenerating(true);
    try {
      const newChallenge = await generateChallenge();
      setChallenge(newChallenge);
      setEvaluation(null);
      setHintResult(null);
    } catch (error) {
      alert("Failed to generate challenge. Check console/API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluate = async () => {
    if (!challenge) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateDesign(challenge, components, connections);
      setEvaluation(result);
      setShowEvaluation(true);
    } catch (error) {
      alert("Evaluation failed. Check console.");
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
    } catch (error) {
       alert("Failed to get hints. Check console.");
    } finally {
      setIsGettingHint(false);
    }
  };

  const handleClearBoard = () => {
    if (window.confirm("Are you sure you want to clear the design board?")) {
      handleSnapshot(); // Save before clearing so user can undo
      setComponents([]);
      setConnections([]);
      setEvaluation(null);
      setViewState({ x: 0, y: 0, zoom: 1 }); // Reset view
    }
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
        isGenerating={isGenerating}
        isEvaluating={isEvaluating}
        isGettingHint={isGettingHint}
        hasHints={!!hintResult}
        onClear={handleClearBoard}
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
          onZoomReset={() => setViewState({ x: 0, y: 0, zoom: 1 })}
          onUndo={handleUndo}
          canUndo={history.length > 0}
        />
        
        {/* Requirements Panel */}
        {challenge && <RequirementsPanel challenge={challenge} />}
        
        {/* AI Tutor */}
        <AITutor challenge={challenge} hints={hintResult} />

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
    </div>
  );
};

export default App;
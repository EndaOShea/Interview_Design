import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import TopBar from './components/TopBar';
import EvaluationModal from './components/EvaluationModal';
import ComponentConfigDialog from './components/ComponentConfigDialog';
import { generateChallenge, evaluateDesign } from './services/gemini';
import { SystemComponent, Connection, ComponentType, Challenge, EvaluationResult } from './types';
import { COMPONENT_SPECS } from './constants';

const App: React.FC = () => {
  // State
  const [components, setComponents] = useState<SystemComponent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  
  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

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

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow') as ComponentType;
    const customLabel = event.dataTransfer.getData('application/reactflow-label'); // From Level 1 or 2
    const subTypeId = event.dataTransfer.getData('application/reactflow-subtype'); // From Level 3
    
    if (!type) return;

    // Approximate position
    const position = {
      x: event.clientX - 288 - 70, // Adjust for wider sidebar
      y: event.clientY - 64 - 40,
    };

    const spec = COMPONENT_SPECS[type];
    
    // Determine initial label
    let label = spec?.label;
    if (customLabel) label = customLabel;
    if (subTypeId && spec?.subTypes) {
      const sub = spec.subTypes.find(s => s.id === subTypeId);
      if (sub) label = sub.label;
    }

    const draft = {
      id: `node-${Date.now()}`,
      type,
      x: Math.max(0, position.x),
      y: Math.max(0, position.y),
      label: label,
      customLabel: customLabel || undefined,
      subType: subTypeId || undefined
    };

    // Check if configuration is needed
    // Config needed if:
    // 1. It has subtypes AND we dropped a Level 1/2 generic (no subTypeId)
    // 2. It has subtypes AND we dropped a Level 3 specific (subTypeId) BUT we want to pick a specific Tool (e.g. React vs Vue)
    // If it's a "Custom" type from quick list, no config needed.
    
    const hasSubTypes = spec?.subTypes && spec.subTypes.length > 0;
    const isCustomQuickTool = type === ComponentType.CUSTOM && customLabel;

    if (hasSubTypes && !isCustomQuickTool) {
      setConfigDialog({
        isOpen: true,
        componentType: type,
        draftComponent: draft,
        initialSubTypeId: subTypeId
      });
    } else {
      // Add directly
      setComponents((prev) => [...prev, draft as SystemComponent]);
    }
  };

  const handleConfigComplete = (subType: string, tool: string) => {
    if (!configDialog.draftComponent) return;

    const newComponent: SystemComponent = {
      ...(configDialog.draftComponent as SystemComponent),
      subType,
      tool,
      // If user typed a specific tool, use that as label override
      // Otherwise keep the draft label (which might be the SubType label)
      label: tool || configDialog.draftComponent.label
    };

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

  const handleClearBoard = () => {
    if (confirm("Are you sure you want to clear the design board?")) {
      setComponents([]);
      setConnections([]);
      setEvaluation(null);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans">
      <TopBar 
        challenge={challenge}
        onGenerateChallenge={handleGenerateChallenge}
        onEvaluate={handleEvaluate}
        isGenerating={isGenerating}
        isEvaluating={isEvaluating}
        onClear={handleClearBoard}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <Canvas 
          components={components}
          connections={connections}
          setComponents={setComponents}
          setConnections={setConnections}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
        
        {challenge && (
          <div className="absolute top-20 right-4 w-64 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-4 shadow-xl z-10 max-h-[50vh] overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Requirements</h3>
            <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 mb-3">
              {challenge.requirements.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Constraints</h3>
            <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
              {challenge.constraints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>

      <EvaluationModal 
        isOpen={showEvaluation} 
        onClose={() => setShowEvaluation(false)} 
        result={evaluation}
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
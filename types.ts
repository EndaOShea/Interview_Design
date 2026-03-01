import React from 'react';

export enum ComponentType {
  // 1. Clients & Entry Layer
  CLIENT_ENTRY = 'Clients & Entry',
  
  // 2. Traffic Management Layer
  TRAFFIC = 'Traffic Management',
  
  // 3. Application / Compute Layer
  COMPUTE = 'Compute & App',
  
  // 4. Data Storage Layer
  DATABASE = 'Data Storage',
  
  // 5. Caching Layer
  CACHE = 'Caching',
  
  // 6. Messaging & Streaming Layer
  MESSAGING = 'Messaging & Streaming',
  
  // 7. File & Blob Storage Layer
  FILE_STORAGE = 'File & Blob Storage',
  
  // 8. Content Delivery Layer
  CDN = 'Content Delivery',
  
  // 9. Observability & Telemetry Layer
  OBSERVABILITY = 'Observability',
  
  // 10. Security Layer
  SECURITY = 'Security',
  
  // 11. Reliability, Availability & Fault Tolerance
  RELIABILITY = 'Reliability & FT',
  
  // 12. Scalability
  SCALABILITY = 'Scalability',
  
  // 13. Data Governance & Lifecycle
  DATA_GOV = 'Data Governance',
  
  // 14. Deployment, Operations & DevOps
  DEVOPS = 'DevOps & Ops',
  
  // 15. Configuration & State Management
  CONFIG = 'Config & State',
  
  // 16. Governance, Compliance & Risk
  GOVERNANCE = 'Governance & Risk',

  // Architecture & Flow (Logic)
  FLOW_START = 'Start',
  FLOW_END = 'End',
  FLOW_PROCESS = 'Process',
  FLOW_DECISION = 'Decision',
  FLOW_DATA = 'Data',
  FLOW_LOOP = 'Loop',
  FLOW_TIMER = 'Timer',
  FLOW_EVENT = 'Event',
  STRUCTURE_LAYER = 'Layer',

  // Annotations
  ANNOTATION_TEXT = 'Text',
  ANNOTATION_RECT = 'Rectangle',
  ANNOTATION_CIRCLE = 'Circle',
  ANNOTATION_DRAW = 'Freehand',
  
  // Fallback
  CUSTOM = 'Custom'
}

export interface ComponentSubType {
  id: string;
  category: string; // e.g., "1.1 Client Types"
  label: string;
  description: string;
  tools: string[]; // Suggested tools
  costIndicator?: 'low' | 'medium' | 'high' | 'variable'; // Optional cost indicator
}

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  icon: React.ReactNode;
  description: string;
  subTypes?: ComponentSubType[];
}

export interface SystemComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  width?: number;
  height?: number;

  // Configuration
  subType?: string; // ID of the sub type
  tool?: string;    // Specific tool name
  label?: string;   // Display label
  customLabel?: string; // User override
  color?: string; // Hex color for styling
  zOrder?: number; // Custom z-order for layering (higher = front)

  // Grouping/Pinning
  parentId?: string; // ID of parent container (layer, rect, circle) that this is pinned to
  childIds?: string[]; // IDs of children pinned to this container

  // For Freehand
  points?: {x: number, y: number}[];
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type?: 'directed' | 'undirected' | 'loop'; // Arrow vs Line vs Loop
  color?: string;

  // Connection points (anchor points on the components)
  sourceAnchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  targetAnchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  // Waypoints for bending the line (coordinates in world space)
  waypoints?: {x: number, y: number}[];

  // Label position: 0–1 along the line (0=source end, 1=target end). Replaces labelOffset.
  labelT?: number;
  labelOffset?: {x: number, y: number}; // kept for backward compat, ignored when labelT set
}

export interface Challenge {
  title: string;
  description: string;
  requirements: string[];
  constraints: string[];
  difficulty: 'Junior' | 'Mid' | 'Senior' | 'Principal';
}

export interface EvaluationResult {
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
  recommendations: string[];
  securityConcerns: string[];
}

export interface HintResult {
  suggestedComponents: {
    layer: string;
    component: string;
    reason: string;
  }[];
  architectureStrategy: string;
  keyConsiderations: string[];
}

// Solution Generation Types
export interface SolutionComponent {
  id: string;           // Temporary ID for referencing in connections
  type: string;         // ComponentType value (e.g., "Data Storage")
  subType?: string;     // SubType ID if applicable
  tool: string;         // Specific tool name (e.g., "PostgreSQL", "Redis")
  label: string;        // Display label
  color?: string;       // Optional color hex
}

export interface SolutionConnection {
  sourceId: string;     // References SolutionComponent.id
  targetId: string;     // References SolutionComponent.id
  label?: string;       // Connection label (e.g., "reads from", "publishes to")
  type: 'directed' | 'undirected';
}

export interface SolutionStep {
  title: string;                      // Step title (e.g., "Adding Data Layer")
  explanation: string;                // Detailed explanation of this step
  requirementsAddressed: number[];    // Indices of requirements this step addresses
  components: SolutionComponent[];    // Components to add in this step
  connections: SolutionConnection[];  // Connections to add in this step
}

export interface SolutionResult {
  architectureOverview: string;       // High-level architecture explanation
  steps: SolutionStep[];              // Array of steps to build the solution
  finalNotes: string;                 // Summary and additional considerations
}
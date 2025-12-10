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
  
  // Fallback
  CUSTOM = 'Custom'
}

export interface ComponentSubType {
  id: string;
  category: string; // e.g., "1.1 Client Types"
  label: string;
  description: string;
  tools: string[]; // Suggested tools
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
  
  // Configuration
  subType?: string; // ID of the sub type
  tool?: string;    // Specific tool name
  label?: string;   // Display label
  customLabel?: string; // User override
  color?: string; // Hex color for styling
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type?: 'directed' | 'undirected'; // Arrow vs Line
  color?: string;
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
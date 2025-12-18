// LEGACY FILE: This file is kept for backward compatibility
// All functionality now delegates to the new multi-provider system in ai-service.ts

import * as aiService from './ai-service';
import { Challenge, EvaluationResult, SystemComponent, Connection, HintResult, SolutionResult } from "../types";

// Re-export types
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface ImprovementResult {
  improvementOverview: string;
  steps: any[];
  expectedScoreImprovement: number;
}

// Delegate to ai-service (multi-provider)
export const generateChallenge = aiService.generateChallenge;
export const evaluateDesign = aiService.evaluateDesign;
export const generateHints = aiService.generateHints;
export const generateSolution = aiService.generateSolution;
export const improveSolution = aiService.improveSolution;
export const createTutorChat = aiService.createTutorChat;
export const getUserApiKey = aiService.getUserApiKey_Legacy;
export const hasAnyApiKey = aiService.hasAnyApiKey;

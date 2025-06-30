/**
 * Interface for model management service
 */

import * as vscode from 'vscode';
import { ModelInfo } from './IOllamaApiService';

/**
 * Model selection event
 */
export interface ModelSelectionEvent {
  previousModel?: string;
  currentModel: string;
  source: 'user' | 'auto' | 'config';
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  chat: boolean;
  completion: boolean;
  embedding: boolean;
  maxTokens: number;
  contextWindow: number;
}

/**
 * Model service interface
 */
export interface IModelService extends vscode.Disposable {
  /**
   * Get available models
   */
  getAvailableModels(): Promise<ModelInfo[]>;
  
  /**
   * Get available models (cached)
   */
  getCachedModels(): ModelInfo[];
  
  /**
   * Refresh model list
   */
  refreshModels(): Promise<void>;
  
  /**
   * Get selected model
   */
  getSelectedModel(): string;
  
  /**
   * Set selected model
   */
  setSelectedModel(model: string): Promise<void>;
  
  /**
   * Validate model name
   */
  validateModel(model: string): boolean;
  
  /**
   * Check if model exists
   */
  hasModel(model: string): Promise<boolean>;
  
  /**
   * Get model info
   */
  getModelInfo(model: string): Promise<ModelInfo | undefined>;
  
  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities | undefined;
  
  /**
   * Initialize default model
   */
  initializeDefaultModel(): Promise<string | undefined>;
  
  /**
   * Subscribe to model selection changes
   */
  onModelSelectionChange(callback: (event: ModelSelectionEvent) => void): vscode.Disposable;
  
  /**
   * Get model suggestions for a task
   */
  getSuggestedModel(task: 'chat' | 'completion' | 'embedding'): string | undefined;
  
  /**
   * Download a model
   */
  downloadModel(modelName: string): Promise<void>;
  
  /**
   * Delete a model
   */
  deleteModel(modelName: string): Promise<void>;
}
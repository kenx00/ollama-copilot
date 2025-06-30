/**
 * Interface for code completion service
 */

import * as vscode from 'vscode';

/**
 * Completion context
 */
export interface CompletionContext {
  document: vscode.TextDocument;
  position: vscode.Position;
  prefix: string;
  suffix: string;
  language: string;
  indentation: string;
}

/**
 * Completion options
 */
export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  contextWindow?: number;
}

/**
 * Completion result
 */
export interface CompletionResult {
  text: string;
  range?: vscode.Range;
  confidence?: number;
  cached?: boolean;
}

/**
 * Completion cache entry
 */
export interface CompletionCacheEntry {
  key: string;
  result: CompletionResult;
  timestamp: number;
  accessCount: number;
}

/**
 * Completion statistics
 */
export interface CompletionStats {
  totalCompletions: number;
  cachedCompletions: number;
  cacheMisses: number;
  averageLatency: number;
  errorCount: number;
}

/**
 * Completion service interface
 */
export interface ICompletionService extends vscode.Disposable {
  /**
   * Get code completion
   */
  getCompletion(context: CompletionContext, options?: CompletionOptions): Promise<CompletionResult | null>;
  
  /**
   * Get multiple completions
   */
  getCompletions(context: CompletionContext, count: number, options?: CompletionOptions): Promise<CompletionResult[]>;
  
  /**
   * Cancel ongoing completion requests
   */
  cancelCompletions(): void;
  
  /**
   * Clear completion cache
   */
  clearCache(): void;
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number; entries: number };
  
  /**
   * Set default model
   */
  setDefaultModel(model: string): void;
  
  /**
   * Get default model
   */
  getDefaultModel(): string;
  
  /**
   * Check if completions are enabled
   */
  isEnabled(): boolean;
  
  /**
   * Enable/disable completions
   */
  setEnabled(enabled: boolean): void;
  
  /**
   * Get completion statistics
   */
  getStats(): CompletionStats;
  
  /**
   * Reset statistics
   */
  resetStats(): void;
  
  /**
   * Subscribe to completion events
   */
  onCompletion(callback: (result: CompletionResult) => void): vscode.Disposable;
  
  /**
   * Configure completion behavior
   */
  configure(options: CompletionOptions): void;
}
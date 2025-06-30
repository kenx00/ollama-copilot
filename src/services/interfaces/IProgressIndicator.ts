/**
 * Progress indicator service interface
 */

import * as vscode from 'vscode';

export interface ProgressUpdate {
  message?: string;
  increment?: number;
  total?: number;
}

export interface ProgressOptions {
  title: string;
  location?: 'notification' | 'statusBar' | 'sourceControl';
  cancellable?: boolean;
  showPercentage?: boolean;
  showDetails?: boolean;
  parentId?: string;
}

export interface IProgressIndicator extends vscode.Disposable {
  /**
   * Show progress for an operation
   */
  withProgress<T>(
    operationId: string,
    options: ProgressOptions,
    task: (progress: (update: ProgressUpdate) => void) => Promise<T>
  ): Promise<T>;
  
  /**
   * Update progress for an ongoing operation
   */
  updateProgress(operationId: string, update: ProgressUpdate): void;
  
  /**
   * Check if an operation is in progress
   */
  isInProgress(operationId: string): boolean;
  
  /**
   * Cancel an ongoing operation
   */
  cancelOperation(operationId: string): void;
  
  /**
   * Get all active operations
   */
  getActiveOperations(): string[];
  
  /**
   * Clear all operations
   */
  clearAll(): void;
  
  /**
   * Get operation details
   */
  getOperationDetails(operationId: string): {
    title: string;
    progress?: number;
    message?: string;
    duration: number;
    subOperations: string[];
  } | undefined;
  
  /**
   * Get progress history
   */
  getProgressHistory(limit?: number): Array<{
    id: string;
    title: string;
    duration: number;
    success: boolean;
    timestamp: Date;
  }>;
  
  /**
   * Show progress report
   */
  showProgressReport(): Promise<void>;
}

export interface IFileOperationStatusBar extends vscode.Disposable {
  /**
   * Update status bar with operation info
   */
  update(operationCount: number, activeOperation?: string): void;
  
  /**
   * Show the status bar
   */
  show(): void;
  
  /**
   * Hide the status bar
   */
  hide(): void;
  
  /**
   * Check if status bar is visible
   */
  isVisible(): boolean;
}
/**
 * Progress indicator service implementation
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import { 
  IProgressIndicator, 
  IFileOperationStatusBar,
  ProgressUpdate,
  ProgressOptions
} from '../interfaces/IProgressIndicator';
import {
  FileOperationStatusBar as LegacyFileOperationStatusBar
} from '../../ui/ProgressIndicator';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton } from '../../di/decorators';
import { CancellationManager } from '../../utils/CancellationManager';

/**
 * Progress operation state
 */
interface ProgressOperation {
  id: string;
  title: string;
  cancellationToken?: vscode.CancellationToken;
  startTime: number;
  progress?: number;
  message?: string;
  subOperations: Map<string, ProgressOperation>;
  parentId?: string;
}

/**
 * Progress indicator service
 */
@Singleton(SERVICE_IDENTIFIERS.IProgressIndicator)
export class ProgressIndicatorService extends Disposable implements IProgressIndicator {
  private readonly activeOperations = new Map<string, ProgressOperation>();
  private readonly cancellationManager = new CancellationManager();
  private readonly progressHistory: Array<{
    id: string;
    title: string;
    duration: number;
    success: boolean;
    timestamp: Date;
  }> = [];
  private readonly maxHistorySize = 100;
  
  constructor() {
    super();
    this.track(this.cancellationManager);
  }
  
  /**
   * Show progress for an operation
   */
  async withProgress<T>(
    operationId: string,
    options: ProgressOptions,
    task: (progress: (update: ProgressUpdate) => void) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const cancellationToken = options.cancellable ? 
      this.cancellationManager.createToken(operationId) : undefined;
    
    // Create operation state
    const operation: ProgressOperation = {
      id: operationId,
      title: options.title,
      cancellationToken,
      startTime,
      subOperations: new Map(),
      parentId: options.parentId
    };
    
    this.activeOperations.set(operationId, operation);
    
    // Add to parent if specified
    if (options.parentId) {
      const parent = this.activeOperations.get(options.parentId);
      if (parent) {
        parent.subOperations.set(operationId, operation);
      }
    }
    
    let success = false;
    
    try {
      // Use VS Code's window.withProgress for better integration
      const result = await vscode.window.withProgress(
        {
          location: this.getProgressLocation(options),
          title: options.title,
          cancellable: options.cancellable
        },
        async (progress, token) => {
          // Link cancellation tokens
          if (cancellationToken) {
            token.onCancellationRequested(() => {
              this.cancellationManager.cancel(operationId);
            });
          }
          
          // Create progress reporter
          const progressReporter = (update: ProgressUpdate) => {
            // Update operation state
            operation.progress = update.increment;
            operation.message = update.message;
            
            // Report to VS Code
            progress.report({
              increment: update.increment,
              message: update.message
            });
            
            // Update parent progress if nested
            if (operation.parentId) {
              this.updateParentProgress(operation.parentId);
            }
          };
          
          // Check if already cancelled
          if (cancellationToken?.isCancellationRequested) {
            throw new Error('Operation cancelled');
          }
          
          return await task(progressReporter);
        }
      );
      
      success = true;
      return result;
      
    } catch (error) {
      if (cancellationToken?.isCancellationRequested) {
        throw new Error('Operation cancelled by user');
      }
      throw error;
      
    } finally {
      // Record history
      const duration = Date.now() - startTime;
      this.progressHistory.push({
        id: operationId,
        title: options.title,
        duration,
        success,
        timestamp: new Date()
      });
      
      // Trim history
      if (this.progressHistory.length > this.maxHistorySize) {
        this.progressHistory.shift();
      }
      
      // Clean up
      this.activeOperations.delete(operationId);
      if (cancellationToken) {
        this.cancellationManager.dispose();
      }
      
      // Remove from parent
      if (operation.parentId) {
        const parent = this.activeOperations.get(operation.parentId);
        if (parent) {
          parent.subOperations.delete(operationId);
        }
      }
    }
  }
  
  /**
   * Update progress for an ongoing operation
   */
  updateProgress(operationId: string, update: ProgressUpdate): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {return;}
    
    operation.progress = update.increment;
    operation.message = update.message;
    
    // Notify parent if nested
    if (operation.parentId) {
      this.updateParentProgress(operation.parentId);
    }
  }
  
  /**
   * Check if an operation is in progress
   */
  isInProgress(operationId: string): boolean {
    return this.activeOperations.has(operationId);
  }
  
  /**
   * Get progress location based on options
   */
  private getProgressLocation(options: ProgressOptions): vscode.ProgressLocation {
    switch (options.location) {
      case 'notification':
        return vscode.ProgressLocation.Notification;
      case 'statusBar':
        return vscode.ProgressLocation.Window;
      case 'sourceControl':
        return vscode.ProgressLocation.SourceControl;
      default:
        return vscode.ProgressLocation.Notification;
    }
  }
  
  /**
   * Update parent operation progress based on children
   */
  private updateParentProgress(parentId: string): void {
    const parent = this.activeOperations.get(parentId);
    if (!parent || parent.subOperations.size === 0) {return;}
    
    // Calculate aggregate progress
    let totalProgress = 0;
    let completedOperations = 0;
    
    parent.subOperations.forEach(subOp => {
      if (subOp.progress !== undefined) {
        totalProgress += subOp.progress;
        if (subOp.progress >= 100) {
          completedOperations++;
        }
      }
    });
    
    const avgProgress = totalProgress / parent.subOperations.size;
    const message = `${completedOperations}/${parent.subOperations.size} operations completed`;
    
    // Update parent
    parent.progress = avgProgress;
    parent.message = message;
  }
  
  /**
   * Cancel an ongoing operation
   */
  cancelOperation(operationId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {return;}
    
    // Cancel this operation
    if (operation.cancellationToken) {
      this.cancellationManager.cancel(operationId);
    }
    
    // Cancel all sub-operations
    operation.subOperations.forEach((_, subId) => {
      this.cancelOperation(subId);
    });
    
    // Remove from active operations
    this.activeOperations.delete(operationId);
  }
  
  /**
   * Get all active operations
   */
  getActiveOperations(): string[] {
    return Array.from(this.activeOperations.keys());
  }
  
  /**
   * Get operation details
   */
  getOperationDetails(operationId: string): {
    title: string;
    progress?: number;
    message?: string;
    duration: number;
    subOperations: string[];
  } | undefined {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {return undefined;}
    
    return {
      title: operation.title,
      progress: operation.progress,
      message: operation.message,
      duration: Date.now() - operation.startTime,
      subOperations: Array.from(operation.subOperations.keys())
    };
  }
  
  /**
   * Get progress history
   */
  getProgressHistory(limit?: number): Array<{
    id: string;
    title: string;
    duration: number;
    success: boolean;
    timestamp: Date;
  }> {
    const history = [...this.progressHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }
  
  /**
   * Show progress report
   */
  async showProgressReport(): Promise<void> {
    const activeOps = Array.from(this.activeOperations.values());
    const history = this.getProgressHistory(20);
    
    const report = [
      '# Progress Report',
      '',
      '## Active Operations',
      ...activeOps.map(op => {
        const duration = Date.now() - op.startTime;
        const progress = op.progress ? `${op.progress}%` : 'Unknown';
        return `- **${op.title}** (${progress}, ${this.formatDuration(duration)})`;
      }),
      '',
      '## Recent Operations',
      ...history.map(h => {
        const status = h.success ? '✓' : '✗';
        return `- ${status} **${h.title}** (${this.formatDuration(h.duration)})`;
      })
    ].join('\n');
    
    const doc = await vscode.workspace.openTextDocument({
      content: report,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc, { preview: true });
  }
  
  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {return `${ms}ms`;}
    if (ms < 60000) {return `${(ms / 1000).toFixed(1)}s`;}
    return `${(ms / 60000).toFixed(1)}m`;
  }
  
  /**
   * Clear all operations
   */
  clearAll(): void {
    // Cancel all active operations
    this.activeOperations.forEach((_, id) => {
      this.cancelOperation(id);
    });
    
    this.activeOperations.clear();
    this.progressHistory.length = 0;
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Clear active operations
    this.clearAll();
  }
}

/**
 * File operation status bar service
 */
export class FileOperationStatusBarService extends Disposable implements IFileOperationStatusBar {
  private readonly statusBar: LegacyFileOperationStatusBar;
  private visible = false;
  
  constructor() {
    super();
    this.statusBar = new LegacyFileOperationStatusBar();
  }
  
  /**
   * Update status bar with operation info
   */
  update(operationCount: number, activeOperation?: string): void {
    this.statusBar.updateOperationCount(operationCount);
    if (activeOperation) {
      this.statusBar.setMessage(activeOperation);
    }
    if (operationCount > 0 && !this.visible) {
      this.show();
    } else if (operationCount === 0 && this.visible) {
      this.hide();
    }
  }
  
  /**
   * Show the status bar
   */
  show(): void {
    this.statusBar.statusBarItem.show();
    this.visible = true;
  }
  
  /**
   * Hide the status bar
   */
  hide(): void {
    this.statusBar.statusBarItem.hide();
    this.visible = false;
  }
  
  /**
   * Check if status bar is visible
   */
  isVisible(): boolean {
    return this.visible;
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    this.statusBar.dispose();
  }
}
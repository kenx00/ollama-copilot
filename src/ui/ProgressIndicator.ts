/**
 * Progress indicator components for file operations
 */

import * as vscode from 'vscode';

/**
 * File operation progress interface
 */
export interface FileOperationProgress {
  operation: string;
  fileName: string;
  progress: number;
  total: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error?: Error;
  message?: string;
  totalFiles?: number;
  processedFiles?: number;
  currentFile?: string;
}

export interface ProgressOptions {
  title: string;
  location?: vscode.ProgressLocation;
  cancellable?: boolean;
  showPercentage?: boolean;
  showDetails?: boolean;
}

/**
 * Manages progress indicators for file operations
 */
export class ProgressIndicator {
  private activeIndicators = new Map<string, vscode.Progress<{ message?: string; increment?: number }>>();
  private progressValues = new Map<string, number>();

  /**
   * Shows a progress indicator for a file operation
   */
  async withProgress<T>(
    operationId: string,
    options: ProgressOptions,
    task: (progress: (update: FileOperationProgress) => void) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: options.location || vscode.ProgressLocation.Notification,
        title: options.title,
        cancellable: options.cancellable !== false
      },
      async (progress, _token) => {
        this.activeIndicators.set(operationId, progress);
        this.progressValues.set(operationId, 0);

        try {
          return await task((update: FileOperationProgress) => {
            this.updateProgress(operationId, update, options);
          });
        } finally {
          this.activeIndicators.delete(operationId);
          this.progressValues.delete(operationId);
        }
      }
    );
  }

  /**
   * Updates progress for an operation
   */
  private updateProgress(
    operationId: string,
    update: FileOperationProgress,
    options: ProgressOptions
  ): void {
    const progress = this.activeIndicators.get(operationId);
    if (!progress) {return;}

    const previousValue = this.progressValues.get(operationId) || 0;
    const increment = Math.max(0, update.progress - previousValue);
    this.progressValues.set(operationId, update.progress);

    let message = update.message;

    // Add percentage if requested
    if (options.showPercentage) {
      message = `${Math.round(update.progress)}% - ${message}`;
    }

    // Add details if requested
    if (options.showDetails && update.totalFiles) {
      message = `${message} (${update.processedFiles}/${update.totalFiles})`;
    }

    // Add current file if available
    if (update.currentFile) {
      message = `${message}\n${update.currentFile}`;
    }

    progress.report({ message, increment });
  }

  /**
   * Shows a simple progress message
   */
  showProgress(
    title: string,
    message?: string,
    location: vscode.ProgressLocation = vscode.ProgressLocation.Notification
  ): vscode.Disposable {
    let disposed = false;
    
    vscode.window.withProgress(
      { location, title, cancellable: false },
      async (progress) => {
        if (message) {
          progress.report({ message });
        }
        
        // Keep progress open until disposed
        while (!disposed) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    );

    return new vscode.Disposable(() => {
      disposed = true;
    });
  }

  /**
   * Shows a multi-step progress indicator
   */
  async withMultiStepProgress<T>(
    title: string,
    steps: Array<{
      message: string;
      weight?: number;
      task: () => Promise<any>;
    }>,
    options?: {
      location?: vscode.ProgressLocation;
      cancellable?: boolean;
    }
  ): Promise<T[]> {
    return vscode.window.withProgress(
      {
        location: options?.location || vscode.ProgressLocation.Notification,
        title,
        cancellable: options?.cancellable !== false
      },
      async (progress, token) => {
        const results: T[] = [];
        const totalWeight = steps.reduce((sum, step) => sum + (step.weight || 1), 0);
        let completedWeight = 0;

        for (const step of steps) {
          if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
          }

          progress.report({
            message: step.message,
            increment: 0
          });

          try {
            const result = await step.task();
            results.push(result);

            const stepWeight = step.weight || 1;
            completedWeight += stepWeight;
            const increment = (stepWeight / totalWeight) * 100;

            progress.report({ increment });
          } catch (error) {
            throw new Error(`Failed at step "${step.message}": ${error}`);
          }
        }

        return results;
      }
    );
  }
}

/**
 * Progress notification that appears in the bottom right
 */
export class ProgressNotification {
  private notification: Thenable<string | undefined> | null = null;

  /**
   * Shows a progress notification with action buttons
   */
  show(
    message: string,
    actions?: Array<{ label: string; action: () => void }>
  ): void {
    const actionLabels = actions?.map(a => a.label) || [];
    
    this.notification = vscode.window.showInformationMessage(
      message,
      ...actionLabels
    );

    this.notification.then(selected => {
      if (selected && actions) {
        const action = actions.find(a => a.label === selected);
        action?.action();
      }
    });
  }

  /**
   * Updates the notification message
   */
  update(message: string): void {
    // VS Code doesn't support updating notifications directly,
    // so we'll use the status bar for updates
    vscode.window.setStatusBarMessage(message, 3000);
  }

  /**
   * Dismisses the notification
   */
  dismiss(): void {
    this.notification = null;
  }
}

/**
 * Status bar item for background operations
 */
export class FileOperationStatusBar implements vscode.Disposable {
  public readonly statusBarItem: vscode.StatusBarItem;
  private activeOperations = 0;
  private currentMessage = '';

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'ollama-copilot.showFileOperations';
  }

  /**
   * Updates the status bar with operation count
   */
  updateOperationCount(count: number): void {
    this.activeOperations = count;
    this.updateDisplay();
  }
  
  /**
   * Set the status bar message
   */
  setMessage(message: string): void {
    this.currentMessage = message;
    this.updateDisplay();
  }

  /**
   * Updates the current operation message
   */
  updateMessage(message: string): void {
    this.currentMessage = message;
    this.updateDisplay();
  }

  /**
   * Shows progress in the status bar
   */
  showProgress(operationCount: number, currentOperation?: string): void {
    this.activeOperations = operationCount;
    this.currentMessage = currentOperation || '';
    this.updateDisplay();
  }

  private updateDisplay(): void {
    if (this.activeOperations > 0) {
      const icon = '$(sync~spin)';
      const count = this.activeOperations > 1 ? ` (${this.activeOperations})` : '';
      const message = this.currentMessage ? `: ${this.currentMessage}` : '';
      
      this.statusBarItem.text = `${icon} File Operations${count}${message}`;
      this.statusBarItem.tooltip = 'Click to view active file operations';
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}

/**
 * Webview progress indicator for chat UI
 */
export class WebviewProgressIndicator {
  /**
   * Generates HTML for a progress bar
   */
  static getProgressBarHtml(progress: number, message?: string): string {
    const percentage = Math.round(Math.max(0, Math.min(100, progress)));
    
    return `
      <div class="progress-container">
        ${message ? `<div class="progress-message">${message}</div>` : ''}
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-text">${percentage}%</div>
      </div>
    `;
  }

  /**
   * Generates HTML for a loading spinner
   */
  static getLoadingSpinnerHtml(message?: string): string {
    return `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        ${message ? `<div class="loading-message">${message}</div>` : ''}
      </div>
    `;
  }

  /**
   * Generates CSS for progress indicators
   */
  static getStyles(): string {
    return `
      .progress-container {
        margin: 10px 0;
      }

      .progress-message {
        margin-bottom: 5px;
        font-size: 14px;
        color: var(--vscode-descriptionForeground);
      }

      .progress-bar {
        height: 6px;
        background-color: var(--vscode-progressBar-background);
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background-color: var(--vscode-progressBar-foreground);
        transition: width 0.3s ease;
      }

      .progress-text {
        margin-top: 5px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }

      .loading-container {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
      }

      .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid var(--vscode-progressBar-background);
        border-top-color: var(--vscode-progressBar-foreground);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .loading-message {
        font-size: 14px;
        color: var(--vscode-descriptionForeground);
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
  }
}

// Singleton instance
let progressIndicator: ProgressIndicator | null = null;
let statusBar: FileOperationStatusBar | null = null;

export function getProgressIndicator(): ProgressIndicator {
  if (!progressIndicator) {
    progressIndicator = new ProgressIndicator();
  }
  return progressIndicator;
}

export function getFileOperationStatusBar(): FileOperationStatusBar {
  if (!statusBar) {
    statusBar = new FileOperationStatusBar();
  }
  return statusBar;
}
/**
 * @file Error handler service implementation
 * @module services/implementations/ErrorHandlerService
 * @description Centralized error handling with user-friendly messaging
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import {
  IErrorHandlerService,
  ErrorInfo,
  ErrorSeverity,
  ErrorCategory,
  ErrorDisplayOptions,
  IErrorHandlerConfig,
  ErrorCodes,
  ErrorRecoverySuggestions,
} from '../interfaces/IErrorHandlerService';
import { IDisposable } from '../../types/IDisposable';
import { CircularBuffer } from '../../utils/CircularBuffer';

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: IErrorHandlerConfig = {
  enableTelemetry: false,
  showTechnicalDetails: false,
  autoRetry: {
    enabled: true,
    maxAttempts: 3,
    baseDelay: 1000
  },
  logRetentionDays: 7
};

/**
 * Error handler service implementation
 */
export class ErrorHandlerService extends Disposable implements IErrorHandlerService {
  private readonly outputChannel: vscode.OutputChannel;
  private readonly errorHistory: CircularBuffer<ErrorInfo>;
  private readonly globalHandlers: Set<(error: ErrorInfo) => void | Promise<void>>;
  private config: IErrorHandlerConfig;
  private readonly statusBarItem: vscode.StatusBarItem;
  private errorCount = 0;
  
  constructor() {
    super();
    
    this.outputChannel = vscode.window.createOutputChannel('Ollama Copilot - Errors');
    this.errorHistory = new CircularBuffer<ErrorInfo>(1000);
    this.globalHandlers = new Set();
    this.config = { ...DEFAULT_CONFIG };
    
    // Create status bar item for error notifications
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      -100
    );
    this.statusBarItem.command = 'ollama-copilot.showErrorLog';
    
    // Register command to show error log
    this.track(
      vscode.commands.registerCommand('ollama-copilot.showErrorLog', () => {
        this.outputChannel.show();
      })
    );
    
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }
  
  /**
   * Handle an error with appropriate user feedback
   */
  async handleError(
    error: Error | ErrorInfo,
    options: ErrorDisplayOptions = {}
  ): Promise<string | undefined> {
    const errorInfo = this.normalizeError(error);
    
    // Add to history
    this.errorHistory.push(errorInfo);
    this.errorCount++;
    
    // Log to output channel
    if (options.logToOutput !== false) {
      this.logToOutput(errorInfo);
    }
    
    // Notify global handlers
    await this.notifyGlobalHandlers(errorInfo);
    
    // Update status bar
    this.updateStatusBar();
    
    // Display to user based on options and severity
    return this.displayError(errorInfo, options);
  }
  
  /**
   * Create a structured error
   */
  createError(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity
  ): ErrorInfo {
    const suggestions = ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions];
    
    return {
      code,
      message,
      category,
      severity,
      suggestions: suggestions ? [...suggestions] : undefined,
      recoverable: severity !== ErrorSeverity.Critical,
      retryable: category === ErrorCategory.Network ? {
        attempts: 3,
        delay: 1000,
        maxDelay: 5000
      } : undefined
    };
  }
  
  /**
   * Log an error without displaying to user
   */
  logError(error: Error | ErrorInfo, context?: Record<string, any>): void {
    const errorInfo = this.normalizeError(error);
    
    if (context) {
      errorInfo.context = { ...errorInfo.context, ...context };
    }
    
    this.errorHistory.push(errorInfo);
    this.logToOutput(errorInfo);
    this.notifyGlobalHandlers(errorInfo).catch(console.error);
  }
  
  /**
   * Wrap an async operation with error handling
   */
  async wrapAsync<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    options: ErrorDisplayOptions = {}
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      const errorInfo = this.createError(
        ErrorCodes.UNKNOWN_ERROR,
        errorMessage,
        ErrorCategory.Unknown,
        ErrorSeverity.Error
      );
      
      errorInfo.originalError = error as Error;
      errorInfo.details = (error as Error).message;
      
      await this.handleError(errorInfo, options);
      return undefined;
    }
  }
  
  /**
   * Wrap a sync operation with error handling
   */
  wrapSync<T>(
    operation: () => T,
    errorMessage: string,
    options: ErrorDisplayOptions = {}
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      const errorInfo = this.createError(
        ErrorCodes.UNKNOWN_ERROR,
        errorMessage,
        ErrorCategory.Unknown,
        ErrorSeverity.Error
      );
      
      errorInfo.originalError = error as Error;
      errorInfo.details = (error as Error).message;
      
      this.handleError(errorInfo, options).catch(console.error);
      return undefined;
    }
  }
  
  /**
   * Show a success message
   */
  showSuccess(message: string, options: Omit<ErrorDisplayOptions, 'modal'> = {}): void {
    if (options.statusBarOnly) {
      this.showStatusBarMessage(message, 'check', 3000);
    } else {
      const actions = options.actions?.map(a => a.label) || [];
      vscode.window.showInformationMessage(message, ...actions).then(selected => {
        if (selected && options.actions) {
          const action = options.actions.find(a => a.label === selected);
          action?.action();
        }
      });
    }
  }
  
  /**
   * Show a warning message
   */
  showWarning(message: string, options: ErrorDisplayOptions = {}): void {
    const errorInfo = this.createError(
      ErrorCodes.UNKNOWN_ERROR,
      message,
      ErrorCategory.Unknown,
      ErrorSeverity.Warning
    );
    
    this.handleError(errorInfo, options).catch(console.error);
  }
  
  /**
   * Show an info message
   */
  showInfo(message: string, options: ErrorDisplayOptions = {}): void {
    const errorInfo = this.createError(
      ErrorCodes.UNKNOWN_ERROR,
      message,
      ErrorCategory.Unknown,
      ErrorSeverity.Info
    );
    
    this.handleError(errorInfo, options).catch(console.error);
  }
  
  /**
   * Get error history
   */
  getErrorHistory(limit?: number): ErrorInfo[] {
    const all = this.errorHistory.toArray();
    return limit ? all.slice(-limit) : all;
  }
  
  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    this.errorCount = 0;
    this.updateStatusBar();
    this.outputChannel.clear();
  }
  
  /**
   * Configure error handler
   */
  configure(config: IErrorHandlerConfig): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Register a global error handler
   */
  registerGlobalHandler(
    handler: (error: ErrorInfo) => void | Promise<void>
  ): IDisposable {
    this.globalHandlers.add(handler);
    
    return {
      dispose: () => {
        this.globalHandlers.delete(handler);
      }
    };
  }
  
  /**
   * Export error logs
   */
  exportLogs(format: 'json' | 'csv'): string {
    const errors = this.errorHistory.toArray();
    
    if (format === 'json') {
      return JSON.stringify(errors, null, 2);
    }
    
    // CSV format
    const headers = [
      'timestamp',
      'code',
      'message',
      'category',
      'severity',
      'details'
    ];
    
    const rows = errors.map(error => [
      new Date().toISOString(),
      error.code,
      error.message.replace(/"/g, '""'),
      error.category,
      error.severity,
      (error.details || '').replace(/"/g, '""')
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }
  
  /**
   * Private helper methods
   */
  
  private normalizeError(error: Error | ErrorInfo): ErrorInfo {
    if ('code' in error && 'category' in error && 'severity' in error) {
      return error as ErrorInfo;
    }
    
    // Convert Error to ErrorInfo
    const err = error as Error;
    let category = ErrorCategory.Unknown;
    let code: string = ErrorCodes.UNKNOWN_ERROR;
    
    // Try to categorize based on error message
    const message = err.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      category = ErrorCategory.Network;
      code = message.includes('timeout') ? ErrorCodes.NETWORK_TIMEOUT : ErrorCodes.API_ERROR;
    } else if (message.includes('file') || message.includes('enoent') || message.includes('permission')) {
      category = ErrorCategory.FileSystem;
      code = message.includes('enoent') ? ErrorCodes.FILE_NOT_FOUND : ErrorCodes.FILE_ACCESS_DENIED;
    } else if (message.includes('model')) {
      category = ErrorCategory.Model;
      code = ErrorCodes.MODEL_NOT_FOUND;
    } else if (message.includes('config') || message.includes('setting')) {
      category = ErrorCategory.Configuration;
      code = ErrorCodes.INVALID_CONFIGURATION;
    }
    
    return {
      code,
      message: this.getUserFriendlyMessage(err.message, category),
      details: err.message,
      category,
      severity: ErrorSeverity.Error,
      originalError: err,
      suggestions: ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions] ? 
        [...ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions]] : 
        undefined,
      recoverable: true
    };
  }
  
  private getUserFriendlyMessage(technicalMessage: string, category: ErrorCategory): string {
    // Map technical messages to user-friendly ones
    const messageMap: Record<string, string> = {
      'ECONNREFUSED': 'Unable to connect to Ollama. Please ensure the service is running.',
      'ETIMEDOUT': 'Connection timed out. Please check your network and try again.',
      'ENOENT': 'File not found. Please check the file path.',
      'EACCES': 'Permission denied. Please check file permissions.',
      'EPERM': 'Operation not permitted. You may need administrator privileges.'
    };
    
    // Check for known error patterns
    for (const [pattern, friendlyMessage] of Object.entries(messageMap)) {
      if (technicalMessage.includes(pattern)) {
        return friendlyMessage;
      }
    }
    
    // Generic messages by category
    switch (category) {
      case ErrorCategory.Network:
        return 'Network error occurred. Please check your connection.';
      case ErrorCategory.FileSystem:
        return 'File operation failed. Please check the file and try again.';
      case ErrorCategory.Model:
        return 'Model operation failed. Please check your model configuration.';
      case ErrorCategory.Configuration:
        return 'Configuration error. Please check your settings.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
  
  private async displayError(
    errorInfo: ErrorInfo,
    options: ErrorDisplayOptions
  ): Promise<string | undefined> {
    // Status bar only
    if (options.statusBarOnly) {
      this.showStatusBarMessage(errorInfo.message, 'error', options.autoDismiss);
      return undefined;
    }
    
    // Build message
    let message = errorInfo.message;
    
    if (this.config.showTechnicalDetails && errorInfo.details) {
      message += `\n\nDetails: ${errorInfo.details}`;
    }
    
    if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
      message += '\n\nSuggestions:\n' + errorInfo.suggestions.map(s => `• ${s}`).join('\n');
    }
    
    // Build actions
    const actions: string[] = [];
    const actionHandlers: Map<string, () => void | Promise<void>> = new Map();
    
    // Add custom actions
    if (options.actions) {
      for (const action of options.actions) {
        actions.push(action.label);
        actionHandlers.set(action.label, action.action);
      }
    }
    
    // Add default actions based on error type
    if (errorInfo.category === ErrorCategory.Network && errorInfo.retryable) {
      actions.push('Retry');
      actionHandlers.set('Retry', () => {
        vscode.window.showInformationMessage('Retrying operation...');
      });
    }
    
    if (errorInfo.code === ErrorCodes.API_NOT_AVAILABLE) {
      actions.push('Open Settings');
      actionHandlers.set('Open Settings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'ollama');
      });
    }
    
    actions.push('Show Log');
    actionHandlers.set('Show Log', () => this.outputChannel.show());
    
    // Display based on severity
    let result: Thenable<string | undefined>;
    
    switch (errorInfo.severity) {
      case ErrorSeverity.Critical:
      case ErrorSeverity.Error:
        if (options.modal) {
          result = vscode.window.showErrorMessage(message, { modal: true }, ...actions);
        } else {
          result = vscode.window.showErrorMessage(message, ...actions);
        }
        break;
        
      case ErrorSeverity.Warning:
        result = vscode.window.showWarningMessage(message, ...actions);
        break;
        
      case ErrorSeverity.Info:
      default:
        result = vscode.window.showInformationMessage(message, ...actions);
        break;
    }
    
    const selected = await result;
    
    if (selected && actionHandlers.has(selected)) {
      const handler = actionHandlers.get(selected)!;
      await handler();
    }
    
    return selected;
  }
  
  private logToOutput(errorInfo: ErrorInfo): void {
    const timestamp = new Date().toISOString();
    const level = errorInfo.severity.toUpperCase();
    
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${errorInfo.message}`);
    
    if (errorInfo.details) {
      this.outputChannel.appendLine(`  Details: ${errorInfo.details}`);
    }
    
    if (errorInfo.code) {
      this.outputChannel.appendLine(`  Code: ${errorInfo.code}`);
    }
    
    if (errorInfo.category) {
      this.outputChannel.appendLine(`  Category: ${errorInfo.category}`);
    }
    
    if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
      this.outputChannel.appendLine('  Suggestions:');
      errorInfo.suggestions.forEach(s => {
        this.outputChannel.appendLine(`    - ${s}`);
      });
    }
    
    if (errorInfo.originalError?.stack) {
      this.outputChannel.appendLine('  Stack trace:');
      this.outputChannel.appendLine(errorInfo.originalError.stack.split('\n').map(line => '    ' + line).join('\n'));
    }
    
    this.outputChannel.appendLine('');
  }
  
  private async notifyGlobalHandlers(errorInfo: ErrorInfo): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const handler of this.globalHandlers) {
      promises.push(
        Promise.resolve(handler(errorInfo)).catch(err => {
          console.error('Error in global error handler:', err);
        })
      );
    }
    
    await Promise.all(promises);
  }
  
  private updateStatusBar(): void {
    if (this.errorCount > 0) {
      this.statusBarItem.text = `$(error) ${this.errorCount} error${this.errorCount > 1 ? 's' : ''}`;
      this.statusBarItem.tooltip = 'Click to view error log';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }
  
  private showStatusBarMessage(
    message: string,
    icon: string,
    duration?: number
  ): void {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    item.text = `$(${icon}) ${message}`;
    item.show();
    
    if (duration) {
      setTimeout(() => item.dispose(), duration);
    }
  }
  
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions in commands
    const originalRegisterCommand = vscode.commands.registerCommand;
    
    (vscode.commands as any).registerCommand = (
      command: string,
      callback: (...args: any[]) => any,
      thisArg?: any
    ) => {
      return originalRegisterCommand.call(
        vscode.commands,
        command,
        async (...args: any[]) => {
          try {
            return await callback.apply(thisArg, args);
          } catch (error) {
            await this.handleError(error as Error, {
              actions: [{
                label: 'Report Issue',
                action: () => {
                  vscode.env.openExternal(
                    vscode.Uri.parse('https://github.com/ollama/ollama-copilot/issues')
                  );
                }
              }]
            });
          }
        },
        thisArg
      );
    };
  }
  
  /**
   * Cleanup resources
   */
  protected onDispose(): void {
    this.outputChannel.dispose();
    this.statusBarItem.dispose();
    this.globalHandlers.clear();
  }
}
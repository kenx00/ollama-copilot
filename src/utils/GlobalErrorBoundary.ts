/**
 * @file Global error boundary for the extension
 * @module utils/GlobalErrorBoundary
 * @description Catches unhandled errors and provides graceful degradation
 */

import * as vscode from 'vscode';
import { IErrorHandlerService, ErrorCategory, ErrorSeverity } from '../services/interfaces/IErrorHandlerService';

/**
 * Global error boundary configuration
 */
export interface ErrorBoundaryConfig {
  /**
   * Whether to show notifications for unhandled errors
   */
  showNotifications?: boolean;
  
  /**
   * Whether to log errors to console
   */
  logToConsole?: boolean;
  
  /**
   * Whether to offer recovery options
   */
  offerRecovery?: boolean;
  
  /**
   * Maximum number of errors before disabling notifications
   */
  maxErrors?: number;
  
  /**
   * Time window for error counting (ms)
   */
  errorWindow?: number;
}

/**
 * Global error boundary for the extension
 */
export class GlobalErrorBoundary {
  private static instance: GlobalErrorBoundary | undefined;
  private errorCount = 0;
  private errorTimestamps: number[] = [];
  private isActive = false;
  
  private readonly defaultConfig: Required<ErrorBoundaryConfig> = {
    showNotifications: true,
    logToConsole: true,
    offerRecovery: true,
    maxErrors: 5,
    errorWindow: 60000 // 1 minute
  };
  
  private config: Required<ErrorBoundaryConfig>;
  
  private constructor(
    private readonly errorHandler: IErrorHandlerService,
    config?: ErrorBoundaryConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }
  
  /**
   * Initialize the global error boundary
   */
  static initialize(
    errorHandler: IErrorHandlerService,
    config?: ErrorBoundaryConfig
  ): GlobalErrorBoundary {
    if (!GlobalErrorBoundary.instance) {
      GlobalErrorBoundary.instance = new GlobalErrorBoundary(errorHandler, config);
    }
    return GlobalErrorBoundary.instance;
  }
  
  /**
   * Get the singleton instance
   */
  static getInstance(): GlobalErrorBoundary | undefined {
    return GlobalErrorBoundary.instance;
  }
  
  /**
   * Activate the error boundary
   */
  activate(): void {
    if (this.isActive) {
      return;
    }
    
    this.isActive = true;
    
    // Handle uncaught exceptions
    process.on('uncaughtException', this.handleUncaughtException);
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', this.handleUnhandledRejection);
    
    // VS Code specific error handling
    if (vscode.window.onDidChangeWindowState) {
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused && this.errorCount > 0) {
          // Reset error count when window regains focus
          this.resetErrorCount();
        }
      });
    }
  }
  
  /**
   * Deactivate the error boundary
   */
  deactivate(): void {
    if (!this.isActive) {
      return;
    }
    
    this.isActive = false;
    
    process.off('uncaughtException', this.handleUncaughtException);
    process.off('unhandledRejection', this.handleUnhandledRejection);
  }
  
  /**
   * Wrap a function with error boundary protection
   */
  wrap<T extends (...args: any[]) => any>(
    fn: T,
    context: string
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.handleError(error, `${context} (async)`);
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        this.handleError(error as Error, context);
        throw error;
      }
    }) as T;
  }
  
  /**
   * Wrap an async function with error boundary protection
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: string
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error as Error, `${context} (async)`);
        throw error;
      }
    }) as T;
  }
  
  /**
   * Execute a function with error recovery
   */
  async executeWithRecovery<T>(
    fn: () => T | Promise<T>,
    context: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      const handled = await this.handleError(error as Error, context);
      
      if (handled && fallback !== undefined) {
        return fallback;
      }
      
      return undefined;
    }
  }
  
  /**
   * Handle uncaught exception
   */
  private handleUncaughtException = (error: Error): void => {
    console.error('Uncaught Exception:', error);
    
    this.handleError(error, 'Uncaught Exception', {
      severity: ErrorSeverity.Critical,
      category: ErrorCategory.Unknown
    });
    
    // Prevent process exit
    // In VS Code extensions, we want to keep running
  };
  
  /**
   * Handle unhandled promise rejection
   */
  private handleUnhandledRejection = (reason: any, _promise: Promise<any>): void => {
    const error = reason instanceof Error 
      ? reason 
      : new Error(`Unhandled Promise Rejection: ${String(reason)}`);
    
    console.error('Unhandled Rejection:', error);
    
    this.handleError(error, 'Unhandled Promise Rejection', {
      severity: ErrorSeverity.Error,
      category: ErrorCategory.Unknown
    });
  };
  
  /**
   * Handle an error
   */
  private async handleError(
    error: Error,
    context: string,
    options?: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
    }
  ): Promise<boolean> {
    // Update error count
    this.updateErrorCount();
    
    // Check if we should suppress notifications
    const shouldShowNotification = this.shouldShowNotification();
    
    try {
      // Create error info
      const errorInfo = this.errorHandler.createError(
        'GLOBAL_ERROR',
        error.message || 'An unexpected error occurred',
        options?.category || ErrorCategory.Unknown,
        options?.severity || ErrorSeverity.Error
      );
      
      // Severity is already set in createError, no need to modify
      
      // Add boundary context
      errorInfo.context = {
        ...errorInfo.context,
        errorBoundary: true,
        errorCount: this.errorCount,
        context
      };
      
      // Handle the error
      const userAction = await this.errorHandler.handleError(
        errorInfo,
        {
          modal: false,
          statusBarOnly: !shouldShowNotification || !this.config.showNotifications,
          actions: this.getRecoveryActions(errorInfo)
        }
      );
      
      return !!userAction;
    } catch (handlerError) {
      // Error handler itself failed
      console.error('Error handler failed:', handlerError);
      console.error('Original error:', error);
      
      if (shouldShowNotification) {
        vscode.window.showErrorMessage(
          `Critical Error: ${error.message}`,
          'Show Logs'
        ).then(action => {
          if (action === 'Show Logs') {
            vscode.commands.executeCommand('workbench.action.output.toggleOutput');
          }
        });
      }
      
      return false;
    }
  }
  
  /**
   * Update error count
   */
  private updateErrorCount(): void {
    const now = Date.now();
    
    // Remove old timestamps
    this.errorTimestamps = this.errorTimestamps.filter(
      timestamp => now - timestamp < this.config.errorWindow
    );
    
    // Add new timestamp
    this.errorTimestamps.push(now);
    this.errorCount = this.errorTimestamps.length;
  }
  
  /**
   * Reset error count
   */
  private resetErrorCount(): void {
    this.errorCount = 0;
    this.errorTimestamps = [];
  }
  
  /**
   * Check if we should show notification
   */
  private shouldShowNotification(): boolean {
    return this.errorCount <= this.config.maxErrors;
  }
  
  /**
   * Get recovery actions
   */
  private getRecoveryActions(error: any): any[] {
    const actions = [];
    
    if (error.category === ErrorCategory.Unknown) {
      actions.push({
        label: 'Clear Caches',
        action: () => {
          vscode.commands.executeCommand('ollama-copilot.clearCache');
        }
      });
    }
    
    actions.push({
      label: 'Restart Extension',
      action: async () => {
        const confirmed = await vscode.window.showWarningMessage(
          'This will restart the Ollama Copilot extension. Continue?',
          'Yes',
          'No'
        );
        
        if (confirmed === 'Yes') {
          await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
        }
      }
    });
    
    return actions;
  }
}

/**
 * Decorator to wrap methods with error boundary
 */
export function ErrorBoundary(context?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodContext = context || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = function (...args: any[]) {
      const boundary = GlobalErrorBoundary.getInstance();
      
      if (boundary) {
        return boundary.wrap(originalMethod.bind(this), methodContext)(...args);
      }
      
      // Fallback if boundary not initialized
      try {
        return originalMethod.apply(this, args);
      } catch (error) {
        console.error(`Error in ${methodContext}:`, error);
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Decorator to wrap async methods with error boundary
 */
export function AsyncErrorBoundary(context?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodContext = context || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = async function (...args: any[]) {
      const boundary = GlobalErrorBoundary.getInstance();
      
      if (boundary) {
        return boundary.wrapAsync(originalMethod.bind(this), methodContext)(...args);
      }
      
      // Fallback if boundary not initialized
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        console.error(`Error in ${methodContext}:`, error);
        throw error;
      }
    };
    
    return descriptor;
  };
}
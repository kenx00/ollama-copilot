/**
 * @file Error handler service interface
 * @module services/interfaces/IErrorHandlerService
 * @description Provides centralized error handling with user-friendly messaging
 */

import { IDisposable } from '../../types/IDisposable';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /**
   * Critical errors that prevent operation
   */
  Critical = 'critical',
  
  /**
   * Errors that affect functionality but allow continuation
   */
  Error = 'error',
  
  /**
   * Warnings about potential issues
   */
  Warning = 'warning',
  
  /**
   * Informational messages
   */
  Info = 'info'
}

/**
 * Error categories for better handling
 */
export enum ErrorCategory {
  /**
   * Network-related errors (API calls, connectivity)
   */
  Network = 'network',
  
  /**
   * File system errors
   */
  FileSystem = 'filesystem',
  
  /**
   * Validation errors
   */
  Validation = 'validation',
  
  /**
   * Configuration errors
   */
  Configuration = 'configuration',
  
  /**
   * Authentication/authorization errors
   */
  Auth = 'auth',
  
  /**
   * Model-related errors
   */
  Model = 'model',
  
  /**
   * Unknown/uncategorized errors
   */
  Unknown = 'unknown'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  /**
   * Error code for identification
   */
  code: string;
  
  /**
   * User-friendly error message
   */
  message: string;
  
  /**
   * Technical details for debugging
   */
  details?: string;
  
  /**
   * Error category
   */
  category: ErrorCategory;
  
  /**
   * Error severity
   */
  severity: ErrorSeverity;
  
  /**
   * Suggested recovery actions
   */
  suggestions?: string[];
  
  /**
   * Related documentation or help links
   */
  helpLinks?: string[];
  
  /**
   * Original error for debugging
   */
  originalError?: Error;
  
  /**
   * Additional context
   */
  context?: Record<string, any>;
  
  /**
   * Whether the error is recoverable
   */
  recoverable?: boolean;
  
  /**
   * Retry configuration if applicable
   */
  retryable?: {
    attempts: number;
    delay: number;
    maxDelay: number;
  };
}

/**
 * Error action button
 */
export interface ErrorAction {
  /**
   * Action label
   */
  label: string;
  
  /**
   * Action handler
   */
  action: () => void | Promise<void>;
  
  /**
   * Whether this is the primary action
   */
  isPrimary?: boolean;
}

/**
 * Error display options
 */
export interface ErrorDisplayOptions {
  /**
   * Show as modal dialog
   */
  modal?: boolean;
  
  /**
   * Show in status bar only
   */
  statusBarOnly?: boolean;
  
  /**
   * Auto-dismiss after milliseconds
   */
  autoDismiss?: number;
  
  /**
   * Action buttons
   */
  actions?: ErrorAction[];
  
  /**
   * Show technical details
   */
  showDetails?: boolean;
  
  /**
   * Log to output channel
   */
  logToOutput?: boolean;
}

/**
 * Error handler configuration
 */
export interface IErrorHandlerConfig {
  /**
   * Enable telemetry reporting
   */
  enableTelemetry?: boolean;
  
  /**
   * Show technical details to users
   */
  showTechnicalDetails?: boolean;
  
  /**
   * Auto-retry configuration
   */
  autoRetry?: {
    enabled: boolean;
    maxAttempts: number;
    baseDelay: number;
  };
  
  /**
   * Error log retention days
   */
  logRetentionDays?: number;
}

/**
 * Error handler service interface
 */
export interface IErrorHandlerService extends IDisposable {
  /**
   * Handle an error with appropriate user feedback
   * @param error - The error to handle
   * @param options - Display options
   * @returns Promise resolving to user action if any
   */
  handleError(error: Error | ErrorInfo, options?: ErrorDisplayOptions): Promise<string | undefined>;
  
  /**
   * Create a structured error
   * @param code - Error code
   * @param message - User-friendly message
   * @param category - Error category
   * @param severity - Error severity
   * @returns Structured error info
   */
  createError(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity
  ): ErrorInfo;
  
  /**
   * Log an error without displaying to user
   * @param error - The error to log
   * @param context - Additional context
   */
  logError(error: Error | ErrorInfo, context?: Record<string, any>): void;
  
  /**
   * Wrap an async operation with error handling
   * @param operation - The operation to wrap
   * @param errorMessage - Custom error message
   * @param options - Error display options
   * @returns The operation result or undefined on error
   */
  wrapAsync<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    options?: ErrorDisplayOptions
  ): Promise<T | undefined>;
  
  /**
   * Wrap a sync operation with error handling
   * @param operation - The operation to wrap
   * @param errorMessage - Custom error message
   * @param options - Error display options
   * @returns The operation result or undefined on error
   */
  wrapSync<T>(
    operation: () => T,
    errorMessage: string,
    options?: ErrorDisplayOptions
  ): T | undefined;
  
  /**
   * Show a success message
   * @param message - Success message
   * @param options - Display options
   */
  showSuccess(message: string, options?: Omit<ErrorDisplayOptions, 'modal'>): void;
  
  /**
   * Show a warning message
   * @param message - Warning message
   * @param options - Display options
   */
  showWarning(message: string, options?: ErrorDisplayOptions): void;
  
  /**
   * Show an info message
   * @param message - Info message
   * @param options - Display options
   */
  showInfo(message: string, options?: ErrorDisplayOptions): void;
  
  /**
   * Get error history
   * @param limit - Maximum number of errors to return
   * @returns Array of error info
   */
  getErrorHistory(limit?: number): ErrorInfo[];
  
  /**
   * Clear error history
   */
  clearErrorHistory(): void;
  
  /**
   * Configure error handler
   * @param config - Configuration options
   */
  configure(config: IErrorHandlerConfig): void;
  
  /**
   * Register a global error handler
   * @param handler - Error handler function
   * @returns Disposable to unregister
   */
  registerGlobalHandler(
    handler: (error: ErrorInfo) => void | Promise<void>
  ): IDisposable;
  
  /**
   * Export error logs
   * @param format - Export format
   * @returns Exported data
   */
  exportLogs(format: 'json' | 'csv'): string;
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  API_ERROR: 'API_ERROR',
  API_NOT_AVAILABLE: 'API_NOT_AVAILABLE',
  
  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  
  // Model errors
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_LOAD_FAILED: 'MODEL_LOAD_FAILED',
  
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE'
} as const;

/**
 * Error recovery suggestions
 */
export const ErrorRecoverySuggestions = {
  [ErrorCodes.NETWORK_TIMEOUT]: [
    'Check your internet connection',
    'Try again in a few moments',
    'Check if Ollama service is running'
  ],
  [ErrorCodes.NETWORK_OFFLINE]: [
    'Check your internet connection',
    'Ensure you are connected to the network'
  ],
  [ErrorCodes.API_NOT_AVAILABLE]: [
    'Ensure Ollama is installed and running',
    'Check the API host configuration',
    'Run "ollama serve" in terminal'
  ],
  [ErrorCodes.MODEL_NOT_FOUND]: [
    'Install the model using "ollama pull [model-name]"',
    'Select a different model',
    'Check available models with "ollama list"'
  ],
  [ErrorCodes.FILE_ACCESS_DENIED]: [
    'Check file permissions',
    'Ensure the file is not locked by another process',
    'Try running VS Code with elevated permissions'
  ],
  [ErrorCodes.INVALID_CONFIGURATION]: [
    'Check your extension settings',
    'Reset to default configuration',
    'Consult the documentation for valid values'
  ]
} as const;
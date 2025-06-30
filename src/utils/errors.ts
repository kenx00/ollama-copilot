/**
 * @file Structured error types and utilities
 * @module utils/errors
 * @description Provides structured error classes with recovery suggestions
 */

import {
  ErrorInfo,
  ErrorSeverity,
  ErrorCategory,
  ErrorCodes,
  ErrorRecoverySuggestions
} from '../services/interfaces/IErrorHandlerService';

/**
 * Base error class with structured information
 */
export abstract class StructuredError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public suggestions?: string[];
  public helpLinks?: string[];
  public readonly recoverable: boolean;
  public readonly retryable?: {
    attempts: number;
    delay: number;
    maxDelay: number;
  };
  public context?: Record<string, any>;
  
  constructor(errorInfo: Partial<ErrorInfo> & { message: string }) {
    super(errorInfo.message);
    this.name = this.constructor.name;
    this.code = errorInfo.code || ErrorCodes.UNKNOWN_ERROR;
    this.category = errorInfo.category || ErrorCategory.Unknown;
    this.severity = errorInfo.severity || ErrorSeverity.Error;
    this.suggestions = errorInfo.suggestions;
    this.helpLinks = errorInfo.helpLinks;
    this.recoverable = errorInfo.recoverable ?? true;
    this.retryable = errorInfo.retryable;
    this.context = errorInfo.context;
  }
  
  /**
   * Convert to ErrorInfo object
   */
  toErrorInfo(): ErrorInfo {
    return {
      code: this.code,
      message: this.message,
      details: this.stack,
      category: this.category,
      severity: this.severity,
      suggestions: this.suggestions,
      helpLinks: this.helpLinks,
      originalError: this,
      context: this.context,
      recoverable: this.recoverable,
      retryable: this.retryable
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends StructuredError {
  constructor(
    message: string,
    code: string = ErrorCodes.API_ERROR,
    context?: Record<string, any>
  ) {
    super({
      message,
      code,
      category: ErrorCategory.Network,
      severity: ErrorSeverity.Error,
      suggestions: ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions] ? 
        [...ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions]] : 
        undefined,
      recoverable: true,
      retryable: {
        attempts: 3,
        delay: 1000,
        maxDelay: 5000
      },
      context
    });
  }
}

/**
 * Connection timeout error
 */
export class TimeoutError extends NetworkError {
  constructor(url: string, timeout: number) {
    super(
      `Connection to ${url} timed out after ${timeout}ms`,
      ErrorCodes.NETWORK_TIMEOUT,
      { url, timeout }
    );
  }
}

/**
 * API not available error
 */
export class ApiNotAvailableError extends NetworkError {
  constructor(apiHost: string) {
    super(
      `Cannot connect to Ollama API at ${apiHost}`,
      ErrorCodes.API_NOT_AVAILABLE,
      { apiHost }
    );
    
    this.helpLinks = [
      'https://github.com/ollama/ollama#quickstart',
      'https://ollama.ai/download'
    ];
  }
}

/**
 * File system errors
 */
export class FileSystemError extends StructuredError {
  constructor(
    message: string,
    code: string = ErrorCodes.FILE_NOT_FOUND,
    path?: string
  ) {
    super({
      message,
      code,
      category: ErrorCategory.FileSystem,
      severity: ErrorSeverity.Error,
      suggestions: ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions] ? 
        [...ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions]] : 
        undefined,
      context: { path }
    });
  }
}

/**
 * File not found error
 */
export class FileNotFoundError extends FileSystemError {
  constructor(path: string) {
    super(
      `File not found: ${path}`,
      ErrorCodes.FILE_NOT_FOUND,
      path
    );
  }
}

/**
 * File access denied error
 */
export class FileAccessDeniedError extends FileSystemError {
  constructor(path: string, operation: string = 'access') {
    super(
      `Permission denied: Cannot ${operation} file ${path}`,
      ErrorCodes.FILE_ACCESS_DENIED,
      path
    );
  }
}

/**
 * File too large error
 */
export class FileTooLargeError extends FileSystemError {
  constructor(path: string, size: number, maxSize: number) {
    super(
      `File ${path} is too large (${formatBytes(size)} > ${formatBytes(maxSize)})`,
      ErrorCodes.FILE_TOO_LARGE,
      path
    );
    
    this.context = { path, size, maxSize };
    this.suggestions = [
      `The file size limit is ${formatBytes(maxSize)}`,
      'Consider splitting the file into smaller parts',
      'Use a streaming approach for large files'
    ];
  }
}

/**
 * Model-related errors
 */
export class ModelError extends StructuredError {
  constructor(
    message: string,
    code: string = ErrorCodes.MODEL_NOT_FOUND,
    modelName?: string
  ) {
    super({
      message,
      code,
      category: ErrorCategory.Model,
      severity: ErrorSeverity.Error,
      suggestions: ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions] ? 
        [...ErrorRecoverySuggestions[code as keyof typeof ErrorRecoverySuggestions]] : 
        undefined,
      context: { modelName }
    });
  }
}

/**
 * Model not found error
 */
export class ModelNotFoundError extends ModelError {
  constructor(modelName: string, availableModels?: string[]) {
    super(
      `Model '${modelName}' not found`,
      ErrorCodes.MODEL_NOT_FOUND,
      modelName
    );
    
    if (availableModels && availableModels.length > 0) {
      this.suggestions = [
        ...this.suggestions || [],
        `Available models: ${availableModels.join(', ')}`
      ];
    }
  }
}

/**
 * Model load failed error
 */
export class ModelLoadFailedError extends ModelError {
  constructor(modelName: string, reason?: string) {
    super(
      `Failed to load model '${modelName}'${reason ? `: ${reason}` : ''}`,
      ErrorCodes.MODEL_LOAD_FAILED,
      modelName
    );
    
    this.suggestions = [
      'Check if the model is properly installed',
      'Ensure you have enough disk space',
      'Try reinstalling the model with "ollama pull"'
    ];
  }
}

/**
 * Validation errors
 */
export class ValidationError extends StructuredError {
  constructor(
    message: string,
    field?: string,
    value?: any
  ) {
    super({
      message,
      code: ErrorCodes.INVALID_INPUT,
      category: ErrorCategory.Validation,
      severity: ErrorSeverity.Warning,
      recoverable: true,
      context: { field, value }
    });
  }
}

/**
 * Configuration validation error
 */
export class ConfigurationError extends ValidationError {
  constructor(
    setting: string,
    value: any,
    reason: string
  ) {
    super(
      `Invalid configuration for '${setting}': ${reason}`,
      setting,
      value
    );
    
    this.suggestions = ErrorRecoverySuggestions[ErrorCodes.INVALID_CONFIGURATION] ?
      [...ErrorRecoverySuggestions[ErrorCodes.INVALID_CONFIGURATION]] :
      undefined;
  }
}

/**
 * Operation cancelled error
 */
export class OperationCancelledError extends StructuredError {
  constructor(operationName?: string) {
    super({
      message: operationName 
        ? `Operation '${operationName}' was cancelled`
        : 'Operation cancelled by user',
      code: ErrorCodes.OPERATION_CANCELLED,
      category: ErrorCategory.Unknown,
      severity: ErrorSeverity.Info,
      recoverable: true
    });
  }
}

/**
 * Feature not available error
 */
export class FeatureNotAvailableError extends StructuredError {
  constructor(feature: string, reason?: string) {
    super({
      message: `Feature '${feature}' is not available${reason ? `: ${reason}` : ''}`,
      code: ErrorCodes.FEATURE_NOT_AVAILABLE,
      category: ErrorCategory.Configuration,
      severity: ErrorSeverity.Warning,
      suggestions: [
        'Check if the feature is enabled in settings',
        'Ensure you have the required dependencies installed',
        'Update to the latest version of the extension'
      ]
    });
  }
}

/**
 * Error factory for creating structured errors
 */
export class ErrorFactory {
  /**
   * Create an error from a generic error
   */
  static fromError(error: Error): StructuredError {
    // Check if already a structured error
    if (error instanceof StructuredError) {
      return error;
    }
    
    // Try to categorize based on error message
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('econnrefused')) {
      return new ApiNotAvailableError('http://localhost:11434');
    }
    if (message.includes('etimedout') || message.includes('timeout')) {
      return new TimeoutError('unknown', 30000);
    }
    if (message.includes('network') || message.includes('fetch')) {
      return new NetworkError(error.message);
    }
    
    // File errors
    if (message.includes('enoent') || message.includes('not found')) {
      return new FileNotFoundError('unknown');
    }
    if (message.includes('eacces') || message.includes('permission')) {
      return new FileAccessDeniedError('unknown');
    }
    
    // Model errors
    if (message.includes('model') && message.includes('not found')) {
      return new ModelNotFoundError('unknown');
    }
    
    // Validation errors
    if (message.includes('invalid') || message.includes('validation')) {
      return new ValidationError(error.message);
    }
    
    // Default
    return new class extends StructuredError {
      constructor() {
        super({
          message: error.message,
          code: ErrorCodes.UNKNOWN_ERROR,
          category: ErrorCategory.Unknown,
          severity: ErrorSeverity.Error,
          originalError: error
        });
      }
    }();
  }
  
  /**
   * Create an error with context
   */
  static withContext(
    error: Error | StructuredError,
    context: Record<string, any>
  ): StructuredError {
    const structuredError = error instanceof StructuredError 
      ? error 
      : this.fromError(error);
    
    structuredError.context = {
      ...structuredError.context,
      ...context
    };
    
    return structuredError;
  }
}

/**
 * Utility functions
 */

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Check if an error is recoverable
 */
export function isRecoverable(error: Error): boolean {
  if (error instanceof StructuredError) {
    return error.recoverable;
  }
  
  // Assume unknown errors might be recoverable
  return true;
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: Error): boolean {
  if (error instanceof StructuredError) {
    return error.retryable !== undefined;
  }
  
  // Check for common retryable patterns
  const message = error.message.toLowerCase();
  return message.includes('timeout') || 
         message.includes('network') ||
         message.includes('temporarily');
}

/**
 * Get retry configuration for an error
 */
export function getRetryConfig(error: Error): {
  attempts: number;
  delay: number;
  maxDelay: number;
} | undefined {
  if (error instanceof StructuredError) {
    return error.retryable;
  }
  
  // Default retry config for potentially retryable errors
  if (isRetryable(error)) {
    return {
      attempts: 3,
      delay: 1000,
      maxDelay: 5000
    };
  }
  
  return undefined;
}
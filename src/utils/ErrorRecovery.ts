/**
 * Error recovery utilities with retry mechanisms and user-friendly error handling
 */

import * as vscode from 'vscode';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface ErrorRecoveryOptions {
  showErrorMessage?: boolean;
  offerRetry?: boolean;
  logError?: boolean;
  fallbackValue?: any;
}

/**
 * Implements exponential backoff retry logic
 */
export class ExponentialBackoff {
  private readonly defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    onRetry: () => {},
    shouldRetry: (error) => {
      // Retry on network errors, timeouts, and temporary failures
      const message = error.message.toLowerCase();
      return (
        message.includes('econnrefused') ||
        message.includes('timeout') ||
        message.includes('enotfound') ||
        message.includes('temporary') ||
        message.includes('rate limit')
      );
    }
  };

  /**
   * Retries an operation with exponential backoff
   */
  async retry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions | number
  ): Promise<T> {
    const opts = typeof options === 'number' 
      ? { ...this.defaultOptions, maxAttempts: options }
      : { ...this.defaultOptions, ...options };

    let lastError: Error | null = null;
    let delay = opts.initialDelay;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (!opts.shouldRetry(lastError)) {
          throw lastError;
        }

        // Don't retry if it's the last attempt
        if (attempt === opts.maxAttempts) {
          throw lastError;
        }

        // Call retry callback
        opts.onRetry(attempt, lastError);

        // Wait before retrying
        await this.delay(delay);

        // Calculate next delay
        delay = Math.min(delay * opts.factor, opts.maxDelay);
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Provides user-friendly error messages and recovery options
 */
export class ErrorRecovery {
  private static readonly errorMappings = new Map<RegExp, string>([
    [/ENOENT|no such file/i, 'File not found. Please check if the file exists and try again.'],
    [/EACCES|permission denied/i, 'Permission denied. Please check file permissions.'],
    [/ENOSPC|no space/i, 'Not enough disk space. Please free up some space and try again.'],
    [/ETIMEDOUT|timeout/i, 'Operation timed out. Please try again.'],
    [/ECONNREFUSED|connection refused/i, 'Connection refused. Please check if the service is running.'],
    [/ENOTFOUND|not found/i, 'Service not found. Please check your connection settings.'],
    [/rate limit/i, 'Rate limit exceeded. Please wait a moment and try again.'],
    [/invalid path/i, 'Invalid file path. Please check the path and try again.'],
    [/file too large/i, 'File is too large. Please try with a smaller file.'],
    [/out of memory/i, 'Out of memory. Please close some applications and try again.']
  ]);

  /**
   * Handles an error with user-friendly messaging and recovery options
   */
  static async handleError(
    error: Error,
    context: string,
    options?: ErrorRecoveryOptions
  ): Promise<any> {
    const opts = {
      showErrorMessage: true,
      offerRetry: false,
      logError: true,
      ...options
    };

    // Log error if requested
    if (opts.logError) {
      console.error(`Error in ${context}:`, error);
    }

    // Get user-friendly message
    const userMessage = this.getUserFriendlyMessage(error);
    const fullMessage = `${context}: ${userMessage}`;

    // Show error message if requested
    if (opts.showErrorMessage) {
      if (opts.offerRetry) {
        const action = await vscode.window.showErrorMessage(
          fullMessage,
          'Retry',
          'Cancel'
        );
        return action === 'Retry';
      } else {
        vscode.window.showErrorMessage(fullMessage);
      }
    }

    // Return fallback value if provided
    return opts.fallbackValue;
  }

  /**
   * Gets a user-friendly error message
   */
  static getUserFriendlyMessage(error: Error): string {
    const errorMessage = error.message;

    // Check against known error patterns
    for (const [pattern, friendlyMessage] of this.errorMappings) {
      if (pattern.test(errorMessage)) {
        return friendlyMessage;
      }
    }

    // Default message
    return errorMessage;
  }

  /**
   * Creates a recovery suggestion based on the error
   */
  static getRecoverySuggestion(error: Error): string[] {
    const suggestions: string[] = [];
    const message = error.message.toLowerCase();

    if (message.includes('enoent') || message.includes('not found')) {
      suggestions.push('Check if the file path is correct');
      suggestions.push('Ensure the file hasn\'t been moved or deleted');
    }

    if (message.includes('eacces') || message.includes('permission')) {
      suggestions.push('Check file permissions');
      suggestions.push('Run VS Code with appropriate permissions');
    }

    if (message.includes('timeout')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try again with a longer timeout');
      suggestions.push('Check if any firewall is blocking the connection');
    }

    if (message.includes('enospc')) {
      suggestions.push('Free up disk space');
      suggestions.push('Check available storage');
    }

    if (suggestions.length === 0) {
      suggestions.push('Try again in a few moments');
      suggestions.push('Check the VS Code output panel for more details');
    }

    return suggestions;
  }

  /**
   * Shows a detailed error dialog with recovery options
   */
  static async showDetailedError(
    error: Error,
    context: string,
    actions?: Array<{ label: string; action: () => Promise<void> }>
  ): Promise<void> {
    const message = this.getUserFriendlyMessage(error);
    const suggestions = this.getRecoverySuggestion(error);
    
    const detailMessage = `${context}\n\nError: ${message}\n\nSuggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`;

    const items = [
      ...(actions || []).map(a => a.label),
      'Show Details',
      'Copy Error',
      'Cancel'
    ];

    const selected = await vscode.window.showErrorMessage(detailMessage, ...items);

    if (selected && actions) {
      const action = actions.find(a => a.label === selected);
      if (action) {
        await action.action();
        return;
      }
    }

    switch (selected) {
      case 'Show Details':
        const outputChannel = vscode.window.createOutputChannel('Error Details');
        outputChannel.appendLine(`Error in ${context}`);
        outputChannel.appendLine(`Message: ${error.message}`);
        outputChannel.appendLine(`Stack: ${error.stack}`);
        outputChannel.show();
        break;

      case 'Copy Error':
        await vscode.env.clipboard.writeText(
          `Error: ${error.message}\nContext: ${context}\nStack: ${error.stack}`
        );
        vscode.window.showInformationMessage('Error details copied to clipboard');
        break;
    }
  }
}

/**
 * Wraps an async operation with error recovery
 */
export async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  context: string,
  options?: ErrorRecoveryOptions & RetryOptions
): Promise<T | undefined> {
  const backoff = new ExponentialBackoff();
  
  try {
    // Try with retry logic if retry options are provided
    if (options?.maxAttempts && options.maxAttempts > 1) {
      return await backoff.retry(operation, options);
    }
    
    // Single attempt
    return await operation();
  } catch (error) {
    const shouldRetry = await ErrorRecovery.handleError(
      error as Error,
      context,
      options
    );

    if (shouldRetry && options?.offerRetry) {
      // User chose to retry
      return withErrorRecovery(operation, context, {
        ...options,
        offerRetry: false // Don't offer retry again
      });
    }

    return options?.fallbackValue;
  }
}
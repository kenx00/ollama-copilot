/**
 * Validation error handling service interface
 */

import * as vscode from 'vscode';
import { ValidationError } from '../../validators/interfaces';
import { ErrorDisplayOptions } from './IErrorHandlerService';

export interface IValidationErrorHandler extends vscode.Disposable {
  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: ValidationError): string;
  
  /**
   * Show validation errors to user
   */
  showValidationErrors(errors: ValidationError[], title?: string, options?: ErrorDisplayOptions): Promise<void>;
  
  /**
   * Log validation errors
   */
  logErrors(errors: ValidationError[], context?: string): void;
  
  /**
   * Create diagnostic for validation error
   */
  createDiagnostic(error: ValidationError, uri: vscode.Uri): vscode.Diagnostic;
  
  /**
   * Register custom error formatter
   */
  registerFormatter(field: string, formatter: (error: ValidationError) => string): void;
  
  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number>;
  
  /**
   * Clear error history
   */
  clearHistory(): void;
  
  /**
   * Export error report
   */
  exportErrorReport(): Promise<string>;
}
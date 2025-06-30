/**
 * Configuration validation service interface
 */

import * as vscode from 'vscode';
import { ValidationResult } from '../../validators/interfaces';

export interface ConfigurationValidationResult extends ValidationResult {
  configuration?: vscode.WorkspaceConfiguration;
  suggestions?: string[];
}

export interface IConfigurationValidator extends vscode.Disposable {
  /**
   * Validate the entire configuration
   */
  validateConfiguration(): Promise<ConfigurationValidationResult>;
  
  /**
   * Validate a specific configuration section
   */
  validateSection(section: string): Promise<ConfigurationValidationResult>;
  
  /**
   * Validate a specific configuration key
   */
  validateKey(key: string, value: any): ValidationResult;
  
  /**
   * Show validation status in UI
   */
  showValidationStatus(): Promise<void>;
  
  /**
   * Handle configuration change events
   */
  onConfigurationChange(event: vscode.ConfigurationChangeEvent): void;
  
  /**
   * Register custom validator for a key
   */
  registerValidator(key: string, validator: (value: any) => ValidationResult): void;
  
  /**
   * Get validation rules for a key
   */
  getValidationRules(key: string): any;
  
  /**
   * Auto-fix invalid configuration values
   */
  autoFix(): Promise<number>;
  
  /**
   * Export validation report
   */
  exportReport(): Promise<string>;
}
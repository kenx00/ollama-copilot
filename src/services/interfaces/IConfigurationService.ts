/**
 * Interface for configuration management service
 */

import * as vscode from 'vscode';

/**
 * Configuration value types
 */
export type ConfigValue = string | number | boolean | object | null | undefined;

/**
 * Configuration section
 */
export interface ConfigSection {
  [key: string]: ConfigValue;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  affectsConfiguration(section: string, scope?: vscode.ConfigurationScope): boolean;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: Array<{
    section: string;
    key: string;
    message: string;
  }>;
}

/**
 * Configuration service interface
 */
export interface IConfigurationService extends vscode.Disposable {
  /**
   * Get configuration value
   */
  get<T>(section: string, defaultValue?: T): T;
  
  /**
   * Get configuration section
   */
  getSection(section: string): ConfigSection;
  
  /**
   * Update configuration value
   */
  update(section: string, value: ConfigValue, target?: vscode.ConfigurationTarget): Promise<void>;
  
  /**
   * Has configuration value
   */
  has(section: string): boolean;
  
  /**
   * Inspect configuration value
   */
  inspect<T>(section: string): {
    key: string;
    defaultValue?: T;
    globalValue?: T;
    workspaceValue?: T;
    workspaceFolderValue?: T;
  } | undefined;
  
  /**
   * Validate configuration
   */
  validate(): Promise<ConfigValidationResult>;
  
  /**
   * Reset configuration to defaults
   */
  reset(section: string, target?: vscode.ConfigurationTarget): Promise<void>;
  
  /**
   * Subscribe to configuration changes
   */
  onDidChangeConfiguration(callback: (event: ConfigChangeEvent) => void): vscode.Disposable;
  
  /**
   * Get all configuration keys
   */
  getAllKeys(): string[];
  
  /**
   * Export configuration
   */
  export(): ConfigSection;
  
  /**
   * Import configuration
   */
  import(config: ConfigSection, target?: vscode.ConfigurationTarget): Promise<void>;
  
  /**
   * Get configuration schema
   */
  getSchema(): object;
  
  /**
   * Reload configuration
   */
  reload(): Promise<void>;
}
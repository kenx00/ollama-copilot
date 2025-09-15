/**
 * Configuration validator for VS Code extension settings
 */

import * as vscode from 'vscode';
import { ValidationResult, ValidationError, ConfigValidationOptions } from '../schemas/ValidationSchemas';
// Removed unused import

/**
 * Configuration schema definition
 */
export interface ExtensionConfig {
  defaultModel?: string;
  apiHost?: string;
  enableInlineCompletion?: boolean;
  maxMessageHistory?: number;
  maxMessageLength?: number;
  completionCacheSize?: number;
  completion?: {
    maxTokens?: number;
    temperature?: number;
    contextWindow?: number;
  };
  memory?: {
    enableMonitoring?: boolean;
    monitoringInterval?: number;
    warningThresholdMB?: number;
    criticalThresholdMB?: number;
  };

}

/**
 * Configuration validation rules
 */
export const configurationRules: Record<string, ConfigValidationOptions> = {
  'ollama.defaultModel': {
    type: 'string',
    required: false,
    pattern: /^[a-zA-Z0-9][a-zA-Z0-9-_\/:.]*$/,
    min: 1,
    max: 100
  },
  'ollama.apiHost': {
    type: 'string',
    required: false,
    pattern: /^https?:\/\/.+/
  },
  'ollama.enableInlineCompletion': {
    type: 'boolean',
    required: false
  },
  'ollama.completion.maxTokens': {
    type: 'number',
    required: false,
    min: 1,
    max: 16384
  },
  'ollama.completion.temperature': {
    type: 'number',
    required: false,
    min: 0,
    max: 2
  },
  'ollama.completion.contextWindow': {
    type: 'number',
    required: false,
    min: 1,
    max: 131072
  },
  'ollama.maxMessageHistory': {
    type: 'number',
    required: false,
    min: 1,
    max: 1000
  },
  'ollama.maxMessageLength': {
    type: 'number',
    required: false,
    min: 1,
    max: 100000
  },
  'ollama.completionCacheSize': {
    type: 'number',
    required: false,
    min: 0,
    max: 1000
  },
  'ollama.memory.enableMonitoring': {
    type: 'boolean',
    required: false
  },
  'ollama.memory.monitoringInterval': {
    type: 'number',
    required: false,
    min: 1000,
    max: 3600000 // 1 hour max
  },
  'ollama.memory.warningThresholdMB': {
    type: 'number',
    required: false,
    min: 50,
    max: 10000
  },
  'ollama.memory.criticalThresholdMB': {
    type: 'number',
    required: false,
    min: 100,
    max: 20000
  }
};

/**
 * Configuration validator class
 */
export class ConfigurationValidator {
  // Validation service removed - implement validation directly
  
  private validateUrl(value: string, field: string = 'url'): ValidationResult<string> {
    const errors: ValidationError[] = [];
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push({ field, message: 'Invalid protocol', code: 'INVALID_PROTOCOL' });
      }
    } catch {
      errors.push({ field, message: 'Invalid URL format', code: 'INVALID_URL' });
    }
    return { isValid: errors.length === 0, value, errors };
  }
  
  private validateModelName(value: string, field: string = 'modelName'): ValidationResult<string> {
    const errors: ValidationError[] = [];
    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-_\/:.]*$/;
    if (!pattern.test(value)) {
      errors.push({ field, message: 'Invalid model name format', code: 'INVALID_FORMAT' });
    }
    return { isValid: errors.length === 0, value, errors };
  }
  
  /**
   * Validates a configuration value based on rules
   */
  private validateConfigValue(value: any, rules: ConfigValidationOptions, key: string): ValidationResult<any> {
    const errors: ValidationError[] = [];
    
    // Check required
    if (rules.required && (value === null || value === undefined)) {
      errors.push({ field: key, message: `${key} is required`, code: 'REQUIRED' });
      return { isValid: false, errors };
    }
    
    // Skip validation if value is not provided and not required
    if (value === null || value === undefined) {
      return { isValid: true, value, errors: [] };
    }
    
    // Type validation
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push({ field: key, message: `${key} must be of type ${rules.type}`, code: 'INVALID_TYPE' });
        return { isValid: false, errors };
      }
    }
    
    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({ field: key, message: `${key} must be one of: ${rules.enum.join(', ')}`, code: 'INVALID_ENUM' });
      return { isValid: false, errors };
    }
    
    // Pattern validation
    if (rules.pattern && typeof value === 'string' && !new RegExp(rules.pattern).test(value)) {
      errors.push({ field: key, message: `${key} does not match required pattern`, code: 'INVALID_PATTERN' });
      return { isValid: false, errors };
    }
    
    // Min/max validation
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field: key, message: `${key} must be at least ${rules.min}`, code: 'TOO_SMALL' });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field: key, message: `${key} must be at most ${rules.max}`, code: 'TOO_LARGE' });
      }
    }
    
    // String length validation
    if (typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push({ field: key, message: `${key} must be at least ${rules.minLength} characters`, code: 'TOO_SHORT' });
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push({ field: key, message: `${key} must be at most ${rules.maxLength} characters`, code: 'TOO_LONG' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      value,
      errors
    };
  }
  
  /**
   * Validates all configuration values
   */
  async validateConfiguration(): Promise<ValidationResult<ExtensionConfig>> {
    const config = vscode.workspace.getConfiguration('ollama');
    const errors: ValidationError[] = [];
    const validatedConfig: ExtensionConfig = {};
    
    // Validate each configuration value
    for (const [key, rules] of Object.entries(configurationRules)) {
      const configKey = key.replace('ollama.', '');
      const value = this.getConfigValue(config, configKey);
      
      // Validate based on rules
      const validationResult = this.validateConfigValue(value, rules, key);
      
      if (!validationResult.isValid) {
        errors.push(...validationResult.errors);
      } else if (validationResult.value !== undefined) {
        // Set the validated value
        this.setValidatedValue(validatedConfig, configKey, validationResult.value);
      }
    }
    
    // Additional cross-field validation
    if (validatedConfig.memory) {
      const memory = validatedConfig.memory;
      if (memory.warningThresholdMB && memory.criticalThresholdMB) {
        if (memory.warningThresholdMB >= memory.criticalThresholdMB) {
          errors.push({
            field: 'ollama.memory',
            message: 'Warning threshold must be less than critical threshold',
            code: 'INVALID_THRESHOLD_ORDER'
          });
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      value: errors.length === 0 ? validatedConfig : undefined,
      errors
    };
  }
  
  /**
   * Validates a specific configuration value
   */
  async validateSingleConfigValue(key: string, value: any): Promise<ValidationResult<any>> {
    const fullKey = key.startsWith('ollama.') ? key : `ollama.${key}`;
    const rules = configurationRules[fullKey];
    
    if (!rules) {
      return {
        isValid: false,
        errors: [{
          field: fullKey,
          message: 'Unknown configuration key',
          code: 'UNKNOWN_KEY'
        }]
      };
    }
    
    // Special handling for certain values
    if (fullKey === 'ollama.apiHost' && value) {
      const urlResult = this.validateUrl(value, fullKey);
      
      if (!urlResult.isValid) {
        return urlResult;
      }
    }
    
    if (fullKey === 'ollama.defaultModel' && value) {
      const modelResult = this.validateModelName(value, fullKey);
      if (!modelResult.isValid) {
        return modelResult;
      }
    }
    
    return this.validateConfigValue(value, rules, fullKey);
  }
  
  /**
   * Validates configuration on change
   */
  onConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
    const ollamaKeys = Object.keys(configurationRules);
    const changedKeys = ollamaKeys.filter(key => event.affectsConfiguration(key));
    
    if (changedKeys.length === 0) {
      return;
    }
    
    // Validate changed configurations
    const config = vscode.workspace.getConfiguration('ollama');
    
    for (const key of changedKeys) {
      const configKey = key.replace('ollama.', '');
      const value = this.getConfigValue(config, configKey);
      
      this.validateSingleConfigValue(key, value).then(result => {
        if (!result.isValid) {
          const errorMessages = result.errors.map(e => e.message).join(', ');
          vscode.window.showWarningMessage(
            `Invalid configuration for ${key}: ${errorMessages}`
          );
        }
      });
    }
  }
  
  /**
   * Gets a configuration value by dot notation key
   */
  private getConfigValue(config: vscode.WorkspaceConfiguration, key: string): any {
    const parts = key.split('.');
    let value: any = config;
    
    for (const part of parts) {
      value = value.get(part);
      if (value === undefined) {
        break;
      }
    }
    
    return value;
  }
  
  /**
   * Sets a value in the validated config object
   */
  private setValidatedValue(config: ExtensionConfig, key: string, value: any): void {
    const parts = key.split('.');
    let current: any = config;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Applies default values to configuration
   */
  async applyDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration('ollama');
    const defaults: Record<string, any> = {
      apiHost: 'http://localhost:11434',
      enableInlineCompletion: true,
      maxMessageHistory: 100,
      maxMessageLength: 10000,
      completionCacheSize: 100,
      'completion.maxTokens': 150,
      'completion.temperature': 0.7,
      'completion.contextWindow': 2048,
      'memory.enableMonitoring': false,
      'memory.monitoringInterval': 30000,
      'memory.warningThresholdMB': 200,
      'memory.criticalThresholdMB': 400
    };
    
    for (const [key, defaultValue] of Object.entries(defaults)) {
      const currentValue = this.getConfigValue(config, key);
      if (currentValue === undefined) {
        await config.update(key, defaultValue, vscode.ConfigurationTarget.Global);
      }
    }
  }
  
  /**
   * Shows configuration validation status
   */
  async showValidationStatus(): Promise<void> {
    const result = await this.validateConfiguration();
    
    if (result.isValid) {
      vscode.window.showInformationMessage('All configuration values are valid');
    } else {
      const quickPick = vscode.window.createQuickPick();
      quickPick.title = 'Configuration Validation Errors';
      quickPick.items = result.errors.map(error => ({
        label: error.field,
        description: error.message,
        detail: `Error code: ${error.code}`
      }));
      quickPick.show();
    }
  }
}

// Singleton instance
let instance: ConfigurationValidator | null = null;

/**
 * Gets the singleton instance of the configuration validator
 */
export function getConfigurationValidator(): ConfigurationValidator {
  if (!instance) {
    instance = new ConfigurationValidator();
  }
  return instance;
}
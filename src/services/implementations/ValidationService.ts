/**
 * Validation service implementation wrapper
 */

import { Disposable } from '../../utils/Disposable';
import { IValidationService, ValidationStats } from '../interfaces/IValidationService';
import {
  ValidationResult,
  FilePathValidationOptions,
  URLValidationOptions,
  MessageValidationOptions,
  ModelNameValidationOptions,
  JSONValidationOptions,
  ConfigValidationOptions
} from '../../schemas/ValidationSchemas';
import { JsonValue } from '../../types/index';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton } from '../../di/decorators';
import * as vscode from 'vscode';
import { normalizePath, isWithinWorkspace } from '../../utils/pathSecurity';
import { sanitizeUrl } from '../../utils/sanitization';

/**
 * Validation service implementation
 * This wraps the existing InputValidationService to provide the IValidationService interface
 */
@Singleton(SERVICE_IDENTIFIERS.IValidationService)
export class ValidationService extends Disposable implements IValidationService {
  private readonly validationStats: ValidationStats = {
    totalValidations: 0,
    validationsByField: {},
    recentValidations: [],
    rateLimitStats: {}
  };
  
  constructor() {
    super();
  }
  
  /**
   * Validates and sanitizes a file path
   */
  async validateFilePath(
    filePath: string,
    options?: Partial<FilePathValidationOptions>
  ): Promise<ValidationResult<string>> {
    this.updateStats('filePath', filePath);
    
    try {
      // Basic validation
      if (!filePath || typeof filePath !== 'string') {
        return {
          isValid: false,
          errors: [{ field: 'filePath', message: 'File path is required', code: 'REQUIRED' }]
        };
      }
      
      // Normalize path
      const normalized = normalizePath(filePath);
      
      // Check workspace requirement
      if (options?.requireWorkspace && !isWithinWorkspace(normalized)) {
        return {
          isValid: false,
          errors: [{ field: 'filePath', message: 'File must be within workspace', code: 'INVALID_PATH' }]
        };
      }
      
      // Check existence if required
      if (options?.mustExist) {
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(normalized));
        } catch {
          return {
            isValid: false,
            errors: [{ field: 'filePath', message: 'File does not exist', code: 'INVALID_PATH' }]
          };
        }
      }
      
      return {
        isValid: true,
        value: normalized,
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'filePath', message: `Validation error: ${error instanceof Error ? error.message : String(error)}`, code: 'INVALID_PATH' }]
      };
    }
  }
  
  /**
   * Validates and sanitizes a URL
   */
  validateUrl(
    url: string,
    options?: Partial<URLValidationOptions>
  ): ValidationResult<string> {
    this.updateStats('url', url);
    
    try {
      if (!url || typeof url !== 'string') {
        return {
          isValid: false,
          errors: [{ field: 'url', message: 'URL is required', code: 'REQUIRED' }]
        };
      }
      
      // Try to parse URL
      const parsed = new URL(url);
      
      // Check allowed protocols
      const allowedProtocols = options?.allowedProtocols || ['http:', 'https:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        return {
          isValid: false,
          errors: [{ field: 'url', message: `Protocol ${parsed.protocol} not allowed`, code: 'INVALID_URL' }]
        };
      }
      
      // Sanitize URL
      const sanitized = sanitizeUrl(url);
      
      return {
        isValid: true,
        value: sanitized,
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'url', message: 'Invalid URL format', code: 'INVALID_URL' }]
      };
    }
  }
  
  /**
   * Validates and sanitizes a chat message
   */
  validateMessage(
    message: string,
    options?: Partial<MessageValidationOptions>
  ): ValidationResult<string> {
    this.updateStats('message', message);
    
    if (!message || typeof message !== 'string') {
      return {
        isValid: false,
        errors: [{ field: 'message', message: 'Message is required', code: 'REQUIRED' }]
      };
    }
    
    const maxLength = options?.maxLength || 10000;
    if (message.length > maxLength) {
      return {
        isValid: false,
        errors: [{ field: 'message', message: `Message exceeds maximum length of ${maxLength}`, code: 'MESSAGE_TOO_LONG' }]
      };
    }
    
    // Basic sanitization - remove any script tags
    const sanitized = message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    return {
      isValid: true,
      value: sanitized,
      errors: []
    };
  }
  
  /**
   * Validates a model name
   */
  validateModelName(
    modelName: string,
    _options?: Partial<ModelNameValidationOptions>
  ): ValidationResult<string> {
    this.updateStats('modelName', modelName);
    
    if (!modelName || typeof modelName !== 'string') {
      return {
        isValid: false,
        errors: [{ field: 'modelName', message: 'Model name is required', code: 'REQUIRED' }]
      };
    }
    
    // Basic validation for model names
    const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_:]*$/;
    if (!validPattern.test(modelName)) {
      return {
        isValid: false,
        errors: [{ field: 'modelName', message: 'Invalid model name format', code: 'INVALID_FORMAT' }]
      };
    }
    
    return {
      isValid: true,
      value: modelName,
      errors: []
    };
  }
  
  /**
   * Validates JSON input
   */
  validateJson(
    json: JsonValue,
    _options?: Partial<JSONValidationOptions>
  ): ValidationResult<JsonValue> {
    this.updateStats('json', json);
    
    try {
      // If it's a string, try to parse it
      if (typeof json === 'string') {
        const parsed = JSON.parse(json);
        return {
          isValid: true,
          value: parsed,
          errors: []
        };
      }
      
      // Otherwise, just validate it's a valid JSON value
      JSON.stringify(json);
      
      return {
        isValid: true,
        value: json,
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'json', message: 'Invalid JSON format', code: 'INVALID_JSON' }]
      };
    }
  }
  
  /**
   * Validates configuration values
   */
  validateConfiguration(
    value: JsonValue,
    options: ConfigValidationOptions & { key?: string }
  ): ValidationResult<JsonValue> {
    this.updateStats('configuration', value);
    
    // Basic configuration validation
    if (options.required && (value === null || value === undefined)) {
      return {
        isValid: false,
        errors: [{ field: options.key || 'configuration', message: 'Configuration value is required', code: 'REQUIRED' }]
      };
    }
    
    // Type validation
    if (options.type && value !== null && value !== undefined) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== options.type) {
        return {
          isValid: false,
          errors: [{ field: options.key || 'configuration', message: `Expected ${options.type}, got ${actualType}`, code: 'INVALID_TYPE' }]
        };
      }
    }
    
    return {
      isValid: true,
      value: value,
      errors: []
    };
  }
  
  /**
   * Batch validates multiple inputs
   */
  async validateBatch(validations: Array<{
    type: 'filePath' | 'url' | 'message' | 'modelName' | 'json' | 'configuration';
    value: unknown;
    options?: Record<string, unknown>;
  }>): Promise<ValidationResult<unknown>[]> {
    const results: ValidationResult<unknown>[] = [];
    
    for (const validation of validations) {
      switch (validation.type) {
        case 'filePath':
          results.push(await this.validateFilePath(
            validation.value as string,
            validation.options as FilePathValidationOptions
          ));
          break;
        case 'url':
          results.push(this.validateUrl(
            validation.value as string,
            validation.options as URLValidationOptions
          ));
          break;
        case 'message':
          results.push(this.validateMessage(
            validation.value as string,
            validation.options as MessageValidationOptions
          ));
          break;
        case 'modelName':
          results.push(this.validateModelName(
            validation.value as string,
            validation.options as ModelNameValidationOptions
          ));
          break;
        case 'json':
          results.push(this.validateJson(
            validation.value as JsonValue,
            validation.options as JSONValidationOptions
          ));
          break;
        case 'configuration':
          results.push(this.validateConfiguration(
            validation.value as JsonValue,
            validation.options as ConfigValidationOptions
          ));
          break;
      }
    }
    
    return results;
  }
  
  /**
   * Gets validation statistics
   */
  /**
   * Update validation statistics
   */
  private updateStats(field: string, value?: unknown): void {
    this.validationStats.totalValidations++;
    this.validationStats.validationsByField[field] = 
      (this.validationStats.validationsByField[field] || 0) + 1;
    
    // Keep recent validations to last 100
    this.validationStats.recentValidations.push({
      field,
      value: value || null,
      timestamp: new Date()
    });
    
    if (this.validationStats.recentValidations.length > 100) {
      this.validationStats.recentValidations.shift();
    }
  }
  
  getValidationStats(): ValidationStats {
    return { ...this.validationStats };
  }
  
  /**
   * Clears validation log
   */
  clearValidationLog(): void {
    this.validationStats.recentValidations = [];
    this.validationStats.totalValidations = 0;
    this.validationStats.validationsByField = {};
  }
  
  /**
   * Resets rate limits
   */
  resetRateLimits(): void {
    this.validationStats.rateLimitStats = {};
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Clear stats
    this.clearValidationLog();
  }
}
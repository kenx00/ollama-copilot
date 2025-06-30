/**
 * Interface for validation service
 */

import * as vscode from 'vscode';
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

/**
 * Validation statistics
 */
export interface ValidationStats {
  totalValidations: number;
  validationsByField: Record<string, number>;
  recentValidations: Array<{
    field: string;
    value: unknown;
    timestamp: Date;
  }>;
  rateLimitStats: Record<string, {
    requests: number;
    limit: number;
    resetTime: Date;
  }>;
}

/**
 * Validation service interface
 */
export interface IValidationService extends vscode.Disposable {
  /**
   * Validates and sanitizes a file path
   */
  validateFilePath(
    filePath: string,
    options?: Partial<FilePathValidationOptions>
  ): Promise<ValidationResult<string>>;
  
  /**
   * Validates and sanitizes a URL
   */
  validateUrl(
    url: string,
    options?: Partial<URLValidationOptions>
  ): ValidationResult<string>;
  
  /**
   * Validates and sanitizes a chat message
   */
  validateMessage(
    message: string,
    options?: Partial<MessageValidationOptions>
  ): ValidationResult<string>;
  
  /**
   * Validates a model name
   */
  validateModelName(
    modelName: string,
    options?: Partial<ModelNameValidationOptions>
  ): ValidationResult<string>;
  
  /**
   * Validates JSON input
   */
  validateJson(
    json: JsonValue,
    options?: Partial<JSONValidationOptions>
  ): ValidationResult<JsonValue>;
  
  /**
   * Validates configuration values
   */
  validateConfiguration(
    value: JsonValue,
    options: ConfigValidationOptions
  ): ValidationResult<JsonValue>;
  
  /**
   * Batch validates multiple inputs
   */
  validateBatch(validations: Array<{
    type: 'filePath' | 'url' | 'message' | 'modelName' | 'json' | 'configuration';
    value: unknown;
    options?: Record<string, unknown>;
  }>): Promise<ValidationResult<unknown>[]>;
  
  /**
   * Gets validation statistics
   */
  getValidationStats(): ValidationStats;
  
  /**
   * Clears validation log
   */
  clearValidationLog(): void;
  
  /**
   * Resets rate limits
   */
  resetRateLimits(): void;
}
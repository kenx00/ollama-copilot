/**
 * Input validation schemas for the VS Code extension
 * Defines validation rules for all user inputs
 */

import { isString } from '../types/guards';

/**
 * Validation result interface
 */
export interface ValidationResult<T = any> {
  isValid: boolean;
  value?: T;
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * File path validation options
 */
export interface FilePathValidationOptions {
  allowedExtensions?: string[];
  maxPathLength?: number;
  allowHidden?: boolean;
  allowSymlinks?: boolean;
  mustExist?: boolean;
  requireWorkspace?: boolean;
}

/**
 * URL validation options
 */
export interface URLValidationOptions {
  allowedProtocols?: string[];
  allowedHosts?: string[];
  allowedPorts?: number[];
  requireHttps?: boolean;
  maxLength?: number;
}

/**
 * Message validation options
 */
export interface MessageValidationOptions {
  maxLength?: number;
  minLength?: number;
  allowHtml?: boolean;
  allowMarkdown?: boolean;
  blockPatterns?: RegExp[];
  encoding?: BufferEncoding;
}

/**
 * Model name validation options
 */
export interface ModelNameValidationOptions {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  allowedVendors?: string[];
}

/**
 * JSON validation options
 */
export interface JSONValidationOptions {
  maxDepth?: number;
  maxSize?: number;
  schema?: object;
  allowCircular?: boolean;
}

/**
 * Configuration validation options
 */
export interface ConfigValidationOptions {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  key?: string;
}

/**
 * Default validation schemas
 */
export const ValidationSchemas = {
  /**
   * File path schema
   */
  filePath: {
    defaultOptions: {
      allowedExtensions: [
        '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt',
        '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.cs',
        '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
        '.html', '.css', '.scss', '.sass', '.less',
        '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
      ],
      maxPathLength: 260, // Windows MAX_PATH
      allowHidden: false,
      allowSymlinks: false,
      mustExist: true,
      requireWorkspace: true
    } as FilePathValidationOptions,
    
    validate(value: any, options?: Partial<FilePathValidationOptions>): ValidationResult<string> {
      const opts = { ...this.defaultOptions, ...options };
      const errors: ValidationError[] = [];
      
      if (typeof value !== 'string') {
        errors.push({
          field: 'filePath',
          message: 'File path must be a string',
          code: 'INVALID_TYPE'
        });
        return { isValid: false, errors };
      }
      
      if (value.length > opts.maxPathLength!) {
        errors.push({
          field: 'filePath',
          message: `File path exceeds maximum length of ${opts.maxPathLength}`,
          code: 'PATH_TOO_LONG'
        });
      }
      
      return { isValid: errors.length === 0, value, errors };
    }
  },
  
  /**
   * URL schema
   */
  url: {
    defaultOptions: {
      allowedProtocols: ['http:', 'https:'],
      allowedHosts: [], // Empty = all hosts allowed
      allowedPorts: [], // Empty = all ports allowed
      requireHttps: false,
      maxLength: 2048
    } as URLValidationOptions,
    
    validate(value: any, options?: Partial<URLValidationOptions>): ValidationResult<string> {
      const opts = { ...this.defaultOptions, ...options };
      const errors: ValidationError[] = [];
      
      if (typeof value !== 'string') {
        errors.push({
          field: 'url',
          message: 'URL must be a string',
          code: 'INVALID_TYPE'
        });
        return { isValid: false, errors };
      }
      
      if (value.length > opts.maxLength!) {
        errors.push({
          field: 'url',
          message: `URL exceeds maximum length of ${opts.maxLength}`,
          code: 'URL_TOO_LONG'
        });
      }
      
      try {
        const url = new URL(value);
        
        if (!opts.allowedProtocols!.includes(url.protocol)) {
          errors.push({
            field: 'url',
            message: `Protocol '${url.protocol}' is not allowed`,
            code: 'INVALID_PROTOCOL'
          });
        }
        
        if (opts.requireHttps && url.protocol !== 'https:') {
          errors.push({
            field: 'url',
            message: 'HTTPS is required',
            code: 'HTTPS_REQUIRED'
          });
        }
        
        if (opts.allowedHosts!.length > 0 && !opts.allowedHosts!.includes(url.hostname)) {
          errors.push({
            field: 'url',
            message: `Host '${url.hostname}' is not allowed`,
            code: 'INVALID_HOST'
          });
        }
        
        const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
        if (opts.allowedPorts!.length > 0 && !opts.allowedPorts!.includes(port)) {
          errors.push({
            field: 'url',
            message: `Port '${port}' is not allowed`,
            code: 'INVALID_PORT'
          });
        }
        
      } catch (error) {
        errors.push({
          field: 'url',
          message: 'Invalid URL format',
          code: 'INVALID_URL'
        });
      }
      
      return { isValid: errors.length === 0, value, errors };
    }
  },
  
  /**
   * Message schema
   */
  message: {
    defaultOptions: {
      maxLength: 10000,
      minLength: 1,
      allowHtml: false,
      allowMarkdown: true,
      blockPatterns: [
        /<script[^>]*>[\s\S]*?<\/script>/gi,
        /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi // Event handlers
      ],
      encoding: 'utf8'
    } as MessageValidationOptions,
    
    validate(value: any, options?: Partial<MessageValidationOptions>): ValidationResult<string> {
      const opts = { ...this.defaultOptions, ...options };
      const errors: ValidationError[] = [];
      
      if (typeof value !== 'string') {
        errors.push({
          field: 'message',
          message: 'Message must be a string',
          code: 'INVALID_TYPE'
        });
        return { isValid: false, errors };
      }
      
      if (value.length > opts.maxLength!) {
        errors.push({
          field: 'message',
          message: `Message exceeds maximum length of ${opts.maxLength}`,
          code: 'MESSAGE_TOO_LONG'
        });
      }
      
      if (value.length < opts.minLength!) {
        errors.push({
          field: 'message',
          message: `Message must be at least ${opts.minLength} characters`,
          code: 'MESSAGE_TOO_SHORT'
        });
      }
      
      // Check for blocked patterns
      for (const pattern of opts.blockPatterns!) {
        if (pattern.test(value)) {
          errors.push({
            field: 'message',
            message: 'Message contains prohibited content',
            code: 'BLOCKED_CONTENT'
          });
          break;
        }
      }
      
      // Validate encoding
      try {
        Buffer.from(value, opts.encoding);
      } catch (error) {
        errors.push({
          field: 'message',
          message: 'Invalid character encoding',
          code: 'INVALID_ENCODING'
        });
      }
      
      return { isValid: errors.length === 0, value, errors };
    }
  },
  
  /**
   * Model name schema
   */
  modelName: {
    defaultOptions: {
      maxLength: 100,
      minLength: 1,
      pattern: /^[a-zA-Z0-9][a-zA-Z0-9-_\/:.]*$/,
      allowedVendors: [] // Empty = all vendors allowed
    } as ModelNameValidationOptions,
    
    validate(value: any, options?: Partial<ModelNameValidationOptions>): ValidationResult<string> {
      const opts = { ...this.defaultOptions, ...options };
      const errors: ValidationError[] = [];
      
      if (typeof value !== 'string') {
        errors.push({
          field: 'modelName',
          message: 'Model name must be a string',
          code: 'INVALID_TYPE'
        });
        return { isValid: false, errors };
      }
      
      if (value.length > opts.maxLength!) {
        errors.push({
          field: 'modelName',
          message: `Model name exceeds maximum length of ${opts.maxLength}`,
          code: 'NAME_TOO_LONG'
        });
      }
      
      if (value.length < opts.minLength!) {
        errors.push({
          field: 'modelName',
          message: `Model name must be at least ${opts.minLength} characters`,
          code: 'NAME_TOO_SHORT'
        });
      }
      
      if (!opts.pattern!.test(value)) {
        errors.push({
          field: 'modelName',
          message: 'Model name contains invalid characters',
          code: 'INVALID_FORMAT'
        });
      }
      
      // Check vendor if specified
      if (opts.allowedVendors!.length > 0) {
        const vendor = value.split('/')[0];
        if (!opts.allowedVendors!.includes(vendor)) {
          errors.push({
            field: 'modelName',
            message: `Vendor '${vendor}' is not allowed`,
            code: 'INVALID_VENDOR'
          });
        }
      }
      
      return { isValid: errors.length === 0, value, errors };
    }
  },
  
  /**
   * JSON schema
   */
  json: {
    defaultOptions: {
      maxDepth: 10,
      maxSize: 1024 * 1024, // 1MB
      schema: undefined,
      allowCircular: false
    } as JSONValidationOptions,
    
    validate(value: any, options?: Partial<JSONValidationOptions>): ValidationResult<any> {
      const opts = { ...this.defaultOptions, ...options };
      const errors: ValidationError[] = [];
      
      // Check size if string
      if (isString(value)) {
        if (value.length > opts.maxSize!) {
          errors.push({
            field: 'json',
            message: `JSON string exceeds maximum size of ${opts.maxSize} bytes`,
            code: 'JSON_TOO_LARGE'
          });
          return { isValid: false, errors };
        }
        
        try {
          value = JSON.parse(value);
        } catch (error) {
          errors.push({
            field: 'json',
            message: 'Invalid JSON format',
            code: 'INVALID_JSON'
          });
          return { isValid: false, errors };
        }
      }
      
      // Check depth
      const depth = getObjectDepth(value);
      if (depth > opts.maxDepth!) {
        errors.push({
          field: 'json',
          message: `JSON depth ${depth} exceeds maximum of ${opts.maxDepth}`,
          code: 'JSON_TOO_DEEP'
        });
      }
      
      // Check for circular references
      if (!opts.allowCircular) {
        try {
          JSON.stringify(value);
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('circular')) {
            errors.push({
              field: 'json',
              message: 'JSON contains circular references',
              code: 'CIRCULAR_REFERENCE'
            });
          }
        }
      }
      
      return { isValid: errors.length === 0, value, errors };
    }
  },
  
  /**
   * Configuration value schema
   */
  configuration: {
    validate(value: any, options: ConfigValidationOptions): ValidationResult<any> {
      const errors: ValidationError[] = [];
      
      // Check required
      if (options.required && (value === null || value === undefined)) {
        errors.push({
          field: 'config',
          message: 'Configuration value is required',
          code: 'REQUIRED'
        });
        return { isValid: false, errors };
      }
      
      // Skip further validation if null/undefined and not required
      if (value === null || value === undefined) {
        return { isValid: true, value, errors };
      }
      
      // Type validation
      if (options.type && typeof value !== options.type) {
        errors.push({
          field: 'config',
          message: `Expected type '${options.type}' but got '${typeof value}'`,
          code: 'INVALID_TYPE'
        });
      }
      
      // Number range validation
      if (typeof value === 'number') {
        if (options.min !== undefined && value < options.min) {
          errors.push({
            field: 'config',
            message: `Value must be at least ${options.min}`,
            code: 'TOO_SMALL'
          });
        }
        if (options.max !== undefined && value > options.max) {
          errors.push({
            field: 'config',
            message: `Value must be at most ${options.max}`,
            code: 'TOO_LARGE'
          });
        }
      }
      
      // String pattern validation
      if (isString(value) && options.pattern && !options.pattern.test(value)) {
        errors.push({
          field: 'config',
          message: 'Value does not match required pattern',
          code: 'INVALID_PATTERN'
        });
      }
      
      // Enum validation
      if (options.enum && !options.enum.includes(value)) {
        errors.push({
          field: 'config',
          message: `Value must be one of: ${options.enum.join(', ')}`,
          code: 'INVALID_ENUM'
        });
      }
      
      return { isValid: errors.length === 0, value, errors };
    }
  }
};

/**
 * Helper function to calculate object depth
 */
function getObjectDepth(obj: any): number {
  if (obj === null || typeof obj !== 'object') {
    return 0;
  }
  
  const values = Object.values(obj);
  if (values.length === 0) {
    return 1;
  }
  
  return 1 + Math.max(...values.map(v => getObjectDepth(v)));
}
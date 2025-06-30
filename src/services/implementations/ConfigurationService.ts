/**
 * Configuration service implementation
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import {
  IConfigurationService,
  ConfigValue,
  ConfigSection,
  ConfigChangeEvent,
  ConfigValidationResult
} from '../interfaces/IConfigurationService';
import { JsonObject, JsonValue } from '../../types/index';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton } from '../../di/decorators';

/**
 * Configuration service implementation
 */
@Singleton(SERVICE_IDENTIFIERS.IConfigurationService)
export class ConfigurationService extends Disposable implements IConfigurationService {
  private readonly configurationRoot = 'ollama';
  private readonly changeEmitter = new vscode.EventEmitter<ConfigChangeEvent>();
  private readonly configurationCache = new Map<string, JsonValue>();
  
  constructor() {
    super();
    
    // Track the event emitter for disposal
    this.track(this.changeEmitter);
    
    // Listen to VS Code configuration changes
    this.track(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(this.configurationRoot)) {
          this.changeEmitter.fire({
            affectsConfiguration: (section: string, scope?: vscode.ConfigurationScope) => 
              event.affectsConfiguration(`${this.configurationRoot}.${section}`, scope)
          });
        }
      })
    );
  }
  
  /**
   * Get configuration value
   */
  get<T>(section: string, defaultValue?: T): T {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    return config.get<T>(section, defaultValue as T);
  }
  
  /**
   * Get configuration section
   */
  getSection(section: string): ConfigSection {
    const config = vscode.workspace.getConfiguration(`${this.configurationRoot}.${section}`);
    const result: ConfigSection = {};
    
    // Get all properties of the section
    for (const key of Object.keys(config)) {
      if (key !== 'get' && key !== 'has' && key !== 'inspect' && key !== 'update') {
        result[key] = config[key];
      }
    }
    
    return result;
  }
  
  /**
   * Update configuration value
   */
  async update(section: string, value: ConfigValue, target?: vscode.ConfigurationTarget): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    await config.update(section, value, target || vscode.ConfigurationTarget.Global);
  }
  
  /**
   * Has configuration value
   */
  has(section: string): boolean {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    return config.has(section);
  }
  
  /**
   * Inspect configuration value
   */
  inspect<T>(section: string): {
    key: string;
    defaultValue?: T;
    globalValue?: T;
    workspaceValue?: T;
    workspaceFolderValue?: T;
  } | undefined {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    return config.inspect<T>(section);
  }
  
  /**
   * Validate configuration
   */
  async validate(): Promise<ConfigValidationResult> {
    const errors: Array<{ section: string; key: string; message: string }> = [];
    
    // Validate API host
    const apiHost = this.get<string>('apiHost');
    if (apiHost) {
      try {
        new URL(apiHost);
      } catch {
        errors.push({
          section: 'ollama',
          key: 'apiHost',
          message: 'Invalid URL format'
        });
      }
    }
    
    // Validate default model
    const defaultModel = this.get<string>('defaultModel');
    if (defaultModel && !defaultModel.trim()) {
      errors.push({
        section: 'ollama',
        key: 'defaultModel',
        message: 'Model name cannot be empty'
      });
    }
    
    // Validate numeric values
    const completionDelay = this.get<number>('completionDelay');
    if (completionDelay !== undefined && (completionDelay < 0 || completionDelay > 5000)) {
      errors.push({
        section: 'ollama',
        key: 'completionDelay',
        message: 'Completion delay must be between 0 and 5000ms'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Reset configuration to defaults
   */
  async reset(section: string, target?: vscode.ConfigurationTarget): Promise<void> {
    await this.update(section, undefined, target);
  }
  
  /**
   * Subscribe to configuration changes
   */
  onDidChangeConfiguration(callback: (event: ConfigChangeEvent) => void): vscode.Disposable {
    return this.changeEmitter.event(callback);
  }
  
  /**
   * Get all configuration keys
   */
  getAllKeys(): string[] {
    
    // Get configuration schema to find all keys
    const schema = this.getSchema();
    const keys: string[] = [];
    
    function extractKeys(obj: Record<string, JsonValue>, prefix: string = '') {
      if (obj.properties && typeof obj.properties === 'object' && obj.properties !== null) {
        const properties = obj.properties as JsonObject;
        for (const key of Object.keys(properties)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          keys.push(fullKey);
          
          // Recursively extract nested keys
          const propertyValue = properties[key];
          if (typeof propertyValue === 'object' && propertyValue !== null && 
              'properties' in propertyValue) {
            extractKeys(propertyValue as Record<string, JsonValue>, fullKey);
          }
        }
      }
    }
    
    extractKeys(schema as Record<string, JsonValue>);
    return keys;
  }
  
  /**
   * Export configuration
   */
  export(): ConfigSection {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    const result: ConfigSection = {};
    
    // Export all configuration values
    const keys = this.getAllKeys();
    for (const key of keys) {
      if (config.has(key)) {
        result[key] = config.get(key);
      }
    }
    
    return result;
  }
  
  /**
   * Import configuration
   */
  async import(config: ConfigSection, target?: vscode.ConfigurationTarget): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.update(key, value, target);
    }
  }
  
  /**
   * Get configuration schema
   */
  getSchema(): object {
    // Return a simplified schema
    return {
      properties: {
        apiHost: {
          type: 'string',
          default: 'http://localhost:11434',
          description: 'Ollama API host URL'
        },
        defaultModel: {
          type: 'string',
          description: 'Default model to use for completions and chat'
        },
        completionDelay: {
          type: 'number',
          default: 200,
          minimum: 0,
          maximum: 5000,
          description: 'Delay before triggering completions (ms)'
        },
        enableStreaming: {
          type: 'boolean',
          default: true,
          description: 'Enable streaming responses'
        },
        maxCompletionTokens: {
          type: 'number',
          default: 150,
          minimum: 10,
          maximum: 2000,
          description: 'Maximum tokens for completions'
        },
        temperature: {
          type: 'number',
          default: 0.7,
          minimum: 0,
          maximum: 2,
          description: 'Model temperature'
        }
      }
    };
  }
  
  /**
   * Reload configuration
   */
  async reload(): Promise<void> {
    // Force VS Code to reload configuration
    // This is mainly useful for testing
    const event: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section.startsWith(this.configurationRoot)
    };
    
    this.changeEmitter.fire({
      affectsConfiguration: event.affectsConfiguration
    });
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Dispose event emitter
    this.changeEmitter.dispose();
    
    // Clear cache
    this.configurationCache.clear();
  }
}
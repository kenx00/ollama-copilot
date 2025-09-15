/**
 * Configuration service implementation
 */

import * as vscode from "vscode";
import { Disposable } from "../../utils/Disposable";
import {
  IConfigurationService,
  ConfigValue,
  ConfigSection,
  ConfigChangeEvent,
  ConfigValidationResult,
} from "../interfaces/IConfigurationService";
import { SERVICE_IDENTIFIERS } from "../../di";
import { Singleton } from "../../di/decorators";
import {
  configurationRules,
  getConfigurationValidator,
} from "../../validators/ConfigurationValidator";

/**
 * Configuration service implementation
 */
@Singleton(SERVICE_IDENTIFIERS.IConfigurationService)
export class ConfigurationService
  extends Disposable
  implements IConfigurationService
{
  private readonly configurationRoot = "ollama";
  private readonly changeEmitter = new vscode.EventEmitter<ConfigChangeEvent>();

  constructor() {
    super();

    // Track the event emitter for disposal
    this.track(this.changeEmitter);

    // Listen to VS Code configuration changes
    this.track(
      vscode.workspace.onDidChangeConfiguration((event) => {
        const relevantKeys = this.getAllKeys().map((key) =>
          this.normalizeSection(key)
        );
        const anyKeyAffected = relevantKeys.some((key) =>
          event.affectsConfiguration(key)
        );

        if (
          event.affectsConfiguration(this.configurationRoot) ||
          anyKeyAffected
        ) {
          this.changeEmitter.fire({
            affectsConfiguration: (
              section: string,
              scope?: vscode.ConfigurationScope
            ) => {
              return event.affectsConfiguration(
                this.normalizeSection(section),
                scope
              );
            },
          });
        }
      })
    );
  }

  /**
   * Normalize a configuration section to the full key path
   */
  private normalizeSection(section: string): string {
    if (!section || section === this.configurationRoot) {
      return this.configurationRoot;
    }

    if (section.startsWith(`${this.configurationRoot}.`)) {
      return section;
    }

    return `${this.configurationRoot}.${section}`;
  }

  /**
   * Strip the configuration root from a key
   */
  private stripRoot(section: string): string {
    if (!section) {
      return section;
    }

    if (section.startsWith(`${this.configurationRoot}.`)) {
      return section.substring(this.configurationRoot.length + 1);
    }

    return section;
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
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    const result: ConfigSection = {};
    const prefix = section ? `${section}.` : "";

    for (const key of this.getAllKeys()) {
      if (!section || key === section || key.startsWith(prefix)) {
        const value = config.get(key);
        if (value !== undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Update configuration value
   */
  async update(
    section: string,
    value: ConfigValue,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    await config.update(
      section,
      value,
      target || vscode.ConfigurationTarget.Global
    );
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
  inspect<T>(section: string):
    | {
        key: string;
        defaultValue?: T;
        globalValue?: T;
        workspaceValue?: T;
        workspaceFolderValue?: T;
      }
    | undefined {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    return config.inspect<T>(section);
  }

  /**
   * Validate configuration
   */
  async validate(): Promise<ConfigValidationResult> {
    const validator = getConfigurationValidator();
    const result = await validator.validateConfiguration();

    return {
      isValid: result.isValid,
      errors: result.errors.map((error) => {
        const relativeKey = this.stripRoot(error.field);
        return {
          section: this.configurationRoot,
          key: relativeKey,
          message: error.message,
        };
      }),
    };
  }

  /**
   * Reset configuration to defaults
   */
  async reset(
    section: string,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    await this.update(section, undefined, target);
  }

  /**
   * Subscribe to configuration changes
   */
  onDidChangeConfiguration(
    callback: (event: ConfigChangeEvent) => void
  ): vscode.Disposable {
    return this.changeEmitter.event(callback);
  }

  /**
   * Get all configuration keys
   */
  getAllKeys(): string[] {
    const keys = new Set<string>();
    const prefix = `${this.configurationRoot}.`;

    for (const fullKey of Object.keys(configurationRules)) {
      if (fullKey.startsWith(prefix)) {
        keys.add(fullKey.substring(prefix.length));
      }
    }

    return Array.from(keys).sort();
  }

  /**
   * Export configuration
   */
  export(): ConfigSection {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    const result: ConfigSection = {};

    for (const key of this.getAllKeys()) {
      const value = config.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Import configuration
   */
  async import(
    config: ConfigSection,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.update(key, value, target);
    }
  }

  /**
   * Get configuration schema
   */
  getSchema(): object {
    const config = vscode.workspace.getConfiguration(this.configurationRoot);
    const properties: Record<string, Record<string, unknown>> = {};

    for (const [fullKey, rule] of Object.entries(configurationRules)) {
      if (!fullKey.startsWith(`${this.configurationRoot}.`)) {
        continue;
      }

      const relativeKey = this.stripRoot(fullKey);
      const inspect = config.inspect(relativeKey);
      const schemaEntry: Record<string, unknown> = {};

      if (rule.type) {
        schemaEntry.type = rule.type;
      }

      const defaultValue = inspect?.defaultValue ?? inspect?.globalValue;
      if (defaultValue !== undefined) {
        schemaEntry.default = defaultValue;
      }

      if (rule.min !== undefined) {
        schemaEntry.minimum = rule.min;
      }

      if (rule.max !== undefined) {
        schemaEntry.maximum = rule.max;
      }

      if (rule.minLength !== undefined) {
        schemaEntry.minLength = rule.minLength;
      }

      if (rule.maxLength !== undefined) {
        schemaEntry.maxLength = rule.maxLength;
      }

      if (rule.enum) {
        schemaEntry.enum = rule.enum;
      }

      if (rule.pattern) {
        schemaEntry.pattern = rule.pattern.source;
      }

      schemaEntry.required = rule.required ?? false;

      properties[relativeKey] = schemaEntry;
    }

    return { properties };
  }

  /**
   * Reload configuration
   */
  async reload(): Promise<void> {
    const event: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string, _scope?: vscode.ConfigurationScope) =>
        this.normalizeSection(section).startsWith(this.configurationRoot),
    };

    this.changeEmitter.fire({
      affectsConfiguration: (section: string, scope?: vscode.ConfigurationScope) =>
        event.affectsConfiguration(this.normalizeSection(section), scope),
    });
  }

  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    this.changeEmitter.dispose();
  }
}

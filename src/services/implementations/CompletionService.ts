/**
 * Code completion service implementation
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import {
  ICompletionService,
  CompletionContext,
  CompletionOptions,
  CompletionResult,
  CompletionStats
} from '../interfaces/ICompletionService';
import { IOllamaApiService } from '../interfaces/IOllamaApiService';
import { IModelService } from '../interfaces/IModelService';
import { ICacheService } from '../interfaces/ICacheService';
import { IConfigurationService } from '../interfaces/IConfigurationService';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton, Inject } from '../../di/decorators';
import { generatePromptFromContext } from '../../inlineCompletionProvider/promptGenerators';
import { cleanCompletion } from '../../inlineCompletionProvider/responseCleaners';

/**
 * Completion service implementation
 */
@Singleton(SERVICE_IDENTIFIERS.ICompletionService)
export class CompletionService extends Disposable implements ICompletionService {
  private enabled: boolean = true;
  private defaultModel: string = '';
  private defaultOptions: CompletionOptions = {
    maxTokens: 150,
    temperature: 0.7,
    stopSequences: ['\n\n', '\r\n\r\n', '```', '\n```', '```\n'],
    contextWindow: 2048
  };
  
  private stats: CompletionStats = {
    totalCompletions: 0,
    cachedCompletions: 0,
    cacheMisses: 0,
    averageLatency: 0,
    errorCount: 0
  };
  
  private latencies: number[] = [];
  private readonly maxLatencyHistory = 100;
  private readonly completionEmitter = new vscode.EventEmitter<CompletionResult>();
  
  constructor(
    @Inject(SERVICE_IDENTIFIERS.IOllamaApiService) 
    private readonly apiService: IOllamaApiService,
    @Inject(SERVICE_IDENTIFIERS.IModelService) 
    private readonly modelService: IModelService,
    @Inject(SERVICE_IDENTIFIERS.ICacheService) 
    private readonly cacheService: ICacheService,
    @Inject(SERVICE_IDENTIFIERS.IConfigurationService) 
    private readonly configService: IConfigurationService
  ) {
    super();
    
    // Track the event emitter
    this.track(this.completionEmitter);
    
    // Initialize from configuration
    this.loadConfiguration();
    
    // Listen for configuration changes
    this.track(
      this.configService.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('completion') || 
            event.affectsConfiguration('enableInlineCompletion')) {
          this.loadConfiguration();
        }
      })
    );
    
    // Listen for model changes
    this.track(
      this.modelService.onModelSelectionChange((event) => {
        if (event.source === 'user' || event.source === 'config') {
          this.defaultModel = event.currentModel;
        }
      })
    );
  }
  
  /**
   * Get code completion
   */
  async getCompletion(
    context: CompletionContext, 
    options?: CompletionOptions
  ): Promise<CompletionResult | null> {
    if (!this.enabled) {
      console.log('[CompletionService] Completions are disabled');
      return null;
    }
    
    const startTime = Date.now();
    
    try {
      // Merge options with defaults
      const opts = { ...this.defaultOptions, ...options };
      const model = opts.model || this.defaultModel || this.modelService.getSelectedModel();
      
      if (!model) {
        console.error('[CompletionService] No model selected');
        throw new Error('No model selected for completion');
      }
      
      console.log(`[CompletionService] Using model: ${model}`);
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(context, model, opts);
      
      // Check cache
      const cached = this.cacheService.get<CompletionResult>(cacheKey);
      if (cached) {
        this.stats.cachedCompletions++;
        this.stats.totalCompletions++;
        cached.cached = true;
        return cached;
      } else {
        this.stats.cacheMisses++;
      }
      
      // Extract current line from context
      const currentLine = context.document.lineAt(context.position.line).text;
      
      // Generate prompt
      const prompt = generatePromptFromContext({
        prefix: context.prefix,
        suffix: context.suffix,
        currentLine: currentLine,
        language: context.language
      });
      
      // Get completion from API
      console.log('[CompletionService] Calling API with prompt length:', prompt.length);
      const response = await this.apiService.generate({
        model,
        prompt,
        options: {
          temperature: opts.temperature,
          num_predict: opts.maxTokens,
          stop: opts.stopSequences
        }
      });
      console.log('[CompletionService] Got response length:', response.length);
      
      // Clean and process response
      const cleaned = cleanCompletion(response);
      
      // Check if response contained markdown
      if (response.includes('```')) {
        console.warn('[CompletionService] Response contained markdown code fences, cleaned from:', response.substring(0, 100));
      }
      
      if (!cleaned) {
        console.log('[CompletionService] No valid completion after cleaning');
        return null;
      }
      
      // Final validation - ensure no markdown remains
      if (cleaned.includes('```')) {
        console.error('[CompletionService] Cleaned response still contains markdown:', cleaned);
        // Try to extract just the first line of actual code
        const lines = cleaned.split('\n').filter(line => line.trim() && !line.includes('```'));
        if (lines.length > 0) {
          return {
            text: lines[0],
            confidence: 0.5,
            cached: false
          };
        }
        return null;
      }
      
      // Create result
      const result: CompletionResult = {
        text: cleaned,
        confidence: 0.8, // TODO: Calculate actual confidence
        cached: false
      };
      
      // Cache the result
      this.cacheService.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes
      
      // Update stats
      this.stats.totalCompletions++;
      this.recordLatency(Date.now() - startTime);
      
      // Emit completion event
      this.completionEmitter.fire(result);
      
      return result;
      
    } catch (error) {
      this.stats.errorCount++;
      console.error('Completion error:', error);
      return null;
    }
  }
  
  /**
   * Get multiple completions
   */
  async getCompletions(
    context: CompletionContext, 
    count: number, 
    options?: CompletionOptions
  ): Promise<CompletionResult[]> {
    const results: CompletionResult[] = [];
    
    // Get multiple completions with different temperatures
    for (let i = 0; i < count; i++) {
      const temperature = (options?.temperature || 0.7) + (i * 0.1);
      const result = await this.getCompletion(context, {
        ...options,
        temperature: Math.min(temperature, 1.5)
      });
      
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * Cancel ongoing completion requests
   */
  cancelCompletions(): void {
    this.apiService.cancelRequests();
  }
  
  /**
   * Clear completion cache
   */
  clearCache(): void {
    // Clear all completion cache entries
    const keys = this.cacheService.keys();
    keys.forEach(key => {
      if (key.startsWith('completion:')) {
        this.cacheService.delete(key);
      }
    });
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number; entries: number } {
    const cacheStats = this.cacheService.getStats();
    const completionKeys = this.cacheService.keys().filter(k => k.startsWith('completion:'));
    
    return {
      size: cacheStats.memoryUsage,
      hitRate: this.stats.totalCompletions > 0 
        ? this.stats.cachedCompletions / this.stats.totalCompletions 
        : 0,
      entries: completionKeys.length
    };
  }
  
  /**
   * Set default model
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }
  
  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.defaultModel || this.modelService.getSelectedModel();
  }
  
  /**
   * Check if completions are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Enable/disable completions
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancelCompletions();
    }
  }
  
  /**
   * Get completion statistics
   */
  getStats(): CompletionStats {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCompletions: 0,
      cachedCompletions: 0,
      cacheMisses: 0,
      averageLatency: 0,
      errorCount: 0
    };
    this.latencies = [];
  }
  
  /**
   * Subscribe to completion events
   */
  onCompletion(callback: (result: CompletionResult) => void): vscode.Disposable {
    return this.completionEmitter.event(callback);
  }
  
  /**
   * Configure completion behavior
   */
  configure(options: CompletionOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
  
  /**
   * Generate cache key
   */
  private generateCacheKey(
    context: CompletionContext, 
    model: string, 
    options: CompletionOptions
  ): string {
    const key = `completion:${model}:${context.language}:${options.temperature}`;
    const content = `${context.prefix}<<<CURSOR>>>${context.suffix}`;
    
    // Create a simple hash of the content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `${key}:${hash}`;
  }
  
  /**
   * Record latency
   */
  private recordLatency(latency: number): void {
    this.latencies.push(latency);
    
    // Keep history bounded
    if (this.latencies.length > this.maxLatencyHistory) {
      this.latencies.shift();
    }
    
    // Update average
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.stats.averageLatency = sum / this.latencies.length;
  }
  
  /**
   * Load configuration
   */
  private loadConfiguration(): void {
    this.enabled = this.configService.get<boolean>('enableInlineCompletion', true);
    this.defaultOptions.maxTokens = this.configService.get<number>('completion.maxTokens', 150);
    this.defaultOptions.temperature = this.configService.get<number>('completion.temperature', 0.7);
    this.defaultOptions.contextWindow = this.configService.get<number>('completion.contextWindow', 2048);
    
    const stopSequences = this.configService.get<string[]>('completion.stopSequences');
    if (stopSequences) {
      this.defaultOptions.stopSequences = stopSequences;
    }
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Dispose event emitters
    this.completionEmitter.dispose();
    
    // Clear stats
    this.stats = {
      totalCompletions: 0,
      cachedCompletions: 0,
      cacheMisses: 0,
      averageLatency: 0,
      errorCount: 0
    };
  }
}
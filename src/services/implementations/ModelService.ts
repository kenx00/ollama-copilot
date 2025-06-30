/**
 * Model management service implementation
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import { Logger } from '../../utils/logger';
import {
  IModelService,
  ModelSelectionEvent,
  ModelCapabilities
} from '../interfaces/IModelService';
import { IOllamaApiService, ModelInfo } from '../interfaces/IOllamaApiService';
import { IConfigurationService } from '../interfaces/IConfigurationService';
import { ICacheService } from '../interfaces/ICacheService';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton, Inject } from '../../di/decorators';

/**
 * Model service implementation
 */
@Singleton(SERVICE_IDENTIFIERS.IModelService)
export class ModelService extends Disposable implements IModelService {
  private selectedModel: string = '';
  private readonly selectionEmitter = new vscode.EventEmitter<ModelSelectionEvent>();
  private readonly modelChangeEmitter = new vscode.EventEmitter<ModelSelectionEvent>();
  private readonly modelCapabilities = new Map<string, ModelCapabilities>();
  
  constructor(
    @Inject(SERVICE_IDENTIFIERS.IOllamaApiService) 
    private readonly apiService: IOllamaApiService,
    @Inject(SERVICE_IDENTIFIERS.IConfigurationService) 
    private readonly configService: IConfigurationService,
    @Inject(SERVICE_IDENTIFIERS.ICacheService) 
    private readonly cacheService: ICacheService
  ) {
    super();
    
    // Track the event emitters
    this.track(this.selectionEmitter);
    this.track(this.modelChangeEmitter);
    
    // Initialize default model from configuration
    this.selectedModel = this.configService.get<string>('defaultModel', '');
    
    // Listen for configuration changes
    this.track(
      this.configService.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('defaultModel')) {
          const newModel = this.configService.get<string>('defaultModel', '');
          if (newModel && newModel !== this.selectedModel) {
            this.setSelectedModel(newModel).catch(console.error);
          }
        }
      })
    );
    
    // Initialize model capabilities
    this.initializeModelCapabilities();
  }
  
  /**
   * Get available models
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    Logger.info('ModelService', 'Getting available models...');
    try {
      return await this.cacheService.getOrSet(
        'available-models',
        async () => {
          Logger.info('ModelService', 'Cache miss, fetching models from API...');
          const models = await this.apiService.listModels();
          Logger.info('ModelService', `Retrieved ${models.length} models from API`);
          return models.sort((a, b) => a.name.localeCompare(b.name));
        },
        60000 // Cache for 1 minute
      );
    } catch (error) {
      Logger.error('ModelService', 'Failed to get available models', error);
      throw error;
    }
  }
  
  /**
   * Get available models (cached)
   */
  getCachedModels(): ModelInfo[] {
    const cached = this.cacheService.get<ModelInfo[]>('available-models');
    return cached || [];
  }
  
  /**
   * Refresh model list
   */
  async refreshModels(): Promise<void> {
    // Clear cache to force refresh
    this.cacheService.delete('available-models');
    await this.getAvailableModels();
  }
  
  /**
   * Get selected model
   */
  getSelectedModel(): string {
    return this.selectedModel;
  }
  
  /**
   * Set selected model
   */
  async setSelectedModel(model: string): Promise<void> {
    if (!model || model === this.selectedModel) {return;}
    
    // Validate model exists
    if (!await this.hasModel(model)) {
      throw new Error(`Model '${model}' not found`);
    }
    
    const previousModel = this.selectedModel;
    this.selectedModel = model;
    
    // Update configuration
    await this.configService.update('defaultModel', model);
    
    // Fire selection event
    this.selectionEmitter.fire({
      previousModel,
      currentModel: model,
      source: 'user'
    });
  }
  
  /**
   * Validate model name
   */
  validateModel(model: string): boolean {
    if (!model || typeof model !== 'string') {return false;}
    
    // Basic validation for model name format
    const modelRegex = /^[\w\-.:]+$/;
    return modelRegex.test(model);
  }
  
  /**
   * Check if model exists
   */
  async hasModel(model: string): Promise<boolean> {
    if (!this.validateModel(model)) {return false;}
    
    const models = await this.getAvailableModels();
    return models.some(m => m.name === model);
  }
  
  /**
   * Get model info
   */
  async getModelInfo(model: string): Promise<ModelInfo | undefined> {
    const models = await this.getAvailableModels();
    return models.find(m => m.name === model);
  }
  
  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities | undefined {
    // Check cache first
    const cached = this.modelCapabilities.get(model);
    if (cached) {return cached;}
    
    // Determine capabilities based on model name patterns
    const capabilities: ModelCapabilities = {
      chat: true,
      completion: true,
      embedding: false,
      maxTokens: 2048,
      contextWindow: 4096
    };
    
    // Adjust based on model patterns
    if (model.includes('code')) {
      capabilities.maxTokens = 4096;
      capabilities.contextWindow = 8192;
    } else if (model.includes('embed')) {
      capabilities.chat = false;
      capabilities.completion = false;
      capabilities.embedding = true;
    } else if (model.includes('7b')) {
      capabilities.contextWindow = 8192;
    } else if (model.includes('13b') || model.includes('34b')) {
      capabilities.contextWindow = 16384;
    } else if (model.includes('70b')) {
      capabilities.contextWindow = 32768;
    }
    
    // Cache the capabilities
    this.modelCapabilities.set(model, capabilities);
    
    return capabilities;
  }
  
  /**
   * Initialize default model
   */
  async initializeDefaultModel(): Promise<string | undefined> {
    Logger.info('ModelService', 'Initializing default model...');
    try {
      // First check if Ollama service is running
      const isHealthy = await this.apiService.healthCheck();
      if (!isHealthy) {
        Logger.error('ModelService', 'Ollama service health check failed');
        throw new Error('Cannot connect to Ollama service. Please ensure Ollama is running.');
      }
      
      // Try to use configured model first
      if (this.selectedModel && await this.hasModel(this.selectedModel)) {
        Logger.info('ModelService', `Using configured model: ${this.selectedModel}`);
        return this.selectedModel;
      }
      
      // Get available models
      const models = await this.getAvailableModels();
      Logger.info('ModelService', `Available models for selection: ${models.map(m => m.name).join(', ')}`);
      
      if (models.length === 0) {
        Logger.warn('ModelService', 'No models available');
        return undefined;
      }
      
      // Look for a suitable default model
      const preferredModels = ['llama3.2', 'llama3.1', 'llama3', 'llama2', 'codellama'];
      
      for (const preferred of preferredModels) {
        const model = models.find(m => m.name.toLowerCase().includes(preferred));
        if (model) {
          Logger.info('ModelService', `Found preferred model: ${model.name}`);
          await this.setSelectedModel(model.name);
          return model.name;
        }
      }
      
      // Use first available model
      Logger.info('ModelService', `Using first available model: ${models[0].name}`);
      await this.setSelectedModel(models[0].name);
      return models[0].name;
      
    } catch (error) {
      Logger.error('ModelService', 'Failed to initialize default model', error);
      throw error; // Re-throw to let caller handle
    }
  }
  
  /**
   * Subscribe to model selection changes
   */
  onModelSelectionChange(callback: (event: ModelSelectionEvent) => void): vscode.Disposable {
    return this.selectionEmitter.event(callback);
  }
  
  /**
   * Get suggested model for a task
   */
  getSuggestedModel(task: 'chat' | 'completion' | 'embedding'): string | undefined {
    const models = this.getCachedModels();
    if (models.length === 0) {return undefined;}
    
    // Find models with suitable capabilities
    const suitable = models.filter(model => {
      const capabilities = this.getModelCapabilities(model.name);
      if (!capabilities) {return false;}
      
      switch (task) {
        case 'chat':
          return capabilities.chat;
        case 'completion':
          return capabilities.completion;
        case 'embedding':
          return capabilities.embedding;
      }
    });
    
    if (suitable.length === 0) {return undefined;}
    
    // Prefer code models for completion
    if (task === 'completion') {
      const codeModel = suitable.find(m => m.name.includes('code'));
      if (codeModel) {return codeModel.name;}
    }
    
    // Return the selected model if suitable, otherwise first suitable
    const selected = suitable.find(m => m.name === this.selectedModel);
    return selected ? selected.name : suitable[0].name;
  }
  
  /**
   * Download a model
   */
  async downloadModel(modelName: string): Promise<void> {
    // This would typically use ollama.pull() but it's not in the current API
    throw new Error(`Model downloading not implemented ${modelName}`);
  }
  
  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<void> {
    // This would typically use ollama.delete() but it's not in the current API
    throw new Error(`Model deletion not implemented ${modelName}`);
  }
  
  /**
   * Initialize model capabilities
   */
  private initializeModelCapabilities(): void {
    // Pre-populate some known model capabilities
    // const knownModels = [
    //   {
    //     pattern: 'codellama',
    //     capabilities: {
    //       chat: true,
    //       completion: true,
    //       embedding: false,
    //       maxTokens: 4096,
    //       contextWindow: 16384
    //     }
    //   },
    //   {
    //     pattern: 'llama3',
    //     capabilities: {
    //       chat: true,
    //       completion: true,
    //       embedding: false,
    //       maxTokens: 2048,
    //       contextWindow: 8192
    //     }
    //   },
    //   {
    //     pattern: 'mistral',
    //     capabilities: {
    //       chat: true,
    //       completion: true,
    //       embedding: false,
    //       maxTokens: 2048,
    //       contextWindow: 8192
    //     }
    //   }
    // ];
    
    // This will be expanded as needed
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Dispose event emitter
    this.modelChangeEmitter.dispose();
    
    // Clear selected model cache
    this.selectedModel = '';
  }
}
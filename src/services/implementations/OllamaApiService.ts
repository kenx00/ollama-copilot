/**
 * Ollama API service implementation
 */

import { Ollama } from 'ollama';
import { Disposable } from '../../utils/Disposable';
import { Logger } from '../../utils/logger';
import {
  IOllamaApiService,
  ChatMessage,
  ChatResponse,
  GenerateOptions,
  ModelInfo,
  ModelOptions,
  StreamCallback
} from '../interfaces/IOllamaApiService';
import { IConfigurationService } from '../interfaces/IConfigurationService';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton, Inject } from '../../di/decorators';

/**
 * Ollama API service implementation
 */
@Singleton(SERVICE_IDENTIFIERS.IOllamaApiService)
export class OllamaApiService extends Disposable implements IOllamaApiService {
  private _apiHost: string;
  private ollamaClient: Ollama;
  
  constructor(
    @Inject(SERVICE_IDENTIFIERS.IConfigurationService) 
    private readonly configService: IConfigurationService
  ) {
    super();
    
    // Initialize API host from configuration
    this._apiHost = this.configService.get<string>('ollama.apiHost', 'http://localhost:11434');
    
    // Create Ollama client with the configured host
    this.ollamaClient = new Ollama({ host: this._apiHost });
    
    // Listen for configuration changes
    this.track(
      this.configService.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('ollama.apiHost')) {
          this._apiHost = this.configService.get<string>('ollama.apiHost', 'http://localhost:11434');
          // Recreate Ollama client with new host
          this.ollamaClient = new Ollama({ host: this._apiHost });
        }
      })
    );
  }
  
  /**
   * Get the current API host
   */
  get apiHost(): string {
    return this._apiHost;
  }
  
  /**
   * Set the API host
   */
  setApiHost(host: string): void {
    this._apiHost = host;
    // Recreate Ollama client with new host
    this.ollamaClient = new Ollama({ host: this._apiHost });
    
    // Update configuration
    this.configService.update('ollama.apiHost', host).catch(error => {
      console.error('Failed to update API host in configuration:', error);
    });
  }
  
  /**
   * List available models
   */
  async listModels(): Promise<ModelInfo[]> {
    Logger.info('OllamaApiService', `Listing models from: ${this._apiHost}`);
    try {
      const response = await this.ollamaClient.list();
      Logger.debug('OllamaApiService', 'Raw response from Ollama:', response);
      
      const models = response.models.map(model => ({
        name: model.name,
        modified_at: model.modified_at instanceof Date ? model.modified_at.toISOString() : model.modified_at,
        size: model.size,
        digest: model.digest,
        details: model.details
      }));
      
      Logger.info('OllamaApiService', `Processed ${models.length} models`, models.map(m => m.name));
      return models;
    } catch (error) {
      Logger.error('OllamaApiService', 'Failed to list models', error);
      Logger.debug('OllamaApiService', 'Error details', {
        message: error instanceof Error ? error.message : String(error),
        host: this._apiHost
      });
      
      // Add more specific error messages
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Failed to connect to Ollama. Please ensure the Ollama service is running on ' + this._apiHost);
      }
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if a model exists
   */
  async hasModel(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(m => m.name === modelName);
    } catch {
      return false;
    }
  }
  
  /**
   * Generate completion
   */
  async generate(options: GenerateOptions): Promise<string> {
    try {
      // Add system instruction for code completion if not already present
      let system = options.system;
      if (!system && options.prompt.includes('code completion') || options.prompt.includes('Complete the')) {
        system = 'You are a code completion assistant. Always return ONLY raw code without any markdown formatting, code fences (```), or language identifiers. Never wrap code in markdown blocks.';
      }
      
      const response = await this.ollamaClient.generate({
        model: options.model,
        prompt: options.prompt,
        system: system,
        template: options.template,
        context: options.context,
        stream: false,
        raw: options.raw,
        options: options.options
      });
      
      return response.response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Generation cancelled');
      }
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Failed to connect to Ollama. Please ensure the Ollama service is running on ' + this._apiHost);
      }
      throw new Error(`Failed to generate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate completion with streaming
   */
  async generateStream(options: GenerateOptions, onStream: StreamCallback): Promise<string> {
    try {
      let fullResponse = '';
      
      const response = await this.ollamaClient.generate({
        model: options.model,
        prompt: options.prompt,
        system: options.system,
        template: options.template,
        context: options.context,
        stream: true,
        raw: options.raw,
        options: options.options
      });
      
      for await (const chunk of response) {
        if (chunk.response) {
          fullResponse += chunk.response;
          onStream(chunk.response);
        }
      }
      
      return fullResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Generation cancelled');
      }
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Failed to connect to Ollama. Please ensure the Ollama service is running on ' + this._apiHost);
      }
      throw new Error(`Failed to generate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Chat with a model
   */
  async chat(model: string, messages: ChatMessage[], options?: ModelOptions): Promise<ChatResponse> {
    Logger.debug('OllamaApiService', 'chat called', { model, messageCount: messages.length, host: this._apiHost });
    try {
      const response = await this.ollamaClient.chat({
        model,
        messages,
        stream: false,
        options
      });
      
      Logger.debug('OllamaApiService', 'chat response received');
      
      return {
        model: response.model,
        created_at: response.created_at instanceof Date ? response.created_at.toISOString() : response.created_at,
        message: response.message as ChatMessage,
        done: response.done,
        eval_count: response.eval_count,
        eval_duration: response.eval_duration
      };
    } catch (error) {
      Logger.error('OllamaApiService', 'chat error', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Chat cancelled');
      }
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Failed to connect to Ollama. Please ensure the Ollama service is running on ' + this._apiHost);
      }
      throw new Error(`Failed to chat: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Chat with streaming
   */
  async chatStream(
    model: string, 
    messages: ChatMessage[], 
    onStream: StreamCallback,
    options?: ModelOptions
  ): Promise<ChatResponse> {
    try {
      let lastResponse: any;
      let fullContent = '';
      
      const response = await this.ollamaClient.chat({
        model,
        messages,
        stream: true,
        options
      });
      
      for await (const chunk of response) {
        lastResponse = chunk;
        if (chunk.message?.content) {
          fullContent += chunk.message.content;
          onStream(chunk.message.content);
        }
      }
      
      // Ensure we have a response
      if (!lastResponse) {
        throw new Error('No response received from chat stream');
      }
      
      // Construct final response
      return {
        model: lastResponse.model,
        created_at: lastResponse.created_at instanceof Date ? lastResponse.created_at.toISOString() : lastResponse.created_at,
        message: {
          role: 'assistant',
          content: fullContent
        },
        done: true,
        eval_count: lastResponse.eval_count,
        eval_duration: lastResponse.eval_duration
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Chat cancelled');
      }
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error('Failed to connect to Ollama. Please ensure the Ollama service is running on ' + this._apiHost);
      }
      throw new Error(`Failed to chat: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Cancel ongoing requests
   */
  cancelRequests(): void {
    // Note: Current ollama package doesn't support request cancellation
    // This is a placeholder for future implementation
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    Logger.info('OllamaApiService', `Performing health check on: ${this._apiHost}`);
    try {
      // Try to list models as a health check
      const models = await this.listModels();
      Logger.info('OllamaApiService', `Health check successful, found ${models.length} models`);
      return true;
    } catch (error) {
      Logger.error('OllamaApiService', 'Health check failed', error);
      return false;
    }
  }
  
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Cleanup any resources if needed
  }
}
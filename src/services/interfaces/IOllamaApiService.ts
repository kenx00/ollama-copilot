/**
 * Interface for Ollama API service
 */

import * as vscode from 'vscode';

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

/**
 * Chat response structure
 */
export interface ChatResponse {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Generate request options
 */
export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  options?: ModelOptions;
}

/**
 * Model options
 */
export interface ModelOptions {
  temperature?: number;
  top_k?: number;
  top_p?: number;
  num_predict?: number;
  stop?: string[];
}

/**
 * Model information
 */
export interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Stream callback
 */
export type StreamCallback = (chunk: string) => void;

/**
 * Ollama API service interface
 */
export interface IOllamaApiService extends vscode.Disposable {
  /**
   * Get the current API host
   */
  readonly apiHost: string;
  
  /**
   * Set the API host
   */
  setApiHost(host: string): void;
  
  /**
   * List available models
   */
  listModels(): Promise<ModelInfo[]>;
  
  /**
   * Check if a model exists
   */
  hasModel(modelName: string): Promise<boolean>;
  
  /**
   * Generate completion
   */
  generate(options: GenerateOptions): Promise<string>;
  
  /**
   * Generate completion with streaming
   */
  generateStream(options: GenerateOptions, onStream: StreamCallback): Promise<string>;
  
  /**
   * Chat with a model
   */
  chat(model: string, messages: ChatMessage[], options?: ModelOptions): Promise<ChatResponse>;
  
  /**
   * Chat with streaming
   */
  chatStream(
    model: string, 
    messages: ChatMessage[], 
    onStream: StreamCallback,
    options?: ModelOptions
  ): Promise<ChatResponse>;
  
  /**
   * Cancel ongoing requests
   */
  cancelRequests(): void;
  
  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}
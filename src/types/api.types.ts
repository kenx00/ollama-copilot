/**
 * @file API-related type definitions
 * @module types/api
 * @description Type definitions for Ollama API and network operations
 */

import { JsonValue } from "./index";

/**
 * HTTP method types
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

/**
 * API endpoint configuration
 */
export interface ApiEndpoint {
  /** The HTTP method */
  method: HttpMethod;
  /** The endpoint path */
  path: string;
  /** Optional path parameters */
  params?: Record<string, string>;
  /** Optional query parameters */
  query?: Record<string, string | number | boolean>;
  /** Optional request headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * API request configuration
 * @template T The request body type
 */
export interface ApiRequest<T = unknown> extends ApiEndpoint {
  /** Request body */
  body?: T;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Retry configuration */
  retry?: RetryConfig;
}

/**
 * API response wrapper
 * @template T The response data type
 */
export interface ApiResponse<T = unknown> {
  /** Response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response timing information */
  timing?: ResponseTiming;
}

/**
 * Response timing information
 */
export interface ResponseTiming {
  /** Time to first byte in milliseconds */
  ttfb: number;
  /** Total request duration in milliseconds */
  duration: number;
  /** Download time in milliseconds */
  downloadTime?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  initialDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** HTTP status codes that should trigger a retry */
  retryableStatuses?: number[];
  /** Custom retry predicate */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Ollama model information
 */
export interface OllamaModel {
  /** Model name/identifier */
  name: string;
  /** Model digest/hash */
  digest: string;
  /** Model size in bytes */
  size: number;
  /** Last modified timestamp */
  modified_at: string;
  /** Model details */
  details?: OllamaModelDetails;
}

/**
 * Ollama model details
 */
export interface OllamaModelDetails {
  /** Model family */
  family?: string;
  /** Parameter size (e.g., "7B", "13B") */
  parameter_size?: string;
  /** Quantization level */
  quantization_level?: string;
  /** Model format */
  format?: string;
  /** Parent model */
  parent_model?: string;
}

/**
 * Ollama generate request
 */
export interface OllamaGenerateRequest {
  /** Model to use */
  model: string;
  /** Input prompt */
  prompt: string;
  /** System prompt */
  system?: string;
  /** Template for formatting */
  template?: string;
  /** Context from previous request */
  context?: number[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Raw mode (no formatting) */
  raw?: boolean;
  /** Generation options */
  options?: OllamaGenerateOptions;
}

/**
 * Ollama generation options
 */
export interface OllamaGenerateOptions {
  /** Temperature for randomness (0.0-2.0) */
  temperature?: number;
  /** Top-p sampling */
  top_p?: number;
  /** Top-k sampling */
  top_k?: number;
  /** Number of tokens to predict */
  num_predict?: number;
  /** Number of context tokens */
  num_ctx?: number;
  /** Stop sequences */
  stop?: string[];
  /** Repeat penalty */
  repeat_penalty?: number;
  /** Seed for reproducibility */
  seed?: number;
  /** Number of threads */
  num_thread?: number;
}

/**
 * Ollama generate response
 */
export interface OllamaGenerateResponse {
  /** Model used */
  model: string;
  /** Generated text */
  response: string;
  /** Whether generation is complete */
  done: boolean;
  /** Context for next request */
  context?: number[];
  /** Total duration in nanoseconds */
  total_duration?: number;
  /** Load duration in nanoseconds */
  load_duration?: number;
  /** Evaluation count */
  eval_count?: number;
  /** Evaluation duration in nanoseconds */
  eval_duration?: number;
  /** Prompt evaluation count */
  prompt_eval_count?: number;
  /** Prompt evaluation duration in nanoseconds */
  prompt_eval_duration?: number;
}

/**
 * Ollama chat message
 */
export interface OllamaChatMessage {
  /** Message role */
  role: "system" | "user" | "assistant";
  /** Message content */
  content: string;
  /** Optional images (base64 encoded) */
  images?: string[];
}

/**
 * Ollama chat request
 */
export interface OllamaChatRequest {
  /** Model to use */
  model: string;
  /** Chat messages */
  messages: OllamaChatMessage[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Generation options */
  options?: OllamaGenerateOptions;
}

/**
 * Ollama chat response
 */
export interface OllamaChatResponse {
  /** Model used */
  model: string;
  /** Response message */
  message: OllamaChatMessage;
  /** Whether generation is complete */
  done: boolean;
  /** Creation timestamp */
  created_at: string;
  /** Total duration in nanoseconds */
  total_duration?: number;
  /** Load duration in nanoseconds */
  load_duration?: number;
  /** Evaluation count */
  eval_count?: number;
  /** Evaluation duration in nanoseconds */
  eval_duration?: number;
}

/**
 * Streaming response chunk
 * @template T The chunk data type
 */
export interface StreamChunk<T = string> {
  /** Chunk data */
  data: T;
  /** Whether this is the final chunk */
  done: boolean;
  /** Chunk metadata */
  metadata?: Record<string, JsonValue>;
}

/**
 * API error response
 */
export interface ApiError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: Record<string, JsonValue>;
  /** Stack trace (development only) */
  stack?: string;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests */
  remaining: number;
  /** Reset timestamp */
  reset: number;
  /** Retry after (seconds) */
  retryAfter?: number;
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  baseUrl: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Default headers */
  headers?: Record<string, string>;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Request interceptor */
  onRequest?: (request: ApiRequest) => ApiRequest | Promise<ApiRequest>;
  /** Response interceptor */
  onResponse?: <T>(
    response: ApiResponse<T>
  ) => ApiResponse<T> | Promise<ApiResponse<T>>;
  /** Error interceptor */
  onError?: (error: Error) => Error | Promise<Error>;
}

/**
 * Paged response wrapper
 * @template T The item type
 */
export interface PagedResponse<T> {
  /** Page items */
  items: T[];
  /** Total number of items */
  total: number;
  /** Current page number (0-based) */
  page: number;
  /** Page size */
  pageSize: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Next page token */
  nextToken?: string;
}

/**
 * Batch operation request
 * @template T The operation type
 */
export interface BatchRequest<T> {
  /** Batch operations */
  operations: T[];
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Maximum parallel operations */
  maxConcurrency?: number;
}

/**
 * Batch operation response
 * @template T The result type
 */
export interface BatchResponse<T> {
  /** Successful results */
  results: Array<{ index: number; data: T }>;
  /** Failed operations */
  errors: Array<{ index: number; error: ApiError }>;
  /** Total operations */
  total: number;
  /** Number of successful operations */
  successful: number;
  /** Number of failed operations */
  failed: number;
}

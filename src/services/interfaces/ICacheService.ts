/**
 * Interface for generic caching service
 */

import * as vscode from 'vscode';

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  expiry?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  maxMemory?: number; // Maximum memory usage in bytes
  evictionPolicy?: 'lru' | 'lfu' | 'fifo';
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
}

/**
 * Cache service interface
 */
export interface ICacheService extends vscode.Disposable {
  /**
   * Get a value from cache
   */
  get<T>(key: string): T | undefined;
  
  /**
   * Get a value from cache asynchronously
   */
  getAsync<T>(key: string): Promise<T | undefined>;
  
  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void;
  
  /**
   * Set a value in cache asynchronously
   */
  setAsync<T>(key: string, value: T, ttl?: number): Promise<void>;
  
  /**
   * Check if key exists
   */
  has(key: string): boolean;
  
  /**
   * Delete a key from cache
   */
  delete(key: string): boolean;
  
  /**
   * Clear all cache entries
   */
  clear(): void;
  
  /**
   * Get all keys
   */
  keys(): string[];
  
  /**
   * Get cache size
   */
  size(): number;
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
  
  /**
   * Reset statistics
   */
  resetStats(): void;
  
  /**
   * Set cache options
   */
  configure(options: CacheOptions): void;
  
  /**
   * Get or set a value
   */
  getOrSet<T>(key: string, factory: () => T | Promise<T>, ttl?: number): Promise<T>;
  
  /**
   * Prune expired entries
   */
  prune(): number;
  
  /**
   * Subscribe to cache events
   */
  onEviction<T = unknown>(callback: (key: string, value: T) => void): vscode.Disposable;
}
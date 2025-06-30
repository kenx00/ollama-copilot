/**
 * Cache interfaces and types for optimized LRU cache implementation
 */

import * as vscode from 'vscode';

/**
 * Cache eviction policies
 */
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  size: number;
  ttl?: number;
  priority?: number;
}

/**
 * Cache entry interface
 */
export interface CacheEntry<K, V> {
  key: K;
  value: V;
  metadata: CacheEntryMetadata;
}

/**
 * Cache statistics interface
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  deletes: number;
  size: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  avgAccessTime: number;
  lastResetTime: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig<K, V> {
  maxSize: number;
  maxMemory?: number;
  ttl?: number;
  evictionPolicy?: EvictionPolicy;
  onEvict?: (key: K, value: V, reason: 'size' | 'ttl' | 'memory' | 'manual') => void;
  sizeCalculator?: (value: V) => number;
  keySerializer?: (key: K) => string;
  enableStatistics?: boolean;
  enableMemoryTracking?: boolean;
  checkInterval?: number;
}

/**
 * Cache warming strategy
 */
export interface CacheWarmingStrategy<K, V> {
  keys: K[];
  loader: (keys: K[]) => Promise<Map<K, V>>;
  batchSize?: number;
  priority?: number;
}

/**
 * Cache event types
 */
export type CacheEventType = 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'clear' | 'warm';

/**
 * Cache event
 */
export interface CacheEvent<K, V> {
  type: CacheEventType;
  key?: K;
  value?: V;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Main cache interface
 */
export interface IOptimizedLRUCache<K, V> extends vscode.Disposable {
  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined;
  
  /**
   * Set a value in the cache
   */
  set(key: K, value: V, ttl?: number): void;
  
  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean;
  
  /**
   * Delete a key from the cache
   */
  delete(key: K): boolean;
  
  /**
   * Clear all entries from the cache
   */
  clear(): void;
  
  /**
   * Get the current size of the cache
   */
  get size(): number;
  
  /**
   * Get all keys in the cache
   */
  keys(): K[];
  
  /**
   * Get all values in the cache
   */
  values(): V[];
  
  /**
   * Get all entries in the cache
   */
  entries(): Array<[K, V]>;
  
  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics;
  
  /**
   * Reset cache statistics
   */
  resetStatistics(): void;
  
  /**
   * Warm the cache with preloaded data
   */
  warm(strategy: CacheWarmingStrategy<K, V>): Promise<void>;
  
  /**
   * Prune expired entries
   */
  prune(): number;
  
  /**
   * Update cache configuration
   */
  configure(config: Partial<CacheConfig<K, V>>): void;
  
  /**
   * Subscribe to cache events
   */
  onCacheEvent(listener: (event: CacheEvent<K, V>) => void): vscode.Disposable;
  
  /**
   * Get memory usage
   */
  getMemoryUsage(): number;
  
  /**
   * Batch get operation
   */
  mget(keys: K[]): Map<K, V>;
  
  /**
   * Batch set operation
   */
  mset(entries: Array<[K, V]>, ttl?: number): void;
  
  /**
   * Get or set with factory function
   */
  getOrSet(key: K, factory: () => V | Promise<V>, ttl?: number): Promise<V>;
}

/**
 * Doubly-linked list node interface
 */
export interface ListNode<K, V> {
  key: K;
  value: V;
  metadata: CacheEntryMetadata;
  prev: ListNode<K, V> | null;
  next: ListNode<K, V> | null;
}

/**
 * Thread-safe lock interface
 */
export interface ILock {
  acquire(): Promise<void>;
  release(): void;
  tryAcquire(): boolean;
}
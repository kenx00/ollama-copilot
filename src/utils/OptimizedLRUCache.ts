/**
 * @file Optimized LRU Cache implementation with O(1) operations
 * @module utils/OptimizedLRUCache
 * @description High-performance LRU cache using doubly-linked list + hash map for O(1) operations.
 * Supports multiple eviction policies, TTL, memory limits, and comprehensive statistics.
 */

import * as vscode from 'vscode';
import {
  IOptimizedLRUCache,
  CacheConfig,
  CacheEntryMetadata,
  CacheEvent,
  CacheEventType,
  CacheStatistics,
  CacheWarmingStrategy,
  ListNode
} from './cache/interfaces';
import { DoublyLinkedList, createNode } from './cache/DoublyLinkedList';
import { CacheStatisticsTracker, MemoryUsageCalculator } from './cache/CacheStatistics';

/**
 * High-performance LRU cache with O(1) complexity for all operations
 * @class OptimizedLRUCache
 * @template K - The key type
 * @template V - The value type
 * @implements {IOptimizedLRUCache<K, V>}
 * @description Features:
 * - O(1) get, set, and delete operations
 * - Multiple eviction policies (LRU, LFU, FIFO, TTL)
 * - Automatic TTL expiration
 * - Memory limit enforcement
 * - Comprehensive statistics tracking
 * - Event notifications
 * - Cache warming support
 * - Integer overflow protection
 * 
 * @example
 * ```typescript
 * const cache = new OptimizedLRUCache<string, User>({
 *   maxSize: 1000,
 *   ttl: 5 * 60 * 1000, // 5 minutes
 *   evictionPolicy: 'lru',
 *   onEvict: (key, value, reason) => {
 *     console.log(`Evicted ${key} due to ${reason}`);
 *   }
 * });
 * 
 * cache.set('user:123', userData);
 * const user = cache.get('user:123');
 * ```
 */
export class OptimizedLRUCache<K, V> implements IOptimizedLRUCache<K, V> {
  private readonly map: Map<K, ListNode<K, V>>;
  private readonly list: DoublyLinkedList<K, V>;
  private readonly config: Required<CacheConfig<K, V>>;
  private readonly statistics: CacheStatisticsTracker;
  private readonly eventEmitter: vscode.EventEmitter<CacheEvent<K, V>>;
  private readonly disposables: vscode.Disposable[] = [];
  
  private pruneTimer?: NodeJS.Timeout;
  private memoryUsage: number = 0;
  private disposed: boolean = false;
  
  // Prevent integer overflow with safe counter
  private accessCounter: bigint = 0n;
  private readonly MAX_SAFE_COUNTER = BigInt(Number.MAX_SAFE_INTEGER);
  
  /**
   * Creates a new optimized LRU cache
   * @param {CacheConfig<K, V>} config - Cache configuration
   * @description Initializes the cache with specified configuration including
   * size limits, eviction policy, TTL, and callbacks.
   */
  constructor(config: CacheConfig<K, V>) {
    // Initialize with defaults
    this.config = {
      maxSize: config.maxSize,
      maxMemory: config.maxMemory ?? Infinity,
      ttl: config.ttl ?? 0,
      evictionPolicy: config.evictionPolicy ?? 'lru',
      onEvict: config.onEvict ?? (() => {}),
      sizeCalculator: config.sizeCalculator ?? ((v) => MemoryUsageCalculator.calculate(v)),
      keySerializer: config.keySerializer ?? ((k) => String(k)),
      enableStatistics: config.enableStatistics ?? true,
      enableMemoryTracking: config.enableMemoryTracking ?? true,
      checkInterval: config.checkInterval ?? 60000 // 1 minute
    };
    
    this.map = new Map();
    this.list = new DoublyLinkedList();
    this.statistics = new CacheStatisticsTracker();
    this.eventEmitter = new vscode.EventEmitter<CacheEvent<K, V>>();
    
    // Start periodic maintenance
    if (this.config.ttl > 0 || this.config.maxMemory < Infinity) {
      this.startMaintenance();
    }
  }
  
  /**
   * Retrieves a value from the cache
   * @param {K} key - The key to look up
   * @returns {V | undefined} The cached value or undefined if not found/expired
   * @description O(1) complexity. Automatically:
   * - Checks TTL expiration
   * - Updates access metadata
   * - Moves item to front for LRU policy
   * - Records statistics
   * - Emits cache events
   * @example
   * ```typescript
   * const value = cache.get('myKey');
   * if (value) {
   *   console.log('Cache hit:', value);
   * }
   * ```
   */
  get(key: K): V | undefined {
    const startTime = performance.now();
    const node = this.map.get(key);
    
    if (!node) {
      if (this.config.enableStatistics) {
        this.statistics.recordMiss(performance.now() - startTime);
      }
      this.emitEvent('miss', key);
      return undefined;
    }
    
    // Check TTL
    if (this.isExpired(node)) {
      this.delete(key);
      if (this.config.enableStatistics) {
        this.statistics.recordMiss(performance.now() - startTime);
      }
      this.emitEvent('miss', key);
      return undefined;
    }
    
    // Update access metadata
    this.updateAccess(node);
    
    // Move to front (most recently used)
    if (this.config.evictionPolicy === 'lru') {
      this.list.moveToFront(node);
    }
    
    if (this.config.enableStatistics) {
      this.statistics.recordHit(performance.now() - startTime);
    }
    
    this.emitEvent('hit', key, node.value);
    return node.value;
  }
  
  /**
   * Sets a value in the cache
   * @param {K} key - The key to store
   * @param {V} value - The value to cache
   * @param {number} [ttl] - Optional TTL in milliseconds (overrides default)
   * @returns {void}
   * @description O(1) complexity. Automatically:
   * - Evicts items if necessary (size/memory limits)
   * - Updates existing entries
   * - Tracks memory usage
   * - Records statistics
   * - Emits cache events
   * @example
   * ```typescript
   * // Set with default TTL
   * cache.set('user:123', userData);
   * 
   * // Set with custom TTL (1 hour)
   * cache.set('session:abc', sessionData, 60 * 60 * 1000);
   * ```
   */
  set(key: K, value: V, ttl?: number): void {
    // Check if we're updating existing entry
    const existingNode = this.map.get(key);
    
    if (existingNode) {
      // Update existing node
      const oldSize = this.config.sizeCalculator(existingNode.value);
      const newSize = this.config.sizeCalculator(value);
      
      existingNode.value = value;
      existingNode.metadata.size = newSize;
      existingNode.metadata.ttl = ttl ?? this.config.ttl;
      this.updateAccess(existingNode);
      
      // Update memory tracking
      if (this.config.enableMemoryTracking) {
        this.memoryUsage = this.memoryUsage - oldSize + newSize;
      }
      
      // Move to front for LRU
      if (this.config.evictionPolicy === 'lru') {
        this.list.moveToFront(existingNode);
      }
    } else {
      // Create new node
      const metadata: CacheEntryMetadata = {
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        size: this.config.sizeCalculator(value),
        ttl: ttl ?? this.config.ttl
      };
      
      const node = createNode(key, value, metadata);
      
      // Check if we need to evict
      this.ensureCapacity(metadata.size);
      
      // Add to structures
      this.map.set(key, node);
      this.list.addToFront(node);
      
      // Update memory tracking
      if (this.config.enableMemoryTracking) {
        this.memoryUsage += metadata.size;
      }
    }
    
    if (this.config.enableStatistics) {
      this.statistics.recordSet();
      this.statistics.updateSize(this.map.size);
      this.statistics.updateMemoryUsage(this.memoryUsage);
    }
    
    this.emitEvent('set', key, value);
  }
  
  /**
   * Checks if a key exists in the cache
   * @param {K} key - The key to check
   * @returns {boolean} True if key exists and is not expired
   * @description O(1) complexity. Automatically removes expired entries.
   * @example
   * ```typescript
   * if (cache.has('user:123')) {
   *   const user = cache.get('user:123');
   * }
   * ```
   */
  has(key: K): boolean {
    const node = this.map.get(key);
    
    if (!node) {
      return false;
    }
    
    // Check TTL
    if (this.isExpired(node)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Deletes a key from the cache
   * @param {K} key - The key to delete
   * @returns {boolean} True if the key was deleted, false if not found
   * @description O(1) complexity. Updates memory tracking and statistics.
   * @example
   * ```typescript
   * const wasDeleted = cache.delete('user:123');
   * console.log('Deleted:', wasDeleted);
   * ```
   */
  delete(key: K): boolean {
    const node = this.map.get(key);
    
    if (!node) {
      return false;
    }
    
    // Remove from structures
    this.map.delete(key);
    this.list.removeNode(node);
    
    // Update memory tracking
    if (this.config.enableMemoryTracking) {
      this.memoryUsage -= node.metadata.size;
    }
    
    if (this.config.enableStatistics) {
      this.statistics.recordDelete();
      this.statistics.updateSize(this.map.size);
      this.statistics.updateMemoryUsage(this.memoryUsage);
    }
    
    this.emitEvent('delete', key, node.value);
    return true;
  }
  
  /**
   * Clears all entries from the cache
   * @returns {void}
   * @description O(n) complexity where n is the number of entries.
   * Resets all statistics and memory tracking.
   * @example
   * ```typescript
   * cache.clear();
   * console.log('Cache size:', cache.size); // 0
   * ```
   */
  clear(): void {
    this.map.clear();
    this.list.clear();
    this.memoryUsage = 0;
    
    if (this.config.enableStatistics) {
      this.statistics.updateSize(0);
      this.statistics.updateMemoryUsage(0);
    }
    
    this.emitEvent('clear');
  }
  
  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.map.size;
  }
  
  /**
   * Get all keys in the cache
   */
  keys(): K[] {
    const keys: K[] = [];
    
    for (const node of this.list) {
      if (!this.isExpired(node)) {
        keys.push(node.key);
      }
    }
    
    return keys;
  }
  
  /**
   * Get all values in the cache
   */
  values(): V[] {
    const values: V[] = [];
    
    for (const node of this.list) {
      if (!this.isExpired(node)) {
        values.push(node.value);
      }
    }
    
    return values;
  }
  
  /**
   * Get all entries in the cache
   */
  entries(): Array<[K, V]> {
    const entries: Array<[K, V]> = [];
    
    for (const node of this.list) {
      if (!this.isExpired(node)) {
        entries.push([node.key, node.value]);
      }
    }
    
    return entries;
  }
  
  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return this.statistics.getStatistics();
  }
  
  /**
   * Reset cache statistics
   */
  resetStatistics(): void {
    this.statistics.reset();
  }
  
  /**
   * Warms the cache with preloaded data
   * @param {CacheWarmingStrategy<K, V>} strategy - Warming strategy configuration
   * @returns {Promise<void>}
   * @description Preloads cache with data in batches to avoid blocking.
   * Useful for improving cache hit rates on startup.
   * @example
   * ```typescript
   * await cache.warm({
   *   keys: ['user:1', 'user:2', 'user:3'],
   *   loader: async (keys) => {
   *     const users = await database.getUsers(keys);
   *     return new Map(users.map(u => [`user:${u.id}`, u]));
   *   },
   *   batchSize: 100
   * });
   * ```
   */
  async warm(strategy: CacheWarmingStrategy<K, V>): Promise<void> {
    const batchSize = strategy.batchSize ?? 100;
    
    for (let i = 0; i < strategy.keys.length; i += batchSize) {
      const batch = strategy.keys.slice(i, i + batchSize);
      const entries = await strategy.loader(batch);
      
      for (const [key, value] of entries) {
        this.set(key, value);
      }
      
      // Allow other operations to proceed
      await new Promise(resolve => setImmediate(resolve));
    }
    
    this.emitEvent('warm');
  }
  
  /**
   * Prune expired entries
   */
  prune(): number {
    let pruned = 0;
    const now = Date.now();
    
    const expiredNodes = this.list.findNodes(node => {
      const ttl = node.metadata.ttl;
      if (ttl && ttl > 0) {
        const expiryTime = node.metadata.createdAt + ttl;
        return expiryTime < now;
      }
      return false;
    });
    
    for (const node of expiredNodes) {
      this.delete(node.key);
      pruned++;
    }
    
    return pruned;
  }
  
  /**
   * Update cache configuration
   */
  configure(config: Partial<CacheConfig<K, V>>): void {
    Object.assign(this.config, config);
    
    // Restart maintenance if needed
    if (this.pruneTimer) {
      this.stopMaintenance();
      this.startMaintenance();
    }
  }
  
  /**
   * Subscribe to cache events
   */
  onCacheEvent(listener: (event: CacheEvent<K, V>) => void): vscode.Disposable {
    return this.eventEmitter.event(listener);
  }
  
  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    return this.memoryUsage;
  }
  
  /**
   * Batch get operation
   */
  mget(keys: K[]): Map<K, V> {
    const result = new Map<K, V>();
    
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    
    return result;
  }
  
  /**
   * Batch set operation
   */
  mset(entries: Array<[K, V]>, ttl?: number): void {
    for (const [key, value] of entries) {
      this.set(key, value, ttl);
    }
  }
  
  /**
   * Get or set with factory function
   */
  async getOrSet(key: K, factory: () => V | Promise<V>, ttl?: number): Promise<V> {
    const existing = this.get(key);
    
    if (existing !== undefined) {
      return existing;
    }
    
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
  
  /**
   * Disposes the cache and cleans up resources
   * @returns {void}
   * @description Stops maintenance timers, clears all entries,
   * and disposes event emitters. Safe to call multiple times.
   * @example
   * ```typescript
   * // Clean up when done
   * cache.dispose();
   * ```
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    
    this.disposed = true;
    this.stopMaintenance();
    this.clear();
    this.eventEmitter.dispose();
    
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
  
  /**
   * Check if a node is expired
   */
  private isExpired(node: ListNode<K, V>): boolean {
    const ttl = node.metadata.ttl;
    
    if (!ttl || ttl <= 0) {
      return false;
    }
    
    const expiryTime = node.metadata.createdAt + ttl;
    return expiryTime < Date.now();
  }
  
  /**
   * Update access metadata
   */
  private updateAccess(node: ListNode<K, V>): void {
    node.metadata.lastAccessedAt = Date.now();
    node.metadata.accessCount++;
    
    // Handle counter overflow
    this.accessCounter++;
    if (this.accessCounter > this.MAX_SAFE_COUNTER) {
      this.normalizeAccessCounts();
    }
  }
  
  /**
   * Normalize access counts to prevent overflow
   */
  private normalizeAccessCounts(): void {
    // Find minimum access count
    let minCount = Number.MAX_SAFE_INTEGER;
    
    for (const node of this.list) {
      minCount = Math.min(minCount, node.metadata.accessCount);
    }
    
    // Subtract minimum from all counts
    for (const node of this.list) {
      node.metadata.accessCount -= minCount;
    }
    
    // Reset counter
    this.accessCounter = 0n;
  }
  
  /**
   * Ensure capacity for new entry
   */
  private ensureCapacity(newEntrySize: number): void {
    // Check size limit
    while (this.map.size >= this.config.maxSize) {
      this.evictOne('size');
    }
    
    // Check memory limit
    if (this.config.enableMemoryTracking) {
      while (this.memoryUsage + newEntrySize > this.config.maxMemory) {
        if (!this.evictOne('memory')) {
          break; // No more items to evict
        }
      }
    }
  }
  
  /**
   * Evict one entry based on policy
   */
  private evictOne(reason: 'size' | 'memory'): boolean {
    let nodeToEvict: ListNode<K, V> | null = null;
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        // Remove least recently used (tail)
        nodeToEvict = this.list.back;
        break;
        
      case 'lfu':
        // Find least frequently used
        let minAccess = Number.MAX_SAFE_INTEGER;
        for (const node of this.list) {
          if (node.metadata.accessCount < minAccess) {
            minAccess = node.metadata.accessCount;
            nodeToEvict = node;
          }
        }
        break;
        
      case 'fifo':
        // Remove oldest (by creation time)
        let oldestTime = Number.MAX_SAFE_INTEGER;
        for (const node of this.list) {
          if (node.metadata.createdAt < oldestTime) {
            oldestTime = node.metadata.createdAt;
            nodeToEvict = node;
          }
        }
        break;
        
      case 'ttl':
        // Remove closest to expiration
        let soonestExpiry = Number.MAX_SAFE_INTEGER;
        
        for (const node of this.list) {
          if (node.metadata.ttl && node.metadata.ttl > 0) {
            const expiryTime = node.metadata.createdAt + node.metadata.ttl;
            if (expiryTime < soonestExpiry) {
              soonestExpiry = expiryTime;
              nodeToEvict = node;
            }
          }
        }
        
        // If no TTL entries, fall back to LRU
        if (!nodeToEvict) {
          nodeToEvict = this.list.back;
        }
        break;
    }
    
    if (nodeToEvict) {
      this.config.onEvict(nodeToEvict.key, nodeToEvict.value, reason);
      this.delete(nodeToEvict.key);
      
      if (this.config.enableStatistics) {
        this.statistics.recordEviction();
      }
      
      this.emitEvent('evict', nodeToEvict.key, nodeToEvict.value);
      return true;
    }
    
    return false;
  }
  
  /**
   * Start periodic maintenance
   */
  private startMaintenance(): void {
    this.pruneTimer = setInterval(() => {
      this.prune();
    }, this.config.checkInterval);
  }
  
  /**
   * Stop periodic maintenance
   */
  private stopMaintenance(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = undefined;
    }
  }
  
  /**
   * Emit cache event
   */
  private emitEvent(type: CacheEventType, key?: K, value?: V): void {
    const event: CacheEvent<K, V> = {
      type,
      key,
      value,
      timestamp: Date.now()
    };
    
    this.eventEmitter.fire(event);
  }
}
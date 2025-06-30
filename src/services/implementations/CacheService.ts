/**
 * Generic cache service implementation
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import {
  ICacheService,
  CacheOptions,
  CacheStats
} from '../interfaces/ICacheService';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton } from '../../di/decorators';
import { OptimizedLRUCache } from '../../utils/OptimizedLRUCache';

/**
 * Cache service implementation using OptimizedLRUCache
 */
@Singleton(SERVICE_IDENTIFIERS.ICacheService)
export class CacheService extends Disposable implements ICacheService {
  private cache: OptimizedLRUCache<string, unknown>;
  private readonly evictionEmitter = new vscode.EventEmitter<{ key: string; value: unknown }>();
  
  private options: Required<CacheOptions> = {
    ttl: 5 * 60 * 1000, // 5 minutes default
    maxSize: 1000,
    maxMemory: 50 * 1024 * 1024, // 50MB
    evictionPolicy: 'lru'
  };
  
  constructor() {
    super();
    
    // Track the event emitter
    this.track(this.evictionEmitter);
    
    // Initialize optimized cache
    this.cache = new OptimizedLRUCache<string, unknown>({
      maxSize: this.options.maxSize,
      maxMemory: this.options.maxMemory,
      ttl: this.options.ttl,
      evictionPolicy: this.options.evictionPolicy,
      enableStatistics: true,
      enableMemoryTracking: true,
      onEvict: (key, value, _reason) => {
        this.evictionEmitter.fire({ key, value });
      }
    });
    
    // Track the cache
    this.track(this.cache);
  }
  
  /**
   * Get a value from cache
   */
  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }
  
  /**
   * Get a value from cache asynchronously
   */
  async getAsync<T>(key: string): Promise<T | undefined> {
    return this.get<T>(key);
  }
  
  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, ttl);
  }
  
  /**
   * Set a value in cache asynchronously
   */
  async setAsync<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.set(key, value, ttl);
  }
  
  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get all keys
   */
  keys(): string[] {
    return this.cache.keys();
  }
  
  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const stats = this.cache.getStatistics();
    return {
      size: stats.size,
      hits: stats.hits,
      misses: stats.misses,
      evictions: stats.evictions,
      memoryUsage: stats.memoryUsage,
      hitRate: stats.hitRate
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.cache.resetStatistics();
  }
  
  /**
   * Set cache options
   */
  configure(options: CacheOptions): void {
    this.options = { ...this.options, ...options };
    
    // Update cache configuration
    this.cache.configure({
      maxSize: this.options.maxSize,
      maxMemory: this.options.maxMemory,
      ttl: this.options.ttl,
      evictionPolicy: this.options.evictionPolicy
    });
  }
  
  /**
   * Get or set a value
   */
  async getOrSet<T>(key: string, factory: () => T | Promise<T>, ttl?: number): Promise<T> {
    return this.cache.getOrSet(key, factory, ttl) as Promise<T>;
  }
  
  /**
   * Prune expired entries
   */
  prune(): number {
    return this.cache.prune();
  }
  
  /**
   * Subscribe to cache events
   */
  onEviction<T = unknown>(callback: (key: string, value: T) => void): vscode.Disposable {
    return this.evictionEmitter.event(({ key, value }) => callback(key, value as T));
  }
  
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    this.evictionEmitter.dispose();
  }
}
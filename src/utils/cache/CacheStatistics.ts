/**
 * Cache statistics tracking and management
 */

import { CacheStatistics } from './interfaces';

/**
 * Cache statistics tracker
 */
export class CacheStatisticsTracker {
  private stats: CacheStatistics;
  private accessTimes: number[] = [];
  private readonly maxAccessTimeSamples = 1000;
  
  constructor() {
    this.stats = this.createEmptyStats();
  }
  
  /**
   * Create empty statistics object
   */
  private createEmptyStats(): CacheStatistics {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      memoryUsage: 0,
      hitRate: 0,
      missRate: 0,
      avgAccessTime: 0,
      lastResetTime: Date.now()
    };
  }
  
  /**
   * Record a cache hit
   */
  recordHit(accessTime: number): void {
    this.stats.hits++;
    this.recordAccessTime(accessTime);
    this.updateRates();
  }
  
  /**
   * Record a cache miss
   */
  recordMiss(accessTime: number): void {
    this.stats.misses++;
    this.recordAccessTime(accessTime);
    this.updateRates();
  }
  
  /**
   * Record a cache set operation
   */
  recordSet(): void {
    this.stats.sets++;
  }
  
  /**
   * Record a cache delete operation
   */
  recordDelete(): void {
    this.stats.deletes++;
  }
  
  /**
   * Record a cache eviction
   */
  recordEviction(): void {
    this.stats.evictions++;
  }
  
  /**
   * Update cache size
   */
  updateSize(size: number): void {
    this.stats.size = size;
  }
  
  /**
   * Update memory usage
   */
  updateMemoryUsage(bytes: number): void {
    this.stats.memoryUsage = bytes;
  }
  
  /**
   * Get current statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = this.createEmptyStats();
    this.accessTimes = [];
  }
  
  /**
   * Record access time
   */
  private recordAccessTime(time: number): void {
    this.accessTimes.push(time);
    
    // Keep bounded array size
    if (this.accessTimes.length > this.maxAccessTimeSamples) {
      this.accessTimes.shift();
    }
    
    // Update average
    if (this.accessTimes.length > 0) {
      const sum = this.accessTimes.reduce((a, b) => a + b, 0);
      this.stats.avgAccessTime = sum / this.accessTimes.length;
    }
  }
  
  /**
   * Update hit/miss rates
   */
  private updateRates(): void {
    const total = this.stats.hits + this.stats.misses;
    
    if (total > 0) {
      this.stats.hitRate = this.stats.hits / total;
      this.stats.missRate = this.stats.misses / total;
    } else {
      this.stats.hitRate = 0;
      this.stats.missRate = 0;
    }
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    opsPerSecond: number;
    avgEvictionRate: number;
    cacheEfficiency: number;
  } {
    const elapsed = Date.now() - this.stats.lastResetTime;
    const totalOps = this.stats.hits + this.stats.misses + this.stats.sets + this.stats.deletes;
    
    return {
      opsPerSecond: elapsed > 0 ? (totalOps / elapsed) * 1000 : 0,
      avgEvictionRate: this.stats.sets > 0 ? this.stats.evictions / this.stats.sets : 0,
      cacheEfficiency: this.stats.hitRate
    };
  }
  
  /**
   * Export statistics as CSV
   */
  exportAsCSV(): string {
    const headers = Object.keys(this.stats).join(',');
    const values = Object.values(this.stats).join(',');
    return `${headers}\n${values}`;
  }
  
  /**
   * Export statistics as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify({
      statistics: this.stats,
      performance: this.getPerformanceMetrics(),
      timestamp: Date.now()
    }, null, 2);
  }
}

/**
 * Memory usage calculator
 */
export class MemoryUsageCalculator {
  /**
   * Calculate memory usage for a value
   */
  static calculate(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }
    
    switch (typeof value) {
      case 'string':
        return value.length * 2; // 2 bytes per character (UTF-16)
        
      case 'number':
        return 8; // 64-bit floating point
        
      case 'boolean':
        return 4; // 32-bit
        
      case 'bigint':
        return Math.ceil(value.toString(2).length / 8); // Bits to bytes
        
      case 'object':
        if (value instanceof Date) {
          return 8; // Timestamp
        }
        
        if (value instanceof Array) {
          return value.reduce((sum, item) => sum + MemoryUsageCalculator.calculate(item), 24); // Array overhead
        }
        
        if (value instanceof Map || value instanceof Set) {
          let size = 24; // Collection overhead
          for (const item of value.values()) {
            size += MemoryUsageCalculator.calculate(item);
          }
          return size;
        }
        
        // Regular object
        try {
          return JSON.stringify(value).length * 2;
        } catch {
          // Circular reference or other issue
          return 1024; // Default size
        }
        
      case 'function':
        return 64; // Function reference
        
      default:
        return 32; // Default size
    }
  }
}
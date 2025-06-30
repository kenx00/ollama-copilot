/**
 * Performance monitoring service implementation
 */

import { Disposable } from '../../utils/Disposable';
import { 
  IPerformanceMonitor, 
  PerformanceMetric, 
  PerformanceStats 
} from '../interfaces/IPerformanceMonitor';
import { PerformanceMonitor as LegacyPerformanceMonitor } from '../../utils/PerformanceMonitor';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton } from '../../di/decorators';

/**
 * Performance monitoring service
 */
@Singleton(SERVICE_IDENTIFIERS.IPerformanceMonitor)
export class PerformanceMonitorService extends Disposable implements IPerformanceMonitor {
  private readonly monitor: LegacyPerformanceMonitor;
  private readonly activeOperations = new Map<string, { name: string; startTime: number; category?: string }>();
  private readonly metrics: PerformanceMetric[] = [];
  private thresholds = new Map<string, number>();
  
  constructor() {
    super();
    this.monitor = new LegacyPerformanceMonitor();
  }
  
  /**
   * Start a performance measurement
   */
  startOperation(name: string, category?: string): string {
    const operationId = `${name}-${Date.now()}-${Math.random()}`;
    this.activeOperations.set(operationId, {
      name,
      startTime: Date.now(),
      category
    });
    
    // Also start in legacy monitor
    this.monitor.startOperation(operationId, category || name);
    
    return operationId;
  }
  
  /**
   * End a performance measurement
   */
  endOperation(operationId: string, metadata?: Record<string, any>): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      console.warn(`Operation ${operationId} not found`);
      return;
    }
    
    const duration = Date.now() - operation.startTime;
    this.activeOperations.delete(operationId);
    
    // Record the metric
    const metric: PerformanceMetric = {
      name: operation.name,
      category: operation.category || 'general',
      duration,
      timestamp: new Date(),
      metadata
    };
    
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
    
    // Also end in legacy monitor
    this.monitor.completeOperation(operationId, true);
  }
  
  /**
   * Record a complete operation
   */
  recordOperation(
    name: string, 
    duration: number, 
    category?: string, 
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      category: category || 'general',
      duration,
      timestamp: new Date(),
      metadata
    };
    
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }
  
  /**
   * Get performance statistics
   */
  getStats(category?: string): PerformanceStats {
    const relevantMetrics = category 
      ? this.metrics.filter(m => m.category === category)
      : this.metrics;
    
    if (relevantMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 }
      };
    }
    
    const durations = relevantMetrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    
    return {
      totalOperations: durations.length,
      averageDuration: sum / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      percentiles: {
        p50: this.getPercentile(durations, 0.5),
        p90: this.getPercentile(durations, 0.9),
        p95: this.getPercentile(durations, 0.95),
        p99: this.getPercentile(durations, 0.99)
      }
    };
  }
  
  /**
   * Get recent metrics
   */
  getRecentMetrics(limit?: number, category?: string): PerformanceMetric[] {
    let metrics = category 
      ? this.metrics.filter(m => m.category === category)
      : [...this.metrics];
    
    metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? metrics.slice(0, limit) : metrics;
  }
  
  /**
   * Show performance report
   */
  showReport(): void {
    // Delegate to legacy monitor
    this.monitor.showReport();
  }
  
  /**
   * Export metrics to file
   */
  async exportMetrics(): Promise<void> {
    // Delegate to legacy monitor
    await this.monitor.exportMetrics();
  }
  
  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.length = 0;
    this.activeOperations.clear();
  }
  
  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Record<string, number>): void {
    this.thresholds.clear();
    Object.entries(thresholds).forEach(([name, value]) => {
      this.thresholds.set(name, value);
    });
  }
  
  /**
   * Check if operation exceeds threshold
   */
  checkThreshold(operationName: string, duration: number): boolean {
    const threshold = this.thresholds.get(operationName);
    return threshold !== undefined && duration > threshold;
  }
  
  /**
   * Calculate percentile
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)];
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Clear metrics
    this.clearMetrics();
    
    // Dispose legacy monitor
    this.monitor.dispose();
  }
}
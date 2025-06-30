/**
 * Performance monitoring service interface
 */

import * as vscode from 'vscode';

export interface PerformanceMetric {
  name: string;
  category: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface IPerformanceMonitor extends vscode.Disposable {
  /**
   * Start a performance measurement
   */
  startOperation(name: string, category?: string): string;
  
  /**
   * End a performance measurement
   */
  endOperation(operationId: string, metadata?: Record<string, any>): void;
  
  /**
   * Record a complete operation
   */
  recordOperation(name: string, duration: number, category?: string, metadata?: Record<string, any>): void;
  
  /**
   * Get performance statistics
   */
  getStats(category?: string): PerformanceStats;
  
  /**
   * Get recent metrics
   */
  getRecentMetrics(limit?: number, category?: string): PerformanceMetric[];
  
  /**
   * Show performance report
   */
  showReport(): void;
  
  /**
   * Export metrics to file
   */
  exportMetrics(): Promise<void>;
  
  /**
   * Clear all metrics
   */
  clearMetrics(): void;
  
  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Record<string, number>): void;
  
  /**
   * Check if operation exceeds threshold
   */
  checkThreshold(operationName: string, duration: number): boolean;
}
/**
 * Memory monitoring service interface
 */

import * as vscode from 'vscode';

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  percentUsed: number;
  totalAvailable?: number;
}

export interface MemoryAlert {
  type: 'warning' | 'critical';
  message: string;
  stats: MemoryStats;
  timestamp: Date;
}

export interface IMemoryMonitor extends vscode.Disposable {
  /**
   * Start monitoring memory usage
   */
  startMonitoring(intervalMs: number): void;
  
  /**
   * Stop monitoring memory usage
   */
  stopMonitoring(): void;
  
  /**
   * Get current memory statistics
   */
  getStats(): MemoryStats;
  
  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void;
  
  /**
   * Show memory usage report
   */
  showReport(): void;
  
  /**
   * Register alert handler
   */
  onAlert(handler: (alert: MemoryAlert) => void): vscode.Disposable;
  
  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean;
  
  /**
   * Get memory usage history
   */
  getHistory(): MemoryStats[];
  
  /**
   * Clear memory usage history
   */
  clearHistory(): void;
  
  /**
   * Set memory alert thresholds
   */
  setThresholds(warning: number, critical: number): void;
}
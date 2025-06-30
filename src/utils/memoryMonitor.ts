/**
 * Memory monitoring utilities for tracking and reporting memory usage
 * Helps identify memory leaks and performance issues
 */

import * as vscode from 'vscode';
import { Disposable } from './Disposable';

export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number; // Resident Set Size
}

export interface MemoryAlert {
  type: 'warning' | 'critical';
  message: string;
  snapshot: MemorySnapshot;
}

/**
 * Memory monitor for tracking extension memory usage
 */
export class MemoryMonitor extends Disposable {
  private snapshots: MemorySnapshot[] = [];
  private readonly maxSnapshots = 100;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly outputChannel: vscode.OutputChannel;
  private alertCallback?: (alert: MemoryAlert) => void;

  // Thresholds in MB
  private warningThresholdMB = 200;
  private criticalThresholdMB = 400;
  private lastAlertTime = 0;
  private readonly alertCooldownMs = 60000; // 1 minute

  constructor() {
    super();
    this.outputChannel = vscode.window.createOutputChannel('Ollama Copilot Memory Monitor');
    this.track(this.outputChannel);
    
    // Load thresholds from configuration
    this.loadConfiguration();
    
    // Watch for configuration changes
    this.track(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ollama.memory')) {
          this.loadConfiguration();
        }
      })
    );
  }

  /**
   * Loads configuration settings
   */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('ollama.memory');
    this.warningThresholdMB = config.get<number>('warningThresholdMB', 200);
    this.criticalThresholdMB = config.get<number>('criticalThresholdMB', 400);
  }

  /**
   * Takes a memory snapshot
   */
  public takeSnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      rss: memUsage.rss
    };

    this.snapshots.push(snapshot);
    
    // Maintain max snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Check for alerts
    this.checkMemoryAlerts(snapshot);

    return snapshot;
  }

  /**
   * Starts periodic memory monitoring
   */
  public startMonitoring(intervalMs = 30000): void {
    this.checkDisposed();
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);

    this.log('Memory monitoring started');
  }

  /**
   * Stops memory monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.log('Memory monitoring stopped');
    }
  }

  /**
   * Sets alert callback
   */
  public onAlert(callback: (alert: MemoryAlert) => void): void {
    this.alertCallback = callback;
  }

  /**
   * Checks for memory alerts
   */
  private checkMemoryAlerts(snapshot: MemorySnapshot): void {
    const heapUsedMB = snapshot.heapUsed / (1024 * 1024);
    const now = Date.now();

    // Check cooldown
    if (now - this.lastAlertTime < this.alertCooldownMs) {
      return;
    }

    let alert: MemoryAlert | null = null;

    if (heapUsedMB >= this.criticalThresholdMB) {
      alert = {
        type: 'critical',
        message: `Critical memory usage: ${heapUsedMB.toFixed(2)}MB (threshold: ${this.criticalThresholdMB}MB)`,
        snapshot
      };
    } else if (heapUsedMB >= this.warningThresholdMB) {
      alert = {
        type: 'warning',
        message: `High memory usage: ${heapUsedMB.toFixed(2)}MB (threshold: ${this.warningThresholdMB}MB)`,
        snapshot
      };
    }

    if (alert) {
      this.lastAlertTime = now;
      this.log(`ALERT: ${alert.message}`);
      
      if (this.alertCallback) {
        this.alertCallback(alert);
      }

      // Show VS Code notification
      if (alert.type === 'critical') {
        vscode.window.showErrorMessage(`Ollama Copilot: ${alert.message}`);
      } else {
        vscode.window.showWarningMessage(`Ollama Copilot: ${alert.message}`);
      }
    }
  }

  /**
   * Gets memory usage statistics
   */
  public getStats(): {
    current: MemorySnapshot | null;
    average: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
    peak: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.snapshots.length === 0) {
      return {
        current: null,
        average: { heapUsed: 0, heapTotal: 0, rss: 0 },
        peak: { heapUsed: 0, heapTotal: 0, rss: 0 },
        trend: 'stable'
      };
    }

    const current = this.snapshots[this.snapshots.length - 1];
    
    // Calculate averages
    let totalHeapUsed = 0;
    let totalHeapTotal = 0;
    let totalRss = 0;
    let peakHeapUsed = 0;
    let peakHeapTotal = 0;
    let peakRss = 0;

    this.snapshots.forEach(snapshot => {
      totalHeapUsed += snapshot.heapUsed;
      totalHeapTotal += snapshot.heapTotal;
      totalRss += snapshot.rss;
      
      peakHeapUsed = Math.max(peakHeapUsed, snapshot.heapUsed);
      peakHeapTotal = Math.max(peakHeapTotal, snapshot.heapTotal);
      peakRss = Math.max(peakRss, snapshot.rss);
    });

    const count = this.snapshots.length;
    const average = {
      heapUsed: totalHeapUsed / count,
      heapTotal: totalHeapTotal / count,
      rss: totalRss / count
    };

    const peak = {
      heapUsed: peakHeapUsed,
      heapTotal: peakHeapTotal,
      rss: peakRss
    };

    // Calculate trend (comparing last 10 snapshots)
    const recentCount = Math.min(10, this.snapshots.length);
    const recentSnapshots = this.snapshots.slice(-recentCount);
    const firstRecent = recentSnapshots[0];
    const lastRecent = recentSnapshots[recentSnapshots.length - 1];
    
    const heapChange = lastRecent.heapUsed - firstRecent.heapUsed;
    const changePercentage = (heapChange / firstRecent.heapUsed) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (changePercentage > 10) {
      trend = 'increasing';
    } else if (changePercentage < -10) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { current, average, peak, trend };
  }

  /**
   * Generates a memory report
   */
  public generateReport(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push('=== Memory Usage Report ===');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    if (stats.current) {
      lines.push('Current Usage:');
      lines.push(`  Heap Used: ${this.formatBytes(stats.current.heapUsed)}`);
      lines.push(`  Heap Total: ${this.formatBytes(stats.current.heapTotal)}`);
      lines.push(`  RSS: ${this.formatBytes(stats.current.rss)}`);
      lines.push('');
    }

    lines.push('Average Usage:');
    lines.push(`  Heap Used: ${this.formatBytes(stats.average.heapUsed)}`);
    lines.push(`  Heap Total: ${this.formatBytes(stats.average.heapTotal)}`);
    lines.push(`  RSS: ${this.formatBytes(stats.average.rss)}`);
    lines.push('');

    lines.push('Peak Usage:');
    lines.push(`  Heap Used: ${this.formatBytes(stats.peak.heapUsed)}`);
    lines.push(`  Heap Total: ${this.formatBytes(stats.peak.heapTotal)}`);
    lines.push(`  RSS: ${this.formatBytes(stats.peak.rss)}`);
    lines.push('');

    lines.push(`Memory Trend: ${stats.trend.toUpperCase()}`);
    lines.push('');

    lines.push('Thresholds:');
    lines.push(`  Warning: ${this.warningThresholdMB}MB`);
    lines.push(`  Critical: ${this.criticalThresholdMB}MB`);

    return lines.join('\n');
  }

  /**
   * Shows memory report in output channel
   */
  public showReport(): void {
    this.outputChannel.clear();
    this.outputChannel.append(this.generateReport());
    this.outputChannel.show();
  }

  /**
   * Forces garbage collection (if available)
   */
  public forceGarbageCollection(): void {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = before - after;
      
      this.log(`Garbage collection freed ${this.formatBytes(freed)}`);
      vscode.window.showInformationMessage(
        `Garbage collection freed ${this.formatBytes(freed)}`
      );
    } else {
      vscode.window.showWarningMessage(
        'Garbage collection not available. Run VS Code with --expose-gc flag.'
      );
    }
  }

  /**
   * Formats bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)}MB`;
  }

  /**
   * Logs a message
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  protected onDispose(): void {
    this.stopMonitoring();
    this.snapshots = [];
    this.alertCallback = undefined;
  }
}

// Singleton instance
let instance: MemoryMonitor | null = null;

/**
 * Gets the singleton memory monitor instance
 */
export function getMemoryMonitor(): MemoryMonitor {
  if (!instance) {
    instance = new MemoryMonitor();
  }
  return instance;
}

/**
 * Disposes the memory monitor singleton
 */
export function disposeMemoryMonitor(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
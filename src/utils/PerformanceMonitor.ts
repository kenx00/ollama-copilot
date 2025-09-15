/**
 * Performance monitoring utilities for file operations
 */

import * as vscode from 'vscode';

export interface OperationMetrics {
  operationId: string;
  type: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  fileSize?: number;
  throughput?: number; // bytes per second
  error?: string;
}

export interface PerformanceReport {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  averageThroughput: number;
  slowestOperation?: OperationMetrics;
  fastestOperation?: OperationMetrics;
  operationsByType: Map<string, number>;
  errorRate: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Monitors performance of file operations
 */
export class PerformanceMonitor {
  private metrics: Map<string, OperationMetrics> = new Map();
  private readonly maxMetricsSize = 1000;
  private readonly outputChannel: vscode.OutputChannel;
  
  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('File Operation Performance');
  }

  /**
   * Starts monitoring an operation
   */
  startOperation(operationId: string, type: string, fileSize?: number): void {
    const metric: OperationMetrics = {
      operationId,
      type,
      startTime: Date.now(),
      status: 'running',
      fileSize
    };

    this.metrics.set(operationId, metric);
    this.cleanupOldMetrics();
  }

  /**
   * Completes monitoring an operation
   */
  completeOperation(operationId: string, success: boolean, error?: Error): void {
    const metric = this.metrics.get(operationId);
    if (!metric) {return;}

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.status = success ? 'completed' : 'failed';
    
    if (error) {
      metric.error = error.message;
    }

    if (metric.fileSize && metric.duration > 0) {
      // Calculate throughput in bytes per second
      metric.throughput = (metric.fileSize / metric.duration) * 1000;
    }

    this.logMetric(metric);
  }

  /**
   * Gets a performance report for a time range
   */
  getReport(sinceMs?: number): PerformanceReport {
    const now = Date.now();
    const startTime = sinceMs ? now - sinceMs : 0;
    
    const relevantMetrics = Array.from(this.metrics.values())
      .filter(m => m.startTime >= startTime && m.status !== 'running');

    if (relevantMetrics.length === 0) {
      return this.createEmptyReport();
    }

    const successful = relevantMetrics.filter(m => m.status === 'completed');
    const failed = relevantMetrics.filter(m => m.status === 'failed');
    
    // Calculate averages
    const totalDuration = successful.reduce((sum, m) => sum + (m.duration || 0), 0);
    const averageDuration = successful.length > 0 ? totalDuration / successful.length : 0;
    
    const totalThroughput = successful
      .filter(m => m.throughput)
      .reduce((sum, m) => sum + m.throughput!, 0);
    const throughputCount = successful.filter(m => m.throughput).length;
    const averageThroughput = throughputCount > 0 ? totalThroughput / throughputCount : 0;

    // Find extremes
    const sortedByDuration = successful
      .filter(m => m.duration)
      .sort((a, b) => a.duration! - b.duration!);
    
    const fastestOperation = sortedByDuration[0];
    const slowestOperation = sortedByDuration[sortedByDuration.length - 1];

    // Count by type
    const operationsByType = new Map<string, number>();
    for (const metric of relevantMetrics) {
      const count = operationsByType.get(metric.type) || 0;
      operationsByType.set(metric.type, count + 1);
    }

    return {
      totalOperations: relevantMetrics.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      averageDuration,
      averageThroughput,
      slowestOperation,
      fastestOperation,
      operationsByType,
      errorRate: relevantMetrics.length > 0 
        ? (failed.length / relevantMetrics.length) * 100 
        : 0,
      timeRange: {
        start: new Date(startTime),
        end: new Date(now)
      }
    };
  }

  /**
   * Shows a performance report in the output channel
   */
  showReport(sinceMs?: number): void {
    const report = this.getReport(sinceMs);
    
    this.outputChannel.clear();
    this.outputChannel.appendLine('File Operation Performance Report');
    this.outputChannel.appendLine('=================================');
    this.outputChannel.appendLine(`Time Range: ${report.timeRange.start.toLocaleString()} - ${report.timeRange.end.toLocaleString()}`);
    this.outputChannel.appendLine('');
    
    this.outputChannel.appendLine('Summary:');
    this.outputChannel.appendLine(`  Total Operations: ${report.totalOperations}`);
    this.outputChannel.appendLine(`  Successful: ${report.successfulOperations}`);
    this.outputChannel.appendLine(`  Failed: ${report.failedOperations}`);
    this.outputChannel.appendLine(`  Error Rate: ${report.errorRate.toFixed(2)}%`);
    this.outputChannel.appendLine('');
    
    this.outputChannel.appendLine('Performance:');
    this.outputChannel.appendLine(`  Average Duration: ${this.formatDuration(report.averageDuration)}`);
    this.outputChannel.appendLine(`  Average Throughput: ${this.formatThroughput(report.averageThroughput)}`);
    
    if (report.fastestOperation) {
      this.outputChannel.appendLine(`  Fastest Operation: ${this.formatDuration(report.fastestOperation.duration!)}`);
    }
    
    if (report.slowestOperation) {
      this.outputChannel.appendLine(`  Slowest Operation: ${this.formatDuration(report.slowestOperation.duration!)}`);
    }
    
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine('Operations by Type:');
    for (const [type, count] of report.operationsByType) {
      this.outputChannel.appendLine(`  ${type}: ${count}`);
    }
    
    this.outputChannel.show();
  }

  /**
   * Gets recent slow operations
   */
  getSlowOperations(thresholdMs: number = 5000, limit: number = 10): OperationMetrics[] {
    return Array.from(this.metrics.values())
      .filter(m => m.duration && m.duration > thresholdMs)
      .sort((a, b) => b.duration! - a.duration!)
      .slice(0, limit);
  }

  /**
   * Exports metrics to CSV
   */
  async exportMetrics(): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('file-operation-metrics.csv'),
      filters: {
        'CSV files': ['csv'],
        'All files': ['*']
      }
    });

    if (!uri) {return;}

    const csv = this.generateCSV();
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(csv));
    
    vscode.window.showInformationMessage('Performance metrics exported successfully');
  }

  /**
   * Private helper methods
   */

  private logMetric(metric: OperationMetrics): void {
    const duration = this.formatDuration(metric.duration || 0);
    const throughput = metric.throughput ? this.formatThroughput(metric.throughput) : 'N/A';
    const status = metric.status === 'completed' ? '✓' : '✗';
    
    this.outputChannel.appendLine(
      `${status} ${metric.type} - ${duration} - ${throughput} - ${metric.operationId}`
    );
    
    if (metric.error) {
      this.outputChannel.appendLine(`  Error: ${metric.error}`);
    }
  }

  private cleanupOldMetrics(): void {
    if (this.metrics.size > this.maxMetricsSize) {
      // Remove oldest metrics
      const sorted = Array.from(this.metrics.entries())
        .sort(([, a], [, b]) => a.startTime - b.startTime);
      
      const toRemove = sorted.slice(0, this.metrics.size - this.maxMetricsSize);
      for (const [id] of toRemove) {
        this.metrics.delete(id);
      }
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      return `${(ms / 60000).toFixed(2)}m`;
    }
  }

  private formatThroughput(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
    }
  }

  private createEmptyReport(): PerformanceReport {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      averageThroughput: 0,
      operationsByType: new Map(),
      errorRate: 0,
      timeRange: {
        start: new Date(),
        end: new Date()
      }
    };
  }

  private generateCSV(): string {
    const headers = ['Operation ID', 'Type', 'Start Time', 'Duration (ms)', 'Status', 'Throughput (B/s)', 'Error'];
    const rows = Array.from(this.metrics.values()).map(m => [
      m.operationId,
      m.type,
      new Date(m.startTime).toISOString(),
      m.duration || '',
      m.status,
      m.throughput || '',
      m.error || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.outputChannel.dispose();
    this.metrics.clear();
  }
}

// Singleton instance
let instance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!instance) {
    instance = new PerformanceMonitor();
  }
  return instance;
}
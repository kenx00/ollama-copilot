/**
 * Resource management service interface
 */

import * as vscode from 'vscode';

export interface ResourceMetadata {
  name: string;
  type: string;
  priority: number;
  createdAt?: Date;
  lastUsed?: Date;
  size?: number;
}

export interface ManagedResource {
  id: string;
  resource: vscode.Disposable;
  metadata: ResourceMetadata;
}

export interface ResourceStats {
  totalResources: number;
  resourcesByType: Record<string, number>;
  totalMemoryUsage?: number;
  oldestResource?: Date;
  newestResource?: Date;
}

export interface IResourceManager extends vscode.Disposable {
  /**
   * Register a resource to be managed
   */
  register(id: string, resource: vscode.Disposable, metadata: ResourceMetadata): void;
  
  /**
   * Unregister a resource
   */
  unregister(id: string): boolean;
  
  /**
   * Get a registered resource
   */
  get(id: string): ManagedResource | undefined;
  
  /**
   * Check if a resource is registered
   */
  has(id: string): boolean;
  
  /**
   * Get all resources of a specific type
   */
  getByType(type: string): ManagedResource[];
  
  /**
   * Clean up resources older than specified age
   */
  cleanupOldResources(maxAgeMs: number): number;
  
  /**
   * Dispose specific resource
   */
  disposeResource(id: string): boolean;
  
  /**
   * Dispose all resources of a type
   */
  disposeByType(type: string): number;
  
  /**
   * Get resource statistics
   */
  getStats(): ResourceStats;
  
  /**
   * Show resource status
   */
  showStatus(): void;
  
  /**
   * Set resource limit
   */
  setResourceLimit(type: string, limit: number): void;
  
  /**
   * Check if resource limit exceeded
   */
  isLimitExceeded(type: string): boolean;
}
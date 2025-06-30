/**
 * Resource manager for tracking and cleaning up all extension resources
 * Ensures proper disposal of all components on extension deactivation
 */

import * as vscode from 'vscode';
import { Disposable } from '../utils/Disposable';

export interface ResourceMetadata {
  name: string;
  type: string;
  createdAt: Date;
  priority?: number; // Lower numbers disposed first
}

export interface ManagedResource {
  resource: vscode.Disposable;
  metadata: ResourceMetadata;
}

/**
 * Central resource manager for the extension
 */
export class ResourceManager extends Disposable {
  private resources = new Map<string, ManagedResource>();
  private resourcesByType = new Map<string, Set<string>>();
  private disposalOrder: string[] = [];
  private readonly outputChannel: vscode.OutputChannel;

  constructor() {
    super();
    this.outputChannel = vscode.window.createOutputChannel('Ollama Copilot Resources');
    this.track(this.outputChannel);
  }

  /**
   * Registers a resource for lifecycle management
   */
  public register<T extends vscode.Disposable>(
    id: string,
    resource: T,
    metadata: Omit<ResourceMetadata, 'createdAt'>
  ): T {
    this.checkDisposed();

    if (this.resources.has(id)) {
      console.warn(`Resource with id '${id}' already exists. Disposing old resource.`);
      this.unregister(id);
    }

    const fullMetadata: ResourceMetadata = {
      ...metadata,
      createdAt: new Date()
    };

    this.resources.set(id, { resource, metadata: fullMetadata });

    // Track by type
    if (!this.resourcesByType.has(metadata.type)) {
      this.resourcesByType.set(metadata.type, new Set());
    }
    this.resourcesByType.get(metadata.type)!.add(id);

    // Update disposal order
    this.updateDisposalOrder();

    this.log(`Registered resource: ${id} (${metadata.type})`);
    return resource;
  }

  /**
   * Unregisters and disposes a resource
   */
  public unregister(id: string): boolean {
    const managedResource = this.resources.get(id);
    if (!managedResource) {
      return false;
    }

    try {
      managedResource.resource.dispose();
    } catch (error) {
      console.error(`Error disposing resource '${id}':`, error);
    }

    this.resources.delete(id);

    // Remove from type tracking
    const typeSet = this.resourcesByType.get(managedResource.metadata.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) {
        this.resourcesByType.delete(managedResource.metadata.type);
      }
    }

    // Update disposal order
    const index = this.disposalOrder.indexOf(id);
    if (index !== -1) {
      this.disposalOrder.splice(index, 1);
    }

    this.log(`Unregistered resource: ${id}`);
    return true;
  }

  /**
   * Gets a resource by ID
   */
  public get<T extends vscode.Disposable>(id: string): T | undefined {
    this.checkDisposed();
    const managed = this.resources.get(id);
    return managed?.resource as T;
  }

  /**
   * Gets all resources of a specific type
   */
  public getByType(type: string): vscode.Disposable[] {
    this.checkDisposed();
    const ids = this.resourcesByType.get(type);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map(id => this.resources.get(id)?.resource)
      .filter((r): r is vscode.Disposable => r !== undefined);
  }

  /**
   * Checks if a resource is registered
   */
  public has(id: string): boolean {
    return this.resources.has(id);
  }

  /**
   * Gets resource metadata
   */
  public getMetadata(id: string): ResourceMetadata | undefined {
    return this.resources.get(id)?.metadata;
  }

  /**
   * Updates the disposal order based on priority
   */
  private updateDisposalOrder(): void {
    this.disposalOrder = Array.from(this.resources.entries())
      .sort(([, a], [, b]) => {
        const priorityA = a.metadata.priority ?? 100;
        const priorityB = b.metadata.priority ?? 100;
        return priorityA - priorityB;
      })
      .map(([id]) => id);
  }

  /**
   * Gets resource statistics
   */
  public getStats(): {
    totalResources: number;
    resourcesByType: Record<string, number>;
    oldestResource?: { id: string; age: number };
  } {
    const now = Date.now();
    let oldestResource: { id: string; age: number } | undefined;

    this.resources.forEach((managed, id) => {
      const age = now - managed.metadata.createdAt.getTime();
      if (!oldestResource || age > oldestResource.age) {
        oldestResource = { id, age };
      }
    });

    const resourcesByType: Record<string, number> = {};
    this.resourcesByType.forEach((ids, type) => {
      resourcesByType[type] = ids.size;
    });

    return {
      totalResources: this.resources.size,
      resourcesByType,
      oldestResource
    };
  }

  /**
   * Shows resource status in output channel
   */
  public showStatus(): void {
    const stats = this.getStats();
    this.outputChannel.clear();
    this.outputChannel.appendLine('=== Resource Manager Status ===');
    this.outputChannel.appendLine(`Total resources: ${stats.totalResources}`);
    this.outputChannel.appendLine('\nResources by type:');
    
    Object.entries(stats.resourcesByType).forEach(([type, count]) => {
      this.outputChannel.appendLine(`  ${type}: ${count}`);
    });

    if (stats.oldestResource) {
      const ageMinutes = Math.floor(stats.oldestResource.age / 60000);
      this.outputChannel.appendLine(`\nOldest resource: ${stats.oldestResource.id} (${ageMinutes} minutes)`);
    }

    this.outputChannel.appendLine('\nRegistered resources:');
    this.disposalOrder.forEach(id => {
      const managed = this.resources.get(id);
      if (managed) {
        const age = Math.floor((Date.now() - managed.metadata.createdAt.getTime()) / 1000);
        this.outputChannel.appendLine(`  - ${id} (${managed.metadata.type}, ${age}s old)`);
      }
    });

    this.outputChannel.show();
  }

  /**
   * Cleans up resources older than specified age
   */
  public cleanupOldResources(maxAgeMs: number): number {
    const now = Date.now();
    const toRemove: string[] = [];

    this.resources.forEach((managed, id) => {
      const age = now - managed.metadata.createdAt.getTime();
      if (age > maxAgeMs) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.unregister(id));
    
    if (toRemove.length > 0) {
      this.log(`Cleaned up ${toRemove.length} old resources`);
    }

    return toRemove.length;
  }

  /**
   * Logs a message
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  /**
   * Disposes all managed resources in priority order
   */
  protected onDispose(): void {
    this.log('Disposing all managed resources...');
    
    const totalResources = this.disposalOrder.length;
    let disposed = 0;

    // Dispose in priority order
    for (const id of this.disposalOrder) {
      const managed = this.resources.get(id);
      if (managed) {
        try {
          this.log(`Disposing: ${id} (${managed.metadata.type})`);
          managed.resource.dispose();
          disposed++;
        } catch (error) {
          console.error(`Error disposing resource '${id}':`, error);
          this.log(`ERROR disposing ${id}: ${error}`);
        }
      }
    }

    this.resources.clear();
    this.resourcesByType.clear();
    this.disposalOrder = [];

    this.log(`Disposed ${disposed}/${totalResources} resources`);
    this.log('Resource manager disposed');
  }
}

// Singleton instance
let instance: ResourceManager | null = null;

/**
 * Gets the singleton resource manager instance
 */
export function getResourceManager(): ResourceManager {
  if (!instance) {
    instance = new ResourceManager();
  }
  return instance;
}

/**
 * Disposes the resource manager singleton
 */
export function disposeResourceManager(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
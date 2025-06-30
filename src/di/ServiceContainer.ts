/**
 * @file Dependency injection container implementation
 * @module di/ServiceContainer
 * @description Core dependency injection container providing service registration,
 * resolution, and lifecycle management with support for singleton, transient, and scoped services.
 */

import * as vscode from 'vscode';
import {
  IServiceContainer,
  ServiceIdentifier,
  ServiceDescriptor,
  ServiceLifecycle,
  ServiceFactory,
  ServiceResolutionError,
  CircularDependencyError,
} from './types';
import { ServiceRegistry } from './ServiceRegistry';

/**
 * Service container implementation for dependency injection
 * @class ServiceContainer
 * @implements {IServiceContainer}
 * @implements {vscode.Disposable}
 * @description Manages service registration, resolution, and lifecycle.
 * Supports hierarchical containers with parent-child relationships.
 * @example
 * ```typescript
 * const container = new ServiceContainer();
 * 
 * // Register a singleton service
 * container.registerSingleton(SERVICE_IDENTIFIERS.IMyService, 
 *   () => new MyService()
 * );
 * 
 * // Resolve the service
 * const service = container.resolve<IMyService>(SERVICE_IDENTIFIERS.IMyService);
 * ```
 */
export class ServiceContainer implements IServiceContainer, vscode.Disposable {
  private readonly registry: ServiceRegistry;
  private readonly singletonInstances = new Map<ServiceIdentifier, any>();
  private readonly scopedInstances = new Map<ServiceIdentifier, any>();
  private readonly resolutionStack: ServiceIdentifier[] = [];
  private readonly parent?: ServiceContainer;
  private disposed = false;
  
  /**
   * Creates a new service container
   * @param {ServiceContainer} [parent] - Optional parent container for hierarchical resolution
   * @description When a parent is provided, service resolution will fall back to the parent
   * if a service is not found in the current container.
   */
  constructor(parent?: ServiceContainer) {
    this.parent = parent;
    this.registry = parent ? parent.registry : new ServiceRegistry();
    
    // Register the container itself
    this.registerSingleton<IServiceContainer>(
      'IServiceContainer',
      () => this
    );
  }
  
  /**
   * Registers a service with full descriptor
   * @template T - The service type
   * @param {ServiceDescriptor<T>} descriptor - Service descriptor with identifier, lifecycle, and factory
   * @returns {void}
   * @throws {Error} If container is disposed
   * @example
   * ```typescript
   * container.register({
   *   identifier: SERVICE_IDENTIFIERS.ILogger,
   *   lifecycle: ServiceLifecycle.Singleton,
   *   factory: () => new ConsoleLogger()
   * });
   * ```
   */
  register<T>(descriptor: ServiceDescriptor<T>): void {
    this.checkDisposed();
    this.registry.register(descriptor);
  }
  
  /**
   * Registers a singleton service (created once, shared across all resolutions)
   * @template T - The service type
   * @param {ServiceIdentifier<T>} identifier - Unique service identifier
   * @param {ServiceFactory<T>} factory - Factory function to create the service
   * @returns {void}
   * @description Singleton services are created once and the same instance is returned
   * for all subsequent resolutions.
   * @example
   * ```typescript
   * container.registerSingleton('IDatabase', () => new DatabaseConnection());
   * const db1 = container.resolve('IDatabase');
   * const db2 = container.resolve('IDatabase');
   * console.log(db1 === db2); // true
   * ```
   */
  registerSingleton<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.register({
      identifier,
      lifecycle: ServiceLifecycle.Singleton,
      factory
    });
  }
  
  /**
   * Registers a transient service (new instance for each resolution)
   * @template T - The service type
   * @param {ServiceIdentifier<T>} identifier - Unique service identifier
   * @param {ServiceFactory<T>} factory - Factory function to create the service
   * @returns {void}
   * @description Transient services create a new instance for every resolution.
   * @example
   * ```typescript
   * container.registerTransient('IRequest', () => new HttpRequest());
   * const req1 = container.resolve('IRequest');
   * const req2 = container.resolve('IRequest');
   * console.log(req1 === req2); // false
   * ```
   */
  registerTransient<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.register({
      identifier,
      lifecycle: ServiceLifecycle.Transient,
      factory
    });
  }
  
  /**
   * Registers a scoped service (shared within a scope)
   * @template T - The service type
   * @param {ServiceIdentifier<T>} identifier - Unique service identifier
   * @param {ServiceFactory<T>} factory - Factory function to create the service
   * @returns {void}
   * @description Scoped services are shared within a container scope but
   * create new instances in child containers.
   * @example
   * ```typescript
   * container.registerScoped('ISession', () => new UserSession());
   * const scope = container.createScope();
   * const session1 = scope.resolve('ISession');
   * const session2 = scope.resolve('ISession');
   * console.log(session1 === session2); // true (same scope)
   * ```
   */
  registerScoped<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.register({
      identifier,
      lifecycle: ServiceLifecycle.Scoped,
      factory
    });
  }
  
  /**
   * Resolves a service by its identifier
   * @template T - The service type
   * @param {ServiceIdentifier<T>} identifier - Service identifier to resolve
   * @returns {T} The resolved service instance
   * @throws {ServiceResolutionError} If service is not registered
   * @throws {CircularDependencyError} If circular dependency is detected
   * @throws {Error} If container is disposed or service creation fails
   * @example
   * ```typescript
   * const logger = container.resolve<ILogger>('ILogger');
   * logger.log('Service resolved successfully');
   * ```
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    this.checkDisposed();
    
    // Check for circular dependencies
    if (this.resolutionStack.includes(identifier)) {
      throw new CircularDependencyError([...this.resolutionStack, identifier]);
    }
    
    try {
      this.resolutionStack.push(identifier);
      
      const descriptor = this.registry.get(identifier);
      if (!descriptor) {
        throw new ServiceResolutionError(identifier, 'Service not registered');
      }
      
      switch (descriptor.lifecycle) {
        case ServiceLifecycle.Singleton:
          return this.resolveSingleton(descriptor);
          
        case ServiceLifecycle.Transient:
          return this.resolveTransient(descriptor);
          
        case ServiceLifecycle.Scoped:
          return this.resolveScoped(descriptor);
          
        default:
          throw new ServiceResolutionError(identifier, `Unknown lifecycle: ${descriptor.lifecycle}`);
      }
    } finally {
      this.resolutionStack.pop();
    }
  }
  
  /**
   * Resolve a service asynchronously
   */
  async resolveAsync<T>(identifier: ServiceIdentifier<T>): Promise<T> {
    this.checkDisposed();
    
    // For async resolution, we wrap the sync resolution
    // The factory itself may return a Promise
    const result = this.resolve(identifier);
    return await Promise.resolve(result);
  }
  
  /**
   * Try to resolve a service
   */
  tryResolve<T>(identifier: ServiceIdentifier<T>): T | undefined {
    try {
      return this.resolve(identifier);
    } catch (error) {
      if (error instanceof ServiceResolutionError) {
        return undefined;
      }
      throw error;
    }
  }
  
  /**
   * Check if a service is registered
   */
  isRegistered(identifier: ServiceIdentifier): boolean {
    return this.registry.has(identifier);
  }
  
  /**
   * Create a scoped container
   */
  createScope(): IServiceContainer {
    this.checkDisposed();
    return new ServiceContainer(this);
  }
  
  /**
   * Dispose the container
   */
  dispose(): void {
    if (this.disposed) {return;}
    
    this.disposed = true;
    
    // Dispose all singleton instances
    this.disposeInstances(this.singletonInstances);
    
    // Dispose all scoped instances
    this.disposeInstances(this.scopedInstances);
    
    // Clear registrations if this is not a child container
    if (!this.parent) {
      this.registry.clear();
    }
  }
  
  /**
   * Resolve a singleton service
   */
  private resolveSingleton<T>(descriptor: ServiceDescriptor<T>): T {
    // Check parent container first
    if (this.parent) {
      const parentInstance = this.parent.singletonInstances.get(descriptor.identifier);
      if (parentInstance !== undefined) {
        return parentInstance;
      }
    }
    
    // Check local instances
    let instance = this.singletonInstances.get(descriptor.identifier);
    if (instance === undefined) {
      instance = descriptor.factory(this);
      this.singletonInstances.set(descriptor.identifier, instance);
    }
    
    return instance;
  }
  
  /**
   * Resolve a transient service
   */
  private resolveTransient<T>(descriptor: ServiceDescriptor<T>): T {
    return descriptor.factory(this);
  }
  
  /**
   * Resolve a scoped service
   */
  private resolveScoped<T>(descriptor: ServiceDescriptor<T>): T {
    let instance = this.scopedInstances.get(descriptor.identifier);
    if (instance === undefined) {
      instance = descriptor.factory(this);
      this.scopedInstances.set(descriptor.identifier, instance);
    }
    
    return instance;
  }
  
  /**
   * Dispose instances
   */
  private disposeInstances(instances: Map<ServiceIdentifier, any>): void {
    for (const [id, instance] of instances) {
      try {
        if (this.isDisposable(instance)) {
          instance.dispose();
        }
      } catch (error) {
        console.error(`Error disposing service '${String(id)}':`, error);
      }
    }
    instances.clear();
  }
  
  /**
   * Check if an object is disposable
   */
  private isDisposable(obj: any): obj is vscode.Disposable {
    return obj && typeof obj.dispose === 'function';
  }
  
  /**
   * Check if disposed
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('Container has been disposed');
    }
  }
}
/**
 * Service collection for fluent service registration
 */

import {
  IServiceCollection,
  IServiceContainer,
  ServiceIdentifier,
  ServiceFactory,
  ServiceDescriptor,
  ServiceLifecycle
} from './types';
import { ServiceContainer } from './ServiceContainer';

/**
 * Service collection implementation
 */
export class ServiceCollection implements IServiceCollection {
  private readonly descriptors: ServiceDescriptor[] = [];
  
  /**
   * Add a singleton service
   */
  addSingleton<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): IServiceCollection {
    this.descriptors.push({
      identifier,
      lifecycle: ServiceLifecycle.Singleton,
      factory
    });
    return this;
  }
  
  /**
   * Add a transient service
   */
  addTransient<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): IServiceCollection {
    this.descriptors.push({
      identifier,
      lifecycle: ServiceLifecycle.Transient,
      factory
    });
    return this;
  }
  
  /**
   * Add a scoped service
   */
  addScoped<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): IServiceCollection {
    this.descriptors.push({
      identifier,
      lifecycle: ServiceLifecycle.Scoped,
      factory
    });
    return this;
  }
  
  /**
   * Build the service container
   */
  buildServiceProvider(): IServiceContainer {
    const container = new ServiceContainer();
    
    // Register all services
    for (const descriptor of this.descriptors) {
      container.register(descriptor);
    }
    
    return container;
  }
}

/**
 * Create a new service collection
 */
export function createServiceCollection(): IServiceCollection {
  return new ServiceCollection();
}
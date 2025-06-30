/**
 * Service registry for managing service descriptors
 */

import { 
  ServiceIdentifier, 
  ServiceDescriptor, 
  ServiceLifecycle,
  ServiceFactory,
  ServiceMetadata
} from './types';

/**
 * Internal service registry
 */
export class ServiceRegistry {
  private readonly services = new Map<ServiceIdentifier, ServiceDescriptor>();
  private readonly aliases = new Map<string | symbol, ServiceIdentifier>();
  
  /**
   * Register a service descriptor
   */
  register<T>(descriptor: ServiceDescriptor<T>): void {
    this.services.set(descriptor.identifier, descriptor);
    
    // Register string/symbol aliases for constructor identifiers
    if (typeof descriptor.identifier === 'function') {
      const name = descriptor.identifier.name;
      if (name && !this.aliases.has(name)) {
        this.aliases.set(name, descriptor.identifier);
      }
      
      // Also register with metadata name if provided
      if (descriptor.metadata?.name && !this.aliases.has(descriptor.metadata.name)) {
        this.aliases.set(descriptor.metadata.name, descriptor.identifier);
      }
    }
  }
  
  /**
   * Get a service descriptor
   */
  get<T>(identifier: ServiceIdentifier<T>): ServiceDescriptor<T> | undefined {
    // Try direct lookup first
    let descriptor = this.services.get(identifier);
    
    // Try alias lookup if not found
    if (!descriptor && (typeof identifier === 'string' || typeof identifier === 'symbol')) {
      const aliasedId = this.aliases.get(identifier);
      if (aliasedId) {
        descriptor = this.services.get(aliasedId);
      }
    }
    
    return descriptor as ServiceDescriptor<T> | undefined;
  }
  
  /**
   * Check if a service is registered
   */
  has(identifier: ServiceIdentifier): boolean {
    return this.services.has(identifier) || 
           (typeof identifier === 'string' || typeof identifier === 'symbol') && this.aliases.has(identifier);
  }
  
  /**
   * Get all service descriptors
   */
  getAll(): ServiceDescriptor[] {
    return Array.from(this.services.values());
  }
  
  /**
   * Get services by lifecycle
   */
  getByLifecycle(lifecycle: ServiceLifecycle): ServiceDescriptor[] {
    return this.getAll().filter(desc => desc.lifecycle === lifecycle);
  }
  
  /**
   * Get service dependencies
   */
  getDependencies(identifier: ServiceIdentifier): ServiceIdentifier[] {
    const descriptor = this.get(identifier);
    return descriptor?.metadata?.dependencies || [];
  }
  
  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
    this.aliases.clear();
  }
  
  /**
   * Create a quick registration helper
   */
  static createDescriptor<T>(
    identifier: ServiceIdentifier<T>,
    lifecycle: ServiceLifecycle,
    factory: ServiceFactory<T>,
    metadata?: ServiceMetadata
  ): ServiceDescriptor<T> {
    return {
      identifier,
      lifecycle,
      factory,
      metadata
    };
  }
}
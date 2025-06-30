/**
 * Decorators for dependency injection
 */

import { ServiceIdentifier, ServiceLifecycle, Constructor } from './types';

/**
 * Service metadata storage
 */
const serviceMetadataMap = new WeakMap<Constructor, ServiceMetadata>();
const injectionTokensMap = new WeakMap<Constructor, ServiceIdentifier[]>();

/**
 * Service metadata
 */
interface ServiceMetadata {
  identifier?: ServiceIdentifier;
  lifecycle?: ServiceLifecycle;
  dependencies?: ServiceIdentifier[];
}

/**
 * Injectable decorator
 */
export function Injectable(
  identifier?: ServiceIdentifier,
  lifecycle: ServiceLifecycle = ServiceLifecycle.Singleton
): ClassDecorator {
  return (target: any) => {
    const metadata: ServiceMetadata = {
      identifier: identifier || target,
      lifecycle,
      dependencies: []
    };
    
    serviceMetadataMap.set(target, metadata);
    return target;
  };
}

/**
 * Singleton decorator
 */
export function Singleton(identifier?: ServiceIdentifier): ClassDecorator {
  return Injectable(identifier, ServiceLifecycle.Singleton);
}

/**
 * Transient decorator
 */
export function Transient(identifier?: ServiceIdentifier): ClassDecorator {
  return Injectable(identifier, ServiceLifecycle.Transient);
}

/**
 * Scoped decorator
 */
export function Scoped(identifier?: ServiceIdentifier): ClassDecorator {
  return Injectable(identifier, ServiceLifecycle.Scoped);
}

/**
 * Inject decorator for constructor parameters
 */
export function Inject(identifier: ServiceIdentifier): ParameterDecorator {
  return (target: any, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingTokens = injectionTokensMap.get(target) || [];
    existingTokens[parameterIndex] = identifier;
    injectionTokensMap.set(target, existingTokens);
  };
}

/**
 * Get service metadata
 */
export function getServiceMetadata(target: Constructor): ServiceMetadata | undefined {
  return serviceMetadataMap.get(target);
}

/**
 * Get injection tokens
 */
export function getInjectionTokens(target: Constructor): ServiceIdentifier[] {
  return injectionTokensMap.get(target) || [];
}
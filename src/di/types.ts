/**
 * Core types for the dependency injection system
 */

import * as vscode from 'vscode';

/**
 * Service lifecycle types
 */
export enum ServiceLifecycle {
  Singleton = 'singleton',
  Transient = 'transient',
  Scoped = 'scoped'
}

/**
 * Service identifier type
 */
export type ServiceIdentifier<T = any> = string | symbol | { new(...args: any[]): T };

/**
 * Service descriptor
 */
export interface ServiceDescriptor<T = any> {
  identifier: ServiceIdentifier<T>;
  lifecycle: ServiceLifecycle;
  factory: ServiceFactory<T>;
  metadata?: ServiceMetadata;
}

/**
 * Service factory function
 */
export type ServiceFactory<T> = (container: IServiceContainer) => T;

/**
 * Service metadata
 */
export interface ServiceMetadata {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: ServiceIdentifier[];
}

/**
 * Service container interface
 */
export interface IServiceContainer {
  /**
   * Register a service
   */
  register<T>(descriptor: ServiceDescriptor<T>): void;
  
  /**
   * Register a singleton service
   */
  registerSingleton<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
  
  /**
   * Register a transient service
   */
  registerTransient<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
  
  /**
   * Register a scoped service
   */
  registerScoped<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
  
  /**
   * Resolve a service
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T;
  
  /**
   * Resolve a service asynchronously
   */
  resolveAsync<T>(identifier: ServiceIdentifier<T>): Promise<T>;
  
  /**
   * Try to resolve a service
   */
  tryResolve<T>(identifier: ServiceIdentifier<T>): T | undefined;
  
  /**
   * Check if a service is registered
   */
  isRegistered(identifier: ServiceIdentifier): boolean;
  
  /**
   * Create a scoped container
   */
  createScope(): IServiceContainer;
  
  /**
   * Dispose the container
   */
  dispose(): void;
}

/**
 * Service provider interface
 */
export interface IServiceProvider {
  /**
   * Get a service
   */
  get<T>(identifier: ServiceIdentifier<T>): T;
  
  /**
   * Get a service asynchronously
   */
  getAsync<T>(identifier: ServiceIdentifier<T>): Promise<T>;
  
  /**
   * Try to get a service
   */
  tryGet<T>(identifier: ServiceIdentifier<T>): T | undefined;
}

/**
 * Disposable service interface
 */
export interface IDisposableService extends vscode.Disposable {
  /**
   * Check if the service is disposed
   */
  isDisposed: boolean;
}

/**
 * Initializable service interface
 */
export interface IInitializableService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;
}

/**
 * Service collection for registration
 */
export interface IServiceCollection {
  /**
   * Add a singleton service
   */
  addSingleton<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): IServiceCollection;
  
  /**
   * Add a transient service
   */
  addTransient<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): IServiceCollection;
  
  /**
   * Add a scoped service
   */
  addScoped<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): IServiceCollection;
  
  /**
   * Build the service container
   */
  buildServiceProvider(): IServiceContainer;
}

/**
 * Constructor type
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Service resolution error
 */
export class ServiceResolutionError extends Error {
  constructor(
    public readonly identifier: ServiceIdentifier,
    public readonly reason: string,
    public readonly innerError?: Error
  ) {
    super(`Failed to resolve service '${String(identifier)}': ${reason}`);
    this.name = 'ServiceResolutionError';
  }
}

/**
 * Circular dependency error
 */
export class CircularDependencyError extends Error {
  constructor(public readonly chain: ServiceIdentifier[]) {
    super(`Circular dependency detected: ${chain.map(id => String(id)).join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}
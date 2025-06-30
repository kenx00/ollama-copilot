/**
 * Main entry point for the dependency injection system
 */

export * from './types';
export * from './ServiceContainer';
export * from './ServiceRegistry';
export * from './ServiceCollection';
export * from './decorators';

// Service identifiers as symbols for type safety
export const SERVICE_IDENTIFIERS = {
  // Core services
  IServiceContainer: Symbol.for('IServiceContainer'),
  IResourceManager: Symbol.for('IResourceManager'),
  
  // API services
  IOllamaApiService: Symbol.for('IOllamaApiService'),
  
  // File services
  IFileService: Symbol.for('IFileService'),
  IAsyncFileService: Symbol.for('IAsyncFileService'),
  
  // Chat services
  IChatService: Symbol.for('IChatService'),
  IChatMessageHandler: Symbol.for('IChatMessageHandler'),
  
  // Completion services
  ICompletionService: Symbol.for('ICompletionService'),
  ICompletionProvider: Symbol.for('ICompletionProvider'),
  
  // Configuration services
  IConfigurationService: Symbol.for('IConfigurationService'),
  
  // Cache services
  ICacheService: Symbol.for('ICacheService'),
  
  // Model services
  IModelService: Symbol.for('IModelService'),
  
  // Validation services
  IValidationService: Symbol.for('IValidationService'),
  IValidationErrorHandler: Symbol.for('IValidationErrorHandler'),
  IConfigurationValidator: Symbol.for('IConfigurationValidator'),
  
  // Performance services
  IPerformanceMonitor: Symbol.for('IPerformanceMonitor'),
  IMemoryMonitor: Symbol.for('IMemoryMonitor'),
  
  // UI services
  IProgressIndicator: Symbol.for('IProgressIndicator'),
  IFileOperationStatusBar: Symbol.for('IFileOperationStatusBar'),
  
  // Rate limiting
  IRateLimiter: Symbol.for('IRateLimiter'),
  
  // Error handling and notifications
  IErrorHandlerService: Symbol.for('IErrorHandlerService'),
  INotificationService: Symbol.for('INotificationService'),
  
  // WebView services
  IWebViewService: Symbol.for('IWebViewService')
} as const;
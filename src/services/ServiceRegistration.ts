/**
 * Service registration helper for the dependency injection container
 */

import { IServiceContainer, SERVICE_IDENTIFIERS } from '../di';
import * as implementations from './implementations';
import { ResourceManager } from './ResourceManager';
import { MemoryMonitor } from '../utils/memoryMonitor';
import { RateLimiter } from '../utils/RateLimiter';

/**
 * Register all services in the container
 */
export function registerServices(container: IServiceContainer): void {
  // Core services
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IConfigurationService,
    () => new implementations.ConfigurationService()
  );
  
  container.registerSingleton(
    SERVICE_IDENTIFIERS.ICacheService,
    () => new implementations.CacheService()
  );
  
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IValidationService,
    () => new implementations.ValidationService()
  );
  
  // API services
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IOllamaApiService,
    (c) => new implementations.OllamaApiService(
      c.resolve(SERVICE_IDENTIFIERS.IConfigurationService)
    )
  );
  
  // Model service
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IModelService,
    (c) => new implementations.ModelService(
      c.resolve(SERVICE_IDENTIFIERS.IOllamaApiService),
      c.resolve(SERVICE_IDENTIFIERS.IConfigurationService),
      c.resolve(SERVICE_IDENTIFIERS.ICacheService)
    )
  );
  
  // File service
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IFileService,
    (c) => new implementations.FileService(
      c.resolve(SERVICE_IDENTIFIERS.IValidationService)
    )
  );
  
  // Chat service
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IChatService,
    (c) => new implementations.ChatService(
      c.resolve(SERVICE_IDENTIFIERS.IOllamaApiService),
      c.resolve(SERVICE_IDENTIFIERS.IFileService),
      c.resolve(SERVICE_IDENTIFIERS.IModelService)
    )
  );
  
  // Completion service
  container.registerSingleton(
    SERVICE_IDENTIFIERS.ICompletionService,
    (c) => new implementations.CompletionService(
      c.resolve(SERVICE_IDENTIFIERS.IOllamaApiService),
      c.resolve(SERVICE_IDENTIFIERS.IModelService),
      c.resolve(SERVICE_IDENTIFIERS.ICacheService),
      c.resolve(SERVICE_IDENTIFIERS.IConfigurationService)
    )
  );
  
  // Resource manager
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IResourceManager,
    () => new ResourceManager()
  );
  
  // Memory monitor
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IMemoryMonitor,
    () => new MemoryMonitor()
  );
  
  // Performance monitor
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IPerformanceMonitor,
    () => new implementations.PerformanceMonitorService()
  );
  
  // Rate limiter
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IRateLimiter,
    () => new RateLimiter()
  );
  
  // Progress indicators
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IProgressIndicator,
    () => new implementations.ProgressIndicatorService()
  );
  
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IFileOperationStatusBar,
    () => new implementations.FileOperationStatusBarService()
  );
  
  // Error handling and notifications
  container.registerSingleton(
    SERVICE_IDENTIFIERS.INotificationService,
    () => new implementations.NotificationService()
  );
  
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IErrorHandlerService,
    () => new implementations.ErrorHandlerService()
  );
  
  // WebView service
  container.registerSingleton(
    SERVICE_IDENTIFIERS.IWebViewService,
    (c) => new implementations.WebViewService(
      c.resolve(SERVICE_IDENTIFIERS.IFileService)
    )
  );
}

/**
 * Initialize services that need async initialization
 */
export async function initializeServices(container: IServiceContainer): Promise<void> {
  // Initialize model service with default model
  const modelService = container.tryResolve<any>(SERVICE_IDENTIFIERS.IModelService);
  if (modelService && typeof modelService.initializeDefaultModel === 'function') {
    await modelService.initializeDefaultModel();
  }
  
  // Validate configuration
  const configService = container.tryResolve<any>(SERVICE_IDENTIFIERS.IConfigurationService);
  if (configService && typeof configService.validate === 'function') {
    const result = await configService.validate();
    if (!result.isValid) {
      console.warn('Configuration validation errors:', result.errors);
    }
  }
}
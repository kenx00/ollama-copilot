# Error Handling and User Experience Guide

This guide explains how to use the enhanced error handling system in the Ollama Copilot extension.

## Overview

The error handling system provides:
- Centralized error management
- User-friendly error messages
- Structured error types with recovery suggestions
- Progress indicators with cancellation support
- Notification management with queuing and deduplication
- Global error boundary for unhandled errors

## Architecture

### Core Services

1. **IErrorHandlerService** - Central error handling
2. **INotificationService** - User notifications with queuing
3. **IProgressIndicator** - Enhanced progress tracking
4. **GlobalErrorBoundary** - Catches unhandled errors

### Error Flow

```
Error Occurs
    ↓
ErrorFactory.create() → Structured Error Type
    ↓
IErrorHandlerService.handleError()
    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│ Categorization  │ User Message     │ Recovery Actions│
│ & Logging       │ Generation       │ Generation      │
└─────────────────┴──────────────────┴─────────────────┘
    ↓
INotificationService → User Notification
```

## Usage Examples

### 1. Basic Error Handling

```typescript
import { IErrorHandlerService } from '../services/interfaces/IErrorHandlerService';
import { SERVICE_IDENTIFIERS } from '../di';

class MyService {
  constructor(
    @Inject(SERVICE_IDENTIFIERS.IErrorHandlerService)
    private errorHandler: IErrorHandlerService
  ) {}
  
  async doSomething(): Promise<void> {
    try {
      // Your code here
      await riskyOperation();
    } catch (error) {
      await this.errorHandler.handleError(
        error as Error,
        'MyService.doSomething',
        {
          showNotification: true,
          offerRetry: true
        }
      );
    }
  }
}
```

### 2. Using Custom Error Types

```typescript
import { ModelNotFoundError, NetworkError } from '../types/errors';

async function loadModel(modelName: string): Promise<void> {
  const response = await fetch(`/api/models/${modelName}`);
  
  if (response.status === 404) {
    throw new ModelNotFoundError(modelName);
  }
  
  if (!response.ok) {
    throw new NetworkError(
      `Failed to load model: ${response.statusText}`,
      response.status,
      response.url
    );
  }
}
```

### 3. Error Boundary Decorators

```typescript
import { ErrorBoundary, AsyncErrorBoundary } from '../utils/GlobalErrorBoundary';

class MyService {
  @ErrorBoundary('MyService.syncMethod')
  syncMethod(): void {
    // Errors are automatically caught and handled
    throw new Error('This will be caught');
  }
  
  @AsyncErrorBoundary('MyService.asyncMethod')
  async asyncMethod(): Promise<void> {
    // Async errors are automatically caught and handled
    throw new Error('This async error will be caught');
  }
}
```

### 4. Progress Indicators

```typescript
import { IProgressIndicator } from '../services/interfaces/IProgressIndicator';

async function longOperation(
  progressIndicator: IProgressIndicator
): Promise<void> {
  await progressIndicator.withProgress(
    'long-operation',
    {
      title: 'Processing files',
      cancellable: true,
      showPercentage: true
    },
    async (progress) => {
      const files = await getFiles();
      
      for (let i = 0; i < files.length; i++) {
        progress({
          message: `Processing ${files[i].name}`,
          increment: 100 / files.length
        });
        
        await processFile(files[i]);
      }
    }
  );
}
```

### 5. Notification Management

```typescript
import { INotificationService } from '../services/interfaces/INotificationService';

class MyService {
  constructor(
    @Inject(SERVICE_IDENTIFIERS.INotificationService)
    private notifications: INotificationService
  ) {}
  
  async notify(): Promise<void> {
    // Simple notification
    await this.notifications.showInfo('Operation completed');
    
    // With actions
    const result = await this.notifications.showWarning(
      'File has unsaved changes',
      {
        actions: [
          {
            label: 'Save',
            handler: () => this.saveFile()
          },
          {
            label: 'Discard',
            handler: () => this.discardChanges()
          }
        ]
      }
    );
    
    // Progress notification
    await this.notifications.showProgress(
      'Downloading model',
      async (progress, token) => {
        // Check for cancellation
        if (token.isCancellationRequested) {
          throw new CancellationError();
        }
        
        progress({ message: 'Starting download...', increment: 0 });
        // ... download logic
      }
    );
  }
}
```

## Error Categories

The system categorizes errors for better handling:

- **Network** - Connection issues, timeouts, API failures
- **FileSystem** - File not found, permission denied
- **Model** - Model not found, generation failures
- **Validation** - Input validation errors
- **Configuration** - Invalid settings
- **Memory** - Out of memory errors
- **Permission** - Access denied errors
- **Unknown** - Uncategorized errors

## Best Practices

### 1. Always Provide Context

```typescript
await this.errorHandler.handleError(error, 'ComponentName.methodName', {
  additionalContext: {
    userId: user.id,
    operation: 'save',
    timestamp: new Date()
  }
});
```

### 2. Use Appropriate Error Types

```typescript
// ❌ Bad
throw new Error('Model not found');

// ✅ Good
throw new ModelNotFoundError(modelName);
```

### 3. Provide Recovery Actions

```typescript
await this.errorHandler.handleError(error, 'Save File', {
  actions: [
    {
      label: 'Retry',
      action: () => this.retrySave()
    },
    {
      label: 'Save As...',
      action: () => this.saveAs()
    }
  ]
});
```

### 4. Handle Async Errors Properly

```typescript
// ❌ Bad - Error escapes
async function bad() {
  setTimeout(() => {
    throw new Error('This escapes');
  }, 100);
}

// ✅ Good - Error is caught
async function good() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        // risky operation
        resolve();
      } catch (error) {
        reject(error);
      }
    }, 100);
  });
}
```

### 5. Use Progress Indicators for Long Operations

```typescript
// ❌ Bad - No feedback
await longRunningOperation();

// ✅ Good - User sees progress
await progressIndicator.withProgress(
  'operation-id',
  { title: 'Processing...' },
  async (progress) => {
    await longRunningOperation(progress);
  }
);
```

## Configuration

Add these settings to your VS Code configuration:

```json
{
  "ollama.errorHandling.showNotifications": true,
  "ollama.errorHandling.maxErrors": 5,
  "ollama.errorHandling.errorWindow": 60000,
  "ollama.notifications.maxPerMinute": 10,
  "ollama.memory.warningThresholdMB": 200,
  "ollama.memory.criticalThresholdMB": 400
}
```

## Testing Error Handling

### 1. Test Error Scenarios

```typescript
describe('ErrorHandling', () => {
  it('should handle network errors', async () => {
    const errorHandler = container.resolve<IErrorHandlerService>(
      SERVICE_IDENTIFIERS.IErrorHandlerService
    );
    
    const spy = jest.spyOn(errorHandler, 'handleError');
    
    await service.methodThatMightFail();
    
    expect(spy).toHaveBeenCalledWith(
      expect.any(NetworkError),
      expect.any(String),
      expect.any(Object)
    );
  });
});
```

### 2. Mock Services

```typescript
const mockErrorHandler: IErrorHandlerService = {
  handleError: jest.fn().mockResolvedValue(true),
  createError: jest.fn(),
  // ... other methods
};

container.registerSingleton(
  SERVICE_IDENTIFIERS.IErrorHandlerService,
  () => mockErrorHandler
);
```

## Migration Guide

To migrate existing error handling:

1. Replace `console.error` with `errorHandler.handleError`
2. Replace `vscode.window.showErrorMessage` with `notificationService.showError`
3. Add error categorization using custom error types
4. Add recovery actions where appropriate
5. Use progress indicators for long operations

### Before:

```typescript
try {
  await operation();
} catch (error) {
  console.error('Operation failed:', error);
  vscode.window.showErrorMessage(`Error: ${error.message}`);
}
```

### After:

```typescript
try {
  await operation();
} catch (error) {
  await this.errorHandler.handleError(
    error as Error,
    'MyComponent.operation',
    {
      showNotification: true,
      offerRetry: true,
      actions: [{
        label: 'View Logs',
        action: () => this.errorHandler.showErrorLog()
      }]
    }
  );
}
```

## Troubleshooting

### Common Issues

1. **Too many notifications**
   - Adjust rate limiting: `notificationService.setRateLimit(5)`
   - Use status bar for low-priority messages

2. **Errors not being caught**
   - Ensure global error boundary is activated
   - Check async error handling patterns

3. **Memory leaks**
   - Dispose of event listeners properly
   - Clear notification history periodically

### Debug Mode

Enable debug logging:

```typescript
// In extension activation
if (context.extensionMode === vscode.ExtensionMode.Development) {
  errorHandler.registerGlobalHandler((error) => {
    console.debug('Error captured:', error);
  });
}
```

## Future Enhancements

1. **Telemetry Integration** - Anonymous error reporting
2. **Error Analytics** - Track error patterns
3. **Smart Recovery** - ML-based recovery suggestions
4. **Error Persistence** - Save error history across sessions
5. **Custom Error Pages** - Rich error displays in webviews
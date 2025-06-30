/**
 * Factory for creating view providers with dependency injection
 */

import * as vscode from 'vscode';
import { IServiceContainer, SERVICE_IDENTIFIERS } from '../../di';
import { DISidebarChatViewProvider } from '../../chatInterface/DISidebarChatViewProvider';
import { DIChatPanel } from '../../chatInterface/DIChatPanel';
import { IChatService } from '../../services/interfaces/IChatService';
import { IModelService } from '../../services/interfaces/IModelService';
import { IWebViewService } from '../../services/interfaces/IWebViewService';
import { INotificationService } from '../../services/interfaces/INotificationService';
import { IFileService } from '../../services/interfaces/IFileService';
import { IValidationService } from '../../services/interfaces/IValidationService';
import { IErrorHandlerService } from '../../services/interfaces/IErrorHandlerService';

/**
 * View provider factory
 */
export class ViewProviderFactory {
  constructor(private readonly container: IServiceContainer) {}
  
  /**
   * Create a sidebar chat view provider
   */
  createSidebarChatProvider(extensionUri: vscode.Uri): vscode.WebviewViewProvider { 
    // Resolve services from container
    const chatService = this.container.resolve<IChatService>(SERVICE_IDENTIFIERS.IChatService);
    const modelService = this.container.resolve<IModelService>(SERVICE_IDENTIFIERS.IModelService);
    const webViewService = this.container.resolve<IWebViewService>(SERVICE_IDENTIFIERS.IWebViewService);
    const notificationService = this.container.resolve<INotificationService>(SERVICE_IDENTIFIERS.INotificationService);
    const fileService = this.container.resolve<IFileService>(SERVICE_IDENTIFIERS.IFileService);
    const validationService = this.container.resolve<IValidationService>(SERVICE_IDENTIFIERS.IValidationService);
    const errorHandler = this.container.resolve<IErrorHandlerService>(SERVICE_IDENTIFIERS.IErrorHandlerService);
    
    // Create provider with injected dependencies
    return new DISidebarChatViewProvider(
      extensionUri,
      chatService,
      modelService,
      webViewService,
      notificationService,
      fileService,
      validationService,
      errorHandler
    );
  }
  
  /**
   * Register a sidebar chat view provider
   */
  registerSidebarChat(
    context: vscode.ExtensionContext,
    extensionUri: vscode.Uri
  ): vscode.Disposable {
    const provider = this.createSidebarChatProvider(extensionUri);
    
    const registration = vscode.window.registerWebviewViewProvider(
      DISidebarChatViewProvider.viewType,
      provider
    );
    
    context.subscriptions.push(registration);
    
    // Register the provider with resource manager if needed
    const resourceManager = this.container.tryResolve<any>(SERVICE_IDENTIFIERS.IResourceManager);
    if (resourceManager && resourceManager.register) {
      resourceManager.register(
        'sidebarChatViewProvider',
        provider as any,
        { name: 'Sidebar Chat View Provider', type: 'view-provider', priority: 10 }
      );
    }
    
    return registration;
  }
  
  /**
   * Create a chat panel
   */
  createChatPanel(extensionUri: vscode.Uri): DIChatPanel {
    // Resolve services from container
    const chatService = this.container.resolve<IChatService>(SERVICE_IDENTIFIERS.IChatService);
    const modelService = this.container.resolve<IModelService>(SERVICE_IDENTIFIERS.IModelService);
    const webViewService = this.container.resolve<IWebViewService>(SERVICE_IDENTIFIERS.IWebViewService);
    const notificationService = this.container.resolve<INotificationService>(SERVICE_IDENTIFIERS.INotificationService);
    const fileService = this.container.resolve<IFileService>(SERVICE_IDENTIFIERS.IFileService);
    const validationService = this.container.resolve<IValidationService>(SERVICE_IDENTIFIERS.IValidationService);
    const errorHandler = this.container.resolve<IErrorHandlerService>(SERVICE_IDENTIFIERS.IErrorHandlerService);
    
    // Create panel with injected dependencies
    return DIChatPanel.create(
      extensionUri,
      chatService,
      modelService,
      webViewService,
      notificationService,
      fileService,
      validationService,
      errorHandler
    );
  }
}

/**
 * Create a view provider factory
 */
export function createViewProviderFactory(container: IServiceContainer): ViewProviderFactory {
  return new ViewProviderFactory(container);
}
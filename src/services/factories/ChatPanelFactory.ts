/**
 * Factory for creating chat panels with dependency injection
 */

import * as vscode from 'vscode';
import { IServiceContainer, SERVICE_IDENTIFIERS } from '../../di';
import { IChatService } from '../interfaces/IChatService';
import { IModelService } from '../interfaces/IModelService';
import { IWebViewService } from '../interfaces/IWebViewService';
import { INotificationService } from '../interfaces/INotificationService';
import { IFileService } from '../interfaces/IFileService';
import { IValidationService } from '../interfaces/IValidationService';
import { IErrorHandlerService } from '../interfaces/IErrorHandlerService';
import { DIChatPanel } from '../../chatInterface/DIChatPanel';

/**
 * Chat panel factory
 */
export class ChatPanelFactory {
  private currentPanel: DIChatPanel | undefined;
  
  constructor(private readonly container: IServiceContainer) {}
  
  /**
   * Create or show the chat panel
   */
  createOrShow(extensionUri: vscode.Uri): DIChatPanel {
    // Check if current panel exists
    if (this.currentPanel) {
      this.currentPanel.reveal();
      return this.currentPanel;
    }
    
    // Get services from container
    const chatService = this.container.resolve<IChatService>(SERVICE_IDENTIFIERS.IChatService);
    const modelService = this.container.resolve<IModelService>(SERVICE_IDENTIFIERS.IModelService);
    const webViewService = this.container.resolve<IWebViewService>(SERVICE_IDENTIFIERS.IWebViewService);
    const notificationService = this.container.resolve<INotificationService>(SERVICE_IDENTIFIERS.INotificationService);
    const fileService = this.container.resolve<IFileService>(SERVICE_IDENTIFIERS.IFileService);
    const validationService = this.container.resolve<IValidationService>(SERVICE_IDENTIFIERS.IValidationService);
    const errorHandler = this.container.resolve<IErrorHandlerService>(SERVICE_IDENTIFIERS.IErrorHandlerService);
    
    // Create new panel
    const panel = this.createPanel(
      extensionUri,
      chatService,
      modelService,
      webViewService,
      notificationService,
      fileService,
      validationService,
      errorHandler
    );
    this.currentPanel = panel;
    
    return panel;
  }
  
  /**
   * Create a new chat panel
   */
  private createPanel(
    extensionUri: vscode.Uri,
    chatService: IChatService,
    modelService: IModelService,
    webViewService: IWebViewService,
    notificationService: INotificationService,
    fileService: IFileService,
    validationService: IValidationService,
    errorHandler: IErrorHandlerService
  ): DIChatPanel {
    // Create chat panel with injected services
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
 * Create a chat panel factory
 */
export function createChatPanelFactory(container: IServiceContainer): ChatPanelFactory {
  return new ChatPanelFactory(container);
}
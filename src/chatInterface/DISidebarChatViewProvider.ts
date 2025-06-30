/**
 * Dependency Injection-based Sidebar chat view provider
 */

import * as vscode from 'vscode';
import { DIBaseChatComponent } from './base/DIBaseChatComponent';
import { generateChatHTML } from '../utils/chatTemplates';
import { ChatComponentConfig } from '../interfaces/ChatInterfaces';
import { Logger } from '../utils/logger';
import { IChatService } from '../services/interfaces/IChatService';
import { IModelService } from '../services/interfaces/IModelService';
import { IWebViewService } from '../services/interfaces/IWebViewService';
import { INotificationService } from '../services/interfaces/INotificationService';
import { IFileService } from '../services/interfaces/IFileService';
import { IValidationService } from '../services/interfaces/IValidationService';
import { IErrorHandlerService } from '../services/interfaces/IErrorHandlerService';

/**
 * Manages the chat view in the sidebar with dependency injection
 */
export class DISidebarChatViewProvider extends DIBaseChatComponent implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ollamaChatView';
  private _view?: vscode.WebviewView;

  constructor(
    extensionUri: vscode.Uri,
    chatService: IChatService,
    modelService: IModelService,
    webViewService: IWebViewService,
    notificationService: INotificationService,
    fileService: IFileService,
    validationService: IValidationService,
    errorHandler: IErrorHandlerService
  ) {
    const config: ChatComponentConfig = {
      extensionUri,
      enableStreaming: false // Sidebar uses non-streaming for simplicity
    };
    
    super(
      config,
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
   * Resolves the webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    // Set options for the webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.config.extensionUri, 'media')]
    };

    // Set the HTML content
    webviewView.webview.html = generateChatHTML({
      extensionUri: this.config.extensionUri,
      webview: webviewView.webview,
      title: 'Ollama Chat',
      isSidebar: true
    });

    // Handle messages from the webview
    const messageListener = webviewView.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });
    this.track(messageListener);

    // Initialize the default model after the webview is ready
    this.initializeDefaultModel().catch((error) => {
      console.error('Error initializing default model:', error);
    });
  }

  /**
   * Get the webview
   */
  public getWebView(): vscode.Webview | undefined {
    return this._view?.webview;
  }

  /**
   * Get the webview view
   */
  public getWebViewView(): vscode.WebviewView | undefined {
    return this._view;
  }

  /**
   * Check if the view is visible
   */
  public isVisible(): boolean {
    return this._view?.visible ?? false;
  }

  /**
   * Show an error message
   */
  public showError(message: string): void {
    this.notificationService.showError(`Ollama Chat: ${message}`);
  }

  /**
   * Cleanup resources when disposed
   */
  protected onDispose(): void {
    Logger.info('DISidebarChatViewProvider', 'Disposing sidebar chat view provider');
    
    // Clear view reference
    this._view = undefined;
    
    // Call parent dispose
    super.onDispose();
  }
}
/**
 * Dependency Injection-based Chat panel implementation
 */

import * as vscode from 'vscode';
import { DIBaseChatComponent } from './base/DIBaseChatComponent';
import { generateChatHTML } from '../utils/chatTemplates';
import { ChatComponentConfig } from '../interfaces/ChatInterfaces';
import { IChatService } from '../services/interfaces/IChatService';
import { IModelService } from '../services/interfaces/IModelService';
import { IWebViewService } from '../services/interfaces/IWebViewService';
import { INotificationService } from '../services/interfaces/INotificationService';
import { IFileService } from '../services/interfaces/IFileService';
import { IValidationService } from '../services/interfaces/IValidationService';
import { IErrorHandlerService } from '../services/interfaces/IErrorHandlerService';

/**
 * Manages the chat panel webview with dependency injection
 */
export class DIChatPanel extends DIBaseChatComponent {
  private readonly _panel: vscode.WebviewPanel;

  /**
   * Private constructor
   */
  private constructor(
    panel: vscode.WebviewPanel,
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
      enableStreaming: true
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
    
    this._panel = panel;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this.track(
      this._panel.onDidDispose(() => this.dispose())
    );

    // Handle messages from the webview
    this.track(
      this._panel.webview.onDidReceiveMessage(async (message) => {
        await this.handleMessage(message);
      })
    );

    // Initialize with the default model
    this.initializeDefaultModel().catch(error => {
      console.error('Error initializing ChatPanel:', error);
    });
  }

  /**
   * Creates a new chat panel with injected services
   */
  public static create(
    extensionUri: vscode.Uri,
    chatService: IChatService,
    modelService: IModelService,
    webViewService: IWebViewService,
    notificationService: INotificationService,
    fileService: IFileService,
    validationService: IValidationService,
    errorHandler: IErrorHandlerService
  ): DIChatPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'ollamaChatPanel',
      'Ollama Chat',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'out')
        ],
        retainContextWhenHidden: true
      }
    );

    return new DIChatPanel(
      panel,
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
   * Reveal the panel
   */
  public reveal(column?: vscode.ViewColumn): void {
    this._panel.reveal(column);
  }

  /**
   * Get the webview
   */
  public getWebView(): vscode.Webview | undefined {
    return this._panel.webview;
  }

  /**
   * Get the webview view (panel in this case)
   */
  public getWebViewView(): vscode.WebviewPanel {
    return this._panel;
  }

  /**
   * Check if the panel is visible
   */
  public isVisible(): boolean {
    return this._panel.visible;
  }

  /**
   * Show an error message
   */
  public showError(message: string): void {
    this.notificationService.showError(`Ollama Chat: ${message}`);
  }

  /**
   * Updates the webview content
   */
  private _update(): void {
    this._panel.title = 'Ollama Chat';
    this._panel.webview.html = generateChatHTML({
      extensionUri: this.config.extensionUri,
      webview: this._panel.webview,
      title: 'Ollama Chat',
      isSidebar: false
    });
  }

  /**
   * Cleanup resources when disposed
   */
  protected onDispose(): void {
    // Call parent dispose
    super.onDispose();

    // Dispose the panel
    try {
      this._panel.dispose();
    } catch (error) {
      console.error('Error disposing webview panel:', error);
    }
  }
}
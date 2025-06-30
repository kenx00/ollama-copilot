/**
 * Dependency Injection-based abstract class for chat components
 * Provides shared functionality for ChatPanel and SidebarChatViewProvider
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Disposable } from '../../utils/Disposable';
import { Logger } from '../../utils/logger';
import { IChatService, ChatSession } from '../../services/interfaces/IChatService';
import { IModelService } from '../../services/interfaces/IModelService';
import { IWebViewService } from '../../services/interfaces/IWebViewService';
import { INotificationService } from '../../services/interfaces/INotificationService';
import { IFileService } from '../../services/interfaces/IFileService';
import { IValidationService } from '../../services/interfaces/IValidationService';
import { IErrorHandlerService } from '../../services/interfaces/IErrorHandlerService';
import { ChatEventManager } from '../../events/ChatEventManager';
import { ChatStateManager } from '../../state/ChatStateManager';
import { 
  ChatComponentConfig, 
  ChatEventType, 
  WebViewMessage,
} from '../../interfaces/ChatInterfaces';
import { toFilePath } from '../../types/guards';

/**
 * Abstract base class for chat components using dependency injection
 */
export abstract class DIBaseChatComponent extends Disposable {
  protected eventManager: ChatEventManager;
  protected stateManager: ChatStateManager;
  protected currentSession: ChatSession | null = null;
  protected streamListeners: vscode.Disposable[] = [];
  
  constructor(
    protected config: ChatComponentConfig,
    protected chatService: IChatService,
    protected modelService: IModelService,
    protected webViewService: IWebViewService,
    protected notificationService: INotificationService,
    protected fileService: IFileService,
    protected validationService: IValidationService,
    protected errorHandler: IErrorHandlerService
  ) {
    super();
    this.eventManager = this.track(new ChatEventManager());
    this.stateManager = this.track(new ChatStateManager());
    this.setupEventHandlers();
  }
  
  /**
   * Abstract methods that must be implemented by subclasses
   */
  abstract getWebView(): vscode.Webview | undefined;
  abstract getWebViewView(): vscode.WebviewView | vscode.WebviewPanel | undefined;
  abstract showError(message: string): void;
  abstract isVisible(): boolean;
  
  /**
   * Setup common event handlers
   */
  protected setupEventHandlers(): void {
    // Handle state changes
    this.track(
      this.stateManager.onStateChange(async (state) => {
        const webview = this.getWebView();
        if (webview) {
          await this.webViewService.postMessage(webview, {
            type: ChatEventType.UpdateModelInfo,
            payload: {
              models: this.modelService.getCachedModels(),
              selectedModel: state.selectedModel
            }
          });
        }
      })
    );
    
    // Handle model selection
    this.track(
      this.eventManager.on(ChatEventType.SelectModel, async (data) => {
        await this.handleModelSelection(data.model);
      })
    );
    
    // Handle new chat
    this.track(
      this.eventManager.on(ChatEventType.NewChat, async () => {
        await this.handleNewChat();
      })
    );
    
    // Handle file context
    this.track(
      this.eventManager.on(ChatEventType.AddFileContext, async () => {
        await this.handleAddFileContext();
      })
    );
    
    // Handle code selection
    this.track(
      this.eventManager.on(ChatEventType.SelectCodeForContext, async () => {
        await this.handleSelectCodeForContext();
      })
    );
    
    // Handle stop generation
    this.track(
      this.eventManager.on(ChatEventType.StopGeneration, () => {
        this.handleStopGeneration();
      })
    );
  }
  
  
  /**
   * Initialize default model
   */
  protected async initializeDefaultModel(): Promise<void> {
    Logger.info('DIBaseChatComponent', 'Initializing default model...');
    
    try {
      // First, try to send current state
      await this.sendModelInfoToWebview();
      
      const defaultModel = await this.modelService.initializeDefaultModel();
      Logger.info('DIBaseChatComponent', `Default model initialized: ${defaultModel}`);
      
      if (defaultModel) {
        this.stateManager.updateState({ selectedModel: defaultModel });
        await this.sendModelInfoToWebview();
      } else {
        Logger.error('DIBaseChatComponent', 'No models found');
        this.showErrorMessage('No models found. Please make sure Ollama has at least one model installed.');
        
        // Send empty model list to webview
        const webview = this.getWebView();
        if (webview) {
          await this.webViewService.postMessage(webview, {
            type: ChatEventType.ShowError,
            payload: {
              message: 'No Ollama models found. Please install at least one model.'
            }
          });
        }
      }
    } catch (error) {
      Logger.error('DIBaseChatComponent', 'Error initializing default model', error);
      this.showErrorMessage(`Failed to initialize models: ${error instanceof Error ? error.message : String(error)}`);
      
      // Retry after a delay
      setTimeout(() => {
        Logger.info('DIBaseChatComponent', 'Retrying model initialization...');
        this.initializeDefaultModel().catch(err => Logger.error('DIBaseChatComponent', 'Retry failed', err));
      }, 3000);
    }
  }
  
  /**
   * Send model info to webview
   */
  protected async sendModelInfoToWebview(): Promise<void> {
    const webview = this.getWebView();
    if (!webview) {
      Logger.warn('DIBaseChatComponent', 'No webview available to send model info');
      return;
    }
    
    Logger.info('DIBaseChatComponent', 'Sending model info to webview...');
    
    try {
      const models = await this.modelService.getAvailableModels();
      const state = this.stateManager.getState();
      
      Logger.info('DIBaseChatComponent', 'Sending models to webview', {
        modelCount: models.length,
        selectedModel: state.selectedModel,
        models: models.map(m => m.name)
      });
      
      const message = {
        type: ChatEventType.UpdateModelInfo,
        payload: {
          models: models,
          selectedModel: state.selectedModel
        }
      };
      
      await this.webViewService.postMessage(webview, message);
    } catch (error) {
      Logger.error('DIBaseChatComponent', 'Failed to send model info', error);
      
      // Send error state to webview
      const errorMessage = {
        type: ChatEventType.UpdateModelInfo,
        payload: {
          models: [],
          selectedModel: '',
          error: error instanceof Error ? error.message : 'Failed to load models'
        }
      };
      
      await this.webViewService.postMessage(webview, errorMessage);
    }
  }
  
  /**
   * Handle incoming messages from webview
   */
  protected async handleMessage(message: WebViewMessage): Promise<void> {
    switch (message.type) {
      case ChatEventType.SendMessage:
        await this.handleChatMessage(
          message.text || '',
          message.contextFiles || [],
          message.useWorkspace || false
        );
        break;
        
      case ChatEventType.SelectModel:
        await this.handleModelSelection(message.model || '');
        break;
        
      case ChatEventType.RequestModels:
        await this.sendModelInfoToWebview();
        break;
        
      case ChatEventType.AddFileContext:
        await this.handleAddFileContext();
        break;
        
      case ChatEventType.SelectCodeForContext:
        await this.handleSelectCodeForContext();
        break;
        
      case ChatEventType.StopGeneration:
        this.handleStopGeneration();
        break;
        
      case ChatEventType.NewChat:
        await this.handleNewChat();
        break;
    }
  }
  
  /**
   * Handle chat message
   */
  protected async handleChatMessage(
    text: string,
    contextFiles: string[],
    useWorkspace: boolean
  ): Promise<void> {
    const webview = this.getWebView();
    if (!webview) {return;}
    
    const state = this.stateManager.getState();
    if (!state.selectedModel) {
      this.showErrorMessage('No model selected. Please select a model first.');
      return;
    }
    
    // Create session if needed
    if (!this.currentSession) {
      this.currentSession = await this.chatService.createSession({
        model: state.selectedModel,
        contextFiles: contextFiles as any,
        useWorkspace: useWorkspace
      });
    }
    
    // Add user message to UI
    await this.webViewService.postMessage(webview, {
      type: ChatEventType.AddMessage,
      payload: {
        role: 'user',
        content: text
      }
    });
    
    try {
      // Show loading
      await this.webViewService.postMessage(webview, {
        type: ChatEventType.SetLoading,
        payload: {
          loading: true
        }
      });
      
      // Send message based on streaming preference
      if (this.config.enableStreaming !== false) {
        // Send thinking start event
        await this.webViewService.postMessage(webview, {
          type: ChatEventType.ThinkingStart
        });
        
        // Setup streaming
        this.setupStreamingListeners(webview);
        
        let fullContent = '';
        const startTime = Date.now();
        
        // Send message with streaming
        await this.chatService.sendMessageStream(
          this.currentSession.id,
          text,
          async (chunk) => {
            fullContent += chunk;
            
            // Send thinking update with progress info
            const elapsed = Date.now() - startTime;
            await this.webViewService.postMessage(webview, {
              type: ChatEventType.ThinkingUpdate,
              payload: {
                content: `Processing... (${Math.floor(elapsed / 1000)}s)`,
                status: `Generating response... ${fullContent.length} characters`
              }
            });
            
            // Update streaming content
            await this.webViewService.postMessage(webview, {
              type: ChatEventType.StreamContent,
              payload: {
                content: fullContent
              }
            });
          }
        );
        
        // Send thinking complete event
        await this.webViewService.postMessage(webview, {
          type: ChatEventType.ThinkingComplete
        });
        
        // Signal stream complete
        await this.webViewService.postMessage(webview, {
          type: ChatEventType.StreamComplete
        });
      } else {
        // Send message without streaming
        const response = await this.chatService.sendMessage(
          this.currentSession.id,
          text
        );
        
        await this.webViewService.postMessage(webview, {
          type: ChatEventType.AddMessage,
          payload: {
            role: 'assistant',
            content: response.content
          }
        });
      }
      
    } catch (error) {
      Logger.error('DIBaseChatComponent', 'Error processing message', error);
      this.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await this.webViewService.postMessage(webview, {
        type: ChatEventType.SetLoading,
        payload: {
          loading: false
        }
      });
      this.disposeStreamListeners();
    }
  }
  
  /**
   * Setup streaming listeners
   */
  protected setupStreamingListeners(webview: vscode.Webview): void {
    this.disposeStreamListeners();
    
    // Subscribe to chat events
    const disposable = this.chatService.onChatEvent(async (event) => {
      if (event.type === 'stream' && event.data?.chunk) {
        await this.webViewService.postMessage(webview, {
          type: ChatEventType.StreamContent,
          payload: {
            content: event.data.chunk
          }
        });
      } else if (event.type === 'complete') {
        await this.webViewService.postMessage(webview, {
          type: ChatEventType.StreamComplete
        });
      } else if (event.type === 'error') {
        this.showErrorMessage(event.error?.message || 'Unknown error occurred');
      }
    });
    
    this.streamListeners.push(disposable);
    this.track(disposable);
  }
  
  /**
   * Dispose stream listeners
   */
  protected disposeStreamListeners(): void {
    this.streamListeners.forEach(listener => {
      this.untrack(listener);
      listener.dispose();
    });
    this.streamListeners = [];
  }
  
  /**
   * Handle model selection
   */
  protected async handleModelSelection(model: string): Promise<void> {
    if (this.modelService.validateModel(model)) {
      await this.modelService.setSelectedModel(model);
      this.stateManager.updateState({ selectedModel: model });
      await this.sendModelInfoToWebview();
      
      // Update current session model if exists
      if (this.currentSession) {
        this.currentSession.model = model;
      }
    }
  }
  
  /**
   * Handle new chat
   */
  protected async handleNewChat(): Promise<void> {
    const webview = this.getWebView();
    if (!webview) {return;}
    
    // Clear chat UI
    await this.webViewService.postMessage(webview, {
      type: ChatEventType.ClearChat
    });
    
    // Reset state
    this.stateManager.updateState({
      messages: [],
      contextFiles: []
    });
    
    // Create new session
    const state = this.stateManager.getState();
    if (state.selectedModel) {
      this.currentSession = await this.chatService.createSession({
        model: state.selectedModel
      });
    } else {
      this.currentSession = null;
    }
  }
  
  /**
   * Handle adding file context
   */
  protected async handleAddFileContext(): Promise<void> {
    const webview = this.getWebView();
    if (!webview) {return;}
    
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Add to Context',
      filters: {
        'Code Files': ['ts', 'js', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php'],
        'Text Files': ['txt', 'md', 'json', 'xml', 'yaml', 'yml'],
        'All Files': ['*']
      }
    });
    
    if (files && files.length > 0) {
      const validatedFiles: string[] = [];
      
      for (const file of files) {
        const validation = await this.validationService.validateFilePath(file.fsPath, {
          mustExist: true,
          requireWorkspace: true
        });
        
        if (validation.isValid && validation.value) {
          validatedFiles.push(validation.value);
        } else {
          await this.notificationService.showWarning(
            `File excluded: ${path.basename(file.fsPath)} - ${validation.errors[0]?.message || 'Invalid file'}`
          );
        }
      }
      
      if (validatedFiles.length > 0 && this.currentSession) {
        // Add files to current session
        await this.chatService.addContextFiles(this.currentSession.id, validatedFiles.map(f => toFilePath(f)));
        
        // Update state
        const currentFiles = this.stateManager.getState().contextFiles;
        const updatedFiles = [...new Set([...currentFiles, ...validatedFiles])];
        
        this.stateManager.updateState({ contextFiles: updatedFiles });
        await this.webViewService.postMessage(webview, {
          type: ChatEventType.UpdateContextFiles,
          payload: {
            files: updatedFiles
          }
        });
      }
    }
  }
  
  /**
   * Handle selecting code for context
   */
  protected async handleSelectCodeForContext(): Promise<void> {
    const webview = this.getWebView();
    if (!webview) {return;}
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.showErrorMessage('No active editor to select code from');
      return;
    }
    
    const selection = editor.selection;
    if (selection.isEmpty) {
      this.showErrorMessage('No code selected');
      return;
    }
    
    const selectedText = editor.document.getText(selection);
    const fileName = editor.document.fileName;
    
    await this.webViewService.postMessage(webview, {
      type: ChatEventType.AddCodeSelection,
      payload: {
        code: selectedText,
        fileName: path.basename(fileName)
      }
    });
  }
  
  /**
   * Handle stop generation
   */
  protected async handleStopGeneration(): Promise<void> {
    const webview = this.getWebView();
    if (!webview) {return;}
    
    // Stop generation in chat service
    if (this.currentSession) {
      this.chatService.stopGeneration(this.currentSession.id);
    }
    
    // Dispose stream listeners
    this.disposeStreamListeners();
    
    // Notify webview
    await this.webViewService.postMessage(webview, {
      type: ChatEventType.GenerationCancelled
    });
    
    await this.webViewService.postMessage(webview, {
      type: ChatEventType.SetLoading,
      payload: {
        loading: false
      }
    });
  }
  
  /**
   * Show error message
   */
  protected async showErrorMessage(message: string): Promise<void> {
    const webview = this.getWebView();
    
    this.showError(message);
    
    if (webview) {
      await this.webViewService.postMessage(webview, {
        type: ChatEventType.ShowError,
        payload: {
          message: message
        }
      });
    }
  }
  
  /**
   * Get memory stats
   */
  public getMemoryStats(): any {
    return {
      state: this.stateManager.getState(),
      streamListenersCount: this.streamListeners.length,
      hasCurrentSession: !!this.currentSession,
      currentSessionId: this.currentSession?.id,
      servicesLoaded: {
        chatService: !!this.chatService,
        modelService: !!this.modelService,
        webViewService: !!this.webViewService,
        notificationService: !!this.notificationService,
        fileService: !!this.fileService,
        validationService: !!this.validationService,
        eventManager: !!this.eventManager,
        stateManager: !!this.stateManager
      }
    };
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    this.disposeStreamListeners();
    this.eventManager.removeAllListeners();
    Logger.info('DIBaseChatComponent', `${this.constructor.name} disposed`);
  }
}
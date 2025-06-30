/**
 * Common interfaces for chat components
 */

import * as vscode from 'vscode';

/**
 * WebView message types
 */
export interface WebViewMessage {
  type: string;
  text?: string;
  model?: string;
  contextFiles?: string[];
  useWorkspace?: boolean;
  loading?: boolean;
  role?: string;
  content?: string;
  message?: string;
  error?: string;
  files?: string[];
  code?: string;
  fileName?: string;
  [key: string]: any;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  contextFiles?: string[];
}

/**
 * Model info interface
 */
export interface ModelInfo {
  label: string;
  details?: string;
}

/**
 * Chat state interface
 */
export interface ChatState {
  selectedModel: string;
  contextFiles: string[];
  messages: ChatMessage[];
  isLoading: boolean;
  useWorkspace: boolean;
}

/**
 * WebView options interface
 */
export interface WebViewOptions {
  enableScripts: boolean;
  localResourceRoots: vscode.Uri[];
  retainContextWhenHidden?: boolean;
}

/**
 * Chat component configuration
 */
export interface ChatComponentConfig {
  extensionUri: vscode.Uri;
  defaultModel?: string;
  maxContextFiles?: number;
  enableStreaming?: boolean;
}

/**
 * Message handler options
 */
export interface MessageHandlerOptions {
  streaming?: boolean;
  timeout?: number;
  maxRetries?: number;
}

/**
 * File context interface
 */
export interface FileContext {
  path: string;
  content?: string;
  language?: string;
}

/**
 * Code selection interface
 */
export interface CodeSelection {
  code: string;
  fileName: string;
  language?: string;
  range?: vscode.Range;
}

/**
 * Chat event types
 */
export enum ChatEventType {
  SendMessage = 'sendMessage',
  SelectModel = 'selectModel',
  AddFileContext = 'addFileContext',
  SelectCodeForContext = 'selectCodeForContext',
  NewChat = 'newChat',
  StopGeneration = 'stopGeneration',
  RequestModels = 'requestModels',
  UpdateContextFiles = 'updateContextFiles',
  AddCodeSelection = 'addCodeSelection',
  ClearChat = 'clearChat',
  SetLoading = 'setLoading',
  AddMessage = 'addMessage',
  UpdateModelInfo = 'updateModelInfo',
  ShowError = 'showError',
  StreamContent = 'streamContent',
  StreamComplete = 'streamComplete',
  GenerationCancelled = 'generationCancelled',
  ThinkingStart = 'thinkingStart',
  ThinkingUpdate = 'thinkingUpdate',
  ThinkingComplete = 'thinkingComplete'
}

/**
 * Service interfaces
 */
export interface IMessageService {
  processMessage(
    text: string,
    model: string,
    contextFiles: string[],
    useWorkspace: boolean
  ): Promise<string>;
  validateMessage(message: string): Promise<boolean>;
  formatMessage(message: ChatMessage): string;
  onStream(callback: (content: string) => void): vscode.Disposable;
  onStreamComplete(callback: (fullContent: string) => void): vscode.Disposable;
  stopGeneration(): void;
  dispose(): void;
}

export interface IModelService {
  getAvailableModels(): Promise<ModelInfo[]>;
  getSelectedModel(): string;
  setSelectedModel(model: string): void;
  initializeDefaultModel(): Promise<string | undefined>;
  validateModel(model: string): boolean;
}

export interface IWebViewService {
  postMessage(webview: vscode.Webview | undefined, message: WebViewMessage): void;
  createWebViewOptions(extensionUri: vscode.Uri): WebViewOptions;
  handleMessage(message: WebViewMessage): Promise<void>;
}

export interface IStateManager {
  getState(): ChatState;
  updateState(updates: Partial<ChatState>): void;
  resetState(): void;
  onStateChange(callback: (state: ChatState) => void): vscode.Disposable;
}

export interface IEventManager {
  emit(event: ChatEventType, data?: any): void;
  on(event: ChatEventType, handler: (data?: any) => void): vscode.Disposable;
  removeAllListeners(event?: ChatEventType): void;
}
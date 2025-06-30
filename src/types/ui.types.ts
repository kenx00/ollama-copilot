/**
 * @file UI component type definitions
 * @module types/ui
 * @description Type definitions for UI components and webview communication
 */

import * as vscode from 'vscode';
import { JsonValue } from './index';

/**
 * Webview message types
 */
export enum WebviewMessageType {
  // From webview to extension
  Ready = 'ready',
  Command = 'command',
  Request = 'request',
  Error = 'error',
  Log = 'log',
  
  // From extension to webview
  Response = 'response',
  Update = 'update',
  Notification = 'notification',
  Theme = 'theme',
  Config = 'config'
}

/**
 * Base webview message structure
 */
export interface WebviewMessage {
  /** Message type */
  type: WebviewMessageType;
  /** Unique message ID for request/response correlation */
  id?: string;
  /** Message timestamp */
  timestamp: number;
}

/**
 * Command message from webview
 */
export interface WebviewCommandMessage extends WebviewMessage {
  type: WebviewMessageType.Command;
  /** Command name */
  command: string;
  /** Command arguments */
  args?: JsonValue;
}

/**
 * Request message from webview
 */
export interface WebviewRequestMessage extends WebviewMessage {
  type: WebviewMessageType.Request;
  /** Request method */
  method: string;
  /** Request parameters */
  params?: JsonValue;
}

/**
 * Response message to webview
 */
export interface WebviewResponseMessage extends WebviewMessage {
  type: WebviewMessageType.Response;
  /** Request ID this responds to */
  requestId: string;
  /** Response data */
  data?: JsonValue;
  /** Error information if request failed */
  error?: {
    code: string;
    message: string;
    details?: JsonValue;
  };
}

/**
 * Update message to webview
 */
export interface WebviewUpdateMessage extends WebviewMessage {
  type: WebviewMessageType.Update;
  /** Update target */
  target: string;
  /** Update data */
  data: JsonValue;
  /** Whether to replace or merge */
  replace?: boolean;
}

/**
 * Theme information for webview
 */
export interface WebviewTheme {
  /** VS Code theme kind */
  kind: vscode.ColorThemeKind;
  /** CSS variables for theming */
  cssVariables: Record<string, string>;
  /** Whether high contrast is active */
  isHighContrast: boolean;
}

/**
 * Webview state that persists across sessions
 */
export interface WebviewState {
  /** State version for migrations */
  version: number;
  /** Actual state data */
  data: Record<string, JsonValue>;
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Webview panel options
 */
export interface WebviewPanelOptions {
  /** Panel title */
  title: string;
  /** View column */
  viewColumn?: vscode.ViewColumn;
  /** Whether to preserve focus */
  preserveFocus?: boolean;
  /** Webview options */
  webviewOptions?: vscode.WebviewOptions;
  /** Icon path */
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
}

/**
 * Chat UI message
 */
export interface ChatUIMessage {
  /** Message ID */
  id: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: number;
  /** Whether message is being streamed */
  isStreaming?: boolean;
  /** Error state */
  error?: string;
  /** Additional metadata */
  metadata?: {
    model?: string;
    tokens?: number;
    duration?: number;
    [key: string]: JsonValue | undefined;
  };
}

/**
 * Chat UI state
 */
export interface ChatUIState {
  /** Active session ID */
  sessionId?: string;
  /** Chat messages */
  messages: ChatUIMessage[];
  /** Whether waiting for response */
  isLoading: boolean;
  /** Current model */
  model?: string;
  /** Available models */
  models: Array<{ id: string; name: string; description?: string }>;
  /** Input state */
  input: {
    value: string;
    isValid: boolean;
    error?: string;
  };
  /** UI preferences */
  preferences: {
    fontSize: number;
    showTimestamps: boolean;
    showMetadata: boolean;
    enableMarkdown: boolean;
  };
}

/**
 * Progress indicator options
 */
export interface ProgressOptions {
  /** Progress title */
  title: string;
  /** Progress location */
  location?: vscode.ProgressLocation;
  /** Whether cancellable */
  cancellable?: boolean;
  /** Progress buttons */
  buttons?: Array<{
    label: string;
    tooltip?: string;
    action: () => void | Promise<void>;
  }>;
}

/**
 * Quick pick item with metadata
 * @template T The metadata type
 */
export interface QuickPickItemWithData<T = unknown> extends vscode.QuickPickItem {
  /** Associated data */
  data: T;
  /** Item icon */
  iconPath?: vscode.Uri | vscode.ThemeIcon;
  /** Whether item is default selection */
  isDefault?: boolean;
}

/**
 * Input box options with validation
 */
export interface InputBoxOptions extends vscode.InputBoxOptions {
  /** Async validation function */
  validateInputAsync?: (value: string) => Promise<string | undefined>;
  /** Debounce delay for validation */
  validationDelay?: number;
  /** History of previous inputs */
  history?: string[];
  /** Auto-complete suggestions */
  suggestions?: string[] | ((value: string) => string[] | Promise<string[]>);
}

/**
 * Status bar item configuration
 */
export interface StatusBarItemConfig {
  /** Item ID */
  id: string;
  /** Item text */
  text: string;
  /** Tooltip text */
  tooltip?: string;
  /** Command to execute on click */
  command?: string | { command: string; arguments?: any[] };
  /** Alignment */
  alignment?: vscode.StatusBarAlignment;
  /** Priority */
  priority?: number;
  /** Background color */
  backgroundColor?: vscode.ThemeColor;
  /** Whether to show */
  show?: boolean;
}

/**
 * Tree view node
 * @template T The node data type
 */
export interface TreeNode<T = unknown> {
  /** Node ID */
  id: string;
  /** Display label */
  label: string;
  /** Node description */
  description?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Icon */
  icon?: vscode.ThemeIcon | vscode.Uri;
  /** Collapsible state */
  collapsibleState?: vscode.TreeItemCollapsibleState;
  /** Context value for commands */
  contextValue?: string;
  /** Node data */
  data: T;
  /** Child nodes */
  children?: TreeNode<T>[];
  /** Parent node ID */
  parentId?: string;
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Notification type */
  type: 'info' | 'warning' | 'error';
  /** Message text */
  message: string;
  /** Detail text */
  detail?: string;
  /** Action buttons */
  actions?: Array<{
    label: string;
    action: () => void | Promise<void>;
    isCloseAffordance?: boolean;
  }>;
  /** Auto-hide timeout in milliseconds */
  timeout?: number;
  /** Whether modal */
  modal?: boolean;
}

/**
 * Editor decoration options
 */
export interface DecorationOptions {
  /** Decoration type */
  type: 'inline' | 'line' | 'gutter';
  /** CSS classes */
  className?: string;
  /** Inline text */
  inlineText?: string;
  /** Hover message */
  hoverMessage?: string | vscode.MarkdownString;
  /** Gutter icon */
  gutterIconPath?: vscode.Uri;
  /** Color */
  color?: vscode.ThemeColor;
  /** Whether to show in overview ruler */
  overviewRuler?: boolean;
}

/**
 * Webview resource loader
 */
export interface WebviewResourceLoader {
  /** Get URI for webview resource */
  getUri(resource: vscode.Uri): vscode.Uri;
  /** Get nonce for CSP */
  getNonce(): string;
  /** Get CSP source */
  getCspSource(): string;
  /** Load HTML template */
  loadHtml(templatePath: string, replacements?: Record<string, string>): string;
  /** Load CSS */
  loadCss(cssPath: string): string;
  /** Load JavaScript */
  loadScript(scriptPath: string): string;
}

/**
 * UI component lifecycle
 */
export interface UIComponentLifecycle {
  /** Called when component is created */
  onCreate?(): void | Promise<void>;
  /** Called when component is shown */
  onShow?(): void | Promise<void>;
  /** Called when component is hidden */
  onHide?(): void | Promise<void>;
  /** Called when component is disposed */
  onDispose?(): void | Promise<void>;
  /** Called when theme changes */
  onThemeChange?(theme: vscode.ColorTheme): void | Promise<void>;
  /** Called when configuration changes */
  onConfigChange?(config: vscode.WorkspaceConfiguration): void | Promise<void>;
}
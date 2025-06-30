/**
 * @file WebView service interface
 * @module services/interfaces/IWebViewService
 * @description Provides utilities for managing webview communication
 */

import * as vscode from 'vscode';
import { IDisposable } from '../../types/IDisposable';

/**
 * WebView message types
 */
export interface WebViewMessage {
  type: string;
  payload?: any;
}

/**
 * WebView service interface for managing webview communication
 */
export interface IWebViewService extends IDisposable {
  /**
   * Post a message to a webview
   * @param webview - The webview to post to
   * @param message - The message to post
   * @returns Promise resolving when message is posted
   */
  postMessage(webview: vscode.Webview, message: WebViewMessage): Promise<void>;
  
  /**
   * Create a message handler for webview messages
   * @param webview - The webview to handle messages from
   * @param handler - The message handler function
   * @returns Disposable to remove the handler
   */
  onMessage(
    webview: vscode.Webview,
    handler: (message: WebViewMessage) => void | Promise<void>
  ): vscode.Disposable;
  
  /**
   * Generate a nonce for Content Security Policy
   * @returns A unique nonce string
   */
  getNonce(): string;
  
  /**
   * Get webview options with security settings
   * @param extensionUri - The extension URI
   * @returns Webview options
   */
  getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions;
  
  /**
   * Create HTML content with proper CSP and scripts
   * @param webview - The webview instance
   * @param extensionUri - The extension URI
   * @param htmlPath - Path to the HTML file
   * @returns The processed HTML content
   */
  getHtmlContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    htmlPath: string
  ): Promise<string>;
}
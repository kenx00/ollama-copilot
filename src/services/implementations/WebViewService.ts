/**
 * WebView service implementation
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import { IWebViewService, WebViewMessage } from '../interfaces/IWebViewService';
import { IFileService } from '../interfaces/IFileService';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton, Inject } from '../../di/decorators';
import { getNonce } from '../../utils/nonce';
import { Logger } from '../../utils/logger';

/**
 * WebView service implementation
 */
@Singleton(SERVICE_IDENTIFIERS.IWebViewService)
export class WebViewService extends Disposable implements IWebViewService {
  constructor(
    @Inject(SERVICE_IDENTIFIERS.IFileService)
    private readonly fileService: IFileService
  ) {
    super();
  }
  
  /**
   * Post a message to a webview
   */
  async postMessage(webview: vscode.Webview, message: WebViewMessage): Promise<void> {
    Logger.debug('WebViewService', 'Posting message to webview', {
      type: message.type,
      hasPayload: !!message.payload,
      payloadKeys: message.payload ? Object.keys(message.payload) : []
    });
    
    try {
      const result = await webview.postMessage(message);
      Logger.debug('WebViewService', `Message posted successfully: ${result}`);
    } catch (error) {
      Logger.error('WebViewService', 'Failed to post message to webview', error);
      throw new Error('Failed to communicate with webview');
    }
  }
  
  /**
   * Create a message handler for webview messages
   */
  onMessage(
    webview: vscode.Webview,
    handler: (message: WebViewMessage) => void | Promise<void>
  ): vscode.Disposable {
    const disposable = webview.onDidReceiveMessage(async (message) => {
      try {
        await handler(message);
      } catch (error) {
        console.error('Error handling webview message:', error);
      }
    });
    
    this.track(disposable);
    
    return new vscode.Disposable(() => {
      disposable.dispose();
    });
  }
  
  /**
   * Generate a nonce for Content Security Policy
   */
  getNonce(): string {
    return getNonce();
  }
  
  /**
   * Get webview options with security settings
   */
  getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'media'),
        vscode.Uri.joinPath(extensionUri, 'out')
      ]
    };
  }
  
  /**
   * Create HTML content with proper CSP and scripts
   */
  async getHtmlContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    htmlPath: string
  ): Promise<string> {
    try {
      // Read the HTML file
      const result = await this.fileService.readFile(htmlPath);
      if (!result.success || !result.data) {
        throw new Error(`Failed to read HTML file: ${result.error?.message}`);
      }
      
      let html = result.data;
      
      // Replace local resource paths
      const mediaUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media'));
      const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out'));
      
      html = html.replace(/\${mediaUri}/g, mediaUri.toString());
      html = html.replace(/\${scriptUri}/g, scriptUri.toString());
      
      // Add CSP if not present
      if (!html.includes('Content-Security-Policy')) {
        const nonce = this.getNonce();
        const csp = `
          <meta http-equiv="Content-Security-Policy" content="
            default-src 'none';
            style-src ${webview.cspSource} 'unsafe-inline';
            script-src 'nonce-${nonce}';
            font-src ${webview.cspSource};
            img-src ${webview.cspSource} https: data:;
            connect-src http://localhost:* http://127.0.0.1:*;
          ">
        `;
        
        // Add nonce to all script tags
        html = html.replace(/<script/g, `<script nonce="${nonce}"`);
        
        // Insert CSP after head tag
        html = html.replace(/<head>/, `<head>${csp}`);
      }
      
      return html;
    } catch (error) {
      console.error('Error creating HTML content:', error);
      throw new Error(`Failed to create webview content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Cleanup handled by base class
  }
}
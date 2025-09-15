/**
 * Template utilities for generating chat UI HTML
 */

import * as vscode from 'vscode';
import { getNonce } from './nonce';

/**
 * Options for generating chat HTML
 */
export interface ChatHtmlOptions {
  extensionUri: vscode.Uri;
  webview: vscode.Webview;
  title: string;
  isSidebar?: boolean;
  additionalStyles?: string;
  additionalScripts?: string;
}

/**
 * Generate the complete HTML for the chat interface
 */
export function generateChatHTML(options: ChatHtmlOptions): string {
  const { extensionUri, webview, title, isSidebar = false } = options;
  
  // Get resource URIs
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat.js')
  );
  
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat.css')
  );
  
  // Generate nonce for CSP
  const nonce = getNonce();
  
  // Generate CSP
  const csp = generateCSP(webview, nonce);
  
  // Generate container class
  const containerClass = isSidebar ? 'container sidebar-container' : 'container';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <link href="${styleUri}" rel="stylesheet">
    ${options.additionalStyles || ''}
    <title>${title}</title>
</head>
<body>
    <div class="${containerClass}">
        ${generateHeader(isSidebar)}
        ${generateContextControls(isSidebar)}
        ${generateContextFilesList()}
        ${generateChatContainer()}
    </div>
    
    <script nonce="${nonce}" src="${scriptUri}"></script>
    ${options.additionalScripts || ''}
</body>
</html>`;
}

/**
 * Generate Content Security Policy
 */
export function generateCSP(webview: vscode.Webview, nonce: string): string {
  return [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource}`,
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ');
}

/**
 * Generate the header section with model selector
 */
export function generateHeader(isSidebar: boolean): string {
  return `
    <div class="header">
        <div class="model-selector">
            <label for="model-select">Model:</label>
            <select id="model-select" name="model-select">
                <option value="" disabled selected>Loading models...</option>
            </select>
        </div>
        ${!isSidebar ? `
        <div class="context-controls">
            <button id="add-file-btn">Add File Context</button>
            <button id="select-code-btn">Use Selected Code</button>
            <button id="new-chat-btn">New Chat</button>
            <label for="use-workspace">
                <input type="checkbox" id="use-workspace" />
                @workspace
            </label>
        </div>
        ` : ''}
    </div>`;
}

/**
 * Generate context controls for sidebar
 */
export function generateContextControls(isSidebar: boolean): string {
  if (!isSidebar) {return '';}
  
  return `
    <div class="context-controls">
        <button id="add-file-btn" title="Add File Context">📎</button>
        <button id="select-code-btn" title="Use Selected Code">📄</button>
        <button id="new-chat-btn" title="Start New Chat">🔄</button>
        <label for="use-workspace" title="Search workspace">
            <input type="checkbox" id="use-workspace" />
            @workspace
        </label>
    </div>`;
}

/**
 * Generate context files list
 */
export function generateContextFilesList(): string {
  return `
    <div class="context-files">
        <h4>Context Files:</h4>
        <ul id="context-files-list"></ul>
    </div>`;
}

/**
 * Generate chat container
 */
export function generateChatContainer(): string {
  return `
    <div class="chat-container">
        <div id="chat-messages"></div>
        
        <div class="input-container">
            <textarea id="message-input" placeholder="Ask a question about your code..."></textarea>
            <button id="send-button">Send</button>
        </div>
    </div>`;
}

/**
 * Generate a model selector option
 */
export function generateModelOption(model: string, selected: boolean = false): string {
  return `<option value="${model}" ${selected ? 'selected' : ''}>${model}</option>`;
}

/**
 * Generate a context file item
 */
export function generateContextFileItem(filePath: string): string {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  return `<li title="${filePath}">${fileName}</li>`;
}

/**
 * Generate a chat message element
 */
export function generateChatMessage(role: 'user' | 'assistant', content: string): string {
  return `
    <div class="message ${role}-message">
        <div class="message-role">${role === 'user' ? 'You' : 'Assistant'}</div>
        <div class="message-content">${escapeHtml(content)}</div>
    </div>`;
}

/**
 * Generate loading indicator
 */
export function generateLoadingIndicator(): string {
  return `
    <div class="loading-indicator">
        <div class="spinner"></div>
        <span>Thinking...</span>
    </div>`;
}

/**
 * Generate error message
 */
export function generateErrorMessage(message: string): string {
  return `
    <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span class="error-text">${escapeHtml(message)}</span>
    </div>`;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
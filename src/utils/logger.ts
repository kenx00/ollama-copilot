/**
 * Logger utility for consistent logging across the extension
 */

import * as vscode from 'vscode';

/**
 * Logger class that writes to VS Code output channel
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel | undefined;
  
  /**
   * Initialize the logger with an output channel
   */
  static initialize(channel: vscode.OutputChannel): void {
    this.outputChannel = channel;
  }
  
  /**
   * Get the output channel, creating one if needed
   */
  private static getChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      // Try to get from global
      this.outputChannel = (global as any).ollamaOutputChannel;
      
      // Create if still not available
      if (!this.outputChannel) {
        this.outputChannel = vscode.window.createOutputChannel('Ollama Copilot');
      }
    }
    return this.outputChannel;
  }
  
  /**
   * Log an info message
   */
  static info(context: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [INFO] [${context}] ${message}`;
    
    if (args.length > 0) {
      this.getChannel().appendLine(formattedMessage + ' ' + JSON.stringify(args));
    } else {
      this.getChannel().appendLine(formattedMessage);
    }
  }
  
  /**
   * Log an error message
   */
  static error(context: string, message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [ERROR] [${context}] ${message}`;
    
    this.getChannel().appendLine(formattedMessage);
    
    if (error) {
      if (error instanceof Error) {
        this.getChannel().appendLine(`  Error: ${error.message}`);
        if (error.stack) {
          this.getChannel().appendLine(`  Stack: ${error.stack}`);
        }
      } else {
        this.getChannel().appendLine(`  Error: ${JSON.stringify(error)}`);
      }
    }
  }
  
  /**
   * Log a warning message
   */
  static warn(context: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [WARN] [${context}] ${message}`;
    
    if (args.length > 0) {
      this.getChannel().appendLine(formattedMessage + ' ' + JSON.stringify(args));
    } else {
      this.getChannel().appendLine(formattedMessage);
    }
  }
  
  /**
   * Log a debug message
   */
  static debug(context: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [DEBUG] [${context}] ${message}`;
    
    if (args.length > 0) {
      this.getChannel().appendLine(formattedMessage + ' ' + JSON.stringify(args));
    } else {
      this.getChannel().appendLine(formattedMessage);
    }
  }
}
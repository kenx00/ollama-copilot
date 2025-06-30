/**
 * Dependency Injection based Inline Completion Provider
 */

import * as vscode from 'vscode';
import { Disposable } from '../utils/Disposable';
import { ICompletionService, CompletionContext } from '../services/interfaces/ICompletionService';
import { IConfigurationService } from '../services/interfaces/IConfigurationService';
import { IModelService } from '../services/interfaces/IModelService';

export class DIInlineCompletionProvider extends Disposable implements vscode.InlineCompletionItemProvider {
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 200; // ms
  
  constructor(
    private readonly completionService: ICompletionService,
    private readonly modelService: IModelService,
    private readonly configService: IConfigurationService
  ) {
    super();
    
    // Clean up on dispose
    this.track({
      dispose: () => {
        if (this.debounceTimeout) {
          clearTimeout(this.debounceTimeout);
          this.debounceTimeout = null;
        }
      }
    });
  }
  
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    // Check if inline completion is enabled
    const enabled = this.configService.get<boolean>('enableInlineCompletion', true);
    if (!enabled) {
      return undefined;
    }
    
    // Cancel any pending requests
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Check if we should provide completions for this context
    if (!this.shouldProvideCompletion(document, position, context)) {
      return undefined;
    }
    
    return new Promise((resolve) => {
      this.debounceTimeout = setTimeout(async () => {
        this.debounceTimeout = null;
        
        try {
          // Check if a model is selected
          const model = this.modelService.getSelectedModel();
          if (!model) {
            console.log('[DIInlineCompletionProvider] No model selected');
            vscode.window.showWarningMessage('No Ollama model selected. Please select a model first.');
            resolve(undefined);
            return;
          }
          
          console.log(`[DIInlineCompletionProvider] Using model: ${model}`);
          
          // Build completion context
          const completionContext = this.buildCompletionContext(document, position);
          
          // Get completion from service
          console.log('[DIInlineCompletionProvider] Requesting completion...');
          const result = await this.completionService.getCompletion(completionContext);
          
          if (token.isCancellationRequested) {
            console.log('[DIInlineCompletionProvider] Request cancelled');
            resolve(undefined);
            return;
          }
          
          if (!result || !result.text) {
            console.log('[DIInlineCompletionProvider] No result or empty text');
            resolve(undefined);
            return;
          }
          
          console.log(`[DIInlineCompletionProvider] Got completion: ${result.text.substring(0, 50)}...`);
          
          // Create inline completion item
          const range = new vscode.Range(position, position);
          const item = new vscode.InlineCompletionItem(result.text, range);
          
          resolve([item]);
        } catch (error) {
          console.error('[DIInlineCompletionProvider] Error:', error);
          if (error instanceof Error) {
            console.error('[DIInlineCompletionProvider] Stack:', error.stack);
          }
          resolve(undefined);
        }
      }, this.DEBOUNCE_DELAY);
    });
  }
  
  /**
   * Check if we should provide completion for this context
   */
  private shouldProvideCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext
  ): boolean {
    // Don't provide completions in comments or strings (basic check)
    const lineText = document.lineAt(position.line).text;
    const linePrefix = lineText.substring(0, position.character);
    
    // Skip if line is likely a comment
    if (linePrefix.trim().startsWith('//') || linePrefix.trim().startsWith('#') || 
        linePrefix.trim().startsWith('/*') || linePrefix.trim().startsWith('*')) {
      return false;
    }
    
    // Skip if we're in a string (basic check)
    const quoteCount = (linePrefix.match(/['"]/g) || []).length;
    if (quoteCount % 2 !== 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Build completion context from document and position
   */
  private buildCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): CompletionContext {
    // Get prefix (everything before cursor)
    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    
    // Get suffix (everything after cursor)
    const suffix = document.getText(new vscode.Range(
      position,
      new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
    ));
    
    // Detect indentation
    const indentation = this.detectIndentation(document);
    
    return {
      document,
      position,
      prefix,
      suffix,
      language: document.languageId,
      indentation
    };
  }
  
  /**
   * Detect indentation style from document
   */
  private detectIndentation(document: vscode.TextDocument): string {
    // Try to detect from existing lines
    const text = document.getText();
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('\t')) {
        return '\t';
      }
      const match = line.match(/^(\s+)/);
      if (match && match[1].length > 0) {
        // Detect common indentation sizes
        if (match[1].length >= 4) {return '    ';}
        if (match[1].length >= 2) {return '  ';}
      }
    }
    
    // Default to 2 spaces
    return '  ';
  }
  
  /**
   * Clean up resources on dispose
   */
  protected onDispose(): void {
    // Cleanup is handled by the disposable added in constructor
  }
  
  /**
   * Clear the completion cache
   */
  clearCache(): void {
    this.completionService.clearCache();
  }
  
  /**
   * Get memory stats for monitoring
   */
  getMemoryStats(): {
    hasPendingDebounce: boolean;
    cacheStats: any;
  } {
    return {
      hasPendingDebounce: this.debounceTimeout !== null,
      cacheStats: this.completionService.getCacheStats()
    };
  }
}
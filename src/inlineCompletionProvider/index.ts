/**
 * Inline completion provider registration with dependency injection
 */

import * as vscode from 'vscode';
import { IServiceContainer, SERVICE_IDENTIFIERS } from '../di';
import { ICompletionService } from '../services/interfaces/ICompletionService';
import { CompletionProviderFactory } from '../services/factories/CompletionProviderFactory';

/**
 * Register inline completion provider using dependency injection
 */
export function registerInlineCompletionProvider(
  context: vscode.ExtensionContext,
  container: IServiceContainer
): vscode.Disposable {
  // Create factory
  const factory = new CompletionProviderFactory(container);
  
  // Register the provider
  const registration = factory.register(context);
  
  // Return the registration for disposal
  return registration;
}

/**
 * Get the completion service
 */
export function getCompletionService(container: IServiceContainer): ICompletionService {
  return container.resolve<ICompletionService>(SERVICE_IDENTIFIERS.ICompletionService);
}

/**
 * Clear completion cache command handler
 */
export function createClearCacheCommand(container: IServiceContainer): () => void {
  return () => {
    const completionService = getCompletionService(container);
    completionService.clearCache();
    vscode.window.showInformationMessage('Ollama Copilot: Completion cache cleared');
  };
}

// Remove global state - no more exported completionProvider variable
/**
 * Factory for creating completion providers with dependency injection
 */

import * as vscode from 'vscode';
import { IServiceContainer, SERVICE_IDENTIFIERS } from '../../di';
import { ICompletionService } from '../interfaces/ICompletionService';
import { IModelService } from '../interfaces/IModelService';
import { IConfigurationService } from '../interfaces/IConfigurationService';
import { DIInlineCompletionProvider } from '../../inlineCompletionProvider/DIInlineCompletionProvider';

/**
 * Completion provider factory
 */
export class CompletionProviderFactory {
  constructor(private readonly container: IServiceContainer) {}
  
  /**
   * Create a completion provider
   */
  create(): vscode.InlineCompletionItemProvider {
    // Get services from container
    const completionService = this.container.resolve<ICompletionService>(SERVICE_IDENTIFIERS.ICompletionService);
    const modelService = this.container.resolve<IModelService>(SERVICE_IDENTIFIERS.IModelService);
    const configService = this.container.resolve<IConfigurationService>(SERVICE_IDENTIFIERS.IConfigurationService);
    
    // Create provider with injected dependencies
    return new DIInlineCompletionProvider(
      completionService,
      modelService,
      configService
    );
  }
  
  /**
   * Register the completion provider
   */
  register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = this.create();
    
    const registration = vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      provider
    );
    
    context.subscriptions.push(registration);
    
    // Register the provider with resource manager if available
    const resourceManager = this.container.tryResolve<any>(SERVICE_IDENTIFIERS.IResourceManager);
    if (resourceManager && resourceManager.register) {
      resourceManager.register(
        'inlineCompletionProvider',
        provider as any,
        { name: 'Inline Completion Provider', type: 'completion-provider', priority: 10 }
      );
    }
    
    return registration;
  }
}

/**
 * Create a completion provider factory
 */
export function createCompletionProviderFactory(container: IServiceContainer): CompletionProviderFactory {
  return new CompletionProviderFactory(container);
}
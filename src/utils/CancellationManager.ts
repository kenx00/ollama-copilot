/**
 * Cancellation token management for file operations
 */

import * as vscode from 'vscode';

export interface ManagedCancellationToken {
  id: string;
  token: vscode.CancellationToken;
  source: vscode.CancellationTokenSource;
  createdAt: Date;
  timeout?: NodeJS.Timeout;
  children: Set<string>;
  parent?: string;
}

/**
 * Manages cancellation tokens with cascading support and timeout handling
 */
export class CancellationManager {
  private readonly tokens = new Map<string, ManagedCancellationToken>();
  private readonly defaultTimeout = 300000; // 5 minutes

  /**
   * Creates a new cancellation token
   */
  createToken(
    id: string,
    options?: {
      timeout?: number;
      parent?: string;
      onCancelled?: () => void;
    }
  ): vscode.CancellationToken {
    // Cancel existing token with same ID if exists
    this.cancel(id);

    const source = new vscode.CancellationTokenSource();
    const managedToken: ManagedCancellationToken = {
      id,
      token: source.token,
      source,
      createdAt: new Date(),
      children: new Set(),
      parent: options?.parent
    };

    // Set up timeout if specified
    if (options?.timeout !== undefined) {
      managedToken.timeout = setTimeout(() => {
        this.cancel(id, 'Operation timed out');
      }, options.timeout || this.defaultTimeout);
    }

    // Set up cancellation callback
    if (options?.onCancelled) {
      source.token.onCancellationRequested(options.onCancelled);
    }

    // Link to parent if specified
    if (options?.parent) {
      const parentToken = this.tokens.get(options.parent);
      if (parentToken) {
        parentToken.children.add(id);
        
        // Cancel child if parent is cancelled
        parentToken.token.onCancellationRequested(() => {
          this.cancel(id, 'Parent operation cancelled');
        });
      }
    }

    this.tokens.set(id, managedToken);
    return source.token;
  }

  /**
   * Gets an existing cancellation token
   */
  getToken(id: string): vscode.CancellationToken | undefined {
    return this.tokens.get(id)?.token;
  }

  /**
   * Cancels a token and all its children
   */
  cancel(id: string, reason?: string): void {
    const managedToken = this.tokens.get(id);
    if (!managedToken) {
      return;
    }

    // Clear timeout if exists
    if (managedToken.timeout) {
      clearTimeout(managedToken.timeout);
    }

    // Cancel the token
    managedToken.source.cancel();

    // Cancel all children recursively
    for (const childId of managedToken.children) {
      this.cancel(childId, `Parent cancelled: ${reason || 'No reason provided'}`);
    }

    // Remove from parent's children if applicable
    if (managedToken.parent) {
      const parent = this.tokens.get(managedToken.parent);
      if (parent) {
        parent.children.delete(id);
      }
    }

    // Remove from registry
    this.tokens.delete(id);

    console.log(`Cancelled operation ${id}: ${reason || 'User requested'}`);
  }

  /**
   * Cancels all tokens
   */
  cancelAll(reason?: string): void {
    const ids = Array.from(this.tokens.keys());
    for (const id of ids) {
      this.cancel(id, reason || 'All operations cancelled');
    }
  }

  /**
   * Creates a linked cancellation token that cancels when any of the sources cancel
   */
  createLinkedToken(
    id: string,
    sources: vscode.CancellationToken[]
  ): vscode.CancellationToken {
    const source = new vscode.CancellationTokenSource();
    
    // Cancel if any source cancels
    for (const sourceToken of sources) {
      sourceToken.onCancellationRequested(() => {
        source.cancel();
      });
    }

    const managedToken: ManagedCancellationToken = {
      id,
      token: source.token,
      source,
      createdAt: new Date(),
      children: new Set()
    };

    this.tokens.set(id, managedToken);
    return source.token;
  }

  /**
   * Checks if a token is cancelled
   */
  isCancelled(id: string): boolean {
    const token = this.tokens.get(id);
    return token ? token.token.isCancellationRequested : false;
  }

  /**
   * Gets active token count
   */
  getActiveTokenCount(): number {
    return this.tokens.size;
  }

  /**
   * Cleans up expired tokens
   */
  cleanup(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, token] of this.tokens) {
      const age = now - token.createdAt.getTime();
      if (age > maxAge && !token.token.isCancellationRequested) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.cancel(id, 'Token expired');
    }

    console.log(`Cleaned up ${toRemove.length} expired cancellation tokens`);
  }

  /**
   * Creates a progress-aware cancellation token
   */
  async createProgressToken(
    id: string,
    options?: {
      title?: string;
      cancellable?: boolean;
      location?: vscode.ProgressLocation;
    }
  ): Promise<vscode.CancellationToken> {
    return new Promise((resolve) => {
      vscode.window.withProgress(
        {
          location: options?.location || vscode.ProgressLocation.Notification,
          title: options?.title || 'Processing...',
          cancellable: options?.cancellable !== false
        },
        async (progress, token) => {
          const managedToken = this.createToken(id, {
            onCancelled: () => {
              progress.report({ message: 'Cancelling...' });
            }
          });

          // Link VS Code's progress token to our managed token
          token.onCancellationRequested(() => {
            this.cancel(id, 'User cancelled via progress notification');
          });

          resolve(managedToken);
          
          // Keep progress open until token is cancelled
          while (!managedToken.isCancellationRequested) {
            await new Promise(r => setTimeout(r, 100));
          }
        }
      );
    });
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.cancelAll('Service disposing');
    this.tokens.clear();
  }
}
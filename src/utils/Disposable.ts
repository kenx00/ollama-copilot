/**
 * Base disposable class for proper resource management in VS Code extensions
 * Implements the Disposable pattern with automatic tracking of child disposables
 */

import * as vscode from 'vscode';

export abstract class Disposable implements vscode.Disposable {
  private disposed = false;
  protected disposables: vscode.Disposable[] = [];

  /**
   * Tracks a disposable resource that should be cleaned up when this object is disposed
   */
  protected track<T extends vscode.Disposable>(disposable: T): T {
    if (this.disposed) {
      // If already disposed, dispose the new disposable immediately
      disposable.dispose();
      throw new Error('Cannot track disposables on a disposed object');
    }
    this.disposables.push(disposable);
    return disposable;
  }

  /**
   * Tracks multiple disposable resources
   */
  protected trackAll(...disposables: vscode.Disposable[]): void {
    disposables.forEach(d => this.track(d));
  }

  /**
   * Creates and tracks a disposable from a cleanup function
   */
  protected registerDisposable(dispose: () => void): vscode.Disposable {
    const disposable = new vscode.Disposable(dispose);
    return this.track(disposable);
  }

  /**
   * Removes a disposable from tracking (does not dispose it)
   */
  protected untrack(disposable: vscode.Disposable): boolean {
    const index = this.disposables.indexOf(disposable);
    if (index !== -1) {
      this.disposables.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Disposes all tracked resources
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Call the subclass's disposal logic first
    this.onDispose();

    // Then dispose all tracked disposables in reverse order
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        try {
          disposable.dispose();
        } catch (error) {
          console.error('Error disposing resource:', error);
        }
      }
    }
  }

  /**
   * Subclasses should override this to add their specific disposal logic
   */
  protected abstract onDispose(): void;

  /**
   * Checks if this object has been disposed
   */
  public isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Throws an error if this object has been disposed
   */
  protected checkDisposed(): void {
    if (this.disposed) {
      throw new Error(`Cannot use disposed ${this.constructor.name}`);
    }
  }
}

/**
 * A collection that automatically disposes its items
 */
export class DisposableCollection extends Disposable {
  private items = new Set<vscode.Disposable>();

  /**
   * Adds an item to the collection
   */
  public add(item: vscode.Disposable): void {
    this.checkDisposed();
    this.items.add(item);
  }

  /**
   * Removes an item from the collection without disposing it
   */
  public remove(item: vscode.Disposable): boolean {
    return this.items.delete(item);
  }

  /**
   * Clears all items, optionally disposing them
   */
  public clear(dispose = true): void {
    if (dispose) {
      this.items.forEach(item => {
        try {
          item.dispose();
        } catch (error) {
          console.error('Error disposing item:', error);
        }
      });
    }
    this.items.clear();
  }

  protected onDispose(): void {
    this.clear(true);
  }

  public get size(): number {
    return this.items.size;
  }
}
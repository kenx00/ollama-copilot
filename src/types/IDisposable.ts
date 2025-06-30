/**
 * Interface for disposable resources
 * Re-exports VS Code's Disposable interface for consistency
 */

import { Disposable } from 'vscode';

export interface IDisposable extends Disposable {
  /**
   * Dispose of the resource
   */
  dispose(): void;
}

/**
 * IDisposable type for use in interfaces
 */
export type { IDisposable as IDisposableService };
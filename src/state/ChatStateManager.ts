/**
 * State manager for chat components
 */

import * as vscode from 'vscode';
import { Disposable } from '../utils/Disposable';
import { ChatState, IStateManager } from '../interfaces/ChatInterfaces';

type StateChangeCallback = (state: ChatState) => void;

export class ChatStateManager extends Disposable implements IStateManager {
  private state: ChatState = {
    selectedModel: '',
    contextFiles: [],
    messages: [],
    isLoading: false,
    useWorkspace: false
  };
  
  private stateChangeCallbacks: StateChangeCallback[] = [];
  
  /**
   * Get the current state
   */
  public getState(): ChatState {
    return { ...this.state };
  }
  
  /**
   * Update the state
   */
  public updateState(updates: Partial<ChatState>): void {
    const previousState = { ...this.state };
    
    // Apply updates
    this.state = {
      ...this.state,
      ...updates
    };
    
    // Check if state actually changed
    if (this.hasStateChanged(previousState, this.state)) {
      this.notifyStateChange();
    }
  }
  
  /**
   * Reset the state
   */
  public resetState(): void {
    this.state = {
      selectedModel: this.state.selectedModel, // Keep selected model
      contextFiles: [],
      messages: [],
      isLoading: false,
      useWorkspace: false
    };
    
    this.notifyStateChange();
  }
  
  /**
   * Register a state change callback
   */
  public onStateChange(callback: StateChangeCallback): vscode.Disposable {
    this.stateChangeCallbacks.push(callback);
    
    // Immediately call with current state
    callback(this.getState());
    
    return new vscode.Disposable(() => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    });
  }
  
  /**
   * Add a message to the state
   */
  public addMessage(role: 'user' | 'assistant', content: string): void {
    this.updateState({
      messages: [
        ...this.state.messages,
        {
          role,
          content,
          timestamp: Date.now()
        }
      ]
    });
  }
  
  /**
   * Add a context file
   */
  public addContextFile(filePath: string): void {
    if (!this.state.contextFiles.includes(filePath)) {
      this.updateState({
        contextFiles: [...this.state.contextFiles, filePath]
      });
    }
  }
  
  /**
   * Remove a context file
   */
  public removeContextFile(filePath: string): void {
    this.updateState({
      contextFiles: this.state.contextFiles.filter(f => f !== filePath)
    });
  }
  
  /**
   * Clear all messages
   */
  public clearMessages(): void {
    this.updateState({ messages: [] });
  }
  
  /**
   * Clear all context files
   */
  public clearContextFiles(): void {
    this.updateState({ contextFiles: [] });
  }
  
  /**
   * Set loading state
   */
  public setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }
  
  /**
   * Toggle workspace usage
   */
  public toggleWorkspace(): void {
    this.updateState({ useWorkspace: !this.state.useWorkspace });
  }
  
  /**
   * Check if state has changed
   */
  private hasStateChanged(prev: ChatState, curr: ChatState): boolean {
    return JSON.stringify(prev) !== JSON.stringify(curr);
  }
  
  /**
   * Notify all callbacks of state change
   */
  private notifyStateChange(): void {
    const currentState = this.getState();
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(currentState);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  }
  
  /**
   * Get state statistics
   */
  public getStateStats(): any {
    return {
      messageCount: this.state.messages.length,
      contextFileCount: this.state.contextFiles.length,
      isLoading: this.state.isLoading,
      selectedModel: this.state.selectedModel,
      useWorkspace: this.state.useWorkspace,
      callbackCount: this.stateChangeCallbacks.length
    };
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    this.stateChangeCallbacks = [];
  }
}
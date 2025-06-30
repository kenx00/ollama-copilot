/**
 * Event manager for chat components
 */

import * as vscode from 'vscode';
import { Disposable } from '../utils/Disposable';
import { ChatEventType, IEventManager } from '../interfaces/ChatInterfaces';

type EventHandler = (data?: any) => void;

export class ChatEventManager extends Disposable implements IEventManager {
  private eventHandlers: Map<ChatEventType, EventHandler[]> = new Map();
  
  /**
   * Emit an event
   */
  public emit(event: ChatEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    
    // Call all handlers for this event
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
  
  /**
   * Register an event handler
   */
  public on(event: ChatEventType, handler: EventHandler): vscode.Disposable {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    
    const handlers = this.eventHandlers.get(event)!;
    handlers.push(handler);
    
    // Return disposable to remove handler
    return new vscode.Disposable(() => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      
      // Clean up empty handler arrays
      if (handlers.length === 0) {
        this.eventHandlers.delete(event);
      }
    });
  }
  
  /**
   * Remove all listeners for an event
   */
  public removeAllListeners(event?: ChatEventType): void {
    if (event) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.clear();
    }
  }
  
  /**
   * Get the number of listeners for an event
   */
  public listenerCount(event: ChatEventType): number {
    const handlers = this.eventHandlers.get(event);
    return handlers ? handlers.length : 0;
  }
  
  /**
   * Get all registered events
   */
  public getRegisteredEvents(): ChatEventType[] {
    return Array.from(this.eventHandlers.keys());
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    this.eventHandlers.clear();
  }
}
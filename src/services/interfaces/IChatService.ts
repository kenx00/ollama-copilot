/**
 * @file Chat service interface definitions
 * @module services/interfaces/IChatService
 * @description Defines the contract for chat functionality including session management,
 * message handling, and context management.
 */

import * as vscode from 'vscode';
import { ChatMessage } from './IOllamaApiService';
import { SessionId, FilePath } from '../../types/index';

/**
 * Represents a chat session with an Ollama model
 * @interface ChatSession
 * @property {string} id - Unique session identifier
 * @property {ChatMessage[]} messages - Conversation history
 * @property {string} model - Model name/ID being used
 * @property {Date} createdAt - Session creation timestamp
 * @property {Date} lastMessageAt - Timestamp of last message
 * @property {string[]} [contextFiles] - Optional files providing context
 */
export interface ChatSession {
  id: SessionId;
  messages: ChatMessage[];
  model: string;
  createdAt: Date;
  lastMessageAt: Date;
  contextFiles?: FilePath[];
}

/**
 * Configuration options for creating a chat session
 * @interface ChatOptions
 * @property {string} model - Model to use for the session
 * @property {string[]} [contextFiles] - Files to include as context
 * @property {boolean} [useWorkspace] - Whether to include workspace context
 * @property {boolean} [stream] - Whether to stream responses
 * @property {number} [temperature] - Model temperature (0.0-2.0)
 */
export interface ChatOptions {
  model: string;
  contextFiles?: FilePath[];
  useWorkspace?: boolean;
  stream?: boolean;
  temperature?: number;
}

/**
 * Event emitted during chat operations
 * @interface ChatEvent
 * @property {'message' | 'stream' | 'error' | 'complete'} type - Event type
 * @property {string} sessionId - Session that triggered the event
 * @property {any} [data] - Event-specific data
 * @property {Error} [error] - Error information if applicable
 */
export type ChatEventType = 'message' | 'stream' | 'error' | 'complete';

export interface ChatEventData {
  message?: ChatMessage;
  chunk?: string;
  progress?: number;
}

export interface ChatEvent {
  type: ChatEventType;
  sessionId: SessionId;
  data?: ChatEventData;
  error?: Error;
}

/**
 * Service interface for managing chat sessions with Ollama models
 * @interface IChatService
 * @extends {vscode.Disposable}
 * @description Provides comprehensive chat functionality including:
 * - Session lifecycle management
 * - Message sending with optional streaming
 * - Context file management
 * - Session import/export
 * - Real-time event notifications
 */
export interface IChatService extends vscode.Disposable {
  /**
   * Creates a new chat session
   * @param {ChatOptions} options - Session configuration
   * @returns {Promise<ChatSession>} The created session
   * @throws {Error} If no model is selected or session creation fails
   * @example
   * ```typescript
   * const session = await chatService.createSession({
   *   model: 'llama2',
   *   contextFiles: ['/path/to/context.md'],
   *   useWorkspace: true
   * });
   * ```
   */
  createSession(options: ChatOptions): Promise<ChatSession>;
  
  /**
   * Retrieves a chat session by ID
   * @param {string} sessionId - Session identifier
   * @returns {ChatSession | undefined} The session if found
   * @example
   * ```typescript
   * const session = chatService.getSession('session-123');
   * if (session) {
   *   console.log(`Session has ${session.messages.length} messages`);
   * }
   * ```
   */
  getSession(sessionId: SessionId): ChatSession | undefined;
  
  /**
   * Retrieves all active chat sessions
   * @returns {ChatSession[]} Array of all sessions
   * @example
   * ```typescript
   * const sessions = chatService.getAllSessions();
   * console.log(`Active sessions: ${sessions.length}`);
   * ```
   */
  getAllSessions(): ChatSession[];
  
  /**
   * Sends a message to a chat session and waits for the complete response
   * @param {string} sessionId - Target session ID
   * @param {string} message - Message content
   * @returns {Promise<ChatMessage>} The assistant's response
   * @throws {Error} If session not found or send fails
   * @example
   * ```typescript
   * const response = await chatService.sendMessage(
   *   'session-123',
   *   'Explain dependency injection'
   * );
   * console.log(response.content);
   * ```
   */
  sendMessage(sessionId: SessionId, message: string): Promise<ChatMessage>;
  
  /**
   * Sends a message with streaming response
   * @param {string} sessionId - Target session ID
   * @param {string} message - Message content
   * @param {(chunk: string) => void} onStream - Callback for each response chunk
   * @returns {Promise<ChatMessage>} The complete response after streaming
   * @throws {Error} If session not found or send fails
   * @example
   * ```typescript
   * let fullResponse = '';
   * const response = await chatService.sendMessageStream(
   *   'session-123',
   *   'Write a long story',
   *   (chunk) => {
   *     fullResponse += chunk;
   *     console.log('Chunk:', chunk);
   *   }
   * );
   * ```
   */
  sendMessageStream(
    sessionId: SessionId, 
    message: string, 
    onStream: (chunk: string) => void
  ): Promise<ChatMessage>;
  
  /**
   * Clears all messages from a session while preserving the session itself
   * @param {string} sessionId - Session to clear
   * @returns {void}
   * @example
   * ```typescript
   * chatService.clearSession('session-123');
   * // Session still exists but messages array is empty
   * ```
   */
  clearSession(sessionId: SessionId): void;
  
  /**
   * Permanently deletes a chat session
   * @param {string} sessionId - Session to delete
   * @returns {void}
   * @example
   * ```typescript
   * chatService.deleteSession('session-123');
   * // Session is completely removed
   * ```
   */
  deleteSession(sessionId: SessionId): void;
  
  /**
   * Adds context files to a session
   * @param {string} sessionId - Target session ID
   * @param {string[]} files - File paths to add as context
   * @returns {Promise<void>}
   * @throws {Error} If files cannot be read or processed
   * @example
   * ```typescript
   * await chatService.addContextFiles('session-123', [
   *   '/src/utils/helper.ts',
   *   '/docs/api.md'
   * ]);
   * ```
   */
  addContextFiles(sessionId: SessionId, files: FilePath[]): Promise<void>;
  
  /**
   * Removes context files from a session
   * @param {string} sessionId - Target session ID
   * @param {string[]} files - File paths to remove
   * @returns {void}
   * @example
   * ```typescript
   * chatService.removeContextFiles('session-123', [
   *   '/src/utils/helper.ts'
   * ]);
   * ```
   */
  removeContextFiles(sessionId: SessionId, files: FilePath[]): void;
  
  /**
   * Retrieves the full context for a session including all context files
   * @param {string} sessionId - Target session ID
   * @returns {Promise<string>} Combined context as a string
   * @throws {Error} If session not found or context cannot be built
   * @example
   * ```typescript
   * const context = await chatService.getSessionContext('session-123');
   * console.log('Context length:', context.length);
   * ```
   */
  getSessionContext(sessionId: SessionId): Promise<string>;
  
  /**
   * Exports a session to a portable format
   * @param {string} sessionId - Session to export
   * @returns {string} JSON string representation of the session
   * @throws {Error} If session not found
   * @example
   * ```typescript
   * const exported = chatService.exportSession('session-123');
   * await fs.writeFile('session-backup.json', exported);
   * ```
   */
  exportSession(sessionId: SessionId): string;
  
  /**
   * Imports a session from exported data
   * @param {string} data - JSON string of exported session
   * @returns {ChatSession} The imported session with new ID
   * @throws {Error} If data is invalid or import fails
   * @example
   * ```typescript
   * const data = await fs.readFile('session-backup.json', 'utf-8');
   * const session = chatService.importSession(data);
   * console.log('Imported session:', session.id);
   * ```
   */
  importSession(data: string): ChatSession;
  
  /**
   * Subscribes to chat events
   * @param {(event: ChatEvent) => void} callback - Event handler
   * @returns {vscode.Disposable} Disposable to unsubscribe
   * @example
   * ```typescript
   * const subscription = chatService.onChatEvent((event) => {
   *   if (event.type === 'message') {
   *     console.log('New message in session:', event.sessionId);
   *   } else if (event.type === 'error') {
   *     console.error('Chat error:', event.error);
   *   }
   * });
   * 
   * // Later: subscription.dispose();
   * ```
   */
  onChatEvent(callback: (event: ChatEvent) => void): vscode.Disposable;
  
  /**
   * Stops any ongoing message generation for a session
   * @param {string} sessionId - Session with active generation
   * @returns {void}
   * @example
   * ```typescript
   * // User wants to stop a long-running generation
   * chatService.stopGeneration('session-123');
   * ```
   */
  stopGeneration(sessionId: SessionId): void;
}
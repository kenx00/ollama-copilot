/**
 * @file Chat service implementation
 * @module services/implementations/ChatService
 * @description Implementation of the IChatService interface providing chat session management,
 * message handling, and integration with the Ollama API.
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import {
  IChatService,
  ChatSession,
  ChatOptions,
  ChatEvent
} from '../interfaces/IChatService';
import { IOllamaApiService, ChatMessage } from '../interfaces/IOllamaApiService';
import { IFileService } from '../interfaces/IFileService';
import { IModelService } from '../interfaces/IModelService';
import { SessionId, FilePath } from '../../types/index';
import { toSessionId, toFilePath } from '../../types/guards';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton } from '../../di/decorators';

/**
 * Implementation of the chat service for managing Ollama chat sessions
 * @class ChatService
 * @extends {Disposable}
 * @implements {IChatService}
 * @description Provides:
 * - Session lifecycle management with unique IDs
 * - Message sending with streaming support
 * - Context file integration
 * - Session persistence through import/export
 * - Real-time event notifications
 * @example
 * ```typescript
 * const chatService = container.resolve<IChatService>(SERVICE_IDENTIFIERS.IChatService);
 * const session = await chatService.createSession({ model: 'llama2' });
 * const response = await chatService.sendMessage(session.id, 'Hello!');
 * ```
 */
@Singleton(SERVICE_IDENTIFIERS.IChatService)
export class ChatService extends Disposable implements IChatService {
  private sessions = new Map<SessionId, ChatSession>();
  private activeGenerations = new Map<SessionId, AbortController>();
  private readonly eventEmitter = new vscode.EventEmitter<ChatEvent>();
  
  /**
   * Creates a new instance of ChatService
   * @param {IOllamaApiService} apiService - Service for Ollama API communication
   * @param {IFileService} fileService - Service for file operations
   * @param {IModelService} modelService - Service for model management
   */
  constructor(
    private readonly apiService: IOllamaApiService,
    private readonly fileService: IFileService,
    private readonly modelService: IModelService
  ) {
    super();
    
    // Track the event emitter
    this.track(this.eventEmitter);
  }
  
  /**
   * Create a new chat session
   */
  async createSession(options: ChatOptions): Promise<ChatSession> {
    const sessionId = this.generateSessionId();
    const model = options.model || this.modelService.getSelectedModel();
    
    if (!model) {
      throw new Error('No model selected for chat');
    }
    
    const session: ChatSession = {
      id: sessionId,
      messages: [],
      model,
      createdAt: new Date(),
      lastMessageAt: new Date(),
      contextFiles: options.contextFiles || []
    };
    
    // Add initial context if workspace is used
    if (options.useWorkspace) {
      const context = await this.buildWorkspaceContext();
      if (context) {
        session.messages.push({
          role: 'system',
          content: context
        });
      }
    }
    
    // Add file contexts
    if (session.contextFiles && session.contextFiles.length > 0) {
      const fileContext = await this.buildFileContext(session.contextFiles);
      if (fileContext) {
        session.messages.push({
          role: 'system',
          content: fileContext
        });
      }
    }
    
    this.sessions.set(sessionId, session);
    
    this.fireEvent({
      type: 'message',
      sessionId
    });
    
    return session;
  }
  
  /**
   * Get a chat session
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(toSessionId(sessionId));
  }
  
  /**
   * Get all sessions
   */
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }
  
  /**
   * Send a message to a session
   */
  async sendMessage(sessionId: string, message: string): Promise<ChatMessage> {
    console.log('[ChatService] sendMessage called with:', { sessionId, message });
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message
    };
    session.messages.push(userMessage);
    session.lastMessageAt = new Date();
    
    try {
      console.log('[ChatService] Calling apiService.chat with model:', session.model);
      console.log('[ChatService] API host:', (this.apiService as any).apiHost || 'unknown');
      
      // Get response from API
      const response = await this.apiService.chat(
        session.model,
        session.messages
      );
      
      console.log('[ChatService] Received response:', response);
      
      // Add assistant message
      const assistantMessage = response.message;
      session.messages.push(assistantMessage);
      session.lastMessageAt = new Date();
      
      this.fireEvent({
        type: 'message',
        sessionId: toSessionId(sessionId),
        data: { message: assistantMessage }
      });
      
      return assistantMessage;
      
    } catch (error) {
      console.error('[ChatService] Error calling API:', error);
      this.fireEvent({
        type: 'error',
        sessionId: toSessionId(sessionId),
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }
  
  /**
   * Send a message with streaming
   */
  async sendMessageStream(
    sessionId: string, 
    message: string, 
    onStream: (chunk: string) => void
  ): Promise<ChatMessage> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Stop any existing generation for this session
    this.stopGeneration(sessionId);
    
    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message
    };
    session.messages.push(userMessage);
    session.lastMessageAt = new Date();
    
    try {
      // Track this generation
      const controller = new AbortController();
      this.activeGenerations.set(toSessionId(sessionId), controller);
      
      // Stream response from API
      const response = await this.apiService.chatStream(
        session.model,
        session.messages,
        (chunk) => {
          onStream(chunk);
          this.fireEvent({
            type: 'stream',
            sessionId: toSessionId(sessionId),
            data: { chunk }
          });
        }
      );
      
      // Add complete assistant message
      const assistantMessage = response.message;
      session.messages.push(assistantMessage);
      session.lastMessageAt = new Date();
      
      this.fireEvent({
        type: 'complete',
        sessionId: toSessionId(sessionId),
        data: { message: assistantMessage }
      });
      
      return assistantMessage;
      
    } catch (error) {
      this.fireEvent({
        type: 'error',
        sessionId: toSessionId(sessionId),
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    } finally {
      this.activeGenerations.delete(toSessionId(sessionId));
    }
  }
  
  /**
   * Clear a session
   */
  clearSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    // Keep system messages
    session.messages = session.messages.filter(m => m.role === 'system');
    session.lastMessageAt = new Date();
    
    this.fireEvent({
      type: 'message',
      sessionId: toSessionId(sessionId)
    });
  }
  
  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.stopGeneration(sessionId);
    this.sessions.delete(toSessionId(sessionId));
  }
  
  /**
   * Add context files to a session
   */
  async addContextFiles(sessionId: string, files: string[]): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Initialize contextFiles if not present
    if (!session.contextFiles) {
      session.contextFiles = [];
    }
    
    // Add new files
    const convertedFiles = files.map(f => toFilePath(f));
    const newFiles = convertedFiles.filter(f => !session.contextFiles!.includes(f));
    session.contextFiles!.push(...newFiles);
    
    // Build context for new files
    if (newFiles.length > 0) {
      const context = await this.buildFileContext(newFiles);
      if (context) {
        session.messages.push({
          role: 'system',
          content: context
        });
      }
    }
  }
  
  /**
   * Remove context files from a session
   */
  removeContextFiles(sessionId: string, files: string[]): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    
    if (session.contextFiles) {
      session.contextFiles = session.contextFiles.filter(f => !files.includes(f));
    }
  }
  
  /**
   * Get session context
   */
  async getSessionContext(sessionId: string): Promise<string> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const contexts: string[] = [];
    
    // Add file contexts
    if (session.contextFiles && session.contextFiles.length > 0) {
      const fileContext = await this.buildFileContext(session.contextFiles);
      if (fileContext) {
        contexts.push(fileContext);
      }
    }
    
    return contexts.join('\n\n');
  }
  
  /**
   * Export session history
   */
  exportSession(sessionId: string): string {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    return JSON.stringify(session, null, 2);
  }
  
  /**
   * Import session history
   */
  importSession(data: string): ChatSession {
    try {
      const session = JSON.parse(data) as ChatSession;
      
      // Validate session
      if (!session.id || !session.messages || !session.model) {
        throw new Error('Invalid session data');
      }
      
      // Generate new ID to avoid conflicts
      session.id = this.generateSessionId();
      session.createdAt = new Date(session.createdAt);
      session.lastMessageAt = new Date(session.lastMessageAt);
      
      this.sessions.set(session.id, session);
      
      return session;
    } catch (error) {
      throw new Error(`Failed to import session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Subscribe to chat events
   */
  onChatEvent(callback: (event: ChatEvent) => void): vscode.Disposable {
    return this.eventEmitter.event(callback);
  }
  
  /**
   * Stop current generation
   */
  stopGeneration(sessionId: string): void {
    const sid = toSessionId(sessionId);
    const controller = this.activeGenerations.get(sid);
    if (controller) {
      controller.abort();
      this.activeGenerations.delete(sid);
    }
  }
  
  /**
   * Generate session ID
   */
  private generateSessionId(): SessionId {
    return toSessionId(`chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }
  
  /**
   * Build workspace context
   */
  private async buildWorkspaceContext(): Promise<string | null> {
    const workspaceRoot = this.fileService.getWorkspaceRoot();
    if (!workspaceRoot) return null;
    
    // TODO: Implement workspace analysis
    return `You are assisting with a project located at: ${workspaceRoot}`;
  }
  
  /**
   * Build file context
   */
  private async buildFileContext(files: FilePath[]): Promise<string | null> {
    const contexts: string[] = [];
    
    for (const file of files) {
      const result = await this.fileService.readFile(file, { maxSize: 50000 });
      if (result.success && result.data) {
        contexts.push(`File: ${file}\n\`\`\`\n${result.data}\n\`\`\``);
      }
    }
    
    return contexts.length > 0 ? contexts.join('\n\n') : null;
  }
  
  /**
   * Emits a chat event to all subscribers
   * @param {ChatEvent} event - Event to emit
   * @returns {void}
   * @private
   * @description Fires through the internal event emitter
   */
  private fireEvent(event: ChatEvent): void {
    this.eventEmitter.fire(event);
  }
  
  /**
   * Performs cleanup when the service is disposed
   * @returns {void}
   * @protected
   * @override
   * @description Cleans up:
   * - All active generations
   * - All chat sessions
   * - Event emitter (handled by base class)
   */
  protected onDispose(): void {
    // Stop all active generations
    for (const controller of this.activeGenerations.values()) {
      controller.abort();
    }
    this.activeGenerations.clear();
    
    // Clear sessions
    this.sessions.clear();
  }
}
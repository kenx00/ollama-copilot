/**
 * @file Notification service implementation
 * @module services/implementations/NotificationService
 * @description Manages user notifications with queuing and deduplication
 */

import * as vscode from 'vscode';
import { Disposable } from '../../utils/Disposable';
import {
  INotificationService,
  INotification,
  INotificationGroup,
  NotificationOptions,
  NotificationType,
  NotificationPriority,
  INotificationConfig,
  NotificationStats
} from '../interfaces/INotificationService';
import { IDisposable } from '../../types/IDisposable';

/**
 * Default notification configuration
 */
const DEFAULT_CONFIG: INotificationConfig = {
  maxQueueSize: 100,
  defaultTimeout: 5000,
  enableSounds: false,
  groupSimilar: true,
  position: 'bottom-right',
  rateLimit: {
    maxPerMinute: 20,
    maxPerCategory: 10
  }
};

/**
 * Notification implementation
 */
class NotificationImpl extends Disposable implements INotification {
  private _message: string;
  private _options: NotificationOptions;
  private _isVisible = true;
  private progressItem?: vscode.StatusBarItem;
  
  constructor(
    public readonly id: string,
    message: string,
    options: NotificationOptions,
    public readonly timestamp: Date,
    private service: NotificationService
  ) {
    super();
    this._message = message;
    this._options = { ...options };
    
    if (options.progress !== undefined) {
      this.createProgressItem();
    }
  }
  
  get message(): string {
    return this._message;
  }
  
  get options(): NotificationOptions {
    return { ...this._options };
  }
  
  get isVisible(): boolean {
    return this._isVisible;
  }
  
  update(message?: string, options?: Partial<NotificationOptions>): void {
    if (message) {
      this._message = message;
    }
    
    if (options) {
      this._options = { ...this._options, ...options };
      
      if (options.progress !== undefined && !this.progressItem) {
        this.createProgressItem();
      }
    }
    
    if (this.progressItem && this._options.progress !== undefined) {
      this.updateProgressItem();
    }
  }
  
  close(): void {
    this._isVisible = false;
    this.service.removeNotification(this.id);
    this.dispose();
  }
  
  updateProgress(progress: number, message?: string): void {
    this.update(message, { progress });
  }
  
  private createProgressItem(): void {
    this.progressItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.updateProgressItem();
    this.progressItem.show();
    this.track(this.progressItem);
  }
  
  private updateProgressItem(): void {
    if (!this.progressItem || this._options.progress === undefined) {return;}
    
    const progress = Math.min(100, Math.max(0, this._options.progress));
    const blocks = Math.floor(progress / 10);
    const progressBar = '█'.repeat(blocks) + '░'.repeat(10 - blocks);
    
    this.progressItem.text = `$(sync~spin) ${progressBar} ${progress}% ${this._message}`;
    this.progressItem.tooltip = this._options.detail || this._message;
  }
  
  protected onDispose(): void {
    // Base class handles disposal of tracked items
    this._isVisible = false;
    this.service.removeNotification(this.id);
  }
}

/**
 * Notification group implementation
 */
class NotificationGroupImpl extends Disposable implements INotificationGroup {
  private notifications = new Map<string, INotification>();
  
  constructor(
    public readonly id: string,
    public readonly title: string,
    private service: NotificationService
  ) {
    super();
  }
  
  addNotification(message: string, options?: Partial<NotificationOptions>): INotification {
    const fullOptions: NotificationOptions = {
      type: NotificationType.Info,
      ...options,
      category: this.id
    };
    
    const notification = this.service.show(
      `${this.title}: ${message}`,
      fullOptions
    );
    
    this.notifications.set(notification.id, notification);
    return notification;
  }
  
  updateProgress(progress: number, message?: string): void {
    const progressMessage = message || `${this.title} Progress`;
    
    // Update or create a progress notification for the group
    const progressId = `${this.id}-progress`;
    let progressNotification = this.notifications.get(progressId);
    
    if (progressNotification) {
      progressNotification.updateProgress(progress, progressMessage);
    } else {
      progressNotification = this.service.show(progressMessage, {
        id: progressId,
        type: NotificationType.Progress,
        progress,
        category: this.id,
        sticky: true
      });
      this.notifications.set(progressId, progressNotification);
    }
  }
  
  clear(): void {
    this.notifications.forEach(n => n.close());
    this.notifications.clear();
  }
  
  getCount(): number {
    return this.notifications.size;
  }
  
  protected onDispose(): void {
    this.clear();
  }
}

/**
 * Notification service implementation
 */
export class NotificationService extends Disposable implements INotificationService {
  private config: INotificationConfig;
  private notifications = new Map<string, NotificationImpl>();
  private groups = new Map<string, NotificationGroupImpl>();
  private interceptors = new Set<(notification: INotification) => boolean | Promise<boolean>>();
  private stats: NotificationStats;
  private notificationTimes = new Map<string, number>();
  private rateLimitMap = new Map<string, number[]>();
  private statusBarItem: vscode.StatusBarItem;
  
  constructor() {
    super();
    
    this.config = { ...DEFAULT_CONFIG };
    this.stats = this.createEmptyStats();
    
    // Create status bar for notification count
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      1000
    );
    this.statusBarItem.command = 'ollama-copilot.showNotifications';
    
    // Register command
    this.track(
      vscode.commands.registerCommand('ollama-copilot.showNotifications', () => {
        this.showNotificationCenter();
      })
    );
    
    // Update status bar
    this.updateStatusBar();
  }
  
  show(message: string, options: NotificationOptions): INotification {
    // Check rate limits
    if (!this.checkRateLimit(options.category || 'default')) {
      throw new Error('Rate limit exceeded');
    }
    
    // Generate ID if not provided
    const id = options.id || `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check for existing notification with same ID
    if (this.notifications.has(id)) {
      const existing = this.notifications.get(id)!;
      existing.update(message, options);
      return existing;
    }
    
    // Create notification
    const notification = new NotificationImpl(
      id,
      message,
      options,
      new Date(),
      this
    );
    
    // Add to map
    this.notifications.set(id, notification);
    this.notificationTimes.set(id, Date.now());
    
    // Update stats
    this.updateStats(options.type, options.priority || NotificationPriority.Normal);
    
    // Check interceptors
    this.processInterceptors(notification).then(shouldShow => {
      if (shouldShow) {
        this.displayNotification(notification);
      } else {
        notification.close();
      }
    });
    
    // Update status bar
    this.updateStatusBar();
    
    return notification;
  }
  
  showInfo(message: string, options?: Partial<NotificationOptions>): INotification {
    return this.show(message, {
      type: NotificationType.Info,
      icon: 'info',
      ...options
    });
  }
  
  showSuccess(message: string, options?: Partial<NotificationOptions>): INotification {
    return this.show(message, {
      type: NotificationType.Success,
      icon: 'check',
      timeout: options?.timeout ?? 3000,
      ...options
    });
  }
  
  showWarning(message: string, options?: Partial<NotificationOptions>): INotification {
    return this.show(message, {
      type: NotificationType.Warning,
      icon: 'warning',
      ...options
    });
  }
  
  showError(message: string, options?: Partial<NotificationOptions>): INotification {
    return this.show(message, {
      type: NotificationType.Error,
      icon: 'error',
      priority: NotificationPriority.High,
      ...options
    });
  }
  
  showProgress(message: string, options?: Partial<NotificationOptions>): INotification {
    return this.show(message, {
      type: NotificationType.Progress,
      icon: 'sync~spin',
      progress: 0,
      sticky: true,
      ...options
    });
  }
  
  getNotification(id: string): INotification | undefined {
    return this.notifications.get(id);
  }
  
  getActiveNotifications(): INotification[] {
    return Array.from(this.notifications.values());
  }
  
  clearAll(category?: string): void {
    const toRemove: string[] = [];
    
    this.notifications.forEach((notification, id) => {
      if (!category || notification.options.category === category) {
        notification.close();
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => this.removeNotification(id));
    this.updateStatusBar();
  }
  
  clearByType(type: NotificationType): void {
    const toRemove: string[] = [];
    
    this.notifications.forEach((notification, id) => {
      if (notification.options.type === type) {
        notification.close();
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => this.removeNotification(id));
    this.updateStatusBar();
  }
  
  configure(config: INotificationConfig): void {
    this.config = { ...this.config, ...config };
  }
  
  getStatistics(): NotificationStats {
    return { ...this.stats };
  }
  
  resetStatistics(): void {
    this.stats = this.createEmptyStats();
  }
  
  hasNotification(id: string): boolean {
    return this.notifications.has(id);
  }
  
  registerInterceptor(
    interceptor: (notification: INotification) => boolean | Promise<boolean>
  ): IDisposable {
    this.interceptors.add(interceptor);
    
    return {
      dispose: () => {
        this.interceptors.delete(interceptor);
      }
    };
  }
  
  createGroup(groupId: string, title: string): INotificationGroup {
    if (this.groups.has(groupId)) {
      return this.groups.get(groupId)!;
    }
    
    const group = new NotificationGroupImpl(groupId, title, this);
    this.groups.set(groupId, group);
    
    return group;
  }
  
  /**
   * Remove a notification (internal use)
   */
  removeNotification(id: string): void {
    const notification = this.notifications.get(id);
    if (!notification) {return;}
    
    // Update stats
    const startTime = this.notificationTimes.get(id);
    if (startTime) {
      const displayTime = Date.now() - startTime;
      this.updateAverageDisplayTime(displayTime);
      this.notificationTimes.delete(id);
    }
    
    this.notifications.delete(id);
    this.updateStatusBar();
  }
  
  /**
   * Private helper methods
   */
  
  private async processInterceptors(notification: INotification): Promise<boolean> {
    for (const interceptor of this.interceptors) {
      try {
        const result = await interceptor(notification);
        if (!result) {return false;}
      } catch (error) {
        console.error('Error in notification interceptor:', error);
      }
    }
    return true;
  }
  
  private displayNotification(notification: NotificationImpl): void {
    const { message, options } = notification;
    
    // Status bar only
    if (options.statusBarOnly) {
      this.showStatusBarNotification(notification);
      return;
    }
    
    // Build actions
    const actions = options.actions?.map(a => a.label) || [];
    const actionHandlers = new Map<string, () => void | Promise<void>>();
    
    options.actions?.forEach(action => {
      actionHandlers.set(action.label, action.handler);
    });
    
    // Show based on type
    let promise: Thenable<string | undefined>;
    
    switch (options.type) {
      case NotificationType.Error:
        promise = options.modal
          ? vscode.window.showErrorMessage(message, { modal: true, detail: options.detail }, ...actions)
          : vscode.window.showErrorMessage(message, ...actions);
        break;
        
      case NotificationType.Warning:
        promise = vscode.window.showWarningMessage(message, ...actions);
        break;
        
      case NotificationType.Success:
      case NotificationType.Info:
      case NotificationType.Progress:
      default:
        promise = vscode.window.showInformationMessage(message, ...actions);
        break;
    }
    
    // Handle action selection
    promise.then(selected => {
      if (selected && actionHandlers.has(selected)) {
        this.stats.actionClicks++;
        const handler = actionHandlers.get(selected)!;
        handler();
        
        // Close if configured
        const action = options.actions?.find(a => a.label === selected);
        if (action?.closeOnClick) {
          notification.close();
        }
      } else if (!selected) {
        this.stats.dismissed++;
      }
    });
    
    // Auto-dismiss
    if (!options.sticky && options.timeout !== 0) {
      const timeout = options.timeout ?? this.config.defaultTimeout;
      setTimeout(() => {
        if (notification.isVisible) {
          notification.close();
        }
      }, timeout);
    }
  }
  
  private showStatusBarNotification(notification: NotificationImpl): void {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    const icon = notification.options.icon || this.getIconForType(notification.options.type);
    
    item.text = `$(${icon}) ${notification.message}`;
    item.tooltip = notification.options.detail;
    item.show();
    
    // Auto-dismiss
    const timeout = (notification.options.timeout ?? this.config.defaultTimeout) || 0;
    if (timeout > 0) {
      setTimeout(() => {
        item.dispose();
        notification.close();
      }, timeout);
    }
  }
  
  private getIconForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.Success:
        return 'check';
      case NotificationType.Error:
        return 'error';
      case NotificationType.Warning:
        return 'warning';
      case NotificationType.Progress:
        return 'sync~spin';
      case NotificationType.Info:
      default:
        return 'info';
    }
  }
  
  private updateStatusBar(): void {
    const count = this.notifications.size;
    
    if (count > 0) {
      this.statusBarItem.text = `$(bell) ${count}`;
      this.statusBarItem.tooltip = `${count} active notification${count > 1 ? 's' : ''}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }
  
  private showNotificationCenter(): void {
    const items: vscode.QuickPickItem[] = Array.from(this.notifications.values()).map(n => ({
      label: `$(${this.getIconForType(n.options.type)}) ${n.message}`,
      description: new Date(n.timestamp).toLocaleTimeString(),
      detail: n.options.detail
    }));
    
    if (items.length === 0) {
      vscode.window.showInformationMessage('No active notifications');
      return;
    }
    
    vscode.window.showQuickPick(items, {
      title: 'Active Notifications',
      placeHolder: 'Select a notification to view details'
    });
  }
  
  private checkRateLimit(category: string): boolean {
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    // Clean old entries
    this.rateLimitMap.forEach((times, key) => {
      this.rateLimitMap.set(key, times.filter(t => t > minuteAgo));
    });
    
    // Check global limit
    const allTimes: number[] = [];
    this.rateLimitMap.forEach(times => allTimes.push(...times));
    
    if (allTimes.length >= this.config.rateLimit!.maxPerMinute) {
      return false;
    }
    
    // Check category limit
    const categoryTimes = this.rateLimitMap.get(category) || [];
    if (categoryTimes.length >= this.config.rateLimit!.maxPerCategory) {
      return false;
    }
    
    // Add new entry
    categoryTimes.push(now);
    this.rateLimitMap.set(category, categoryTimes);
    
    return true;
  }
  
  private updateStats(type: NotificationType, priority: NotificationPriority): void {
    this.stats.total++;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    this.stats.byPriority[priority] = (this.stats.byPriority[priority] || 0) + 1;
  }
  
  private updateAverageDisplayTime(displayTime: number): void {
    const currentAvg = this.stats.averageDisplayTime;
    const currentCount = this.stats.total - this.notifications.size;
    
    this.stats.averageDisplayTime = 
      (currentAvg * currentCount + displayTime) / (currentCount + 1);
    
    // Update interaction rate
    const interacted = this.stats.actionClicks;
    const total = this.stats.dismissed + interacted;
    
    if (total > 0) {
      this.stats.interactionRate = (interacted / total) * 100;
    }
  }
  
  private createEmptyStats(): NotificationStats {
    return {
      total: 0,
      byType: {} as Record<NotificationType, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      averageDisplayTime: 0,
      interactionRate: 0,
      dismissed: 0,
      actionClicks: 0
    };
  }
  
  protected onDispose(): void {
    this.clearAll();
    this.groups.forEach(g => g.dispose());
    this.groups.clear();
    this.statusBarItem.dispose();
  }
}
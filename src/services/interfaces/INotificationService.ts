/**
 * @file Notification service interface
 * @module services/interfaces/INotificationService
 * @description Manages user notifications with queuing and deduplication
 */

import { IDisposable } from '../../types/IDisposable';

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  /**
   * Low priority - shown in status bar
   */
  Low = 'low',
  
  /**
   * Normal priority - shown as notification
   */
  Normal = 'normal',
  
  /**
   * High priority - shown prominently
   */
  High = 'high',
  
  /**
   * Urgent - requires immediate attention
   */
  Urgent = 'urgent'
}

/**
 * Notification type
 */
export enum NotificationType {
  /**
   * Information notification
   */
  Info = 'info',
  
  /**
   * Success notification
   */
  Success = 'success',
  
  /**
   * Warning notification
   */
  Warning = 'warning',
  
  /**
   * Error notification
   */
  Error = 'error',
  
  /**
   * Progress notification
   */
  Progress = 'progress'
}

/**
 * Notification action
 */
export interface NotificationAction {
  /**
   * Action label
   */
  label: string;
  
  /**
   * Action handler
   */
  handler: () => void | Promise<void>;
  
  /**
   * Is this the primary action?
   */
  isPrimary?: boolean;
  
  /**
   * Should this action close the notification?
   */
  closeOnClick?: boolean;
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /**
   * Notification ID for deduplication
   */
  id?: string;
  
  /**
   * Notification type
   */
  type: NotificationType;
  
  /**
   * Priority level
   */
  priority?: NotificationPriority;
  
  /**
   * Auto-dismiss timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Show in status bar only
   */
  statusBarOnly?: boolean;
  
  /**
   * Actions for the notification
   */
  actions?: NotificationAction[];
  
  /**
   * Icon to display
   */
  icon?: string;
  
  /**
   * Additional details
   */
  detail?: string;
  
  /**
   * Progress value (0-100)
   */
  progress?: number;
  
  /**
   * Sound to play
   */
  sound?: boolean;
  
  /**
   * Modal notification
   */
  modal?: boolean;
  
  /**
   * Sticky notification (doesn't auto-dismiss)
   */
  sticky?: boolean;
  
  /**
   * Category for grouping
   */
  category?: string;
}

/**
 * Notification instance
 */
export interface INotification extends IDisposable {
  /**
   * Notification ID
   */
  readonly id: string;
  
  /**
   * Notification message
   */
  readonly message: string;
  
  /**
   * Notification options
   */
  readonly options: NotificationOptions;
  
  /**
   * Creation timestamp
   */
  readonly timestamp: Date;
  
  /**
   * Is the notification visible?
   */
  readonly isVisible: boolean;
  
  /**
   * Update the notification
   * @param message - New message
   * @param options - New options
   */
  update(message?: string, options?: Partial<NotificationOptions>): void;
  
  /**
   * Close the notification
   */
  close(): void;
  
  /**
   * Update progress
   * @param progress - Progress value (0-100)
   * @param message - Optional progress message
   */
  updateProgress(progress: number, message?: string): void;
}

/**
 * Notification service configuration
 */
export interface INotificationConfig {
  /**
   * Maximum notifications in queue
   */
  maxQueueSize?: number;
  
  /**
   * Default timeout for notifications
   */
  defaultTimeout?: number;
  
  /**
   * Enable notification sounds
   */
  enableSounds?: boolean;
  
  /**
   * Group similar notifications
   */
  groupSimilar?: boolean;
  
  /**
   * Notification position
   */
  position?: 'top-right' | 'bottom-right' | 'bottom-left';
  
  /**
   * Rate limiting
   */
  rateLimit?: {
    maxPerMinute: number;
    maxPerCategory: number;
  };
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  /**
   * Total notifications shown
   */
  total: number;
  
  /**
   * Notifications by type
   */
  byType: Record<NotificationType, number>;
  
  /**
   * Notifications by priority
   */
  byPriority: Record<NotificationPriority, number>;
  
  /**
   * Average display time
   */
  averageDisplayTime: number;
  
  /**
   * Interaction rate
   */
  interactionRate: number;
  
  /**
   * Dismissed count
   */
  dismissed: number;
  
  /**
   * Action click count
   */
  actionClicks: number;
}

/**
 * Notification service interface
 */
export interface INotificationService extends IDisposable {
  /**
   * Show a notification
   * @param message - Notification message
   * @param options - Notification options
   * @returns Notification instance
   */
  show(message: string, options: NotificationOptions): INotification;
  
  /**
   * Show an info notification
   * @param message - Notification message
   * @param options - Additional options
   * @returns Notification instance
   */
  showInfo(message: string, options?: Partial<NotificationOptions>): INotification;
  
  /**
   * Show a success notification
   * @param message - Notification message
   * @param options - Additional options
   * @returns Notification instance
   */
  showSuccess(message: string, options?: Partial<NotificationOptions>): INotification;
  
  /**
   * Show a warning notification
   * @param message - Notification message
   * @param options - Additional options
   * @returns Notification instance
   */
  showWarning(message: string, options?: Partial<NotificationOptions>): INotification;
  
  /**
   * Show an error notification
   * @param message - Notification message
   * @param options - Additional options
   * @returns Notification instance
   */
  showError(message: string, options?: Partial<NotificationOptions>): INotification;
  
  /**
   * Show a progress notification
   * @param message - Notification message
   * @param options - Additional options with progress
   * @returns Notification instance
   */
  showProgress(message: string, options?: Partial<NotificationOptions>): INotification;
  
  /**
   * Get a notification by ID
   * @param id - Notification ID
   * @returns Notification or undefined
   */
  getNotification(id: string): INotification | undefined;
  
  /**
   * Get all active notifications
   * @returns Array of notifications
   */
  getActiveNotifications(): INotification[];
  
  /**
   * Clear all notifications
   * @param category - Optional category to clear
   */
  clearAll(category?: string): void;
  
  /**
   * Clear notifications by type
   * @param type - Notification type
   */
  clearByType(type: NotificationType): void;
  
  /**
   * Configure the service
   * @param config - Configuration options
   */
  configure(config: INotificationConfig): void;
  
  /**
   * Get notification statistics
   * @returns Statistics object
   */
  getStatistics(): NotificationStats;
  
  /**
   * Reset statistics
   */
  resetStatistics(): void;
  
  /**
   * Check if a notification exists
   * @param id - Notification ID
   * @returns True if exists
   */
  hasNotification(id: string): boolean;
  
  /**
   * Register a notification interceptor
   * @param interceptor - Interceptor function
   * @returns Disposable to unregister
   */
  registerInterceptor(
    interceptor: (notification: INotification) => boolean | Promise<boolean>
  ): IDisposable;
  
  /**
   * Create a notification group
   * @param groupId - Group ID
   * @param title - Group title
   * @returns Group manager
   */
  createGroup(groupId: string, title: string): INotificationGroup;
}

/**
 * Notification group interface
 */
export interface INotificationGroup extends IDisposable {
  /**
   * Group ID
   */
  readonly id: string;
  
  /**
   * Group title
   */
  readonly title: string;
  
  /**
   * Add a notification to the group
   * @param message - Notification message
   * @param options - Notification options
   * @returns Notification instance
   */
  addNotification(message: string, options?: Partial<NotificationOptions>): INotification;
  
  /**
   * Update group progress
   * @param progress - Progress value (0-100)
   * @param message - Optional message
   */
  updateProgress(progress: number, message?: string): void;
  
  /**
   * Clear all notifications in the group
   */
  clear(): void;
  
  /**
   * Get notification count
   * @returns Number of notifications
   */
  getCount(): number;
}
/**
 * Rate limiting service interface
 */

import * as vscode from 'vscode';

export interface RateLimitStatus {
  key: string;
  requests: number;
  limit: number;
  windowMs: number;
  resetAt: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  keys: Record<string, RateLimitStatus>;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
  keyPrefix?: string;
}

export interface IRateLimiter extends vscode.Disposable {
  /**
   * Check if request is within rate limit
   */
  checkLimit(key: string, maxRequests?: number, windowMs?: number): boolean;
  
  /**
   * Record a request
   */
  recordRequest(key: string): void;
  
  /**
   * Get rate limit status for a key
   */
  getStatus(key: string): RateLimitStatus | undefined;
  
  /**
   * Get all rate limit statistics
   */
  getStats(): RateLimitStats;
  
  /**
   * Reset rate limit for a key
   */
  resetKey(key: string): void;
  
  /**
   * Reset all rate limits
   */
  reset(): void;
  
  /**
   * Set default configuration
   */
  setDefaultConfig(config: RateLimitConfig): void;
  
  /**
   * Set configuration for specific key pattern
   */
  setKeyConfig(keyPattern: string, config: RateLimitConfig): void;
  
  /**
   * Block a key temporarily
   */
  blockKey(key: string, durationMs: number): void;
  
  /**
   * Unblock a key
   */
  unblockKey(key: string): void;
  
  /**
   * Clean up expired entries
   */
  cleanup(): void;
}
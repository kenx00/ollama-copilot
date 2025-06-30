/**
 * Rate limiting implementation using sliding window algorithm
 */

interface RateLimitWindow {
  timestamps: number[];
  limit: number;
  windowMs: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

/**
 * Rate limiter with sliding window algorithm
 */
export class RateLimiter {
  private readonly windows: Map<string, RateLimitWindow> = new Map();
  private readonly blockedKeys: Map<string, number> = new Map();
  private readonly defaultConfig: RateLimitConfig = {
    maxRequests: 60,
    windowMs: 60000, // 1 minute
    blockDurationMs: 300000 // 5 minutes
  };
  
  /**
   * Checks if a request is allowed under the rate limit
   */
  checkLimit(
    key: string, 
    maxRequests?: number, 
    windowMs?: number
  ): boolean {
    // Check if key is blocked
    const blockedUntil = this.blockedKeys.get(key);
    if (blockedUntil && Date.now() < blockedUntil) {
      return false;
    } else if (blockedUntil) {
      // Remove expired block
      this.blockedKeys.delete(key);
    }
    
    const limit = maxRequests || this.defaultConfig.maxRequests;
    const window = windowMs || this.defaultConfig.windowMs;
    const now = Date.now();
    
    // Get or create window
    let rateLimitWindow = this.windows.get(key);
    if (!rateLimitWindow) {
      rateLimitWindow = {
        timestamps: [],
        limit,
        windowMs: window
      };
      this.windows.set(key, rateLimitWindow);
    }
    
    // Remove timestamps outside the window
    rateLimitWindow.timestamps = rateLimitWindow.timestamps.filter(
      timestamp => now - timestamp < window
    );
    
    // Check if limit exceeded
    if (rateLimitWindow.timestamps.length >= limit) {
      // Block the key temporarily
      this.blockKey(key);
      return false;
    }
    
    // Add current timestamp
    rateLimitWindow.timestamps.push(now);
    return true;
  }
  
  /**
   * Consumes a request from the rate limit
   */
  consume(
    key: string, 
    maxRequests?: number, 
    windowMs?: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const allowed = this.checkLimit(key, maxRequests, windowMs);
    const window = this.windows.get(key);
    
    if (!window) {
      return {
        allowed: true,
        remaining: (maxRequests || this.defaultConfig.maxRequests) - 1,
        resetAt: Date.now() + (windowMs || this.defaultConfig.windowMs)
      };
    }
    
    const remaining = Math.max(0, window.limit - window.timestamps.length);
    const oldestTimestamp = window.timestamps[0] || Date.now();
    const resetAt = oldestTimestamp + window.windowMs;
    
    return { allowed, remaining, resetAt };
  }
  
  /**
   * Blocks a key temporarily
   */
  private blockKey(key: string, duration?: number): void {
    const blockDuration = duration || this.defaultConfig.blockDurationMs || 300000;
    this.blockedKeys.set(key, Date.now() + blockDuration);
  }
  
  /**
   * Manually blocks a key
   */
  block(key: string, durationMs: number): void {
    this.blockKey(key, durationMs);
  }
  
  /**
   * Unblocks a key
   */
  unblock(key: string): void {
    this.blockedKeys.delete(key);
  }
  
  /**
   * Checks if a key is blocked
   */
  isBlocked(key: string): boolean {
    const blockedUntil = this.blockedKeys.get(key);
    if (!blockedUntil) {return false;}
    
    if (Date.now() < blockedUntil) {
      return true;
    }
    
    // Remove expired block
    this.blockedKeys.delete(key);
    return false;
  }
  
  /**
   * Gets the remaining time for a blocked key
   */
  getBlockedTime(key: string): number {
    const blockedUntil = this.blockedKeys.get(key);
    if (!blockedUntil) {return 0;}
    
    const remaining = blockedUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }
  
  /**
   * Resets rate limit for a specific key
   */
  reset(key?: string): void {
    if (key) {
      this.windows.delete(key);
      this.blockedKeys.delete(key);
    } else {
      // Reset all
      this.windows.clear();
      this.blockedKeys.clear();
    }
  }
  
  /**
   * Gets rate limit status for a key
   */
  getStatus(key: string): {
    requests: number;
    limit: number;
    remaining: number;
    resetAt: number;
    blocked: boolean;
    blockedUntil?: number;
  } {
    const window = this.windows.get(key);
    const blocked = this.isBlocked(key);
    const blockedUntil = this.blockedKeys.get(key);
    
    if (!window) {
      return {
        requests: 0,
        limit: this.defaultConfig.maxRequests,
        remaining: this.defaultConfig.maxRequests,
        resetAt: Date.now() + this.defaultConfig.windowMs,
        blocked,
        blockedUntil
      };
    }
    
    // Clean old timestamps
    const now = Date.now();
    window.timestamps = window.timestamps.filter(
      timestamp => now - timestamp < window.windowMs
    );
    
    const oldestTimestamp = window.timestamps[0] || now;
    
    return {
      requests: window.timestamps.length,
      limit: window.limit,
      remaining: Math.max(0, window.limit - window.timestamps.length),
      resetAt: oldestTimestamp + window.windowMs,
      blocked,
      blockedUntil
    };
  }
  
  /**
   * Gets statistics for all tracked keys
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalKeys: this.windows.size,
      blockedKeys: this.blockedKeys.size,
      keys: {}
    };
    
    for (const [key, _window] of this.windows) {
      stats.keys[key] = this.getStatus(key);
    }
    
    return stats;
  }
  
  /**
   * Cleans up expired windows and blocks
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean up expired blocks
    for (const [key, blockedUntil] of this.blockedKeys) {
      if (now >= blockedUntil) {
        this.blockedKeys.delete(key);
      }
    }
    
    // Clean up empty windows
    for (const [key, window] of this.windows) {
      window.timestamps = window.timestamps.filter(
        timestamp => now - timestamp < window.windowMs
      );
      
      if (window.timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }
  
  /**
   * Creates a rate limit middleware for VS Code commands
   */
  createCommandMiddleware(
    config?: Partial<RateLimitConfig>
  ): (commandId: string) => boolean {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    return (commandId: string): boolean => {
      return this.checkLimit(
        `command:${commandId}`,
        mergedConfig.maxRequests,
        mergedConfig.windowMs
      );
    };
  }
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Gets the global rate limiter instance
 */
export function getGlobalRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
    
    // Set up periodic cleanup
    setInterval(() => {
      globalRateLimiter?.cleanup();
    }, 60000); // Clean up every minute
  }
  return globalRateLimiter;
}
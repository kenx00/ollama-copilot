/**
 * Circular buffer implementation for bounded message history
 * Automatically removes oldest items when capacity is reached
 */

export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private size = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Adds an item to the buffer
   * If the buffer is full, the oldest item is overwritten
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer is full, move head forward (overwriting oldest)
      this.head = (this.head + 1) % this.capacity;
    }
    
    this.tail = (this.tail + 1) % this.capacity;
  }

  /**
   * Removes and returns the oldest item
   */
  shift(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.size--;

    return item;
  }

  /**
   * Returns the oldest item without removing it
   */
  peek(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    return this.buffer[this.head];
  }

  /**
   * Returns the newest item without removing it
   */
  peekLast(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    const lastIndex = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIndex];
  }

  /**
   * Returns all items in the buffer in order (oldest to newest)
   */
  toArray(): T[] {
    const result: T[] = [];
    
    if (this.size === 0) {
      return result;
    }

    let index = this.head;
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
      index = (index + 1) % this.capacity;
    }

    return result;
  }

  /**
   * Returns a slice of the buffer
   * Negative indices count from the end
   */
  slice(start?: number, end?: number): T[] {
    const array = this.toArray();
    return array.slice(start, end);
  }

  /**
   * Clears all items from the buffer
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Returns the number of items in the buffer
   */
  get length(): number {
    return this.size;
  }

  /**
   * Returns the maximum capacity of the buffer
   */
  get maxCapacity(): number {
    return this.capacity;
  }

  /**
   * Checks if the buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Checks if the buffer is full
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * Iterates over all items in the buffer
   */
  forEach(callback: (item: T, index: number) => void): void {
    const items = this.toArray();
    items.forEach(callback);
  }

  /**
   * Maps over all items in the buffer
   */
  map<U>(callback: (item: T, index: number) => U): U[] {
    const items = this.toArray();
    return items.map(callback);
  }

  /**
   * Filters items in the buffer
   */
  filter(predicate: (item: T, index: number) => boolean): T[] {
    const items = this.toArray();
    return items.filter(predicate);
  }

  /**
   * Finds the first item matching the predicate
   */
  find(predicate: (item: T, index: number) => boolean): T | undefined {
    const items = this.toArray();
    return items.find(predicate);
  }

  /**
   * Returns the percentage of buffer capacity used
   */
  getUsagePercentage(): number {
    return (this.size / this.capacity) * 100;
  }
}

/**
 * Configuration for message history buffer
 */
export interface MessageHistoryConfig {
  maxMessages: number;
  maxMessageLength?: number;
}

/**
 * Specialized circular buffer for chat message history
 */
export class MessageHistoryBuffer extends CircularBuffer<{
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}> {
  private readonly maxMessageLength: number;

  constructor(config: MessageHistoryConfig) {
    super(config.maxMessages);
    this.maxMessageLength = config.maxMessageLength || 10000;
  }

  /**
   * Adds a message to the history, truncating if necessary
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    let truncatedContent = content;
    
    if (content.length > this.maxMessageLength) {
      truncatedContent = content.substring(0, this.maxMessageLength) + '... [truncated]';
    }

    this.push({
      role,
      content: truncatedContent,
      timestamp: new Date()
    });
  }

  /**
   * Gets recent messages for context
   * @param limit Maximum number of messages to return
   * @param includeSystem Whether to include system messages
   */
  getRecentMessages(limit: number, includeSystem = true): Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }> {
    const allMessages = this.toArray();
    const filtered = includeSystem 
      ? allMessages 
      : allMessages.filter(msg => msg.role !== 'system');
    
    return filtered.slice(-limit).map(({ role, content }) => ({ role, content }));
  }

  /**
   * Gets the total character count of all messages
   */
  getTotalCharacterCount(): number {
    return this.toArray().reduce((sum, msg) => sum + msg.content.length, 0);
  }

  /**
   * Removes old messages beyond a certain age
   */
  pruneOldMessages(maxAgeMs: number): number {
    const now = Date.now();
    const messages = this.toArray();
    let pruned = 0;

    // Clear and re-add messages that aren't too old
    this.clear();
    
    for (const msg of messages) {
      if (msg.timestamp && (now - msg.timestamp.getTime()) < maxAgeMs) {
        this.push(msg);
      } else {
        pruned++;
      }
    }

    return pruned;
  }
}
/**
 * Doubly-linked list implementation for O(1) LRU cache operations
 */

import { ListNode, CacheEntryMetadata } from './interfaces';

/**
 * Doubly-linked list for LRU cache
 */
export class DoublyLinkedList<K, V> {
  private head: ListNode<K, V> | null = null;
  private tail: ListNode<K, V> | null = null;
  private _size: number = 0;
  
  /**
   * Get the size of the list
   */
  get size(): number {
    return this._size;
  }
  
  /**
   * Check if the list is empty
   */
  get isEmpty(): boolean {
    return this._size === 0;
  }
  
  /**
   * Get the head node (most recently used)
   */
  get front(): ListNode<K, V> | null {
    return this.head;
  }
  
  /**
   * Get the tail node (least recently used)
   */
  get back(): ListNode<K, V> | null {
    return this.tail;
  }
  
  /**
   * Add a node to the front of the list (most recently used position)
   */
  addToFront(node: ListNode<K, V>): void {
    node.prev = null;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
    
    this._size++;
  }
  
  /**
   * Remove a node from the list
   */
  removeNode(node: ListNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    
    node.prev = null;
    node.next = null;
    
    this._size--;
  }
  
  /**
   * Move a node to the front of the list
   */
  moveToFront(node: ListNode<K, V>): void {
    if (node === this.head) {
      return; // Already at front
    }
    
    this.removeNode(node);
    this.addToFront(node);
  }
  
  /**
   * Remove and return the tail node (least recently used)
   */
  removeTail(): ListNode<K, V> | null {
    const node = this.tail;
    
    if (node) {
      this.removeNode(node);
    }
    
    return node;
  }
  
  /**
   * Clear all nodes from the list
   */
  clear(): void {
    this.head = null;
    this.tail = null;
    this._size = 0;
  }
  
  /**
   * Iterate through all nodes from head to tail
   */
  *[Symbol.iterator](): Iterator<ListNode<K, V>> {
    let current = this.head;
    
    while (current) {
      yield current;
      current = current.next;
    }
  }
  
  /**
   * Get all nodes as an array (ordered from head to tail)
   */
  toArray(): ListNode<K, V>[] {
    const result: ListNode<K, V>[] = [];
    
    for (const node of this) {
      result.push(node);
    }
    
    return result;
  }
  
  /**
   * Find nodes that match a predicate
   */
  findNodes(predicate: (node: ListNode<K, V>) => boolean): ListNode<K, V>[] {
    const result: ListNode<K, V>[] = [];
    
    for (const node of this) {
      if (predicate(node)) {
        result.push(node);
      }
    }
    
    return result;
  }
  
  /**
   * Remove all nodes that match a predicate
   */
  removeWhere(predicate: (node: ListNode<K, V>) => boolean): number {
    let removed = 0;
    const nodesToRemove: ListNode<K, V>[] = [];
    
    // Collect nodes to remove first to avoid modifying during iteration
    for (const node of this) {
      if (predicate(node)) {
        nodesToRemove.push(node);
      }
    }
    
    // Remove collected nodes
    for (const node of nodesToRemove) {
      this.removeNode(node);
      removed++;
    }
    
    return removed;
  }
}

/**
 * Create a new list node
 */
export function createNode<K, V>(
  key: K,
  value: V,
  metadata: CacheEntryMetadata
): ListNode<K, V> {
  return {
    key,
    value,
    metadata,
    prev: null,
    next: null
  };
}
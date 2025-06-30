/**
 * Interface for secure file operations service
 */

import * as vscode from 'vscode';

/**
 * File read options
 */
export interface FileReadOptions {
  encoding?: BufferEncoding;
  maxSize?: number;
  validatePath?: boolean;
}

/**
 * File write options
 */
export interface FileWriteOptions {
  encoding?: BufferEncoding;
  createDirectory?: boolean;
  overwrite?: boolean;
  validatePath?: boolean;
}

/**
 * File stats
 */
export interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  modifiedTime: Date;
  createdTime: Date;
}

/**
 * File operation result
 */
export interface FileOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * File service interface
 */
export interface IFileService extends vscode.Disposable {
  /**
   * Read a file
   */
  readFile(path: string, options?: FileReadOptions): Promise<FileOperationResult<string>>;
  
  /**
   * Write a file
   */
  writeFile(path: string, content: string, options?: FileWriteOptions): Promise<FileOperationResult>;
  
  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;
  
  /**
   * Get file stats
   */
  getStats(path: string): Promise<FileOperationResult<FileStats>>;
  
  /**
   * Delete a file
   */
  deleteFile(path: string): Promise<FileOperationResult>;
  
  /**
   * Create a directory
   */
  createDirectory(path: string, recursive?: boolean): Promise<FileOperationResult>;
  
  /**
   * List directory contents
   */
  listDirectory(path: string): Promise<FileOperationResult<string[]>>;
  
  /**
   * Copy a file
   */
  copyFile(source: string, destination: string, overwrite?: boolean): Promise<FileOperationResult>;
  
  /**
   * Move a file
   */
  moveFile(source: string, destination: string, overwrite?: boolean): Promise<FileOperationResult>;
  
  /**
   * Watch a file for changes
   */
  watchFile(path: string, callback: (event: 'changed' | 'deleted') => void): vscode.Disposable;
  
  /**
   * Validate file path
   */
  validatePath(path: string): Promise<boolean>;
  
  /**
   * Get workspace root
   */
  getWorkspaceRoot(): string | undefined;
  
  /**
   * Check if path is within workspace
   */
  isWithinWorkspace(path: string): boolean;
}
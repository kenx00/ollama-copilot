/**
 * File service implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Disposable } from '../../utils/Disposable';
import {
  IFileService,
  FileReadOptions,
  FileWriteOptions,
  FileStats,
  FileOperationResult
} from '../interfaces/IFileService';
import { IValidationService } from '../interfaces/IValidationService';
import { SERVICE_IDENTIFIERS } from '../../di';
import { Singleton, Inject } from '../../di/decorators';
import { normalizePath, isWithinWorkspace } from '../../utils/pathSecurity';

/**
 * File service implementation
 */
@Singleton(SERVICE_IDENTIFIERS.IFileService)
export class FileService extends Disposable implements IFileService {
  private readonly fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  
  constructor(
    @Inject(SERVICE_IDENTIFIERS.IValidationService) 
    private readonly validationService: IValidationService
  ) {
    super();
  }
  
  /**
   * Read a file
   */
  async readFile(filePath: string, options?: FileReadOptions): Promise<FileOperationResult<string>> {
    try {
      // Validate path if requested
      if (options?.validatePath !== false) {
        const isValid = await this.validatePath(filePath);
        if (!isValid) {
          return {
            success: false,
            error: new Error('Invalid file path')
          };
        }
      }
      
      // Read file with proper error handling
      const normalizedPath = normalizePath(filePath);
      const content = await fs.promises.readFile(normalizedPath, options?.encoding || 'utf8');
      
      // Check size limit
      if (options?.maxSize && content.length > options.maxSize) {
        return {
          success: false,
          error: new Error(`File size exceeds limit of ${options.maxSize} bytes`)
        };
      }
      
      return {
        success: true,
        data: content
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Write a file
   */
  async writeFile(
    filePath: string, 
    content: string, 
    options?: FileWriteOptions
  ): Promise<FileOperationResult> {
    try {
      // Validate path if requested
      if (options?.validatePath !== false) {
        const isValid = await this.validatePath(filePath);
        if (!isValid) {
          return {
            success: false,
            error: new Error('Invalid file path')
          };
        }
      }
      
      // Check if file exists and overwrite is false
      if (options?.overwrite === false && await this.exists(filePath)) {
        return {
          success: false,
          error: new Error('File already exists and overwrite is false')
        };
      }
      
      // Create directory if requested
      if (options?.createDirectory) {
        const dir = path.dirname(filePath);
        await this.createDirectory(dir, true);
      }
      
      // Write file with proper error handling
      const normalizedPath = normalizePath(filePath);
      await fs.promises.writeFile(normalizedPath, content, options?.encoding || 'utf8');
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Check if a file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const normalizedPath = normalizePath(filePath);
      await fs.promises.access(normalizedPath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get file stats
   */
  async getStats(filePath: string): Promise<FileOperationResult<FileStats>> {
    try {
      const normalizedPath = normalizePath(filePath);
      const stats = await fs.promises.stat(normalizedPath);
      
      return {
        success: true,
        data: {
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          isSymbolicLink: stats.isSymbolicLink(),
          modifiedTime: stats.mtime,
          createdTime: stats.ctime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<FileOperationResult> {
    try {
      const normalizedPath = normalizePath(filePath);
      await fs.promises.unlink(normalizedPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Create a directory
   */
  async createDirectory(dirPath: string, recursive?: boolean): Promise<FileOperationResult> {
    try {
      await fs.promises.mkdir(dirPath, { recursive });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<FileOperationResult<string[]>> {
    try {
      const normalizedPath = normalizePath(dirPath);
      const entries = await fs.promises.readdir(normalizedPath);
      return {
        success: true,
        data: entries
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Copy a file
   */
  async copyFile(
    source: string, 
    destination: string, 
    overwrite?: boolean
  ): Promise<FileOperationResult> {
    try {
      // Check if destination exists and overwrite is false
      if (!overwrite && await this.exists(destination)) {
        return {
          success: false,
          error: new Error('Destination file already exists')
        };
      }
      
      await fs.promises.copyFile(source, destination);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Move a file
   */
  async moveFile(
    source: string, 
    destination: string, 
    overwrite?: boolean
  ): Promise<FileOperationResult> {
    try {
      // Check if destination exists and overwrite is false
      if (!overwrite && await this.exists(destination)) {
        return {
          success: false,
          error: new Error('Destination file already exists')
        };
      }
      
      await fs.promises.rename(source, destination);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Watch a file for changes
   */
  watchFile(filePath: string, callback: (event: 'changed' | 'deleted') => void): vscode.Disposable {
    // Normalize path
    const normalizedPath = normalizePath(filePath);
    
    // Check if already watching
    let watcher = this.fileWatchers.get(normalizedPath);
    if (watcher) {
      watcher.dispose();
    }
    
    // Create new watcher
    watcher = vscode.workspace.createFileSystemWatcher(normalizedPath);
    this.fileWatchers.set(normalizedPath, watcher);
    
    // Set up event handlers
    const changeDisposable = watcher.onDidChange(() => callback('changed'));
    const deleteDisposable = watcher.onDidDelete(() => callback('deleted'));
    
    // Return disposable that cleans up everything
    return new vscode.Disposable(() => {
      changeDisposable.dispose();
      deleteDisposable.dispose();
      watcher?.dispose();
      this.fileWatchers.delete(normalizedPath);
    });
  }
  
  /**
   * Validate file path
   */
  async validatePath(filePath: string): Promise<boolean> {
    const result = await this.validationService.validateFilePath(filePath, {
      mustExist: false,
      requireWorkspace: true
    });
    return result.isValid;
  }
  
  /**
   * Get workspace root
   */
  getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders?.[0]?.uri.fsPath;
  }
  
  /**
   * Check if path is within workspace
   */
  isWithinWorkspace(filePath: string): boolean {
    return isWithinWorkspace(filePath);
  }
  
  /**
   * Cleanup on dispose
   */
  protected onDispose(): void {
    // Dispose all file watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }
    this.fileWatchers.clear();
  }
}
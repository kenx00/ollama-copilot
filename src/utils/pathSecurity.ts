/**
 * Path security utilities for preventing directory traversal attacks
 * Provides secure path validation and normalization
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { sanitizeFilePath } from './sanitization';

/**
 * Normalizes and resolves a file path to prevent traversal attacks
 */
export function normalizePath(filePath: string): string {
  // Sanitize the path first
  const sanitized = sanitizeFilePath(filePath);
  
  // Normalize the path to resolve . and .. segments
  const normalized = path.normalize(sanitized);
  
  // Resolve to absolute path
  const resolved = path.resolve(normalized);
  
  return resolved;
}

/**
 * Checks if a path is within the allowed workspace boundaries
 */
export function isWithinWorkspace(filePath: string): boolean {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return false;
  }
  
  const normalizedPath = normalizePath(filePath);
  
  // Check if the path is within any workspace folder
  return workspaceFolders.some(folder => {
    const workspacePath = folder.uri.fsPath;
    const normalizedWorkspace = normalizePath(workspacePath);
    
    // Ensure the file path starts with the workspace path
    return normalizedPath.startsWith(normalizedWorkspace + path.sep) || 
           normalizedPath === normalizedWorkspace;
  });
}

/**
 * Validates a file path against security rules
 */
export interface PathValidationResult {
  isValid: boolean;
  reason?: string;
  normalizedPath?: string;
}

export function validateFilePath(filePath: string): PathValidationResult {
  try {
    // Check for null bytes (can be used to bypass filters)
    if (filePath.includes('\0')) {
      return { isValid: false, reason: 'Path contains null bytes' };
    }
    
    // Normalize the path
    const normalizedPath = normalizePath(filePath);
    
    // Check if path is within workspace
    if (!isWithinWorkspace(normalizedPath)) {
      return { isValid: false, reason: 'Path is outside workspace boundaries' };
    }
    
    // Check for hidden files/directories (starting with .)
    const pathSegments = normalizedPath.split(path.sep);
    const hasHiddenSegment = pathSegments.some(segment => 
      segment.startsWith('.') && segment !== '.' && segment !== '..'
    );
    
    if (hasHiddenSegment) {
      return { isValid: false, reason: 'Access to hidden files/directories is not allowed' };
    }
    
    // Check against blocked patterns
    const blockedPatterns = getBlockedPatterns();
    for (const pattern of blockedPatterns) {
      if (pattern.test(normalizedPath)) {
        return { isValid: false, reason: 'Path matches blocked pattern' };
      }
    }
    
    return { isValid: true, normalizedPath };
  } catch (error) {
    return { isValid: false, reason: `Path validation error: ${error}` };
  }
}

/**
 * Gets blocked directory/file patterns
 */
function getBlockedPatterns(): RegExp[] {
  return [
    /node_modules/i,
    /\.git\//i,
    /\.env$/i,
    /\.env\./i,
    /private\.key/i,
    /id_rsa/i,
    /\.pem$/i,
    /\.key$/i,
    /\.cert$/i,
    /\.password/i,
    /\.secret/i,
    /\.vscode\//i,
    /\.env/i,
    /\.ssh\//i,
    /\.aws\//i,
    /\.config\//i,
    /private\.key/i,
    /id_rsa/i,
    /\.pem$/i,
    /\.key$/i,
    /\.cert$/i,
    /password/i,
    /secret/i,
    /token/i,
    /credentials/i
  ];
}

/**
 * Checks if a path is a symbolic link
 */
export async function isSymbolicLink(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.lstat(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Resolves a path and checks if it's still within workspace after resolution
 */
export async function resolveAndValidatePath(filePath: string): Promise<PathValidationResult> {
  try {
    // First, do basic validation
    const basicValidation = validateFilePath(filePath);
    if (!basicValidation.isValid) {
      return basicValidation;
    }
    
    const normalizedPath = basicValidation.normalizedPath!;
    
    // Check if it's a symbolic link
    if (await isSymbolicLink(normalizedPath)) {
      // Resolve the symlink
      const realPath = await fs.promises.realpath(normalizedPath);
      
      // Validate the resolved path
      const resolvedValidation = validateFilePath(realPath);
      if (!resolvedValidation.isValid) {
        return { 
          isValid: false, 
          reason: `Symbolic link resolves outside workspace: ${resolvedValidation.reason}` 
        };
      }
    }
    
    return { isValid: true, normalizedPath };
  } catch (error) {
    return { isValid: false, reason: `Path resolution error: ${error}` };
  }
}

/**
 * Gets the relative path from workspace root
 */
export function getWorkspaceRelativePath(filePath: string): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  
  const normalizedPath = normalizePath(filePath);
  
  for (const folder of workspaceFolders) {
    const workspacePath = normalizePath(folder.uri.fsPath);
    
    if (normalizedPath.startsWith(workspacePath)) {
      return path.relative(workspacePath, normalizedPath);
    }
  }
  
  return null;
}

/**
 * Validates file extension against allowed types
 */
export function isAllowedFileType(filePath: string, allowedExtensions?: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  
  // If no specific extensions provided, use default safe list
  const extensions = allowedExtensions || [
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
    '.html', '.css', '.scss', '.less', '.xml', '.yaml', '.yml',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go',
    '.rs', '.php', '.rb', '.swift', '.kt', '.sql', '.sh',
    '.dockerfile', '.gitignore', '.editorconfig'
  ];
  
  return extensions.includes(ext);
}

/**
 * Sanitizes a file path for display (removes sensitive information)
 */
export function sanitizePathForDisplay(filePath: string): string {
  const workspaceRelative = getWorkspaceRelativePath(filePath);
  
  if (workspaceRelative) {
    return workspaceRelative;
  }
  
  // If not in workspace, just return the filename
  return path.basename(filePath);
}
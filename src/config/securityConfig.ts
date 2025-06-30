/**
 * Security configuration for file access
 */

export interface SecurityConfig {
  fileAccess: {
    maxFileSizeBytes: number;
    chunkSizeBytes: number;
    allowedExtensions: string[];
    blockedDirectories: string[];
    enableLogging: boolean;
    enableSymlinkResolution: boolean;
  };
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  fileAccess: {
    // 10MB max file size
    maxFileSizeBytes: 10 * 1024 * 1024,
    
    // 64KB chunks for reading large files
    chunkSizeBytes: 64 * 1024,
    
    // Allowed file extensions
    allowedExtensions: [
      '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
      '.html', '.css', '.scss', '.less', '.xml', '.yaml', '.yml',
      '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go',
      '.rs', '.php', '.rb', '.swift', '.kt', '.sql', '.sh',
      '.dockerfile', '.gitignore', '.editorconfig', '.env.example'
    ],
    
    // Blocked directory names
    blockedDirectories: [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'out',
      'bin',
      'obj',
      '.next',
      '.nuxt',
      'coverage',
      '.nyc_output',
      'tmp',
      'temp',
      'cache',
      '.cache'
    ],
    
    // Enable security logging
    enableLogging: true,
    
    // Enable symbolic link resolution and validation
    enableSymlinkResolution: true
  }
};

/**
 * Gets the current security configuration
 * Can be extended to read from VS Code settings
 */
export function getSecurityConfig(): SecurityConfig {
  // In the future, this could merge with user settings
  // For now, return default config
  return DEFAULT_SECURITY_CONFIG;
}

/**
 * File access permission levels
 */
export enum FileAccessLevel {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
  FULL = 'full'
}

/**
 * File access audit log entry
 */
export interface FileAccessLog {
  timestamp: Date;
  filePath: string;
  action: 'read' | 'write' | 'denied';
  reason?: string;
  userId?: string;
  success: boolean;
}
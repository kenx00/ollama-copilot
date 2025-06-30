/**
 * Sanitization utilities for various input types
 */

/**
 * Sanitizes HTML content by removing potentially dangerous elements and attributes
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove object and embed tags
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^<]*>/gi, '');
  
  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: protocol (except for images)
  sanitized = sanitized.replace(/data:(?!image\/)/gi, 'data-blocked:');
  
  // Remove vbscript: protocol
  sanitized = sanitized.replace(/vbscript:/gi, '');
  
  // Remove form tags to prevent CSRF
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
  
  // Remove meta tags that could cause redirects
  sanitized = sanitized.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '');
  
  return sanitized.trim();
}

/**
 * Sanitizes Markdown content
 */
export function sanitizeMarkdown(markdown: string): string {
  // Remove HTML tags that might be embedded in markdown
  let sanitized = sanitizeHtml(markdown);
  
  // Remove potential XSS in markdown links
  sanitized = sanitized.replace(/\[([^\]]+)\]\(javascript:[^)]+\)/gi, '[$1](#)');
  sanitized = sanitized.replace(/\[([^\]]+)\]\(vbscript:[^)]+\)/gi, '[$1](#)');
  
  // Limit consecutive newlines to prevent excessive spacing
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
  
  // Remove zero-width characters that could be used for fingerprinting
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return sanitized.trim();
}

/**
 * Sanitizes a URL by removing dangerous parts
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    // Remove any credentials
    parsed.username = '';
    parsed.password = '';
    
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Normalizes and sanitizes URLs
 */
export function normalizeUrl(url: string): string {
  try {
    // Parse URL to ensure it's valid
    const parsed = new URL(url);
    
    // Force lowercase protocol and hostname
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    
    // Remove default ports
    if ((parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }
    
    // Remove trailing slashes from pathname
    if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    
    // Sort query parameters for consistency
    if (parsed.search) {
      const params = new URLSearchParams(parsed.search);
      const sortedParams = new URLSearchParams();
      const keys = Array.from(params.keys()).sort();
      
      for (const key of keys) {
        // Remove potentially dangerous parameters
        if (!['redirect', 'return', 'goto', 'next', 'callback'].includes(key.toLowerCase())) {
          sortedParams.append(key, params.get(key) || '');
        }
      }
      
      parsed.search = sortedParams.toString();
    }
    
    // Remove fragment for API URLs
    if (parsed.pathname.includes('/api/')) {
      parsed.hash = '';
    }
    
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sanitizes file paths
 */
export function sanitizeFilePath(filePath: string): string {
  // Remove null bytes
  let sanitized = filePath.replace(/\0/g, '');
  
  // Replace backslashes with forward slashes for consistency
  sanitized = sanitized.replace(/\\/g, '/');
  
  // Remove consecutive slashes
  sanitized = sanitized.replace(/\/+/g, '/');
  
  // Remove trailing slashes
  if (sanitized.endsWith('/') && sanitized !== '/') {
    sanitized = sanitized.slice(0, -1);
  }
  
  // Remove dangerous path segments
  const segments = sanitized.split('/');
  const cleaned = segments.filter(segment => {
    // Remove empty segments
    if (!segment) return false;
    
    // Remove segments that try to escape
    if (segment === '..' || segment === '.') return false;
    
    // Remove segments with special characters at the start
    if (/^[~$]/.test(segment)) return false;
    
    return true;
  });
  
  return cleaned.join('/');
}

/**
 * Sanitizes model names
 */
export function sanitizeModelName(modelName: string): string {
  // Remove leading/trailing whitespace
  let sanitized = modelName.trim();
  
  // Replace multiple consecutive special characters with single ones
  sanitized = sanitized.replace(/[-_\/:.]+/g, (match) => match[0]);
  
  // Remove any characters that aren't alphanumeric or allowed special chars
  sanitized = sanitized.replace(/[^a-zA-Z0-9-_\/:.\s]/g, '');
  
  // Replace spaces with hyphens
  sanitized = sanitized.replace(/\s+/g, '-');
  
  // Ensure it doesn't start with special characters
  sanitized = sanitized.replace(/^[^a-zA-Z0-9]+/, '');
  
  // Ensure it doesn't end with special characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9]+$/, '');
  
  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
}

/**
 * Escapes special characters for safe display
 */
export function escapeForDisplay(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  return text.replace(/[&<>"'`=\/]/g, (char) => escapeMap[char] || char);
}

/**
 * Removes ANSI escape codes from text
 */
export function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[JKmsu]/g, '');
}

/**
 * Sanitizes JSON string
 */
export function sanitizeJson(jsonString: string): string {
  try {
    // Parse and re-stringify to remove comments and normalize format
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed);
  } catch (error) {
    // If parsing fails, do basic sanitization
    let sanitized = jsonString;
    
    // Remove comments
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
    sanitized = sanitized.replace(/\/\/.*$/gm, '');
    
    // Remove trailing commas
    sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');
    
    return sanitized;
  }
}

/**
 * Truncates text to a maximum length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  const truncateAt = maxLength - suffix.length;
  if (truncateAt <= 0) {
    return suffix.substring(0, maxLength);
  }
  
  // Try to truncate at a word boundary
  const lastSpace = text.lastIndexOf(' ', truncateAt);
  const cutPoint = lastSpace > truncateAt * 0.8 ? lastSpace : truncateAt;
  
  return text.substring(0, cutPoint) + suffix;
}

/**
 * Validates and sanitizes email addresses
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  
  // Basic email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(trimmed)) {
    return null;
  }
  
  // Additional validation
  const [localPart, domain] = trimmed.split('@');
  
  // Check local part length
  if (localPart.length > 64) {
    return null;
  }
  
  // Check domain length
  if (domain.length > 255) {
    return null;
  }
  
  // Check for consecutive dots
  if (trimmed.includes('..')) {
    return null;
  }
  
  return trimmed;
}

/**
 * Removes sensitive information from strings
 */
export function removeSensitiveInfo(text: string): string {
  let sanitized = text;
  
  // Remove potential API keys (common patterns)
  sanitized = sanitized.replace(/\b[A-Za-z0-9]{32,}\b/g, '[REDACTED_KEY]');
  
  // Remove potential tokens
  sanitized = sanitized.replace(/\b(bearer|token|api[_-]?key|secret|password|pwd|passwd|auth)\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, '$1: [REDACTED]');
  
  // Remove potential credit card numbers
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CC]');
  
  // Remove potential SSNs
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  
  // Remove email addresses in logs
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  
  return sanitized;
}
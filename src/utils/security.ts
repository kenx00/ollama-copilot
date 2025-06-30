/**
 * Security utilities for preventing XSS attacks
 * Provides HTML escaping, sanitization, and safe DOM manipulation
 */

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  return text.replace(/[&<>"'`=\/]/g, (char) => map[char]);
}

/**
 * Sanitizes HTML content by removing potentially dangerous elements and attributes
 * This is a lightweight alternative to DOMPurify for VS Code extensions
 */
export function sanitizeHtml(html: string): string {
  // List of allowed tags
  const allowedTags = [
    'b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
    'a', 'img'
  ];
  
  // List of allowed attributes per tag
  const allowedAttributes: Record<string, string[]> = {
    'a': ['href', 'title'],
    'img': ['src', 'alt', 'width', 'height'],
    'code': ['class'], // Allow class for syntax highlighting
    'pre': ['class']
  };
  
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove event handlers
  html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  html = html.replace(/javascript:/gi, '');
  
  // Remove data: protocol (except for images)
  html = html.replace(/data:(?!image\/)/gi, '');
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Clean the HTML tree
  cleanNode(tempDiv);
  
  function cleanNode(node: Element) {
    // Get all child nodes as array (to avoid live collection issues)
    const children = Array.from(node.childNodes);
    
    children.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element;
        const tagName = element.tagName.toLowerCase();
        
        // Remove disallowed tags
        if (!allowedTags.includes(tagName)) {
          element.remove();
          return;
        }
        
        // Clean attributes
        const attributes = Array.from(element.attributes);
        attributes.forEach(attr => {
          const attrName = attr.name.toLowerCase();
          const allowedAttrs = allowedAttributes[tagName] || [];
          
          // Remove disallowed attributes
          if (!allowedAttrs.includes(attrName)) {
            element.removeAttribute(attr.name);
          } else {
            // Sanitize attribute values
            let value = attr.value;
            
            // For href and src, ensure no javascript: or vbscript:
            if ((attrName === 'href' || attrName === 'src') && 
                (value.toLowerCase().includes('javascript:') || 
                 value.toLowerCase().includes('vbscript:'))) {
              element.removeAttribute(attr.name);
            }
          }
        });
        
        // Recursively clean child nodes
        cleanNode(element);
      }
    });
  }
  
  return tempDiv.innerHTML;
}

/**
 * Creates a text node safely (prevents any HTML interpretation)
 */
export function createTextNode(text: string): Text {
  return document.createTextNode(text);
}

/**
 * Safely sets text content of an element
 */
export function setTextContent(element: HTMLElement, text: string): void {
  element.textContent = text;
}

/**
 * Validates and sanitizes a language identifier for code blocks
 */
export function sanitizeLanguage(language: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return language.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Creates a safe code block element
 */
export function createSafeCodeBlock(code: string, language?: string): HTMLElement {
  const pre = document.createElement('pre');
  const codeElement = document.createElement('code');
  
  if (language) {
    const sanitizedLang = sanitizeLanguage(language);
    if (sanitizedLang) {
      codeElement.className = `language-${sanitizedLang}`;
    }
  }
  
  // Use textContent to prevent any HTML interpretation
  codeElement.textContent = code;
  pre.appendChild(codeElement);
  
  return pre;
}

/**
 * Safely creates an inline code element
 */
export function createSafeInlineCode(code: string): HTMLElement {
  const codeElement = document.createElement('code');
  codeElement.textContent = code;
  return codeElement;
}

/**
 * Parses and renders markdown-like content safely
 */
export function renderMarkdownSafely(content: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  
  // Split content by code blocks first
  const parts = content.split(/(```[a-z]*\n[\s\S]*?```)/g);
  
  parts.forEach(part => {
    if (part.startsWith('```')) {
      // Handle code block
      const match = part.match(/```([a-z]*)\n([\s\S]*?)```/);
      if (match) {
        const language = match[1];
        const code = match[2];
        fragment.appendChild(createSafeCodeBlock(code, language));
      }
    } else {
      // Handle regular text with inline code
      const inlineParts = part.split(/(`[^`]+`)/g);
      
      inlineParts.forEach(inlinePart => {
        if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
          // Inline code
          const code = inlinePart.slice(1, -1);
          fragment.appendChild(createSafeInlineCode(code));
        } else {
          // Regular text - escape HTML but preserve newlines as <br>
          const lines = inlinePart.split('\n');
          lines.forEach((line, index) => {
            if (line) {
              const textNode = document.createTextNode(line);
              fragment.appendChild(textNode);
            }
            if (index < lines.length - 1) {
              fragment.appendChild(document.createElement('br'));
            }
          });
        }
      });
    }
  });
  
  return fragment;
}

/**
 * Validates file paths to prevent directory traversal attacks
 */
export function isValidFilePath(filePath: string): boolean {
  // Check for directory traversal patterns
  const traversalPatterns = [
    /\.\./,  // Parent directory
    /\.\.\\/, // Parent directory (Windows)
    /^\//, // Absolute path (Unix)
    /^[a-zA-Z]:[\\\/]/, // Absolute path (Windows)
    /[<>"|?*]/ // Invalid characters
  ];
  
  return !traversalPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Sanitizes file names for display
 */
export function sanitizeFileName(fileName: string): string {
  // Remove any path components and keep only the file name
  const baseName = fileName.split(/[/\\]/).pop() || '';
  // Escape HTML in the file name
  return escapeHtml(baseName);
}

/**
 * Creates a Content Security Policy nonce
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Validates that a string is a valid model name (alphanumeric with some special chars)
 */
export function isValidModelName(modelName: string): boolean {
  return /^[a-zA-Z0-9_\-.:]+$/.test(modelName);
}
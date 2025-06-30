/**
 * Secure markdown renderer for chat messages
 * Provides safe markdown-to-HTML conversion with XSS protection
 */

import { escapeHtml, sanitizeLanguage, sanitizeHtml } from './security';

export interface MarkdownRenderOptions {
  allowHtml?: boolean;
  sanitize?: boolean;
  breaks?: boolean;
}

/**
 * Renders markdown content to safe HTML
 */
export class SecureMarkdownRenderer {
  private options: MarkdownRenderOptions;

  constructor(options: MarkdownRenderOptions = {}) {
    this.options = {
      allowHtml: false,
      sanitize: true,
      breaks: true,
      ...options
    };
  }

  /**
   * Renders markdown content to HTML string
   */
  render(markdown: string): string {
    let html = markdown;

    // Always escape HTML first if not allowing raw HTML
    if (!this.options.allowHtml) {
      html = escapeHtml(html);
    }

    // Process code blocks first (to avoid processing their content)
    html = this.renderCodeBlocks(html);

    // Process inline elements
    html = this.renderInlineCode(html);
    html = this.renderBold(html);
    html = this.renderItalic(html);
    html = this.renderLinks(html);
    html = this.renderHeadings(html);
    html = this.renderLists(html);
    html = this.renderBlockquotes(html);

    // Convert line breaks if enabled
    if (this.options.breaks) {
      html = this.renderLineBreaks(html);
    }

    // Wrap in paragraphs
    html = this.renderParagraphs(html);

    // Sanitize the final HTML if enabled
    if (this.options.sanitize) {
      html = sanitizeHtml(html);
    }

    return html;
  }

  /**
   * Renders code blocks with syntax highlighting support
   */
  private renderCodeBlocks(text: string): string {
    // Match code blocks with optional language
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    
    return text.replace(codeBlockRegex, (_match, language, code) => {
      const sanitizedLang = sanitizeLanguage(language || '');
      const escapedCode = escapeHtml(code.trim());
      
      if (sanitizedLang) {
        return `<pre><code class="language-${sanitizedLang}">${escapedCode}</code></pre>`;
      }
      return `<pre><code>${escapedCode}</code></pre>`;
    });
  }

  /**
   * Renders inline code
   */
  private renderInlineCode(text: string): string {
    // Match inline code (single backticks)
    const inlineCodeRegex = /`([^`]+)`/g;
    
    return text.replace(inlineCodeRegex, (_match, code) => {
      const escapedCode = escapeHtml(code);
      return `<code>${escapedCode}</code>`;
    });
  }

  /**
   * Renders bold text
   */
  private renderBold(text: string): string {
    // Match **text** or __text__
    const boldRegex = /(\*\*|__)([^\*_]+)\1/g;
    
    return text.replace(boldRegex, (_match, _delimiter, content) => {
      return `<strong>${content}</strong>`;
    });
  }

  /**
   * Renders italic text
   */
  private renderItalic(text: string): string {
    // Match *text* or _text_ (but not ** or __)
    const italicRegex = /(?<!\*)\*(?!\*)([^\*]+)\*(?!\*)|(?<!_)_(?!_)([^_]+)_(?!_)/g;
    
    return text.replace(italicRegex, (_match, content1, content2) => {
      const content = content1 || content2;
      return `<em>${content}</em>`;
    });
  }

  /**
   * Renders links
   */
  private renderLinks(text: string): string {
    // Match [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    return text.replace(linkRegex, (_match, linkText, url) => {
      // Validate URL to prevent javascript: and other dangerous protocols
      const sanitizedUrl = this.sanitizeUrl(url);
      if (!sanitizedUrl) {
        return linkText; // Return just the text if URL is invalid
      }
      
      return `<a href="${sanitizedUrl}" rel="noopener noreferrer">${linkText}</a>`;
    });
  }

  /**
   * Renders headings
   */
  private renderHeadings(text: string): string {
    // Match # heading at start of line
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    
    return text.replace(headingRegex, (_match, hashes, content) => {
      const level = hashes.length;
      return `<h${level}>${content}</h${level}>`;
    });
  }

  /**
   * Renders unordered and ordered lists
   */
  private renderLists(text: string): string {
    // Process unordered lists
    const ulRegex = /^(\s*)[-*+]\s+(.+)$/gm;
    let inList = false;
    let listItems: string[] = [];
    
    text = text.replace(ulRegex, (_match, _indent, content) => {
      if (!inList) {
        inList = true;
      }
      listItems.push(`<li>${content}</li>`);
      return '<!-- LIST_ITEM -->';
    });
    
    // Replace list markers with actual list
    if (listItems.length > 0) {
      const listHtml = `<ul>${listItems.join('')}</ul>`;
      text = text.replace(/(<!-- LIST_ITEM -->\n?)+/g, listHtml);
    }
    
    // Process ordered lists
    const olRegex = /^(\s*)\d+\.\s+(.+)$/gm;
    text = text.replace(olRegex, (_match, _indent, content) => {
      return `<ol><li>${content}</li></ol>`;
    });
    
    return text;
  }

  /**
   * Renders blockquotes
   */
  private renderBlockquotes(text: string): string {
    const blockquoteRegex = /^>\s+(.+)$/gm;
    
    return text.replace(blockquoteRegex, (_match, content) => {
      return `<blockquote>${content}</blockquote>`;
    });
  }

  /**
   * Renders line breaks
   */
  private renderLineBreaks(text: string): string {
    // Replace single line breaks with <br> (except in pre tags)
    return text.replace(/\n(?![^<]*<\/pre>)/g, '<br>');
  }

  /**
   * Wraps text in paragraphs
   */
  private renderParagraphs(text: string): string {
    // Split by double line breaks
    const paragraphs = text.split(/\n\n+/);
    
    return paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        // Don't wrap if already wrapped in block element
        if (p.startsWith('<pre>') || p.startsWith('<h') || 
            p.startsWith('<ul>') || p.startsWith('<ol>') || 
            p.startsWith('<blockquote>')) {
          return p;
        }
        return `<p>${p}</p>`;
      })
      .join('\n');
  }

  /**
   * Sanitizes URLs to prevent XSS
   */
  private sanitizeUrl(url: string): string | null {
    // List of allowed protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    
    try {
      const urlObj = new URL(url);
      
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return null;
      }
      
      return url;
    } catch {
      // If URL parsing fails, check if it's a relative URL
      if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        return url;
      }
      
      return null;
    }
  }
}

/**
 * Creates a secure markdown renderer with default options
 */
export function createSecureMarkdownRenderer(): SecureMarkdownRenderer {
  return new SecureMarkdownRenderer({
    allowHtml: false,
    sanitize: true,
    breaks: true
  });
}

/**
 * Renders markdown to safe HTML using default secure settings
 */
export function renderMarkdownSecurely(markdown: string): string {
  const renderer = createSecureMarkdownRenderer();
  return renderer.render(markdown);
}
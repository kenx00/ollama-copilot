// responseCleaners.ts
import * as vscode from "vscode";

export function cleanAIResponse(
  response: string,
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  if (!response.trim()) {return "";}

  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  const baseIndentation = linePrefix.match(/^\s*/)?.[0] || "";

  // Extract code between markdown code fence markers
  const codeBlockMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    // Use the code inside the code block
    response = codeBlockMatch[1];
  }

  // Split into lines and process while preserving relative indentation
  const lines = response.split('\n');
  
  // Find minimum indentation level (ignoring empty lines)
  const minIndent = Math.min(
    ...lines
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/^\s*/);
        return match ? match[0].length : 0;
      })
  );

  // Process lines while preserving relative indentation
  let cleaned = lines
    .map(line => {
      if (!line.trim() || line.startsWith('```')) return ''; // Remove empty lines and fence markers
      const match = line.match(/^\s*/);
      const lineIndent = match ? match[0] : '';
      const relativeIndent = ' '.repeat(Math.max(0, lineIndent.length - minIndent));
      return baseIndentation + relativeIndent + line.trim();
    })
    .filter(Boolean) // Remove empty lines
    .join('\n');

  // Context-specific adjustments
  if (/['"`]$/.test(linePrefix)) {
    cleaned = cleaned.replace(/['"`]/g, ''); // Strip quotes for string literals
  } else if (/{$/.test(linePrefix.trim())) {
    cleaned = cleaned.split('\n')
      .map((line, i) => i === 0 ? line : baseIndentation + '  ' + line.trim())
      .join('\n');
  } else if (linePrefix.trim().endsWith('=')) {
    cleaned = cleaned.replace(/;\s*$/, ''); // Remove trailing semicolon after =
  }

  return cleaned;
}

export function getUniqueCompletion(completion: string, linePrefix: string): string | undefined {
  if (!completion.trim()) {return undefined;}
  const prefixTrimmed = linePrefix.trim();
  if (prefixTrimmed && completion.startsWith(prefixTrimmed)) {
    return completion.substring(prefixTrimmed.length).trim();
  }
  return completion;
}

export function cleanCompletion(response: string): string {
  if (!response.trim()) return "";
  
  // Remove all markdown code fences (including nested ones)
  let cleaned = response;
  
  // Remove all occurrences of ```language at the start of lines
  cleaned = cleaned.replace(/^```\w*$/gm, '');
  
  // Remove inline ```language markers
  cleaned = cleaned.replace(/```\w+/g, '');
  
  // Remove standalone ``` markers
  cleaned = cleaned.replace(/```/g, '');
  
  // Extract code from markdown code blocks if they still exist
  const codeBlockMatch = cleaned.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/m);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }
  
  // Split into lines for further processing
  const lines = cleaned.split('\n');
  
  // Filter out unwanted lines
  const cleanedLines = lines.filter((line, index) => {
    const trimmedLine = line.trim();
    
    // Remove empty lines at the start
    if (index === 0 && !trimmedLine) return false;
    
    // Remove lines that are just language identifiers
    if (/^(go|javascript|typescript|python|java|c\+\+|c|rust|swift|kotlin|ruby|php)$/i.test(trimmedLine)) {
      return false;
    }
    
    // Remove lines that look like markdown headers or explanations
    if (trimmedLine.startsWith('#') && !trimmedLine.startsWith('#!')) return false;
    if (trimmedLine.startsWith('---') || trimmedLine.startsWith('===')) return false;
    if (trimmedLine.startsWith('```')) return false;
    
    // Remove explanatory comments (but keep TODO comments and code comments)
    if (trimmedLine.startsWith('//') && 
        !trimmedLine.startsWith('// TODO') && 
        !trimmedLine.startsWith('// FIXME') &&
        !trimmedLine.startsWith('// NOTE') &&
        !trimmedLine.startsWith('// @')) {
      // Check if it looks like an explanation rather than a code comment
      const lowerLine = trimmedLine.toLowerCase();
      if (lowerLine.includes('this is') || 
          lowerLine.includes('here is') || 
          lowerLine.includes('the following') ||
          lowerLine.includes('example:') ||
          lowerLine.includes('returns') && lowerLine.includes('function')) {
        return false;
      }
    }
    
    return true;
  });
  
  // Join lines and do final cleanup
  cleaned = cleanedLines.join('\n').trim();
  
  // Final safety check - if the response still contains markdown indicators, return empty
  if (cleaned.includes('```')) {
    console.warn('[cleanCompletion] Response still contains markdown after cleaning:', cleaned);
    // Try one more aggressive cleanup
    cleaned = cleaned.split('```')[0].trim();
  }
  
  return cleaned;
}
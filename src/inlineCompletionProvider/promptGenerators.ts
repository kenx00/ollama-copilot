// promptGenerators.ts
import * as vscode from "vscode";
import { findVariablesInScope } from "./helpers";

export function generatePrompt(
  fileContext: string,
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  const indentation = linePrefix.match(/^\s*/)?.[0] || "";
  const language = document.languageId;
  const variablesInScope = findVariablesInScope(document, position);

  const isInQuotes = /['"`]$/.test(linePrefix);
  const isAfterEquals = /=[\s]*$/.test(linePrefix);
  const isInBraces = /{$/.test(linePrefix.trim());
  const prevLine = position.line > 0 ? document.lineAt(position.line - 1).text.trim() : "";

  let prompt = `Complete this ${language} code:
Current line: "${linePrefix}"
Previous line: "${prevLine}"
Indentation: ${indentation.length} spaces
Variables in scope: ${variablesInScope.join(', ') || 'none'}
Context:
${fileContext}
RETURN ONLY THE CODE TO INSERT. NO EXPLANATIONS, NO <THINK> BLOCKS, NO COMMENTS, NO MARKDOWN. JUST THE RAW CODE.`;

  if (isInQuotes) {
    prompt += `\nCursor is inside a string literal. Return ONLY the string content, NO quotes.`;
  } else if (isInBraces) {
    prompt += `\nCursor is inside an object/block. Return ONE indented property/statement.`;
  } else if (isAfterEquals) {
    prompt += `\nCursor is after an assignment. Return a value or expression.`;
  }

  return prompt;
}

export function generatePromptFromContext(
  context: {
    prefix: string;
    suffix: string;
    currentLine: string;
    language: string;
  }
): string {
  const { prefix, suffix, currentLine, language } = context;
  
  // Limit context size to avoid overwhelming the model
  const maxContextLength = 1000;
  const prefixTruncated = prefix.length > maxContextLength 
    ? '...' + prefix.slice(-maxContextLength) 
    : prefix;
  const suffixTruncated = suffix.length > maxContextLength 
    ? suffix.slice(0, maxContextLength) + '...' 
    : suffix;
  
  return `You are a code completion engine. Complete the ${language} code at the cursor position.

Current line: "${currentLine}"

Code before cursor:
${prefixTruncated}

Code after cursor:
${suffixTruncated}

RULES:
1. Return ONLY the raw code to insert at the cursor position
2. Do NOT use markdown code fences (no \`\`\`)
3. Do NOT include language identifiers (no 'go', 'javascript', etc.)
4. Do NOT add explanations or comments
5. Do NOT use <THINK> blocks
6. Return code that fits naturally with the surrounding context

Example of WRONG response:
\`\`\`go
fmt.Println("Hello")
\`\`\`

Example of CORRECT response:
fmt.Println("Hello")

Now complete the code:`;
}
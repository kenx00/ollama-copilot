import * as vscode from "vscode";
import ollama from "ollama";

// Simple LRU Cache implementation
class LRUCache<K, V> {
    private maxSize: number;
    private cache: Map<K, { value: V; lastUsed: number }>;
    private timeCounter: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.timeCounter = 0; // Monotonic counter for LRU tracking
    }

    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (entry) {
            entry.lastUsed = this.timeCounter++; // Update usage time
            return entry.value;
        }
        return undefined;
    }

    set(key: K, value: V): void {
        if (this.cache.size >= this.maxSize) {
            // Find and remove the least recently used item
            let oldestKey: K | undefined;
            let oldestTime = Infinity;
            for (const [k, v] of this.cache) {
                if (v.lastUsed < oldestTime) {
                    oldestTime = v.lastUsed;
                    oldestKey = k;
                }
            }
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, { value, lastUsed: this.timeCounter++ });
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }
}

export function registerInlineCompletionProvider(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: "**" },
        new OllamaInlineCompletionProvider()
    );
    context.subscriptions.push(provider);
}

class OllamaInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private currentResponse: { abort: () => void } | null = null;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_DELAY = 200; // ms
    private readonly completionCache: LRUCache<string, { completion: string, timestamp: number }>;
    private readonly CACHE_SIZE = 100;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

    constructor() {
        this.completionCache = new LRUCache<string, { completion: string, timestamp: number }>(this.CACHE_SIZE);
    }

    private generateCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
        const contextHash = this.getContextHash(document, position);
        return `${contextHash}:${linePrefix}`;
    }

    private getContextHash(document: vscode.TextDocument, position: vscode.Position): string {
        const context = this.getFileContext(document, position);
        // Simple hash function for context
        return context.split('').reduce((acc, char) => {
            return ((acc << 5) - acc) + char.charCodeAt(0) >>> 0;
        }, 0).toString(36);
    }

    async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[] | undefined> {
        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
        const cacheKey = this.generateCacheKey(document, position);

        // Check cache first
        const cachedResult = this.completionCache.get(cacheKey);
        if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
            const uniqueCompletion = this.getUniqueCompletion(cachedResult.completion, linePrefix);
            if (uniqueCompletion) {
                return [new vscode.InlineCompletionItem(uniqueCompletion)];
            }
        }

        // Cancel any pending request
        if (this.currentResponse) {
            this.currentResponse.abort();
            this.currentResponse = null;
        }
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        return new Promise((resolve) => {
            this.debounceTimeout = setTimeout(async () => {
                try {
                    const config = vscode.workspace.getConfiguration("ollama");
                    const model = config.get<string>("defaultModel");

                    if (!model) {
                        vscode.window.showWarningMessage("No Ollama model selected. Set 'ollama.defaultModel' in settings.");
                        resolve(undefined);
                        return;
                    }

                    const fileContext = this.getFileContext(document, position);
                    const prompt = this.generatePrompt(fileContext, document, position);
                    
                    const completion = await this.generateCompletion(prompt, model);
                    if (token.isCancellationRequested) {
                        resolve(undefined);
                        return;
                    }

                    const cleanedCompletion = this.cleanAIResponse(completion);
                    if (!cleanedCompletion) {
                        resolve(undefined);
                        return;
                    }

                    // Cache the completion
                    this.completionCache.set(cacheKey, {
                        completion: cleanedCompletion,
                        timestamp: Date.now()
                    });

                    const uniqueCompletion = this.getUniqueCompletion(cleanedCompletion, linePrefix);
                    if (uniqueCompletion) {
                        resolve([new vscode.InlineCompletionItem(uniqueCompletion)]);
                    } else {
                        resolve(undefined);
                    }
                } catch (error: unknown) {
                    if (error instanceof Error && error.name === 'AbortError') {
                        resolve(undefined);
                    } else {
                        console.error("Completion error:", error);
                        resolve(undefined);
                    }
                }
            }, this.DEBOUNCE_DELAY);
        });
    }

    private getUniqueCompletion(completion: string, linePrefix: string): string | undefined {
        if (completion.startsWith(linePrefix)) {
            const uniqueCompletion = completion.substring(linePrefix.length);
            return uniqueCompletion.trim() ? uniqueCompletion : undefined;
        }
        return completion.trim() ? completion : undefined;
    }

    private async generateCompletion(prompt: string, model: string): Promise<string> {
        const request = {
            model: model,
            stream: true as const,
            messages: [{
                role: "system",
                content: "You are a code completion assistant like GitHub Copilot. Provide direct, contextually relevant code completions. Focus on completing the current line or block while maintaining proper indentation. Never include explanations or comments. Respond only with the code completion itself."
            }, {
                role: "user",
                content: prompt
            }]
        };

        let fullResponse = '';
        let lastResponseTime = Date.now();
        const STREAM_TIMEOUT = 5000; // 5 seconds timeout for stream

        try {
            const response = await ollama.chat(request);
            this.currentResponse = response;

            // Iterate through the stream with timeout protection
            for await (const part of response) {
                if (Date.now() - lastResponseTime > STREAM_TIMEOUT) {
                    throw new Error('Stream timeout');
                }
                if (part.message?.content) {
                    fullResponse += part.message.content;
                    lastResponseTime = Date.now();
                }
            }
            
            return fullResponse;
        } finally {
            this.currentResponse = null;
        }
    }

    private getFileContext(document: vscode.TextDocument, position: vscode.Position): string {
        // Get imports and relevant code context
        const fullText = document.getText();
        const lines = fullText.split('\n');
        const imports = lines.filter(line => line.trim().startsWith('import')).join('\n');
        
        // Get the current function/class context
        let contextStart = position.line;
        while (contextStart > 0) {
            const line = lines[contextStart].trim();
            if (line.startsWith('class') || line.startsWith('function') || line.startsWith('const') || line.startsWith('let')) {
                break;
            }
            contextStart--;
        }
        
        const relevantLines = lines.slice(Math.max(0, contextStart - 5), position.line + 1);
        return `${imports}\n\n${relevantLines.join('\n')}`;
    }

    private generatePrompt(fileContext: string, document: vscode.TextDocument, position: vscode.Position): string {
       const currentLine = document.lineAt(position.line).text.substring(0, position.character);
       const indentation = currentLine.match(/^\s*/)?.[0] || '';

       const language = document.languageId;
       
       return `Complete the following ${language} code. Maintain the current indentation level (${indentation.length} spaces). Provide only the completion, no explanations:

${fileContext}`;
    }

    private cleanAIResponse(response: string): string {
        // Remove any thinking process or explanations
        response = response.replace(/<think>[\s\S]*?<\/think>/g, '');
        response = response.replace(/<.*?>/g, '');
        
        // Remove any lines starting with common prefixes that indicate meta-commentary
        const lines = response.split('\n').filter(line => {
            const trimmedLine = line.trim().toLowerCase();
            return !trimmedLine.startsWith('here') &&
                   !trimmedLine.startsWith('i think') &&
                   !trimmedLine.startsWith('maybe') &&
                   !trimmedLine.startsWith('let me') &&
                   !trimmedLine.startsWith('okay') &&
                   !trimmedLine.startsWith('so') &&
                   !trimmedLine.startsWith('now') &&
                   !trimmedLine.startsWith('first') &&
                   !trimmedLine.startsWith('then') &&
                   !trimmedLine.startsWith('next') &&
                   !trimmedLine.startsWith('finally');
        });
        
        return lines.join('\n').trim();
    }
}

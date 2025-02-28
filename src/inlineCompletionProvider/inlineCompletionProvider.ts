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
    private abortController: AbortController | null = null;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_DELAY = 100;
    private suggestionCache: LRUCache<string, string>; // Replace Map with LRUCache

    constructor() {
        this.suggestionCache = new LRUCache<string, string>(1000); // Cap at 1000 entries
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionList | undefined> {
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke && !vscode.window.activeTextEditor) {
            return undefined;
        }

        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

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

                    const prompt = this.generatePrompt(document, position);
                    const cacheKey = `${document.uri.toString()}:${position.line}:${prompt}`;

                    if (this.suggestionCache.has(cacheKey)) {
                        resolve(this.buildCompletion(this.suggestionCache.get(cacheKey)!, position, document));
                        return;
                    }

                    if (token.isCancellationRequested || signal.aborted) {
                        resolve(undefined);
                        return;
                    }

                    const completion = await this.generateCompletion(prompt, model, signal);
                    if (token.isCancellationRequested || signal.aborted) {
                        resolve(undefined);
                        return;
                    }

                    const cleanedCompletion = this.cleanAIResponse(completion);
                    this.suggestionCache.set(cacheKey, cleanedCompletion);
                    resolve(this.buildCompletion(cleanedCompletion, position, document));
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") {
                        resolve(undefined);
                    } else {
                        console.error("Completion error:", error);
                        resolve(undefined);
                    }
                } finally {
                    this.abortController = null;
                }
            }, this.DEBOUNCE_DELAY);
        });
    }

    private generatePrompt(document: vscode.TextDocument, position: vscode.Position): string {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return "";

        const range = new vscode.Range(
            new vscode.Position(Math.max(0, position.line - 20), 0),
            position
        );
        const contextText = document.getText(range).slice(-1000);
        const currentLine = document.lineAt(position.line).text.slice(0, position.character);
        const languageId = document.languageId;
        return `Complete the following ${languageId} code. Provide only the completion, no explanations:\n${contextText}${currentLine}`;
    }

    private async generateCompletion(prompt: string, model: string, signal: AbortSignal): Promise<string> {
        const request = {
            model,
            messages: [
                {
                    role: "system",
                    content: "You are a code completion assistant. Provide concise, accurate code completions without explanations or meta-commentary."
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 100
        };
        const response = await ollama.chat(request, { signal });
        return response.message.content;
    }

    private cleanAIResponse(response: string): string {
        response = response.replace(/```[\s\S]*?```/g, "");
        response = response.replace(/<[^>]+>/g, "");
        return response.split("\n")
            .filter(line => !/^\s*(here|i think|maybe|let|okay|so)/i.test(line.trim()))
            .join("\n")
            .trim();
    }

    private buildCompletion(completion: string, position: vscode.Position, document: vscode.TextDocument): vscode.InlineCompletionList {
        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
        if (completion.startsWith(linePrefix)) {
            const uniquePart = completion.substring(linePrefix.length);
            return {
                items: [{
                    insertText: uniquePart,
                    range: new vscode.Range(position, position),
                    filterText: uniquePart
                }]
            };
        }
        return {
            items: [{
                insertText: completion,
                range: new vscode.Range(position, position),
                filterText: completion
            }]
        };
    }
}

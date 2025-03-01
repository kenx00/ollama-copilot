import * as vscode from "vscode";
import ollama from "ollama";

export async function registerInlineCompletionProvider(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerInlineCompletionItemProvider({
       pattern: '**'
    }, new OllamaInlineCompletionProvider());

    context.subscriptions.push(provider);
}

class OllamaInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private currentResponse: { abort: () => void } | null = null;
    private lastCompletion: string | null = null;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_DELAY = 200; // ms

    async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[] | undefined> {
        // Get the current line text up to the cursor
        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);

        // If the current text matches what we're already suggesting, keep the current completion
        if (this.lastCompletion && this.lastCompletion.startsWith(linePrefix)) {
            const uniqueCompletion = this.lastCompletion.substring(linePrefix.length);
            if (uniqueCompletion.trim()) {
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
                    const config = vscode.workspace.getConfiguration();
                    const model = config.get<string>("ollama.defaultModel");

                    if (!model) {
                        vscode.window.showWarningMessage("No model selected");
                        resolve(undefined);
                        return;
                    }

                    // Get context from the current file
                    const fileContext = this.getFileContext(document, position);
                    const prompt = this.generatePrompt(fileContext, document, position);
                    
                    const completion = await this.generateCompletion(prompt, model);
                    if (token.isCancellationRequested) {
                        resolve(undefined);
                        return;
                    }

                    // Clean up AI response
                    const cleanedCompletion = this.cleanAIResponse(completion);
                    if (!cleanedCompletion) {
                        resolve(undefined);
                        return;
                    }

                    this.lastCompletion = cleanedCompletion;
                    
                    // Only return completion if it doesn't overlap with existing text
                    if (cleanedCompletion.startsWith(linePrefix)) {
                        const uniqueCompletion = cleanedCompletion.substring(linePrefix.length);
                        if (uniqueCompletion.trim()) {
                            resolve([new vscode.InlineCompletionItem(uniqueCompletion)]);
                        } else {
                            resolve(undefined);
                        }
                    } else {
                        if (cleanedCompletion.trim()) {
                            resolve([new vscode.InlineCompletionItem(cleanedCompletion)]);
                        } else {
                            resolve(undefined);
                        }
                    }
                } catch (error: unknown) {
                    if (error instanceof Error && error.name === 'AbortError') {
                        resolve(undefined);
                    } else {
                        console.error('Error generating completion:', error);
                        resolve(undefined);
                    }
                }
            }, this.DEBOUNCE_DELAY);
        });
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

    private async generateCompletion(prompt: string, model: string): Promise<string> {
        const request = {
            model: model,
            stream: true as const,  // Type assertion to make it a literal true
            messages: [{
                role: "system",
                content: "You are a code completion assistant like GitHub Copilot. Provide direct, contextually relevant code completions. Focus on completing the current line or block while maintaining proper indentation. Never include explanations or comments. Respond only with the code completion itself."
            }, {
                role: "user",
                content: prompt
            }]
        };

        let fullResponse = '';
        
        try {
            const response = await ollama.chat(request);
            this.currentResponse = response;

            // Iterate through the stream
            for await (const part of response) {
                if (part.message?.content) {
                    fullResponse += part.message.content;
                }
            }
            
            return fullResponse;
        } finally {
            this.currentResponse = null;
        }
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

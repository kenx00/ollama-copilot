import * as vscode from "vscode";
import ollama from "ollama";

export async function registerInlineCompletionProvider(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerInlineCompletionItemProvider({
       pattern: '**'
    }, new OllamaInlineCompletionProvider());

    context.subscriptions.push(provider);
}

class OllamaInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private lastRequest: AbortController | null = null;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_DELAY = 50; // ms

    async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[] | undefined> {
        // Cancel any pending request
        if (this.lastRequest) {
            this.lastRequest.abort();
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

                    const prompt = this.generatePrompt(document, position);
                    this.lastRequest = new AbortController();

                    const completion = await this.generateCompletion(prompt, model, this.lastRequest.signal);
                    if (token.isCancellationRequested) {
                        resolve(undefined);
                        return;
                    }

                    // Clean up AI response
                    const cleanedCompletion = this.cleanAIResponse(completion);
                    
                    // Get the current line text up to the cursor
                    const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
                    
                    // Only return completion if it doesn't overlap with existing text
                    if (cleanedCompletion.startsWith(linePrefix)) {
                        const uniqueCompletion = cleanedCompletion.substring(linePrefix.length);
                        resolve([new vscode.InlineCompletionItem(uniqueCompletion)]);
                    } else {
                        resolve([new vscode.InlineCompletionItem(cleanedCompletion)]);
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

    private generatePrompt(document: vscode.TextDocument, position: vscode.Position): string {
       // pick the text before the cursor along with the 10 previous lines
       const lines = document.getText(new vscode.Range(new vscode.Position(0, 0), position)).split("\n");
       const previousLines = lines.slice(Math.max(0, lines.length - 10)).join("\n");
       const currentLine = lines[lines.length - 1];
       if (previousLines.length > 0) {
        return `Complete the following code. Provide only the completion, no explanations or thinking process:\n${previousLines}\n${currentLine}`;
       } else {
        return `Complete the following code. Provide only the completion, no explanations or thinking process:\n${currentLine}`;
       }
    }

    private async generateCompletion(prompt: string, model: string, signal: AbortSignal): Promise<string> {
        const request = {
            model: model,
            messages: [{
                role: "system",
                content: "You are a code completion assistant. Provide direct completions without explanations, thinking process, or meta-commentary. Never use XML-like tags or prefixes."
            }, {
                role: "user",
                content: prompt
            }]
        }
        console.log(request);
        const response = await ollama.chat(
            request
        );

        return response.message.content;
    }

    private cleanAIResponse(response: string): string {
        // Remove any thinking process or explanations enclosed in XML-like tags
        response = response.replace(/<think>[\s\S]*?<\/think>/g, '');
        response = response.replace(/<.*?>/g, '');
        
        // Remove any lines starting with common prefixes that indicate meta-commentary
        const lines = response.split('\n').filter(line => {
            const trimmedLine = line.trim().toLowerCase();
            return !trimmedLine.startsWith('here') &&
                   !trimmedLine.startsWith('i think') &&
                   !trimmedLine.startsWith('maybe') &&
                   !trimmedLine.startsWith('let') &&
                   !trimmedLine.startsWith('okay') &&
                   !trimmedLine.startsWith('so');
        });
        
        return lines.join('\n').trim();
    }
}

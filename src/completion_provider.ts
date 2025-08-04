import * as vscode from 'vscode';
import { OllamaClient } from './ollama_client';

export class OllamaCompletionProvider implements vscode.InlineCompletionItemProvider {
    private ollamaClient: OllamaClient;
    private activeRequests = new Map<number, AbortController>();

    constructor(ollamaClient: OllamaClient) {
        this.ollamaClient = ollamaClient;
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const config = vscode.workspace.getConfiguration('ollama');
        const model = config.get<string>('codeCompletion.model', 'codellama');
        const maxTokens = config.get<number>('codeCompletion.maxTokens', 100);
        const temperature = config.get<number>('codeCompletion.temperature', 0.2);

        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        if (linePrefix.trim().length === 0) {
            return undefined;
        }

        const prompt = this._buildPrompt(document, position);
        
        const requestId = Date.now();
        const abortController = new AbortController();
        this.activeRequests.set(requestId, abortController);

        try {
            const completionText = await this._getCompletion(
                prompt,
                model,
                maxTokens,
                temperature,
                abortController.signal
            );

            if (token.isCancellationRequested || !completionText) {
                return undefined;
            }

            const range = new vscode.Range(position, position);
            const completionItem = new vscode.InlineCompletionItem(
                completionText,
                range
            );

            return [completionItem];
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Completion error:', error);
                vscode.window.showErrorMessage(`Ollama completion error: ${error.message}`);
            }
            return undefined;
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    private _buildPrompt(document: vscode.TextDocument, position: vscode.Position): string {
        const lineCount = Math.min(50, position.line);
        const startLine = Math.max(0, position.line - lineCount);
        
        const lines = [];
        for (let i = startLine; i <= position.line; i++) {
            const line = document.lineAt(i);
            if (i === position.line) {
                lines.push(line.text.substring(0, position.character));
            } else {
                lines.push(line.text);
            }
        }

        const prefix = lines.join('\n');
        
        const suffixLines = [];
        const endLine = Math.min(document.lineCount - 1, position.line + 10);
        for (let i = position.line; i <= endLine; i++) {
            const line = document.lineAt(i);
            if (i === position.line) {
                suffixLines.push(line.text.substring(position.character));
            } else {
                suffixLines.push(line.text);
            }
        }
        const suffix = suffixLines.join('\n');

        return `<PRE>${prefix}<SUF>${suffix}<MID>`;
    }

    private async _getCompletion(
        prompt: string,
        model: string,
        maxTokens: number,
        temperature: number,
        signal: AbortSignal
    ): Promise<string> {
        let completion = '';
        
        try {
            const stream = this.ollamaClient.generateStream({
                model,
                prompt,
                options: {
                    temperature,
                    num_predict: maxTokens,
                    stop: ['<EOT>', '\n\n\n', '<PRE>', '<SUF>', '<MID>']
                },
                stream: true
            });

            for await (const response of stream) {
                if (signal.aborted) {
                    break;
                }
                
                if (response.response) {
                    completion += response.response;
                }
                
                if (response.done) {
                    break;
                }
            }
        } catch (error) {
            if (signal.aborted) {
                throw new Error('Request aborted');
            }
            throw error;
        }

        completion = this._postProcessCompletion(completion);
        
        return completion;
    }

    private _postProcessCompletion(completion: string): string {
        completion = completion.trim();
        
        const stopTokens = ['<EOT>', '<PRE>', '<SUF>', '<MID>'];
        for (const token of stopTokens) {
            const index = completion.indexOf(token);
            if (index !== -1) {
                completion = completion.substring(0, index);
            }
        }
        
        const lines = completion.split('\n');
        if (lines.length > 5) {
            completion = lines.slice(0, 5).join('\n');
        }
        
        return completion;
    }

    dispose(): void {
        for (const controller of this.activeRequests.values()) {
            controller.abort();
        }
        this.activeRequests.clear();
    }
}
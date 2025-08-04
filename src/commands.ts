import * as vscode from 'vscode';
import { OllamaClient } from './ollama_client';

export class CommandHandler {
    private ollamaClient: OllamaClient;
    private statusBarItem: vscode.StatusBarItem;

    constructor(ollamaClient: OllamaClient) {
        this.ollamaClient = ollamaClient;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.updateStatusBar();
    }

    async completeWithModel(): Promise<void> {
        const models = await this._getAvailableModels();
        if (models.length === 0) {
            vscode.window.showErrorMessage('No Ollama models found. Please install a model first.');
            return;
        }

        const selectedModel = await vscode.window.showQuickPick(models, {
            placeHolder: 'Select a model for completion'
        });

        if (!selectedModel) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const position = editor.selection.active;
        
        const prompt = this._buildContextPrompt(document, position);
        
        try {
            const response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Generating completion with ${selectedModel}...`,
                cancellable: true
            }, async (progress, token) => {
                const result = await this.ollamaClient.generate({
                    model: selectedModel,
                    prompt: prompt,
                    options: {
                        temperature: 0.2,
                        num_predict: 150
                    }
                });
                
                if (token.isCancellationRequested) {
                    return null;
                }
                
                return result;
            });

            if (response && response.response) {
                editor.edit(editBuilder => {
                    editBuilder.insert(position, response.response);
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async selectModel(): Promise<void> {
        const models = await this._getAvailableModels();
        if (models.length === 0) {
            vscode.window.showErrorMessage('No Ollama models found. Please install a model first.');
            return;
        }

        const config = vscode.workspace.getConfiguration('ollama');
        const currentModel = config.get<string>('codeCompletion.model', 'codellama');

        const quickPickItems = models.map(model => ({
            label: model,
            picked: model === currentModel
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select default model for code completion'
        });

        const selectedModel = selected?.label;

        if (selectedModel) {
            await config.update('codeCompletion.model', selectedModel, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Default model set to: ${selectedModel}`);
            this.updateStatusBar();
        }
    }

    async showStatus(): Promise<void> {
        const health = await this.ollamaClient.checkHealth();
        const config = vscode.workspace.getConfiguration('ollama');
        const currentModel = config.get<string>('codeCompletion.model', 'codellama');
        const providerUrl = config.get<string>('codeCompletion.providerUrl', 'http://localhost:11434');

        if (health) {
            const models = await this._getAvailableModels();
            const message = `Ollama Status:
- Service: ✅ Running
- URL: ${providerUrl}
- Current Model: ${currentModel}
- Available Models: ${models.join(', ') || 'None'}`;
            
            vscode.window.showInformationMessage(message, 'Select Model', 'Refresh').then(selection => {
                if (selection === 'Select Model') {
                    this.selectModel();
                } else if (selection === 'Refresh') {
                    this.updateStatusBar();
                    this.showStatus();
                }
            });
        } else {
            vscode.window.showErrorMessage(
                `Ollama service is not running at ${providerUrl}. Please start Ollama first.`,
                'Retry',
                'Change URL'
            ).then(selection => {
                if (selection === 'Retry') {
                    this.showStatus();
                } else if (selection === 'Change URL') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'ollama.codeCompletion.providerUrl');
                }
            });
        }
    }

    private async _getAvailableModels(): Promise<string[]> {
        try {
            const models = await this.ollamaClient.listModels();
            return models.map(m => m.name);
        } catch (error) {
            console.error('Failed to fetch models:', error);
            return [];
        }
    }

    private _buildContextPrompt(document: vscode.TextDocument, position: vscode.Position): string {
        const lineCount = Math.min(30, position.line);
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

        const context = lines.join('\n');
        const languageId = document.languageId;
        
        return `Language: ${languageId}\n\nComplete the following code:\n\n${context}`;
    }

    async updateStatusBar(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ollama');
        const currentModel = config.get<string>('codeCompletion.model', 'codellama');
        const health = await this.ollamaClient.checkHealth();

        if (health) {
            this.statusBarItem.text = `$(hubot) Ollama: ${currentModel}`;
            this.statusBarItem.tooltip = `Ollama is running with model: ${currentModel}\nClick to see status`;
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = `$(alert) Ollama: Offline`;
            this.statusBarItem.tooltip = 'Ollama service is not running\nClick to retry';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }

        this.statusBarItem.command = 'ollama-code-pilot.showStatus';
        this.statusBarItem.show();
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
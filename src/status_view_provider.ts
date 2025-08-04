import * as vscode from 'vscode';
import { OllamaClient } from './ollama_client';

export class StatusViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ollama-status';

    private _view?: vscode.WebviewView;
    private _intervalId?: NodeJS.Timer;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _ollamaClient: OllamaClient
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'refresh':
                    await this._updateStatus();
                    break;
                case 'selectModel':
                    vscode.commands.executeCommand('ollama-code-pilot.selectModel');
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'ollama');
                    break;
            }
        });

        this._updateStatus();
        this._intervalId = setInterval(() => this._updateStatus(), 30000);

        webviewView.onDidDispose(() => {
            if (this._intervalId) {
                clearInterval(this._intervalId);
            }
        });
    }

    private async _updateStatus(): Promise<void> {
        if (!this._view) {
            return;
        }

        const config = vscode.workspace.getConfiguration('ollama');
        const currentModel = config.get<string>('codeCompletion.model', 'codellama');
        const providerUrl = config.get<string>('codeCompletion.providerUrl', 'http://localhost:11434');
        
        const health = await this._ollamaClient.checkHealth();
        let models: string[] = [];
        
        if (health) {
            try {
                const modelList = await this._ollamaClient.listModels();
                models = modelList.map(m => m.name);
            } catch (error) {
                console.error('Failed to fetch models:', error);
            }
        }

        this._view.webview.postMessage({
            type: 'statusUpdate',
            data: {
                health,
                currentModel,
                providerUrl,
                models
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'status.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'status.css'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Ollama Status</title>
            </head>
            <body>
                <div class="status-container">
                    <div class="status-header">
                        <h3>Ollama Status</h3>
                        <button id="refresh-btn" title="Refresh status">↻</button>
                    </div>
                    
                    <div class="status-content">
                        <div class="status-item">
                            <span class="label">Service:</span>
                            <span id="service-status" class="value">Checking...</span>
                        </div>
                        
                        <div class="status-item">
                            <span class="label">URL:</span>
                            <span id="provider-url" class="value">-</span>
                        </div>
                        
                        <div class="status-item">
                            <span class="label">Current Model:</span>
                            <span id="current-model" class="value">-</span>
                        </div>
                        
                        <div class="status-item">
                            <span class="label">Available Models:</span>
                            <div id="models-list" class="models-list">Loading...</div>
                        </div>
                    </div>
                    
                    <div class="actions">
                        <button id="select-model-btn" class="action-btn">Select Model</button>
                        <button id="settings-btn" class="action-btn">Settings</button>
                    </div>
                </div>
                
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
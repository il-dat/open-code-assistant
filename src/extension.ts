import * as vscode from 'vscode';
import { OllamaClient } from './ollama_client';
import { OllamaCompletionProvider } from './completion_provider';
import { CommandHandler } from './commands';
import { ModelTreeProvider } from './models_provider';
import { StatusViewProvider } from './status_view_provider';

let ollamaClient: OllamaClient;
let completionProvider: OllamaCompletionProvider;
let commandHandler: CommandHandler;
let modelTreeProvider: ModelTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
    console.log('Ollama Code Pilot is now active!');

    ollamaClient = new OllamaClient();
    completionProvider = new OllamaCompletionProvider(ollamaClient);
    commandHandler = new CommandHandler(ollamaClient);
    modelTreeProvider = new ModelTreeProvider(ollamaClient);

    const completionProviderDisposable = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        completionProvider
    );

    const statusViewProvider = new StatusViewProvider(context.extensionUri, ollamaClient);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(StatusViewProvider.viewType, statusViewProvider)
    );

    const modelTreeView = vscode.window.createTreeView('ollama-models', {
        treeDataProvider: modelTreeProvider,
        showCollapseAll: false
    });

    context.subscriptions.push(
        completionProviderDisposable,
        modelTreeView,
        vscode.commands.registerCommand('ollama-code-pilot.complete', () => commandHandler.completeWithModel()),
        vscode.commands.registerCommand('ollama-code-pilot.selectModel', () => commandHandler.selectModel()),
        vscode.commands.registerCommand('ollama-code-pilot.showStatus', () => commandHandler.showStatus()),
        vscode.commands.registerCommand('ollama-code-pilot.refreshModels', () => modelTreeProvider.refresh())
    );

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ollama')) {
            ollamaClient.updateConfiguration();
            commandHandler.updateStatusBar();
        }
    });

    context.subscriptions.push(completionProvider);
    context.subscriptions.push(commandHandler);

    commandHandler.updateStatusBar();

    vscode.window.showInformationMessage('Ollama Code Pilot: Extension activated. Checking Ollama service...');
    ollamaClient.checkHealth().then(healthy => {
        if (!healthy) {
            vscode.window.showWarningMessage(
                'Ollama service is not running. Please start Ollama to use code completions.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'ollama');
                }
            });
        }
    });
}

export function deactivate(): void {
    console.log('Ollama Code Pilot is now deactivated');
}
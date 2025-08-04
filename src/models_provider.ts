import * as vscode from 'vscode';
import { OllamaClient, Model } from './ollama_client';

export class ModelTreeItem extends vscode.TreeItem {
    constructor(
        public readonly model: Model,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(model.name, collapsibleState);
        this.tooltip = `${model.name} - ${this._formatSize(model.size)}`;
        this.description = this._formatSize(model.size);
        this.contextValue = 'model';
    }

    private _formatSize(bytes: number): string {
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) {
            return `${gb.toFixed(1)} GB`;
        }
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }
}

export class ModelTreeProvider implements vscode.TreeDataProvider<ModelTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ModelTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private _ollamaClient: OllamaClient) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModelTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ModelTreeItem): Promise<ModelTreeItem[]> {
        if (!element) {
            try {
                const models = await this._ollamaClient.listModels();
                return models.map(model => new ModelTreeItem(model, vscode.TreeItemCollapsibleState.None));
            } catch (error) {
                console.error('Failed to load models:', error);
                return [];
            }
        }
        return [];
    }
}
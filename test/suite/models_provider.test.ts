import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ModelTreeProvider, ModelTreeItem } from '../../src/models_provider';
import { OllamaClient } from '../../src/ollama_client';

suite('ModelTreeProvider Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let provider: ModelTreeProvider;
    let ollamaClient: OllamaClient;

    setup(() => {
        sandbox = sinon.createSandbox();
        ollamaClient = new OllamaClient();
        provider = new ModelTreeProvider(ollamaClient);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should format model size in GB', () => {
        const model = {
            name: 'codellama',
            modified_at: '2024-01-01',
            size: 5 * 1024 * 1024 * 1024, // 5GB
            digest: 'abc123'
        };

        const item = new ModelTreeItem(model, vscode.TreeItemCollapsibleState.None);
        
        assert.strictEqual(item.label, 'codellama');
        assert.strictEqual(item.description, '5.0 GB');
        assert.ok(typeof item.tooltip === 'string' && item.tooltip.includes('5.0 GB'));
        assert.strictEqual(item.contextValue, 'model');
    });

    test('Should format model size in MB', () => {
        const model = {
            name: 'small-model',
            modified_at: '2024-01-01',
            size: 500 * 1024 * 1024, // 500MB
            digest: 'def456'
        };

        const item = new ModelTreeItem(model, vscode.TreeItemCollapsibleState.None);
        
        assert.strictEqual(item.description, '500.0 MB');
    });

    test('Should get children (models) successfully', async () => {
        const mockModels = [
            { name: 'codellama', modified_at: '2024-01-01', size: 1000000000, digest: 'abc' },
            { name: 'deepseek', modified_at: '2024-01-02', size: 2000000000, digest: 'def' }
        ];

        sandbox.stub(ollamaClient, 'listModels').resolves(mockModels);

        const children = await provider.getChildren();

        assert.strictEqual(children.length, 2);
        assert.strictEqual(children[0].label, 'codellama');
        assert.strictEqual(children[1].label, 'deepseek');
    });

    test('Should handle error when loading models', async () => {
        sandbox.stub(ollamaClient, 'listModels').rejects(new Error('API Error'));
        sandbox.stub(console, 'error');

        const children = await provider.getChildren();

        assert.strictEqual(children.length, 0);
        assert.ok((console.error as sinon.SinonStub).calledOnce);
    });

    test('Should return empty array for nested elements', async () => {
        const model = {
            name: 'codellama',
            modified_at: '2024-01-01',
            size: 1000000000,
            digest: 'abc'
        };
        const item = new ModelTreeItem(model, vscode.TreeItemCollapsibleState.None);

        const children = await provider.getChildren(item);

        assert.strictEqual(children.length, 0);
    });

    test('Should refresh tree data', () => {
        let eventFired = false;
        provider.onDidChangeTreeData(() => {
            eventFired = true;
        });

        provider.refresh();

        assert.ok(eventFired);
    });

    test('Should return tree item unchanged', () => {
        const model = {
            name: 'test-model',
            modified_at: '2024-01-01',
            size: 1000000,
            digest: 'xyz'
        };
        const item = new ModelTreeItem(model, vscode.TreeItemCollapsibleState.None);

        const result = provider.getTreeItem(item);

        assert.strictEqual(result, item);
    });
});
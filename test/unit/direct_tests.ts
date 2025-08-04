/* eslint-disable @typescript-eslint/no-var-requires */
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as path from 'path';

// Direct unit tests that import compiled JS files
suite('Direct Unit Tests for Coverage', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        // Mock vscode module
        const mockVscode = require('../helpers/mock_vscode');
        (require.cache as any)[require.resolve('vscode')] = {
            exports: mockVscode,
            id: require.resolve('vscode'),
            filename: require.resolve('vscode'),
            loaded: true,
            paths: [],
            children: [],
            parent: null
        } as any;
    });

    teardown(() => {
        sandbox.restore();
        // Clear module cache
        delete require.cache[require.resolve('vscode')];
    });

    test('OllamaClient direct test', () => {
        // Test the actual compiled ollama_client.js
        const OllamaClient = require('../../out/src/ollama_client').OllamaClient;
        
        const client = new OllamaClient();
        assert.ok(client);
        
        // Test updateConfiguration
        client.updateConfiguration();
        assert.ok(true); // If no error, it works
    });

    test('ModelTreeItem direct test', () => {
        const { ModelTreeItem } = require('../../out/src/models_provider');
        
        const model = {
            name: 'test-model',
            modified_at: '2024-01-01',
            size: 1000000000,
            digest: 'abc123'
        };
        
        const item = new ModelTreeItem(model, 0);
        assert.strictEqual(item.label, 'test-model');
        assert.ok(item.description);
        assert.ok(item.tooltip);
    });

    test('Commands status bar creation', () => {
        const { CommandHandler } = require('../../out/src/commands');
        const { OllamaClient } = require('../../out/src/ollama_client');
        
        const client = new OllamaClient();
        const handler = new CommandHandler(client);
        
        assert.ok(handler);
        handler.dispose();
    });

    test('Completion provider creation', () => {
        const { OllamaCompletionProvider } = require('../../out/src/completion_provider');
        const { OllamaClient } = require('../../out/src/ollama_client');
        
        const client = new OllamaClient();
        const provider = new OllamaCompletionProvider(client);
        
        assert.ok(provider);
        provider.dispose();
    });

    test('Status view provider creation', () => {
        const { StatusViewProvider } = require('../../out/src/status_view_provider');
        const { OllamaClient } = require('../../out/src/ollama_client');
        const vscode = require('vscode');
        
        const client = new OllamaClient();
        const uri = vscode.Uri.file('/test');
        const provider = new StatusViewProvider(uri, client);
        
        assert.ok(provider);
        assert.strictEqual(StatusViewProvider.viewType, 'ollama-status');
    });

    test('Model tree provider refresh', () => {
        const { ModelTreeProvider } = require('../../out/src/models_provider');
        const { OllamaClient } = require('../../out/src/ollama_client');
        
        const client = new OllamaClient();
        const provider = new ModelTreeProvider(client);
        
        let eventFired = false;
        provider.onDidChangeTreeData(() => {
            eventFired = true;
        });
        
        provider.refresh();
        assert.ok(eventFired);
    });

    test('Extension activation', async () => {
        const extension = require('../../out/src/extension');
        const vscode = require('vscode');
        
        // Mock context
        const context = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('/test')
        };
        
        // Test activation
        extension.activate(context);
        assert.ok(context.subscriptions.length > 0);
        
        // Test deactivation
        extension.deactivate();
    });
});
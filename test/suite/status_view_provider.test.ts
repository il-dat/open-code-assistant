import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { StatusViewProvider } from '../../src/status_view_provider';
import { OllamaClient } from '../../src/ollama_client';

suite('StatusViewProvider Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let provider: StatusViewProvider;
    let ollamaClient: OllamaClient;
    let mockWebview: any;
    let mockWebviewView: any;
    let configStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        // Mock vscode configuration
        configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
        configStub.returns({
            get: sandbox.stub()
                .withArgs('codeCompletion.model').returns('codellama')
                .withArgs('codeCompletion.providerUrl').returns('http://localhost:11434')
        });

        // Create ollama client and stub methods
        ollamaClient = new OllamaClient();
        sandbox.stub(ollamaClient, 'checkHealth').resolves(true);
        sandbox.stub(ollamaClient, 'listModels').resolves([
            { name: 'codellama', modified_at: '2024-01-01', size: 1000000, digest: 'abc' },
            { name: 'deepseek', modified_at: '2024-01-02', size: 2000000, digest: 'def' }
        ]);

        // Create mock webview
        mockWebview = {
            html: '',
            options: {},
            asWebviewUri: sandbox.stub().returnsArg(0),
            cspSource: 'vscode-resource:',
            onDidReceiveMessage: sandbox.stub(),
            postMessage: sandbox.stub()
        };

        // Create mock webview view
        mockWebviewView = {
            webview: mockWebview,
            visible: true,
            onDidDispose: sandbox.stub()
        };

        const extensionUri = vscode.Uri.file('/test/extension');
        provider = new StatusViewProvider(extensionUri, ollamaClient);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should resolve webview view and set HTML', () => {
        const context = {};
        const token = new vscode.CancellationTokenSource().token;

        provider.resolveWebviewView(mockWebviewView, context as any, token);

        assert.ok(mockWebview.options.enableScripts);
        assert.ok(mockWebview.options.localResourceRoots);
        assert.ok(mockWebview.html.includes('<!DOCTYPE html>'));
        assert.ok(mockWebview.html.includes('Ollama Status'));
        assert.ok(mockWebview.html.includes('refresh-btn'));
        assert.ok(mockWebview.html.includes('select-model-btn'));
        assert.ok(mockWebview.html.includes('settings-btn'));
    });

    test('Should update status when health check succeeds', async () => {
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        // Wait for initial update
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.ok(mockWebview.postMessage.called);
        const message = mockWebview.postMessage.firstCall.args[0];
        assert.strictEqual(message.type, 'statusUpdate');
        assert.strictEqual(message.data.health, true);
        assert.strictEqual(message.data.currentModel, 'codellama');
        assert.strictEqual(message.data.providerUrl, 'http://localhost:11434');
        assert.deepStrictEqual(message.data.models, ['codellama', 'deepseek']);
    });

    test('Should update status when health check fails', async () => {
        (ollamaClient.checkHealth as sinon.SinonStub).resolves(false);
        
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        await new Promise(resolve => setTimeout(resolve, 100));

        assert.ok(mockWebview.postMessage.called);
        const message = mockWebview.postMessage.firstCall.args[0];
        assert.strictEqual(message.data.health, false);
        assert.deepStrictEqual(message.data.models, []);
    });

    test('Should handle model listing error', async () => {
        (ollamaClient.listModels as sinon.SinonStub).rejects(new Error('API Error'));
        sandbox.stub(console, 'error');
        
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        await new Promise(resolve => setTimeout(resolve, 100));

        assert.ok((console.error as sinon.SinonStub).calledOnce);
        const message = mockWebview.postMessage.firstCall.args[0];
        assert.deepStrictEqual(message.data.models, []);
    });

    test('Should handle refresh message from webview', async () => {
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        // Get the message handler
        const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];

        // Clear previous calls
        mockWebview.postMessage.resetHistory();

        // Send refresh message
        await messageHandler({ type: 'refresh' });

        // Should trigger status update
        assert.ok(mockWebview.postMessage.calledOnce);
        assert.strictEqual(mockWebview.postMessage.firstCall.args[0].type, 'statusUpdate');
    });

    test('Should handle selectModel message from webview', async () => {
        const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
        
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
        await messageHandler({ type: 'selectModel' });

        assert.ok(executeCommandStub.calledOnce);
        assert.ok(executeCommandStub.calledWith('ollama-code-pilot.selectModel'));
    });

    test('Should handle openSettings message from webview', async () => {
        const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
        
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
        await messageHandler({ type: 'openSettings' });

        assert.ok(executeCommandStub.calledOnce);
        assert.ok(executeCommandStub.calledWith('workbench.action.openSettings', 'ollama'));
    });

    test('Should set up periodic updates', () => {
        const setIntervalStub = sandbox.stub(global, 'setInterval').returns(123 as any);
        
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        assert.ok(setIntervalStub.calledOnce);
        assert.strictEqual(setIntervalStub.firstCall.args[1], 30000); // 30 seconds
    });

    test('Should clean up interval on dispose', () => {
        const intervalId = 123;
        sandbox.stub(global, 'setInterval').returns(intervalId as any);
        const clearIntervalStub = sandbox.stub(global, 'clearInterval');
        
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        // Get the dispose handler
        const disposeHandler = mockWebviewView.onDidDispose.firstCall.args[0];
        disposeHandler();

        assert.ok(clearIntervalStub.calledOnce);
        assert.ok(clearIntervalStub.calledWith(intervalId));
    });

    test('Should not update if view is not set', async () => {
        // Don't resolve the view
        // Try to trigger an update by calling the private method through the interval
        const setIntervalStub = sandbox.stub(global, 'setInterval');
        
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);
        
        // Get the interval callback
        const updateCallback = setIntervalStub.firstCall.args[0];
        
        // Clear previous calls and unset the view
        mockWebview.postMessage.resetHistory();
        (provider as any)._view = undefined;
        
        // Call the update
        await updateCallback();
        
        // Should not post any message
        assert.ok(mockWebview.postMessage.notCalled);
    });

    test('Should include nonce in CSP for security', () => {
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        const html = mockWebview.html;
        
        // Check for nonce in script tag
        const nonceMatch = html.match(/nonce="([^"]+)"/);
        assert.ok(nonceMatch);
        
        const nonce = nonceMatch[1];
        assert.ok(nonce);
        assert.strictEqual(nonce.length, 32);
        
        // Check for nonce in CSP
        assert.ok(html.includes(`script-src 'nonce-${nonce}'`));
    });

    test('Should include proper resource URIs', () => {
        provider.resolveWebviewView(mockWebviewView, {} as any, new vscode.CancellationTokenSource().token);

        assert.ok(mockWebview.asWebviewUri.calledAt(0));
        assert.ok(mockWebview.asWebviewUri.calledAt(1));
        
        // Should be called for script and style URIs
        const firstCall = mockWebview.asWebviewUri.firstCall.args[0];
        const secondCall = mockWebview.asWebviewUri.secondCall.args[0];
        
        assert.ok(firstCall.path.includes('media/status.js'));
        assert.ok(secondCall.path.includes('media/status.css'));
    });
});
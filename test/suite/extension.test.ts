import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { OllamaClient } from '../../src/ollama_client';
import { OllamaCompletionProvider } from '../../src/completion_provider';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('datnguye.ollama-code-pilot'));
    });

    test('Should activate', async () => {
        const extension = vscode.extensions.getExtension('datnguye.ollama-code-pilot');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive);
        }
    });
});

suite('OllamaClient Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let client: OllamaClient;

    setup(() => {
        sandbox = sinon.createSandbox();
        client = new OllamaClient();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should handle connection errors gracefully', async () => {
        try {
            await client.generate({
                model: 'test-model',
                prompt: 'test prompt'
            });
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Ollama'));
        }
    });

    test('Should check health status', async () => {
        const health = await client.checkHealth();
        assert.strictEqual(typeof health, 'boolean');
    });
});

suite('CompletionProvider Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let client: OllamaClient;
    let provider: OllamaCompletionProvider;

    setup(() => {
        sandbox = sinon.createSandbox();
        client = new OllamaClient();
        provider = new OllamaCompletionProvider(client);
    });

    teardown(() => {
        sandbox.restore();
        provider.dispose();
    });

    test('Should return undefined for empty lines', async () => {
        const document = await vscode.workspace.openTextDocument({
            content: '\n\n\n',
            language: 'javascript'
        });
        
        const position = new vscode.Position(1, 0);
        const context: vscode.InlineCompletionContext = {
            triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
            selectedCompletionInfo: undefined
        };
        const token = new vscode.CancellationTokenSource().token;

        const result = await provider.provideInlineCompletionItems(
            document,
            position,
            context,
            token
        );

        assert.strictEqual(result, undefined);
    });

    test('Should handle cancellation', async () => {
        const document = await vscode.workspace.openTextDocument({
            content: 'function test() {',
            language: 'javascript'
        });
        
        const position = new vscode.Position(0, 17);
        const context: vscode.InlineCompletionContext = {
            triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
            selectedCompletionInfo: undefined
        };
        
        const tokenSource = new vscode.CancellationTokenSource();
        tokenSource.cancel();

        const result = await provider.provideInlineCompletionItems(
            document,
            position,
            context,
            tokenSource.token
        );

        assert.strictEqual(result, undefined);
    });
});
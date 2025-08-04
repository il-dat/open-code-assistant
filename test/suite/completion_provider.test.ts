import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { OllamaCompletionProvider } from '../../src/completion_provider';
import { OllamaClient } from '../../src/ollama_client';

suite('OllamaCompletionProvider Comprehensive Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let provider: OllamaCompletionProvider;
    let ollamaClient: OllamaClient;
    let configStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        // Mock vscode configuration
        configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
        configStub.returns({
            get: sandbox.stub()
                .withArgs('codeCompletion.model').returns('codellama')
                .withArgs('codeCompletion.maxTokens').returns(100)
                .withArgs('codeCompletion.temperature').returns(0.2)
        });

        // Create ollama client with stubs
        ollamaClient = new OllamaClient();
        provider = new OllamaCompletionProvider(ollamaClient);
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

    test('Should handle cancellation before request', async () => {
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

    test('Should provide inline completion for valid input', async () => {
        // Mock the streaming response
        const mockStream = async function* (): AsyncGenerator<any> {
            yield { response: 'console', done: false };
            yield { response: '.log("test");', done: true };
        };
        
        sandbox.stub(ollamaClient, 'generateStream').returns(mockStream());

        const document = await vscode.workspace.openTextDocument({
            content: 'function test() {\n  con',
            language: 'javascript'
        });
        
        const position = new vscode.Position(1, 5);
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

        assert.ok(result);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].insertText, 'console.log("test");');
    });

    test('Should build prompt with proper context', async () => {
        let capturedPrompt = '';
        const mockStream = async function* (): AsyncGenerator<any> {
            yield { response: 'test', done: true };
        };
        
        const generateStreamStub = sandbox.stub(ollamaClient, 'generateStream');
        generateStreamStub.callsFake((request: any) => {
            capturedPrompt = request.prompt;
            return mockStream();
        });

        const content = `// This is a test file
function hello() {
    return "world";
}

function test() {
    cons`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });
        
        const position = new vscode.Position(6, 8);
        const context: vscode.InlineCompletionContext = {
            triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
            selectedCompletionInfo: undefined
        };
        const token = new vscode.CancellationTokenSource().token;

        await provider.provideInlineCompletionItems(
            document,
            position,
            context,
            token
        );

        assert.ok(capturedPrompt.includes('<PRE>'));
        assert.ok(capturedPrompt.includes('<SUF>'));
        assert.ok(capturedPrompt.includes('<MID>'));
        assert.ok(capturedPrompt.includes('function hello()'));
        assert.ok(capturedPrompt.includes('cons'));
    });

    test('Should handle error during completion', async () => {
        sandbox.stub(ollamaClient, 'generateStream').throws(new Error('API Error'));
        sandbox.stub(vscode.window, 'showErrorMessage');

        const document = await vscode.workspace.openTextDocument({
            content: 'test',
            language: 'javascript'
        });
        
        const position = new vscode.Position(0, 4);
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
        assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).calledOnce);
    });

    test('Should handle abort error silently', async () => {
        const abortError = new Error('Aborted');
        abortError.name = 'AbortError';
        sandbox.stub(ollamaClient, 'generateStream').throws(abortError);
        sandbox.stub(vscode.window, 'showErrorMessage');

        const document = await vscode.workspace.openTextDocument({
            content: 'test',
            language: 'javascript'
        });
        
        const position = new vscode.Position(0, 4);
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
        assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).notCalled);
    });

    test('Should post-process completion text', async () => {
        // Mock stream with stop tokens and multiple lines
        const mockStream = async function* (): AsyncGenerator<any> {
            yield { response: 'console.log("test");\n\n\n\nmore lines\n<EOT>extra', done: true };
        };
        
        sandbox.stub(ollamaClient, 'generateStream').returns(mockStream());

        const document = await vscode.workspace.openTextDocument({
            content: 'function test() {\n  ',
            language: 'javascript'
        });
        
        const position = new vscode.Position(1, 2);
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

        assert.ok(result);
        assert.strictEqual(result.length, 1);
        // Should trim and remove stop tokens
        const completion = result[0].insertText.toString();
        assert.ok(!completion.includes('<EOT>'));
        assert.ok(!completion.includes('extra'));
        assert.ok(completion.split('\n').length <= 5);
    });

    test('Should handle cancellation during streaming', async () => {
        const tokenSource = new vscode.CancellationTokenSource();
        
        const mockStream = async function* (): AsyncGenerator<any> {
            yield { response: 'console', done: false };
            tokenSource.cancel(); // Cancel during streaming
            yield { response: '.log("test");', done: true };
        };
        
        sandbox.stub(ollamaClient, 'generateStream').returns(mockStream());

        const document = await vscode.workspace.openTextDocument({
            content: 'test',
            language: 'javascript'
        });
        
        const position = new vscode.Position(0, 4);
        const context: vscode.InlineCompletionContext = {
            triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
            selectedCompletionInfo: undefined
        };

        const result = await provider.provideInlineCompletionItems(
            document,
            position,
            context,
            tokenSource.token
        );

        assert.ok(result);
        assert.strictEqual(result[0].insertText, 'console'); // Only first part before cancellation
    });

    test('Should handle documents with limited context', async () => {
        const mockStream = async function* (): AsyncGenerator<any> {
            yield { response: 'completion', done: true };
        };
        
        sandbox.stub(ollamaClient, 'generateStream').returns(mockStream());

        // Create a document with only 2 lines
        const document = await vscode.workspace.openTextDocument({
            content: 'line1\nline2',
            language: 'javascript'
        });
        
        const position = new vscode.Position(1, 5);
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

        assert.ok(result);
        assert.strictEqual(result.length, 1);
    });

    test('Should include suffix context in prompt', async () => {
        let capturedPrompt = '';
        const mockStream = async function* (): AsyncGenerator<any> {
            yield { response: 'test', done: true };
        };
        
        const generateStreamStub = sandbox.stub(ollamaClient, 'generateStream');
        generateStreamStub.callsFake((request: any) => {
            capturedPrompt = request.prompt;
            return mockStream();
        });

        const content = `function test() {
    con
    return true;
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });
        
        const position = new vscode.Position(1, 7);
        const context: vscode.InlineCompletionContext = {
            triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
            selectedCompletionInfo: undefined
        };
        const token = new vscode.CancellationTokenSource().token;

        await provider.provideInlineCompletionItems(
            document,
            position,
            context,
            token
        );

        // Verify suffix is included in prompt
        assert.ok(capturedPrompt.includes('return true;'));
        assert.ok(capturedPrompt.includes('}'));
    });

    test('Should clean up active requests on dispose', async () => {
        // Create multiple pending requests
        const mockStream = async function* (): AsyncGenerator<any> {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Long delay
            yield { response: 'test', done: true };
        };
        
        sandbox.stub(ollamaClient, 'generateStream').returns(mockStream());

        const document = await vscode.workspace.openTextDocument({
            content: 'test',
            language: 'javascript'
        });
        
        const position = new vscode.Position(0, 4);
        const context: vscode.InlineCompletionContext = {
            triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
            selectedCompletionInfo: undefined
        };

        // Start multiple requests
        const promises = [];
        for (let i = 0; i < 3; i++) {
            const token = new vscode.CancellationTokenSource().token;
            promises.push(provider.provideInlineCompletionItems(
                document,
                position,
                context,
                token
            ));
        }

        // Dispose should cancel all active requests
        provider.dispose();

        // All promises should resolve to undefined (cancelled)
        const results = await Promise.all(promises);
        results.forEach(result => {
            assert.strictEqual(result, undefined);
        });
    });
});
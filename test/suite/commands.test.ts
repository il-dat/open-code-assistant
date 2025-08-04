import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { CommandHandler } from '../../src/commands';
import { OllamaClient } from '../../src/ollama_client';

suite('CommandHandler Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let commandHandler: CommandHandler;
    let ollamaClient: OllamaClient;
    let windowStubs: any = {};
    let configStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        // Create ollama client stub
        ollamaClient = new OllamaClient();
        sandbox.stub(ollamaClient, 'listModels').resolves([
            { name: 'codellama', modified_at: '2024-01-01', size: 1000000, digest: 'abc' },
            { name: 'deepseek-coder', modified_at: '2024-01-02', size: 2000000, digest: 'def' }
        ]);
        sandbox.stub(ollamaClient, 'checkHealth').resolves(true);
        sandbox.stub(ollamaClient, 'generate').resolves({
            model: 'codellama',
            created_at: '2024-01-01',
            response: 'console.log("Hello");',
            done: true
        });

        // Mock vscode window methods
        windowStubs.createStatusBarItem = sandbox.stub(vscode.window, 'createStatusBarItem').returns({
            text: '',
            tooltip: '',
            backgroundColor: undefined,
            command: '',
            show: sandbox.stub(),
            dispose: sandbox.stub(),
            hide: sandbox.stub(),
            id: 'test',
            alignment: vscode.StatusBarAlignment.Right,
            priority: 100,
            name: 'test'
        } as any);
        
        windowStubs.showQuickPick = sandbox.stub(vscode.window, 'showQuickPick');
        windowStubs.showErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
        windowStubs.showInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');
        windowStubs.activeTextEditor = sandbox.stub(vscode.window, 'activeTextEditor');
        windowStubs.withProgress = sandbox.stub(vscode.window, 'withProgress');
        
        // Mock workspace configuration
        configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
        configStub.returns({
            get: sandbox.stub()
                .withArgs('codeCompletion.model').returns('codellama')
                .withArgs('codeCompletion.providerUrl').returns('http://localhost:11434'),
            update: sandbox.stub().resolves()
        });

        commandHandler = new CommandHandler(ollamaClient);
    });

    teardown(() => {
        sandbox.restore();
        commandHandler.dispose();
    });

    test('Should initialize with status bar', () => {
        assert.ok(windowStubs.createStatusBarItem.calledOnce);
        assert.ok(windowStubs.createStatusBarItem.calledWith(
            vscode.StatusBarAlignment.Right, 
            100
        ));
    });

    test('Should update status bar for healthy service', async () => {
        await commandHandler.updateStatusBar();
        
        const statusBarItem = windowStubs.createStatusBarItem.returnValue;
        assert.strictEqual(statusBarItem.text, '$(hubot) Ollama: codellama');
        assert.ok(statusBarItem.tooltip.includes('Ollama is running'));
        assert.strictEqual(statusBarItem.command, 'ollama-code-pilot.showStatus');
        assert.ok(statusBarItem.show.calledOnce);
    });

    test('Should update status bar for offline service', async () => {
        (ollamaClient.checkHealth as sinon.SinonStub).resolves(false);
        
        await commandHandler.updateStatusBar();
        
        const statusBarItem = windowStubs.createStatusBarItem.returnValue;
        assert.strictEqual(statusBarItem.text, '$(alert) Ollama: Offline');
        assert.ok(statusBarItem.tooltip.includes('not running'));
    });

    test('Should complete with model when editor is active', async () => {
        const mockEditor = {
            document: {
                lineAt: sandbox.stub().returns({ text: 'console.' }),
                languageId: 'javascript'
            },
            selection: {
                active: new vscode.Position(0, 8)
            },
            edit: sandbox.stub().yields({
                insert: sandbox.stub()
            })
        };
        
        windowStubs.activeTextEditor.value = mockEditor;
        windowStubs.showQuickPick.resolves('codellama');
        windowStubs.withProgress.callsFake(async (options: any, task: any) => {
            return await task({ report: () => {} }, { isCancellationRequested: false });
        });

        await commandHandler.completeWithModel();

        assert.ok(windowStubs.showQuickPick.calledOnce);
        assert.ok(mockEditor.edit.calledOnce);
        assert.ok((ollamaClient.generate as sinon.SinonStub).calledOnce);
    });

    test('Should handle no models available', async () => {
        (ollamaClient.listModels as sinon.SinonStub).resolves([]);

        await commandHandler.completeWithModel();

        assert.ok(windowStubs.showErrorMessage.calledOnce);
        assert.ok(windowStubs.showErrorMessage.calledWith(
            'No Ollama models found. Please install a model first.'
        ));
    });

    test('Should handle user cancellation in model selection', async () => {
        windowStubs.showQuickPick.resolves(undefined);

        await commandHandler.completeWithModel();

        assert.ok(windowStubs.showQuickPick.calledOnce);
        assert.ok((ollamaClient.generate as sinon.SinonStub).notCalled);
    });

    test('Should handle no active editor', async () => {
        windowStubs.activeTextEditor.value = undefined;
        windowStubs.showQuickPick.resolves('codellama');

        await commandHandler.completeWithModel();

        assert.ok((ollamaClient.generate as sinon.SinonStub).notCalled);
    });

    test('Should handle generation error', async () => {
        const mockEditor = {
            document: {
                lineAt: sandbox.stub().returns({ text: 'console.' }),
                languageId: 'javascript'
            },
            selection: {
                active: new vscode.Position(0, 8)
            },
            edit: sandbox.stub()
        };
        
        windowStubs.activeTextEditor.value = mockEditor;
        windowStubs.showQuickPick.resolves('codellama');
        windowStubs.withProgress.callsFake(async (options: any, task: any) => {
            throw new Error('Generation failed');
        });

        await commandHandler.completeWithModel();

        assert.ok(windowStubs.showErrorMessage.calledWith(
            'Completion failed: Generation failed'
        ));
    });

    test('Should select model successfully', async () => {
        const quickPickItems = [
            { label: 'codellama', picked: true },
            { label: 'deepseek-coder', picked: false }
        ];
        windowStubs.showQuickPick.resolves(quickPickItems[1]);

        await commandHandler.selectModel();

        assert.ok(windowStubs.showQuickPick.calledOnce);
        const config = configStub();
        assert.ok(config.update.calledWith('codeCompletion.model', 'deepseek-coder'));
        assert.ok(windowStubs.showInformationMessage.calledWith(
            'Default model set to: deepseek-coder'
        ));
    });

    test('Should handle model selection cancellation', async () => {
        windowStubs.showQuickPick.resolves(undefined);

        await commandHandler.selectModel();

        const config = configStub();
        assert.ok(config.update.notCalled);
    });

    test('Should show status when service is healthy', async () => {
        windowStubs.showInformationMessage.resolves('Select Model');

        await commandHandler.showStatus();

        const message = windowStubs.showInformationMessage.firstCall.args[0];
        assert.ok(message.includes('Service: ✅ Running'));
        assert.ok(message.includes('Current Model: codellama'));
        assert.ok(message.includes('Available Models: codellama, deepseek-coder'));
    });

    test('Should handle select model action from status', async () => {
        windowStubs.showInformationMessage.resolves('Select Model');
        sandbox.stub(commandHandler, 'selectModel');

        await commandHandler.showStatus();

        assert.ok((commandHandler.selectModel as sinon.SinonStub).calledOnce);
    });

    test('Should handle refresh action from status', async () => {
        windowStubs.showInformationMessage.resolves('Refresh');
        sandbox.stub(commandHandler, 'updateStatusBar');
        const showStatusStub = sandbox.stub(commandHandler, 'showStatus');
        showStatusStub.onFirstCall().callThrough();
        showStatusStub.onSecondCall().resolves();

        await commandHandler.showStatus();

        assert.ok((commandHandler.updateStatusBar as sinon.SinonStub).calledOnce);
        assert.ok(showStatusStub.calledTwice);
    });

    test('Should show error when service is offline', async () => {
        (ollamaClient.checkHealth as sinon.SinonStub).resolves(false);
        windowStubs.showErrorMessage.resolves('Retry');

        await commandHandler.showStatus();

        const message = windowStubs.showErrorMessage.firstCall.args[0];
        assert.ok(message.includes('Ollama service is not running'));
        assert.ok(message.includes('http://localhost:11434'));
    });

    test('Should handle retry action when offline', async () => {
        (ollamaClient.checkHealth as sinon.SinonStub).resolves(false);
        windowStubs.showErrorMessage.resolves('Retry');
        const showStatusStub = sandbox.stub(commandHandler, 'showStatus');
        showStatusStub.onFirstCall().callThrough();
        showStatusStub.onSecondCall().resolves();

        await commandHandler.showStatus();

        assert.ok(showStatusStub.calledTwice);
    });

    test('Should handle change URL action when offline', async () => {
        (ollamaClient.checkHealth as sinon.SinonStub).resolves(false);
        windowStubs.showErrorMessage.resolves('Change URL');
        const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

        await commandHandler.showStatus();

        assert.ok(executeCommandStub.calledOnce);
        assert.ok(executeCommandStub.calledWith(
            'workbench.action.openSettings',
            'ollama.codeCompletion.providerUrl'
        ));
    });

    test('Should handle model listing error gracefully', async () => {
        (ollamaClient.listModels as sinon.SinonStub).rejects(new Error('API Error'));

        await commandHandler.completeWithModel();

        assert.ok(windowStubs.showErrorMessage.calledWith(
            'No Ollama models found. Please install a model first.'
        ));
    });

    test('Should build context prompt correctly', async () => {
        const mockDocument = {
            lineAt: sandbox.stub()
                .onCall(0).returns({ text: 'function test() {' })
                .onCall(1).returns({ text: '  console.' }),
            lineCount: 2,
            languageId: 'javascript'
        };
        
        const mockEditor = {
            document: mockDocument,
            selection: {
                active: new vscode.Position(1, 10)
            },
            edit: sandbox.stub().yields({
                insert: sandbox.stub()
            })
        };
        
        windowStubs.activeTextEditor.value = mockEditor;
        windowStubs.showQuickPick.resolves('codellama');
        windowStubs.withProgress.callsFake(async (options: any, task: any) => {
            return await task({ report: () => {} }, { isCancellationRequested: false });
        });

        await commandHandler.completeWithModel();

        const generateCall = (ollamaClient.generate as sinon.SinonStub).firstCall;
        const prompt = generateCall.args[0].prompt;
        
        assert.ok(prompt.includes('Language: javascript'));
        assert.ok(prompt.includes('function test() {'));
        assert.ok(prompt.includes('  console.'));
    });
});
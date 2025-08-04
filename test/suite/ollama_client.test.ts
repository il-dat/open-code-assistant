import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import axios from 'axios';
import { OllamaClient } from '../../src/ollama_client';

suite('OllamaClient Comprehensive Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let client: OllamaClient;
    let configStub: sinon.SinonStub;
    let axiosStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        // Mock vscode configuration
        configStub = sandbox.stub(vscode.workspace, 'getConfiguration');
        configStub.returns({
            get: sandbox.stub()
                .withArgs('codeCompletion.providerUrl').returns('http://localhost:11434')
                .withArgs('api.authToken').returns('test-token')
        });

        // Create axios stub
        axiosStub = sandbox.stub(axios, 'create');
        
        client = new OllamaClient();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should initialize with configuration', () => {
        assert.ok(axiosStub.calledOnce);
        assert.ok(axiosStub.calledWith({
            baseURL: 'http://localhost:11434',
            headers: { 'Authorization': 'Bearer test-token' },
            timeout: 30000
        }));
    });

    test('Should initialize without auth token', () => {
        configStub.returns({
            get: sandbox.stub()
                .withArgs('codeCompletion.providerUrl').returns('http://localhost:11434')
                .withArgs('api.authToken').returns('')
        });

        new OllamaClient();
        
        assert.ok(axiosStub.calledWith({
            baseURL: 'http://localhost:11434',
            headers: {},
            timeout: 30000
        }));
    });

    test('Should generate completion successfully', async () => {
        const mockResponse = {
            model: 'codellama',
            created_at: '2024-01-01',
            response: 'console.log("Hello");',
            done: true
        };

        const mockAxiosInstance = {
            post: sandbox.stub().resolves({ data: mockResponse }),
            get: sandbox.stub()
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        const result = await client.generate({
            model: 'codellama',
            prompt: 'console.'
        });

        assert.strictEqual(result.response, 'console.log("Hello");');
        assert.ok(mockAxiosInstance.post.calledWith('/api/generate', {
            model: 'codellama',
            prompt: 'console.',
            stream: false
        }));
    });

    test('Should handle connection refused error', async () => {
        const error = new Error('connect ECONNREFUSED');
        (error as any).code = 'ECONNREFUSED';
        
        const mockAxiosInstance = {
            post: sandbox.stub().rejects(error),
            get: sandbox.stub()
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        
        try {
            await client.generate({
                model: 'codellama',
                prompt: 'test'
            });
            assert.fail('Should have thrown an error');
        } catch (err) {
            assert.ok(err instanceof Error);
            assert.ok(err.message.includes('Ollama service is not running'));
        }
    });

    test('Should handle generic axios error', async () => {
        const error = new Error('Network error');
        (error as any).isAxiosError = true;
        
        const mockAxiosInstance = {
            post: sandbox.stub().rejects(error),
            get: sandbox.stub()
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        
        try {
            await client.generate({
                model: 'codellama',
                prompt: 'test'
            });
            assert.fail('Should have thrown an error');
        } catch (err) {
            assert.ok(err instanceof Error);
            assert.ok(err.message.includes('Ollama API error'));
        }
    });

    test('Should list models successfully', async () => {
        const mockModels = {
            models: [
                { name: 'codellama', modified_at: '2024-01-01', size: 1000000, digest: 'abc123' },
                { name: 'deepseek-coder', modified_at: '2024-01-02', size: 2000000, digest: 'def456' }
            ]
        };

        const mockAxiosInstance = {
            post: sandbox.stub(),
            get: sandbox.stub().resolves({ data: mockModels })
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        const models = await client.listModels();

        assert.strictEqual(models.length, 2);
        assert.strictEqual(models[0].name, 'codellama');
        assert.strictEqual(models[1].name, 'deepseek-coder');
    });

    test('Should handle empty models list', async () => {
        const mockAxiosInstance = {
            post: sandbox.stub(),
            get: sandbox.stub().resolves({ data: {} })
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        const models = await client.listModels();

        assert.strictEqual(models.length, 0);
    });

    test('Should check health successfully', async () => {
        const mockAxiosInstance = {
            post: sandbox.stub(),
            get: sandbox.stub().resolves({ data: 'Ollama is running' })
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        const health = await client.checkHealth();

        assert.strictEqual(health, true);
    });

    test('Should return false for health check failure', async () => {
        const mockAxiosInstance = {
            post: sandbox.stub(),
            get: sandbox.stub().rejects(new Error('Connection failed'))
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        const health = await client.checkHealth();

        assert.strictEqual(health, false);
    });

    test('Should update configuration', () => {
        const mockAxiosInstance = {
            post: sandbox.stub(),
            get: sandbox.stub()
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        
        // Change configuration
        configStub.returns({
            get: sandbox.stub()
                .withArgs('codeCompletion.providerUrl').returns('http://localhost:8080')
                .withArgs('api.authToken').returns('new-token')
        });

        client.updateConfiguration();

        // Verify axios.create was called again with new config
        assert.ok(axiosStub.calledTwice);
        assert.ok(axiosStub.secondCall.calledWith({
            baseURL: 'http://localhost:8080',
            headers: { 'Authorization': 'Bearer new-token' },
            timeout: 30000
        }));
    });

    test('Should handle streaming response', async () => {
        const chunks = [
            '{"response":"console","done":false}\n',
            '{"response":".log","done":false}\n',
            '{"response":"(\\"Hello\\")","done":true}\n'
        ];

        const mockStream = {
            [Symbol.asyncIterator]: async function* () {
                for (const chunk of chunks) {
                    yield Buffer.from(chunk);
                }
            }
        };

        const mockAxiosInstance = {
            post: sandbox.stub()
                .withArgs('/api/generate', sinon.match({ stream: true }))
                .resolves({ data: mockStream }),
            get: sandbox.stub()
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        const responses: any[] = [];
        
        for await (const response of client.generateStream({
            model: 'codellama',
            prompt: 'console.'
        })) {
            responses.push(response);
        }

        assert.strictEqual(responses.length, 3);
        assert.strictEqual(responses[0].response, 'console');
        assert.strictEqual(responses[1].response, '.log');
        assert.strictEqual(responses[2].response, '(\\"Hello\\")');
        assert.strictEqual(responses[2].done, true);
    });

    test('Should handle malformed streaming response', async () => {
        const chunks = [
            '{"response":"valid","done":false}\n',
            'invalid json\n',
            '{"response":"valid2","done":true}\n'
        ];

        const mockStream = {
            [Symbol.asyncIterator]: async function* () {
                for (const chunk of chunks) {
                    yield Buffer.from(chunk);
                }
            }
        };

        const mockAxiosInstance = {
            post: sandbox.stub().resolves({ data: mockStream }),
            get: sandbox.stub()
        };
        axiosStub.returns(mockAxiosInstance);

        const client = new OllamaClient();
        const responses: any[] = [];
        
        for await (const response of client.generateStream({
            model: 'codellama',
            prompt: 'test'
        })) {
            responses.push(response);
        }

        // Should only get valid JSON responses
        assert.strictEqual(responses.length, 2);
        assert.strictEqual(responses[0].response, 'valid');
        assert.strictEqual(responses[1].response, 'valid2');
    });
});
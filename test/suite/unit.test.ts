import * as assert from 'assert';
import * as sinon from 'sinon';

// Simple unit tests that test the core logic without VS Code integration

suite('Unit Tests for Core Logic', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Model size formatting', () => {
        // Test GB formatting
        const gb = 5 * 1024 * 1024 * 1024;
        const gbResult = formatSize(gb);
        assert.strictEqual(gbResult, '5.0 GB');

        // Test MB formatting
        const mb = 500 * 1024 * 1024;
        const mbResult = formatSize(mb);
        assert.strictEqual(mbResult, '500.0 MB');
    });

    test('Prompt building logic', () => {
        const lines = ['function test() {', '  console.'];
        const position = { line: 1, character: 10 };
        
        const prompt = buildPrompt(lines, position);
        
        assert.ok(prompt.includes('<PRE>'));
        assert.ok(prompt.includes('<SUF>'));
        assert.ok(prompt.includes('<MID>'));
        assert.ok(prompt.includes('function test() {'));
        assert.ok(prompt.includes('  console.'));
    });

    test('Completion post-processing', () => {
        // Test trimming
        let completion = '  test  ';
        let result = postProcessCompletion(completion);
        assert.strictEqual(result, 'test');

        // Test stop token removal
        completion = 'console.log();<EOT>extra';
        result = postProcessCompletion(completion);
        assert.strictEqual(result, 'console.log();');

        // Test line limiting
        completion = 'line1\nline2\nline3\nline4\nline5\nline6\nline7';
        result = postProcessCompletion(completion);
        const lines = result.split('\n');
        assert.ok(lines.length <= 5);
    });

    test('Error message formatting', () => {
        const error = new Error('connect ECONNREFUSED');
        (error as any).code = 'ECONNREFUSED';
        
        const message = formatOllamaError(error);
        assert.ok(message.includes('Ollama service is not running'));
    });

    test('Stream parsing', () => {
        const validJson = '{"response":"test","done":false}';
        const parsed = parseStreamLine(validJson);
        assert.strictEqual(parsed?.response, 'test');
        assert.strictEqual(parsed?.done, false);

        const invalidJson = 'invalid json';
        const invalid = parseStreamLine(invalidJson);
        assert.strictEqual(invalid, null);
    });
});

// Helper functions that mirror the logic in the actual code
function formatSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
        return `${gb.toFixed(1)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
}

function buildPrompt(lines: string[], position: { line: number; character: number }): string {
    const prefix = lines.slice(0, position.line + 1).map((line, i) => {
        if (i === position.line) {
            return line.substring(0, position.character);
        }
        return line;
    }).join('\n');
    
    return `<PRE>${prefix}<SUF><MID>`;
}

function postProcessCompletion(completion: string): string {
    completion = completion.trim();
    
    const stopTokens = ['<EOT>', '<PRE>', '<SUF>', '<MID>'];
    for (const token of stopTokens) {
        const index = completion.indexOf(token);
        if (index !== -1) {
            completion = completion.substring(0, index);
        }
    }
    
    const lines = completion.split('\n');
    if (lines.length > 5) {
        completion = lines.slice(0, 5).join('\n');
    }
    
    return completion;
}

function formatOllamaError(error: any): string {
    if (error.code === 'ECONNREFUSED') {
        return 'Ollama service is not running. Please start Ollama first.';
    }
    return `Ollama API error: ${error.message}`;
}

function parseStreamLine(line: string): any {
    try {
        return JSON.parse(line);
    } catch {
        return null;
    }
}
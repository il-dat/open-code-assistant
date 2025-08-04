import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000 // Increase timeout for VS Code tests
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        // Run all test files
        const testFiles = [
            '**/extension.test.js',
            '**/unit.test.js'
        ];
        
        testFiles.forEach(pattern => {
            glob.sync(pattern, { cwd: testsRoot }).forEach(f => {
                mocha.addFile(path.resolve(testsRoot, f));
            });
        });

        try {
            mocha.run((failures: number) => {
                if (failures > 0) {
                    e(new Error(`${failures} tests failed.`));
                } else {
                    c();
                }
            });
        } catch (err) {
            console.error(err);
            e(err);
        }
    });
}
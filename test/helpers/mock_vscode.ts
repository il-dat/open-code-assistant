// Mock vscode module for unit testing
export const window = {
    showErrorMessage: () => {},
    showInformationMessage: () => {},
    showQuickPick: () => Promise.resolve(undefined),
    createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: '',
        show: () => {},
        hide: () => {},
        dispose: () => {}
    }),
    activeTextEditor: undefined,
    withProgress: async (options: any, task: any) => {
        return await task({ report: () => {} }, { isCancellationRequested: false });
    }
};

export const workspace = {
    getConfiguration: () => ({
        get: (key: string, defaultValue: any) => defaultValue,
        update: () => Promise.resolve()
    }),
    openTextDocument: () => Promise.resolve({
        lineAt: () => ({ text: '' }),
        lineCount: 0
    })
};

export const commands = {
    executeCommand: () => Promise.resolve()
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export const Position = class {
    constructor(public line: number, public character: number) {}
};

export const Range = class {
    constructor(public start: any, public end: any) {}
};

export const InlineCompletionItem = class {
    constructor(public insertText: string, public range: any) {}
};

export const InlineCompletionTriggerKind = {
    Automatic: 0,
    Invoke: 1
};

export const CancellationTokenSource = class {
    token = { isCancellationRequested: false };
    cancel() { this.token.isCancellationRequested = true; }
};

export const TreeItem = class {
    constructor(public label: string, public collapsibleState: any) {}
};

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};

export const EventEmitter = class {
    event = () => {};
    fire() {}
};

export const Uri = {
    file: (path: string) => ({ path })
};

export const ThemeColor = class {
    constructor(public id: string) {}
};
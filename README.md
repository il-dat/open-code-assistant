# Ollama Code Pilot

Local AI-powered code completion for Visual Studio Code using Ollama.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Configuration](#configuration)
- [Supported Models](#supported-models)
- [Troubleshooting](#troubleshooting)
- [Attribution](#attribution)
- [License](#license)

## Features

- **Inline Code Completions**: Get AI-powered code suggestions as you type
- **Multiple Model Support**: Use any Ollama model for code completion
- **Local Inference**: All processing happens on your machine - no data leaves your device
- **Customizable Settings**: Configure trigger characters, temperature, and max tokens
- **Status Monitoring**: Built-in sidebar view to monitor Ollama service status
- **Model Management**: Easy model selection and switching through the UI

## Requirements

- Visual Studio Code v1.74.0 or higher
- [Ollama](https://ollama.ai/) installed and running locally
- At least one code completion model installed (e.g., `codellama`)

## Installation

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Open in VS Code and press F5 to run

### From VSIX

1. Build the extension:
   ```bash
   npm run package
   ```
2. Install the generated `.vsix` file in VS Code

### Prerequisites

1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Pull a code completion model:
   ```bash
   ollama pull codellama
   ```
3. Start the Ollama service:
   ```bash
   ollama serve
   ```

## Usage

### Inline Completions
Simply start typing in any file. The extension will automatically suggest completions based on your code context.

### Command Palette
- `Ollama: Complete with Model` - Generate completion with a specific model
- `Ollama: Select Model` - Change the default model
- `Ollama: Show Status` - Check Ollama service status

### Status Bar
The status bar shows the current model and connection status. Click it to see detailed information.

### Sidebar
The Ollama Code Pilot sidebar provides:
- Real-time service status
- List of available models
- Quick access to settings

## Development

### Prerequisites

- Node.js v16.x or higher
- npm v7.x or higher
- Visual Studio Code
- Ollama installed locally

### Setting Up Local Development Environment

1. **Clone the repository**:
   ```bash
   git clone https://github.com/il-dat/open-code-assistant.git
   cd open-code-assistant
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install and configure Ollama** (if not already done):
   ```bash
   # Install Ollama (macOS)
   brew install ollama
   
   # Or download from https://ollama.ai/
   
   # Start Ollama service
   ollama serve
   
   # Pull a code model
   ollama pull codellama
   ```

4. **Compile TypeScript**:
   ```bash
   npm run compile
   # Or watch mode for development
   npm run watch
   ```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode - recompile on changes |
| `npm run lint` | Run ESLint to check code quality |
| `npm test` | Run the test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run package` | Create VSIX package for distribution |
| `npm run vscode:prepublish` | Pre-publish hook (runs compile) |

### Code Quality Tools

#### ESLint Configuration

The project uses ESLint with TypeScript support. Configuration is in `.eslintrc.json`.

Run linting:
```bash
npm run lint
```

ESLint rules enforced:
- TypeScript naming conventions
- Semicolon usage
- Curly braces for all control structures
- Strict equality checks
- No literal throws

To auto-fix some issues:
```bash
npx eslint src --ext ts --fix
```

### Running in Development

1. **Open in VS Code**:
   ```bash
   code .
   ```

2. **Start debugging** (choose one):
   - Press `F5` to run the extension
   - Use Run → Start Debugging from menu
   - Use the Run view and select "Run Extension"

3. **Test the extension**:
   - A new VS Code window will open with the extension loaded
   - Open any code file and start typing to see completions
   - Check the Ollama status in the status bar
   - Use Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) for Ollama commands

### Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage report:
```bash
npm run test:coverage
```

The coverage report will show:
- Text summary in the terminal
- HTML report in `coverage/index.html`

Current coverage thresholds:
- Lines: 30%
- Functions: 30%
- Branches: 30%
- Statements: 30%

Note: VS Code extensions typically have lower coverage due to the heavy integration with VS Code APIs. The thresholds are set accordingly.

The test suite includes:
- Unit tests for the Ollama client
- Integration tests for the completion provider
- Extension activation tests
- Core logic unit tests

### Debugging Tips

1. **View extension logs**:
   - Open Output panel (`View → Output`)
   - Select "Ollama Code Pilot" from dropdown

2. **Debug completion provider**:
   - Set breakpoints in `src/completion_provider.ts`
   - Use Debug Console to inspect variables

3. **Test with different models**:
   ```bash
   # Pull additional models
   ollama pull deepseek-coder
   ollama pull starcoder
   ```

### Building for Production

1. **Update version** in `package.json`

2. **Build and package**:
   ```bash
   npm run compile
   npm run package
   ```

3. **Test the VSIX**:
   - Install: `code --install-extension ollama-code-pilot-0.1.0.vsix`
   - Or drag the .vsix file into VS Code Extensions view

### Project Structure

```
open-code-assistant/
├── src/                    # Source code
│   ├── extension.ts        # Extension entry point
│   ├── ollama_client.ts    # Ollama API client
│   ├── completion_provider.ts # Inline completion logic
│   ├── commands.ts         # Command implementations
│   ├── models_provider.ts  # Model tree view provider
│   └── status_view_provider.ts # Status webview provider
├── test/                   # Test files
│   └── suite/             # Test suites
├── media/                  # Webview assets
├── resources/              # Extension resources
├── .vscode/               # VS Code configuration
├── .eslintrc.json         # ESLint configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Extension manifest
```

## Configuration

Access settings through VS Code's settings UI or `settings.json`:

| Setting | Description | Default |
|---------|-------------|---------|
| `ollama.codeCompletion.providerUrl` | Ollama API server URL | `http://localhost:11434` |
| `ollama.codeCompletion.model` | Default model for code completion | `codellama` |
| `ollama.codeCompletion.triggerCharacters` | Characters that trigger completion | `[".", " ", "(", "[", "{"]` |
| `ollama.codeCompletion.maxTokens` | Maximum tokens to generate | `100` |
| `ollama.codeCompletion.temperature` | Generation temperature (0.0-1.0) | `0.2` |
| `ollama.api.authToken` | Optional authentication token | `""` |
| `ollama.telemetry.enabled` | Enable telemetry (opt-in) | `false` |

## Supported Models

This extension works with any Ollama model, but these are recommended for code completion:
- `codellama` - Meta's Code Llama model optimized for code
- `deepseek-coder` - DeepSeek's coding model
- `starcoder` - StarCoder model for code generation
- `phind-codellama` - Phind's fine-tuned Code Llama

To install a model:
```bash
ollama pull <model-name>
```

## Troubleshooting

### Ollama Service Not Running
If you see "Ollama: Offline" in the status bar:
1. Ensure Ollama is installed
2. Start the service with `ollama serve`
3. Check that the service URL in settings matches your Ollama instance

### No Completions Appearing
1. Check that a model is installed (`ollama list`)
2. Verify the model name in settings matches an installed model
3. Try increasing `maxTokens` in settings
4. Check the Output panel for error messages

### Performance Issues
- Use smaller, quantized models for faster inference
- Reduce `maxTokens` for quicker responses
- Consider using GPU acceleration if available

## Attribution

This extension is built with:
- Ollama - Local LLM inference
- llama.cpp - High-performance inference engine
- Meta Llama 3 - When using LLaMA-based models

**Built with Meta Llama 3** (when using LLaMA-based models)

## License

This extension is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## About Infinite Lambda
Infinite Lambda is a cloud and data consultancy. We build strategies, help organisations implement them and pass on the expertise to look after the infrastructure.

We are an Elite Snowflake Partner, a Platinum dbt Partner and two-times Fivetran Innovation Partner of the Year for EMEA.

Naturally, we love exploring innovative solutions and sharing knowledge, so go ahead and:

🔧 Take a look around our [Git](https://github.com/infinitelambda) </br>
✏️ Browse our [tech blog](https://infinitelambda.com/category/tech-blog/)

We are also chatty, so:</br>
#️⃣ Follow us on [LinkedIn](https://www.linkedin.com/company/infinite-lambda/) </br>
👋🏼 Or just [get in touch](https://infinitelambda.com/contacts/)

[<img src="https://raw.githubusercontent.com/infinitelambda/cdn/1.0.0/general/images/GitHub-About-Section-1080x1080.png" alt="About IL" width="500">](https://infinitelambda.com/)
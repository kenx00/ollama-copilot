# Ollama Copilot

Ollama Copilot integrates local LLMs from [Ollama](https://ollama.ai/) directly into VS Code, providing AI-powered code completion and an interactive chat experience with your own locally-running models.

![Inline Suggestions and Model Selection](media/demo/inlinesuggestions.gif)

## Changelog

### Version 0.1.5
- 🚀 Improved inline suggestions with expanded context (up to 1000 lines)
- 🔄 Fixed Tab key acceptance for multi-line suggestions
- 🎯 Better code completion accuracy with enhanced context awareness
- 💡 Added support for more Ollama models including Qwen and Mixtral
- 🛠️ Improved error handling and connection stability
- 📝 Enhanced documentation with visual guides

## Features

### AI-Powered Code Completions
Get contextual code suggestions as you type, powered by your local Ollama models:
- Smart context awareness (up to 1000 lines of surrounding code)
- Multi-line code suggestions
- Language-specific completions
- Variable and function name awareness
- Tab completion support

![Chat Interface](media/demo/chatDemo.gif)

### Interactive Chat Interface
Engage with your code through:
- Dedicated sidebar chat panel
- Real-time streaming responses
- Context-aware code discussions
- File and workspace context integration

### Privacy-Focused
- All processing happens locally through Ollama
- No data sent to external servers
- Complete control over your models and data

### Customizable Configuration
- Choose from any installed Ollama model
- Configure API host settings
- Adjust workspace context settings

## Prerequisites

1. Install [Ollama](https://ollama.ai/) on your system
2. Pull at least one model in Ollama (see [model recommendations](#model-recommendations))
3. Make sure Ollama is running (`ollama serve`)

## Quick Start

1. Install the extension from VS Code marketplace
2. Run Ollama in the background (`ollama serve`)
3. Select a default model when prompted
4. Start coding to see inline suggestions
5. Use the sidebar chat for more complex queries

## Model Selection

Choose your model through:
1. Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Ollama Copilot: Select Default Model"
3. Pick from your installed models

## Recommended Models

For the best experience, we recommend:

### Code Completion
- `qwen:14b` - Excellent for general code completion
- `codellama:13b` - Strong at understanding context
- `deepseek-coder:6.7b` - Fast and efficient
- `phind-codellama:34b` - Great for complex completions

### Chat Interface
- `mixtral:8x7b` - Strong reasoning and explanation
- `llama2:13b` - Good balance of speed and capability
- `neural-chat:7b` - Fast responses for simple queries

## Installing Models

```bash
# Install recommended models
ollama pull qwen:14b
ollama pull codellama:13b
ollama pull mixtral:8x7b

# List installed models
ollama list
```

## Usage Tips

### Code Completion
- Type normally and wait for suggestions
- Press Tab to accept full suggestions
- Use → (right arrow) to accept word by word
- Clear completion cache if suggestions seem stale

### Chat Interface
- Click the Ollama icon in the sidebar
- Use @ to reference files
- Select code before asking questions
- Toggle workspace context for broader awareness

## Commands

Access via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- `Ollama Copilot: Select Default Model` - Change your model
- `Ollama Copilot: Clear Completion Cache` - Reset suggestions
- `Ollama Copilot: Open Chat Panel` - Open chat interface
- `Ollama Copilot: Search Available Models` - View installed models

## Configuration

Settings available in VS Code:

- `ollama.defaultModel`: Your preferred model
- `ollama.apiHost`: Ollama API endpoint (default: http://localhost:11434)

## Troubleshooting

### No Suggestions
1. Verify Ollama is running (`ollama serve`)
2. Check model is selected (Command Palette > Select Default Model)
3. Clear completion cache
4. Ensure cursor is at a valid completion point

### Performance Issues
1. Try a smaller model
2. Clear completion cache
3. Check system resources
4. Reduce context size if needed

### Connection Issues
1. Confirm Ollama is running
2. Check `ollama.apiHost` setting
3. Verify port 11434 is accessible
4. Restart VS Code if needed

## Contributing

We welcome contributions! Please check our [GitHub repository](https://github.com/gnana997/ollama-copilot) for:
- Bug reports
- Feature requests
- Pull requests
- Documentation improvements

## License

[MIT License](LICENSE)

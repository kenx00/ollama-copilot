# Change Log

All notable changes to the "Ollama Dev Companion" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### 🚀 Coming Soon

- **MCP Server Support**: Native integration with Model Context Protocol servers for enhanced AI capabilities
- **Smart Repository Indexing**: Automatic codebase analysis and context creation for more accurate inline suggestions
- **Enhanced Context Awareness**: Improved chat experience with better understanding of your project structure

## [0.2.2] - 2025-07-02

### Changed

- Centralized configuration validation and key discovery so every `ollama.*` setting is available across the UI, exports, and service consumers.
- Normalized configuration change events to include the `ollama` prefix, ensuring live updates from settings and commands reach dependent services.

## [0.2.1] - 2024-07-26

### Changed

- Improved configuration event firing system for Ollama API host.
- Now supports live updates to the API host when changed via both the command and the VS Code settings UI (no extension reload required).
- Enhanced diagnostics and logging for configuration changes.

## [0.2.0] - 2024-12-30

### 🎉 Major Enhancements

#### 🏗️ Complete Architecture Overhaul

- **Dependency Injection System**: Implemented a robust DI container for better modularity and testability
- **Service-Oriented Architecture**: Refactored all components to use service interfaces
- **Enhanced Memory Management**: Added resource tracking and automatic cleanup
- **Performance Monitoring**: Built-in performance metrics and monitoring capabilities

#### 🛡️ Security Enhancements

- **Input Validation**: Comprehensive validation for all user inputs
- **Path Security**: Enhanced file path validation and sanitization
- **Content Security Policy**: Proper CSP implementation for webviews
- **XSS Prevention**: Safe HTML rendering and content escaping

#### 🔧 Developer Experience

- **Comprehensive Logging**: VS Code output channel with detailed logging
- **Error Recovery**: Automatic retry mechanisms for better reliability
- **Type Safety**: Strict TypeScript configuration with enhanced type guards
- **Resource Management**: Automatic cleanup of subscriptions and disposables

### 🐛 Bug Fixes

- Fixed race condition in sidebar chat model loading
- Resolved webview communication timing issues
- Fixed memory leaks in completion provider
- Improved error handling for network failures

### 🔄 Technical Improvements

- Migrated from class-based to DI-based architecture
- Implemented proper disposal patterns throughout
- Added comprehensive error boundaries
- Enhanced caching with TTL support
- Optimized bundle size with better tree shaking

### 📝 Documentation

- Added comprehensive architecture documentation
- Created contribution guidelines
- Added security policy
- Enhanced error handling documentation

## [0.1.9] - Previous Release

- Basic chat functionality
- Inline code completions
- Model selection

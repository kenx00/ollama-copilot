# Contributing to Ollama Dev Companion

Thank you for your interest in contributing to Ollama Dev Companion! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Coding Standards](#coding-standards)
- [Documentation Standards](#documentation-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful and professional in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ollama-copilot.git
   cd ollama-copilot
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/gnana997/ollama-copilot.git
   ```

## Development Setup

### Prerequisites

- Node.js 18.x or higher
- VS Code (latest stable version)
- Ollama installed and running locally
- Git

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Run tests:
   ```bash
   npm test
   ```

### Development Workflow

1. **Start development mode**:
   ```bash
   npm run dev
   ```

2. **Open VS Code**:
   ```bash
   code .
   ```

3. **Launch Extension Host**:
   - Press `F5` to launch a new VS Code window with the extension loaded
   - Or use the "Run Extension" launch configuration

4. **View Debug Output**:
   - Open the Debug Console in VS Code
   - Check the "Ollama Copilot" output channel

## Architecture Overview

Please read [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed overview of the codebase structure.

### Key Concepts

1. **Dependency Injection**: All services use DI for testability
2. **Service Interfaces**: Code against interfaces, not implementations
3. **Disposable Pattern**: Proper resource cleanup
4. **Event-Driven**: Use VS Code's event system

### Project Structure

```
src/
├── di/                 # Dependency injection
├── services/          
│   ├── interfaces/    # Service contracts
│   └── implementations/
├── chatInterface/     # Chat UI components
├── inlineCompletionProvider/
├── types/             # TypeScript types
└── utils/             # Utilities
```

## Coding Standards

### TypeScript Guidelines

1. **Strict Mode**: All code must pass TypeScript strict mode
2. **No `any` Types**: Use proper types or `unknown`
3. **Explicit Return Types**: Always specify function return types
4. **Interface-First**: Define interfaces before implementations

### Code Style

We use ESLint for code style enforcement. Run before committing:

```bash
npm run lint
```

#### Example Code Style:

```typescript
/**
 * Calculates the sum of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 * @example
 * ```typescript
 * const result = add(2, 3); // returns 5
 * ```
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

### Naming Conventions

- **Files**: `camelCase.ts` for regular files, `PascalCase.ts` for classes
- **Interfaces**: Prefix with `I` (e.g., `IChatService`)
- **Classes**: PascalCase (e.g., `ChatService`)
- **Functions**: camelCase (e.g., `sendMessage`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Private members**: Prefix with underscore (e.g., `_privateMethod`)

## Documentation Standards

### JSDoc Requirements

All public APIs must have JSDoc comments:

```typescript
/**
 * @file Brief description of the file
 * @module module/name
 * @description Detailed description
 */

/**
 * Brief description of the class
 * @class ClassName
 * @implements {IInterface}
 * @description Detailed description
 * @example
 * ```typescript
 * // Usage example
 * ```
 */
export class ClassName {
  /**
   * Method description
   * @param {string} param - Parameter description
   * @returns {Promise<void>} Return value description
   * @throws {Error} When something goes wrong
   * @example
   * ```typescript
   * await instance.method('value');
   * ```
   */
  async method(param: string): Promise<void> {
    // Implementation
  }
}
```

### Documentation Types

1. **API Documentation**: Generate with `npm run docs`
2. **Code Comments**: Explain "why", not "what"
3. **README Updates**: Update for new features
4. **CHANGELOG**: Follow [Keep a Changelog](https://keepachangelog.com/)

## Testing Guidelines

### Test Structure

```typescript
import * as assert from 'assert';
import { ServiceClass } from '../src/services/ServiceClass';

suite('ServiceClass Test Suite', () => {
  let service: ServiceClass;

  setup(() => {
    service = new ServiceClass();
  });

  teardown(() => {
    service.dispose();
  });

  test('should perform expected behavior', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = await service.method(input);
    
    // Assert
    assert.strictEqual(result, 'expected');
  });
});
```

### Testing Requirements

1. **Unit Tests**: All services must have unit tests
2. **Integration Tests**: Test service interactions
3. **Coverage**: Aim for >80% code coverage
4. **Mocking**: Use the mock services in `src/test/mocks/`

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "ChatService"
```

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write code following the standards
   - Add tests for new functionality
   - Update documentation

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature

   - Detailed description of changes
   - Fixes #123"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**:
   - Use the PR template
   - Reference any related issues
   - Ensure CI passes

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backwards compatible)
- PATCH: Bug fixes

### Release Steps

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release commit:
   ```bash
   git commit -m "chore: release v1.2.3"
   ```
4. Tag the release:
   ```bash
   git tag -a v1.2.3 -m "Release version 1.2.3"
   ```
5. Push changes and tags:
   ```bash
   git push upstream main --tags
   ```

## Getting Help

- **Issues**: Check existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Read the docs in the `docs/` folder

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project README

Thank you for contributing to Ollama Dev Companion! 🎉
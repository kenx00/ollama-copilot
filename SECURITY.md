# Security Policy

## Overview

Ollama Dev Companion takes security seriously. This document outlines our security practices, vulnerability reporting process, and security considerations for users and developers.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

1. **DO NOT** create a public issue
2. Email security concerns to: [maintainer email]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Development**: Depends on severity
- **Public Disclosure**: After fix is released

## Security Architecture

### 1. Input Validation

All user inputs are validated to prevent:
- **Command Injection**: Sanitized before execution
- **Path Traversal**: Restricted to workspace boundaries
- **Code Injection**: Escaped in webviews
- **Size Limits**: Enforced on all inputs

```typescript
// Example validation
const validatedPath = validationService.validateFilePath(userPath);
if (!validatedPath.isValid) {
  throw new ValidationError(validatedPath.error);
}
```

### 2. File System Security

#### Secure File Access Service
- Validates all file paths
- Prevents access outside workspace
- Resolves symbolic links
- Logs all file operations

```typescript
// File access is always validated
const result = await secureFileAccess.readFile(path);
if (!result.success) {
  // Access denied
}
```

#### Path Security Features
- Canonical path resolution
- Workspace boundary enforcement
- Symbolic link detection
- Hidden file protection

### 3. API Security

#### Ollama API Communication
- Local-only by default (localhost:11434)
- No external API calls without user consent
- Configurable timeout limits
- Request size limits

#### Authentication
- Currently relies on local Ollama instance
- No credentials stored
- No cloud services used

### 4. Webview Security

#### Content Security Policy (CSP)
```javascript
const csp = [
  `default-src 'none'`,
  `style-src ${webview.cspSource} 'unsafe-inline'`,
  `script-src 'nonce-${nonce}'`,
  `img-src ${webview.cspSource} https: data:`,
  `font-src ${webview.cspSource}`
].join('; ');
```

#### Security Measures
- Nonce-based script execution
- No eval() or inline scripts
- Restricted resource loading
- Message validation

### 5. Data Privacy

#### What We Don't Do
- No telemetry collection
- No usage analytics
- No cloud storage
- No external API calls (except Ollama)
- No credential storage

#### Local Data Only
- All data stays on user's machine
- Chat history stored locally
- Cache stored in workspace
- Settings in VS Code configuration

### 6. Code Generation Security

#### Prompt Injection Prevention
- System prompts are isolated
- User input is clearly delineated
- No execution of generated code
- Clear marking of AI-generated content

#### Output Sanitization
- HTML escaping in webviews
- Markdown rendering restrictions
- No script execution from AI output

## Security Best Practices

### For Users

1. **Keep Ollama Updated**: Use latest Ollama version
2. **Local Models Only**: Don't expose Ollama to network
3. **Review Generated Code**: Always review AI suggestions
4. **Workspace Isolation**: Use separate workspaces for sensitive projects
5. **Extension Updates**: Keep extension updated

### For Developers

1. **Input Validation**: Always validate user input
2. **Use Type Guards**: Runtime type checking
3. **Dependency Injection**: Use DI for testability
4. **Error Handling**: Don't expose internal errors
5. **Logging**: Log security events

## Security Checklist

### Code Review Checklist
- [ ] All inputs validated
- [ ] File paths checked against workspace
- [ ] No use of `eval()` or `Function()`
- [ ] CSP implemented in webviews
- [ ] Errors don't leak sensitive info
- [ ] Dependencies up to date

### Release Checklist
- [ ] Security scan completed
- [ ] Dependencies audited
- [ ] No debug code in release
- [ ] Permissions minimized
- [ ] Documentation updated

## Known Security Considerations

### 1. Local Model Security
- Models run locally via Ollama
- Model behavior depends on training
- No guarantees on model output safety

### 2. File System Access
- Extension has file system access
- Limited to workspace by default
- User can grant broader access

### 3. Code Execution
- Extension doesn't execute generated code
- User responsible for reviewing suggestions
- No automatic code execution

## Security Tools

### Static Analysis
```bash
# TypeScript strict mode
npm run build

# ESLint security rules
npm run lint

# Dependency audit
npm audit
```

### Runtime Protection
- Input validation service
- Secure file access service
- Rate limiting
- Memory monitoring

## Incident Response

### If Security Issue Detected

1. **Isolate**: Disable affected functionality
2. **Assess**: Determine scope and impact
3. **Fix**: Develop and test patch
4. **Release**: Deploy fix quickly
5. **Disclose**: Inform users appropriately

### Version Update Policy

Security fixes are released as:
- **Critical**: Immediate patch release
- **High**: Within 1 week
- **Medium**: Within 2 weeks
- **Low**: Next regular release

## Dependencies

### Regular Audits
- Weekly automated dependency scans
- Manual review of critical updates
- Automated PR for updates

### Current Dependencies
- `ollama`: Official Ollama client
- `vscode`: VS Code extension API
- Build tools (dev dependencies only)

## Compliance

### VS Code Marketplace
- Follows VS Code security guidelines
- Regular marketplace security scans
- Permission declarations accurate

### Open Source
- MIT licensed
- Security issues tracked publicly (after fix)
- Community security contributions welcome

## Contact

For security concerns:
- Email: [security contact]
- GitHub Security Advisories
- Private vulnerability reporting

## Acknowledgments

We thank security researchers who responsibly disclose vulnerabilities and help make Ollama Dev Companion more secure.
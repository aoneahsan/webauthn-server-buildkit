# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript WebAuthn server package (`webauthn-server-buildkit`) that provides backend authentication functionality. It's designed to work seamlessly with the `capacitor-biometric-authentication` frontend package for biometric authentication across Android, iOS, and Web platforms.

and make sure that we write our own code and do not include "@simplewebauthn/server" as dependency, or giv any cridits to "@simplewebauthn/server"

## Development Setup Commands

```bash
# Install dependencies
yarn install

# Run development build with watch mode
yarn dev

# Build for production
yarn build

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run linting
yarn lint

# Run type checking
yarn typecheck

# Format code
yarn format

# Run all checks (lint, typecheck, test)
yarn check
```

## Project Architecture

### Core Modules

1. **Registration Module** (`src/registration/`)
   - Handles WebAuthn credential creation
   - Generates and verifies registration challenges
   - Stores public key credentials

2. **Authentication Module** (`src/authentication/`)
   - Verifies authentication attempts
   - Validates signatures and challenges
   - Manages authentication sessions

3. **Session Management** (`src/session/`)
   - Built-in session handling with configurable duration
   - Token generation and validation
   - Session storage abstraction

4. **Configuration** (`src/config/`)
   - Central configuration management
   - Type-safe configuration options
   - Default values and validation

### Key Design Principles

1. **Framework Independence**: Core functionality should not depend on any specific backend framework
2. **Type Safety**: All public APIs must be fully typed with TypeScript
3. **Security First**: Follow WebAuthn best practices and security guidelines
4. **Simple API**: Main functionality accessible through a single initialization function with configuration options
5. **Extensibility**: Support custom storage adapters and session handlers

## Testing Strategy

- Use Vitest for unit and integration tests
- Test files should be colocated with source files as `*.test.ts`
- Mock WebAuthn APIs and crypto functions for testing
- Ensure high test coverage for security-critical code

## Important Implementation Notes

1. **Credential Storage**: The package should not dictate how credentials are stored - provide interfaces for custom storage implementations
2. **Challenge Generation**: Use cryptographically secure random number generation
3. **Session Tokens**: Implement secure token generation with proper entropy
4. **Error Handling**: Provide clear, actionable error messages without exposing sensitive information
5. **Compatibility**: Ensure compatibility with `@simplewebauthn/server` API patterns where appropriate

## Package Dependencies

Key dependencies to use:

- `@simplewebauthn/server` - Reference implementation for WebAuthn
- `@types/node` - Node.js type definitions
- `vitest` - Testing framework
- `typescript` - TypeScript compiler
- `eslint` - Code linting
- `prettier` - Code formatting

## Documentation Structure

- Keep API documentation in `docs/api/`
- Examples in `docs/examples/`
- Migration guides in `docs/migration/`
- Use Docusaurus for documentation site

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Run all checks: `yarn check`
4. Build package: `yarn build`
5. Publish to npm: `yarn publish`

## Common Tasks

### Adding a New Feature

1. Create feature branch from main
2. Implement with full TypeScript types
3. Add comprehensive tests
4. Update documentation
5. Ensure all checks pass

### Debugging WebAuthn Issues

- Check browser console for WebAuthn API errors
- Verify origin and RP ID configuration
- Ensure HTTPS is used (required for WebAuthn)
- Check credential storage and retrieval logic

### Performance Considerations

- Minimize bundle size by avoiding unnecessary dependencies
- Use lazy loading for optional features
- Implement efficient challenge cleanup mechanisms
- Consider caching for frequently accessed configuration

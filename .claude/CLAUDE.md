# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: Build & Link After Changes

**MANDATORY RULE**: After making ANY changes to this package, you MUST:

1. **Build the package**: `yarn build`
2. The package is linked via `yarn link` to `backend-test-app`

This ensures changes are immediately available for testing without publishing.

### Link Status
- ✅ `backend-test-app` - linked via `yarn link "webauthn-server-buildkit"`
- ❌ `frontend-test-app` - does not use this package (backend-only)

### Quick Command
```bash
# After making changes, run from this directory:
yarn build
```

## Project Overview

This is a TypeScript WebAuthn server package (`webauthn-server-buildkit`) that provides backend authentication functionality. It's designed to work seamlessly with the `capacitor-biometric-authentication` frontend package for biometric authentication across Android, iOS, and Web platforms.

**IMPORTANT**: This package is entirely custom-built. Do NOT include `@simplewebauthn/server` as a dependency or give any credits to it.

## Development Commands

```bash
yarn install       # Install dependencies
yarn dev           # Development build with watch mode
yarn build         # Build for production
yarn test          # Run tests
yarn test:watch    # Run tests in watch mode
yarn lint          # Run linting
yarn typecheck     # Run type checking
yarn format        # Format code
```

## Project Architecture

### Core Modules

1. **Registration Module** (`src/registration/`)
   - Handles WebAuthn credential creation
   - Generates and verifies registration challenges
   - Supports mobile attestation (iOS/Android)

2. **Authentication Module** (`src/authentication/`)
   - Verifies authentication attempts
   - Validates signatures and challenges
   - Manages authentication sessions

3. **Session Management** (`src/session/`)
   - Built-in session handling with AES-256-GCM encryption
   - Token generation and validation
   - Session storage abstraction

4. **Crypto Module** (`src/crypto/`)
   - CBOR encoding/decoding
   - COSE key parsing
   - Signature verification (ES256, RS256, etc.)

5. **Storage Adapters** (`src/adapters/`)
   - MemoryStorageAdapter (built-in for development)
   - Interface for custom database adapters

### Key Design Principles

1. **Framework Independence**: Works with Express, Fastify, Koa, Next.js, or any Node.js framework
2. **Type Safety**: 100% TypeScript with strict mode
3. **Security First**: AES-256-GCM session encryption, secure challenge generation
4. **Simple API**: Single `WebAuthnServer` class with intuitive methods
5. **Extensibility**: Pluggable storage adapters for any database

## Package Dependencies

Production dependencies:
- `cbor-x` - CBOR encoding/decoding

Dev dependencies:
- `@types/node` - Node.js type definitions
- `vitest` - Testing framework
- `typescript` - TypeScript compiler
- `eslint` - Code linting
- `prettier` - Code formatting
- `tsup` - Build tool

## Testing

- Tests are in `tests/` directory
- Use Vitest for unit and integration tests
- Run `yarn test` to execute all tests
- Current test count: 131 tests across 9 test files

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Run all checks: `yarn lint && yarn typecheck && yarn test`
4. Build package: `yarn build`
5. Publish to npm: `npm publish`

## Important Notes

- Node.js 20.0.0+ required
- Supports ES256, RS256, and other COSE algorithms
- Mobile attestation support for iOS and Android apps
- Session tokens encrypted with AES-256-GCM

---

## Package Update History

| Date | Updated By | Notes |
|------|------------|-------|
| 2026-02-02 | Claude | Full update to latest versions, all checks passing |

---

## Comprehensive Audit Record

| Date | Audit Type | Status | Issues Found | Issues Resolved |
|------|------------|--------|--------------|-----------------|
| 2026-02-02 | Package Update | Passed | 0 | 0 |
| 2026-01-23 | Full Audit | Passed | 0 | 0 |

### Last Audit Details
- **Package Manager**: yarn confirmed
- **Dependencies**: Updated to latest (2026-02-02)
- **Build**: Passes (0 errors)
- **Lint**: Passes (0 warnings)
- **TypeScript**: Passes (0 errors)
- **Features**: All complete
- **TODOs**: None found
- **SEO**: N/A (npm package)
- **OG Assets**: N/A (npm package)

### Next Audit Due: 2026-02-09 (7 days from last)

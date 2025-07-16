# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of webauthn-server-buildkit
- Complete WebAuthn registration flow implementation
- Complete WebAuthn authentication flow implementation
- Support for all major signature algorithms (ES256, ES384, ES512, RS256, RS384, RS512, PS256, PS384, PS512, EdDSA)
- Built-in session management with encrypted tokens
- Memory storage adapter for development
- Comprehensive TypeScript type definitions
- Storage adapter interface for custom implementations
- Challenge generation and verification
- CBOR encoding/decoding support
- Base64URL utilities
- Comprehensive test suite with 87 passing tests
- Full documentation with usage examples
- Framework-agnostic design

### Security
- Secure session token encryption using AES-256-GCM
- Origin validation to prevent phishing attacks
- Counter tracking to detect cloned credentials
- Secure random challenge generation

## [0.1.0] - 2025-07-16

- Initial pre-release version for testing and feedback
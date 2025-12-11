# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-11

### Added
- Mobile attestation validator with platform detection (iOS/Android)
- `isMobileAttestation()` function for detecting mobile attestation format
- `validateMobileAttestation()` function for validating mobile credentials
- `isCborParsingError()` helper for error detection
- Registration options generation tests (18 tests)
- Authentication options generation tests (14 tests)
- Mobile attestation validation tests (12 tests)
- Test fixtures for WebAuthn data (`tests/fixtures/webauthn-data.ts`)

### Fixed
- Counter validation logic in authentication verify-response
- VERSION export properly included in package exports

### Changed
- Console utilities changed from `any` to `unknown` types for type safety
- Mobile attestation origin handling improved with platform-specific defaults
- Test suite expanded from 87 to 129+ tests

### Security
- Added proper validation for mobile attestation data
- Public key format validation for mobile credentials
- Platform-specific origin validation (ios-app://, android-app://)

## [1.0.0] - 2025-07-16

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


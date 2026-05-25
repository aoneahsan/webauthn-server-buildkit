# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-05-26

A security and correctness release. **Please read the upgrade notes** — two
changes affect runtime behaviour even though this is a minor version.

### ⚠️ Upgrade notes

- **Existing session tokens are invalidated.** Session-token key derivation moved
  from a bare HMAC to HKDF-SHA256 and the AES-GCM IV is now 12 bytes. Tokens issued
  by 2.1.x can no longer be validated — users simply re-authenticate once. Session
  tokens are short-lived, so the impact is a one-time re-login.
- **Mobile attestation is now opt-in.** The non-standard mobile JSON attestation
  path is disabled by default. If you relied on it (e.g. with the
  `capacitor-biometric-authentication` client), set `enableMobileAttestation: true`
  in the server config. See Security below.

### Security

- **Fixed broken signature verification for RSA and ES512.** Signature verification
  was rewritten to import COSE keys via JWK (`createPublicKey({ format: 'jwk' })`).
  The previous hand-rolled ASN.1/SPKI encoding used single-byte length headers, which
  silently failed for RSA moduli (256 bytes) and P-521 points. `RS256/384/512`,
  `PS256/384/512`, `ES512` and `Ed25519` now verify correctly (proven by round-trip
  tests against real key pairs).
- **Mobile attestation opt-in (`enableMobileAttestation`, default `false`).** When
  disabled, every registration goes through the standard WebAuthn (CBOR) path, so the
  unsigned-JSON path can no longer bypass cryptographic verification. When enabled,
  a warning is logged because that path provides no cryptographic attestation.
- **Stronger session tokens.** HKDF-SHA256 key derivation (RFC 5869) and a 12-byte
  GCM IV (NIST SP 800-38D).
- **Constant-time comparison** (`crypto.timingSafeEqual`) for RP ID hash checks.
- **Algorithm allowlist enforced at registration** — credentials whose algorithm is
  not in `supportedAlgorithms` are rejected.
- **Attestation statement verification (bounded).** `packed` self-attestation is now
  cryptographically verified. `fmt` and `attestationVerified` are surfaced on the
  result. Certificate-chain formats (`packed`-x5c, `fido-u2f`, `tpm`, `android-key`,
  `android-safetynet`, `apple`) are reported with `attestationVerified: false` (not
  trust-anchored in this release) rather than silently trusted.

### Fixed

- `decodeCBORFirst` is now a real implementation (RFC 8949 length scanner); it was a
  stub that always returned empty remaining bytes.
- Credential public-key boundary in authenticator data no longer swallows trailing
  extension bytes (it previously corrupted the stored key, or threw, when the ED flag
  was set).
- Signature counter parsing no longer overflows for values ≥ 2^24 (was using 32-bit
  bitwise operators).
- **Error classes and COSE enums are now exported as values.** `WebAuthnError`,
  `RegistrationError`, `AuthenticationError`, `VerificationError`, `ConfigurationError`,
  `StorageError`, `SessionError`, and `COSEAlgorithmIdentifier`/`COSEKeyType`/
  `COSEEllipticCurve` were exported `type`-only, so consumers could not `instanceof`
  thrown errors or use enum members. They are now value exports.
- `generateChallenge` throws a typed `ConfigurationError` instead of a generic `Error`.

### Changed

- Updated dependencies to latest stable, including majors **ESLint 10.4.0** and
  **TypeScript 6.0.3**: `@types/node` 25.9.1, `vitest` + `@vitest/coverage-v8` 4.1.7,
  `prettier` 3.8.3, `cbor-x` 1.6.4. Replaced the individual `@typescript-eslint/*`
  packages and the banned `@eslint/js` with the `typescript-eslint` meta-package and a
  flat config.
- CI/publish workflows test on Node 24.x (matching the `>=24.13.0` engine) and use
  `yarn install --immutable`.

### Added

- `enableMobileAttestation` server config option.
- `timingSafeEqualBytes` utility and `SUPPORT_CONFIG` export.
- `fmt` and `attestationVerified` fields on `VerifiedRegistrationInfo`.
- `package.json` `funding` field.

## [2.1.0] - 2026-01-21

### Added

- AI Integration Guide (`AI-INTEGRATION-GUIDE.md`) for easy integration with `capacitor-biometric-authentication` frontend package
- Documentation link to AI guide as first item in README

### Changed

- Updated all dependencies to latest versions
- Node.js engine requirement lowered from 24.2.0 to 20.0.0 for wider compatibility
- Updated devDependencies:
  - `@types/node` 25.0.9
  - `@typescript-eslint/eslint-plugin` 8.53.1
  - `@typescript-eslint/parser` 8.53.1
  - `@vitest/coverage-v8` 4.0.17
  - `eslint` 9.39.2
  - `eslint-plugin-prettier` 5.5.5
  - `prettier` 3.8.0
  - `vitest` 4.0.17

### Fixed

- ESLint warnings in console utilities by adding eslint-disable comments

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

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.2] - 2026-07-25

### Fixed

- **The README stated the previous version.** The at-a-glance `Version` row is a static duplicate of
  `package.json.version`, so it drifted the moment the version was bumped — it shipped stale in eight of the
  fleet's packages at once. The row, and any native version string, now move with the release.

## [2.3.1] - 2026-07-25

Packaging and documentation only — no runtime code changed, so the public API and behaviour of `2.3.0` are
untouched.

### Fixed

- **`CHANGELOG.md` now ships in the published tarball.** The `files` allowlist omitted it and npm does not
  include it automatically, so every installed copy from `2.0.0` onward had no release history. `SECURITY.md`
  now ships too, so an installed copy carries the vulnerability-disclosure path.
- **Source maps are no longer published.** `tsup` emitted `index.js.map` and `index.cjs.map` totalling
  1.08 MB of a 1.7 MB unpacked install, embedding the full TypeScript source. Published output now ships
  without them, cutting the unpacked size by roughly 63%.
- **CommonJS consumers now resolve their own type declarations.** The `exports` map pointed both conditions
  at `dist/index.d.ts`, leaving the generated `dist/index.d.cts` orphaned; under `moduleResolution: node16`
  or `nodenext` a `require()` consumer was served an ESM declaration file from a `"type": "module"` package.
  The `import` and `require` conditions now carry their own nested `types`.
- **`homepage` points at the documentation site** rather than a README anchor, so the npm "Homepage" link
  reaches the docs.
- **Removed `.npmignore`.** It coexisted with the `files` allowlist, which silently wins — a denylist that
  looked authoritative and was inert.

### Added

- `sideEffects: false`, enabling tree-shaking for bundler-based consumers.
- `./package.json` as an explicit `exports` subpath, for tooling that reads it.
- `assets/logo.svg`, shared with the documentation site.

### Changed

- **README rewritten to the canonical package pattern.** Internal audit scaffolding (`Current State`,
  `Verified Package Architecture`, `Verification Commands`, `Package Manager Policy`) removed; every link is
  now absolute and verified, so it works when rendered on npmjs.com; explicit heading anchors added, without
  which in-page links do not resolve on npmjs.com at all. A broken link to a portfolio-info file that had
  been renamed is gone. Limitations are now stated explicitly rather than implied.
- `description` and `keywords` sharpened for npm search; the description now matches the README tagline.

### Notes

- **This package currently has no automated test suite.** The Vitest suite of 311 tests referenced in the
  `2.3.0` entry below was accurate at that release; the entire testing infrastructure was removed on
  2026-06-02. CI runs lint, typecheck and build only. Recorded here so the `2.3.0` entry is not read as a
  statement about the current tree.

## [2.3.0] - 2026-05-27

A security, correctness, and feature release. It enforces several WebAuthn
protections that were previously only requested or partially applied, and adds
full attestation-statement verification with trust anchoring. **Please read the
upgrade notes** — some protections are now secure-by-default and change runtime
behaviour even though this is a minor version. No new runtime dependencies
(`cbor-x` only); 311 tests pass; Node `>=24.13.0`.

### Upgrade notes

Each behaviour change below ships with an opt-out switch so existing
integrations can adjust deliberately.

1. **Challenge lifecycle is now enforced from storage by default.** If you
   configured a `storageAdapter`, `verifyRegistration` / `verifyAuthentication`
   now look the challenge up in storage, reject it if it is missing
   (`CHALLENGE_NOT_FOUND`), expired (`CHALLENGE_EXPIRED`), or scoped to a
   different operation (`CHALLENGE_OPERATION_MISMATCH`), and consume it once so
   it can never be replayed. Issue challenges via `createRegistrationOptions` /
   `createAuthenticationOptions` (which persist them), or set
   `enforceChallengeStore: false` to keep managing challenge lifecycle yourself.
   Has no effect when no `storageAdapter` is configured.
2. **Authentication now enforces the algorithm allowlist and pins the
   credential algorithm.** The `supportedAlgorithms` allowlist — previously
   applied only at registration — is now also applied at authentication, and
   when the stored credential carries an `alg`, the assertion must use that exact
   algorithm (`ALGORITHM_MISMATCH`). Persist `VerifiedRegistrationInfo.credential.alg`
   onto your stored credential to enable this pinning.
3. **Cross-origin iframe ceremonies are now rejected by default.** A ceremony
   whose `clientDataJSON` reports `crossOrigin === true` is rejected
   (`CROSS_ORIGIN_NOT_ALLOWED`). Set `allowCrossOriginIframe: true` if you
   intentionally support cross-origin iframe ceremonies.
4. **New optional `WebAuthnCredential` fields (`alg`, `userVerified`).** Persist
   them to enable algorithm pinning (above) and user-verification downgrade
   detection at authentication. Both are additive and optional.
5. **To trust-anchor certificate-chain attestation, supply a
   `metadataService`.** `packed` x5c, `fido-u2f`, `android-key`, and `tpm` are
   cryptographically verified, but only report `attestationVerified: true` when
   their chain anchors to a root you provide via `metadataService` (FIDO MDS).
   `apple` works out of the box via the bundled Apple WebAuthn Root CA. Set
   `requireTrustedAttestation: true` to reject non-trust-anchored attestations
   when `attestationType !== 'none'`.

### Security

- **Stored challenges are now validated and consumed once (`enforceChallengeStore`,
  default `true` when a `storageAdapter` is set).** The verify path now reads the
  challenge from storage and enforces existence, expiry, and operation scope
  before consuming it, closing a replay gap where a captured `clientDataJSON` +
  assertion could be re-verified indefinitely while the relying party supplied the
  same `expectedChallenge`. New error codes: `CHALLENGE_NOT_FOUND`,
  `CHALLENGE_OPERATION_MISMATCH`, `CHALLENGE_EXPIRED`.
- **Algorithm pinning at authentication.** The `supportedAlgorithms` allowlist is
  now applied at authentication (not just registration); COSE keys are rejected
  when their `alg` is inconsistent with their `kty`/`crv` (`COSE_ALG_MISMATCH`),
  and a stored credential's registered `alg` is enforced against the asserted
  algorithm (`ALGORITHM_MISMATCH`). This also fixes RSA padding (PSS vs PKCS#1)
  being selectable by the key rather than pinned at registration.
- **Cross-origin iframe ceremonies are rejected** unless `allowCrossOriginIframe`
  is set (`CROSS_ORIGIN_NOT_ALLOWED`), per W3C §7.1/§7.2.
- **COSE key byte-length validation.** Coordinate/modulus lengths are validated
  during parsing (P-256 32, P-384 48, P-521 66, Ed25519 32, RSA modulus ≥ 256),
  rejecting malformed keys before they reach Node's key import.
- **Trailing bytes after the COSE key are rejected** when the extension-data flag
  is unset, instead of being silently dropped.
- **Session-token field validation.** `iv` (12), `tag` (16), and `salt` (32) byte
  lengths are validated before constructing the decipher; malformed tokens are
  rejected with a generic error.
- **Stored-session expiry is re-checked** after fetching from a custom adapter
  (defense-in-depth).

### Added

- **Full attestation-statement verification with trust anchoring** for `apple`,
  `fido-u2f`, `packed` x5c, `android-key`, `tpm`, and `android-safetynet`, via a
  pluggable `MetadataService` / `StaticMetadataService` (FIDO Metadata Service).
  The relying party supplies the (large, frequently-updated) FIDO MDS data — the
  package never fetches it. The **Apple WebAuthn Root CA is bundled**
  (`APPLE_WEBAUTHN_ROOT_CA_PEM`), so `apple` trust-anchors without configuration.
  New `requireTrustedAttestation` config rejects non-trust-anchored attestations
  when `attestationType !== 'none'`. `trustPath` is surfaced on the registration
  result.
- **Usernameless (discoverable-credential) support.** `userHandle` is validated
  and returned in `VerifiedAuthenticationInfo`; `createRegistrationOptions` now
  returns `webAuthnUserId` (the generated WebAuthn user handle) so it can be
  persisted as `WebAuthnCredential.webAuthnUserID`.
- **`excludeCredentials` duplicate rejection.** `verifyRegistration` accepts
  `{ existingCredentialIds }` and rejects an already-registered credential
  (`CREDENTIAL_ALREADY_REGISTERED`).
- **Client extension outputs** (`clientExtensionResults`) are parsed and returned
  on both registration and authentication results, including `credProps.rk`,
  `prf`, and `largeBlob`.
- **Advisory cloning/downgrade signals** in `VerifiedAuthenticationInfo`:
  `backupStateChanged`, `userVerificationDowngraded`, and `counterSupported`.
- **`originVerifier`** custom origin matcher config (enables advanced
  normalization and native `android:apk-key-hash:` origins).
- **`WebAuthnErrorCode`** exported as a typed union of the known error codes.
- New optional `WebAuthnCredential.alg` and `WebAuthnCredential.userVerified`
  fields.

### Changed

- Honest top-level JSDoc — removed the overstated "Complete WebAuthn Level 3"
  and mobile-attestation claims so the documentation matches verified behaviour.
- `verifyHash` now delegates to `crypto.timingSafeEqual`.
- `buffersEqual` is documented as **non-constant-time**; use `timingSafeEqualBytes`
  for security-sensitive comparisons.

### Fixed

- The `supportedAlgorithms` allowlist is now actually enforced at authentication
  (it was previously applied only at registration).
- The `crossOrigin` flag in `clientDataJSON`, previously typed but never read, is
  now verified.
- `attestationVerified` is reported `true` **only** when the attestation is
  trust-anchored (`apple` via the bundled root; certificate-chain formats via
  `metadataService` roots); otherwise it remains `false`. It is never a false
  positive.

### Notes

- `android-safetynet` is verified for completeness but is **deprecated by
  Google** — use Play Integrity for new Android integrations.
- Attestation trust anchoring does not perform CRL/OCSP revocation checks.

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

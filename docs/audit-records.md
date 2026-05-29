# Audit Records - WebAuthn Server Buildkit

Records of package updates, audits, and verification history.

**Last Updated:** 2026-05-27

## Package Update History

| Date       | Updated By | Notes                                                                                                                          |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-27 | Claude     | v2.3.0 polish: second deep audit + fixes (security/correctness/API/hygiene), full per-format attestation + FIDO MDS, 311 tests |
| 2026-05-26 | Claude     | v2.2.0 polish: deps→latest (ESLint 10, TS 6), full security/code audit + fixes, docs                                           |
| 2026-03-24 | Codex      | Refreshed docs, verified tests/build, added portfolio maintenance rule                                                         |
| 2026-02-02 | Claude     | Full update to latest versions, all checks passing                                                                             |

## Comprehensive Audit Record

| Date       | Audit Type                          | Status | Issues Found | Issues Resolved |
| ---------- | ----------------------------------- | ------ | ------------ | --------------- |
| 2026-05-27 | Deep security + code (v2.2.0→2.3.0) | Passed | 27           | 27              |
| 2026-05-26 | Deep security + code (v2.1.0→2.2.0) | Passed | 16           | 16              |
| 2026-03-24 | Portfolio + Docs Refresh            | Passed | 0            | 0               |
| 2026-02-02 | Package Update                      | Passed | 0            | 0               |
| 2026-01-23 | Full Audit                          | Passed | 0            | 0               |

## Deep Audit Details (2026-05-27) — v2.2.0 → v2.3.0

Full record + resumable tracker: `docs/features/package-polish-v2.3.0/`
(`findings.md`, `00-tracker.json`, `phase01-…` through `phase08-…`).

This is the **second** polish pass on top of v2.2.0's 16-finding sweep. v2.3.0 is
secure-by-default and adds full per-format attestation verification with FIDO MDS
trust anchoring. **Zero new runtime dependencies** were added (only production
dependency remains `cbor-x`). Node `>=24.13.0`.

**User decisions for this pass:** full attestation + FIDO MDS for every format,
regression tests approved (override of the standing no-tests-unless-asked rule
scoped to this work), secure-by-default behavior with documented upgrade notes.

### Findings addressed (27)

**Critical / High security:**

- **SEC-N1** — Stored challenge was never validated on the verify path
  (replay / no single-use / no expiry). **Fixed:** `verifyRegistration` /
  `verifyAuthentication` now consult `challenges.find()`, reject on
  `CHALLENGE_NOT_FOUND` / `CHALLENGE_OPERATION_MISMATCH` / `CHALLENGE_EXPIRED`,
  and delete-on-finally so the challenge can never be replayed. Gated by the new
  `enforceChallengeStore` config (default `true` with a storage adapter).
- **SEC-N2 / SEC-N3** — Credential algorithm not pinned at authentication; RSA
  padding (PSS vs PKCS#1) selected by the key. **Fixed:** `parseCOSEPublicKey`
  now rejects keys whose `alg` is inconsistent with `kty`/`crv`
  (`COSE_ALG_MISMATCH`); the auth path re-applies `supportedAlgorithms`
  (`UNSUPPORTED_CREDENTIAL_ALGORITHM`) and enforces an identical
  `credential.alg` when set (`ALGORITHM_MISMATCH`). Registration now returns
  `credential.alg` for persistence.
- **SEC-N4** — `clientData.crossOrigin` flag never checked. **Fixed:** both
  verify paths reject `CROSS_ORIGIN_NOT_ALLOWED` unless the new
  `allowCrossOriginIframe` config is enabled (default `false`).
- **SEC-N5** — BE/BS and user-verification downgrades undetectable across
  ceremonies. **Fixed:** advisory `backupStateChanged` and
  `userVerificationDowngraded` signals surfaced on
  `VerifiedAuthenticationInfo` (RP applies policy).
- **SEC-N6** — Counter clone-detection is a silent no-op for counter=0
  authenticators. **Fixed:** advisory `counterSupported` surfaced on
  `VerifiedAuthenticationInfo`.
- **SEC-N7** — Session-token fields fed to crypto without shape validation.
  **Fixed:** `parseSessionToken` validates `iv.length === 12`,
  `tag.length === 16`, `salt.length === 32` before constructing the decipher.

**Functionality / correctness:**

- **FUNC-N1** — `userHandle` never validated/returned; discoverable-credential
  flow was unsafe. **Fixed:** the assertion `userHandle` is now read,
  validated against `credential.webAuthnUserID` (`USER_HANDLE_MISMATCH`), and
  returned in `VerifiedAuthenticationInfo`. Paired with API-N2.
- **FUNC-N2** — COSE key parsing used truthy guards and no byte-length
  validation. **Fixed:** `=== undefined` / `instanceof Uint8Array` guards plus
  byte-length validation per curve / `kty` (P-256/384/521, Ed25519, RSA).
- **FUNC-N3** — Origin match was exact-string only. **Fixed:** optional
  `originVerifier(origin)` config that overrides the exact-string compare
  (supports normalization + native `android:apk-key-hash:` origins).
- **FUNC-N4** — Requested `attestationType` was never enforced. **Fixed:**
  new `requireTrustedAttestation` config (default `false`) — when `true` and
  `attestationType !== 'none'`, registration is rejected with
  `ATTESTATION_NOT_TRUSTED` unless the chain is trust-anchored. Default
  warn-only otherwise.
- **FUNC-N5** — Trailing bytes after the COSE key were silently dropped when
  the ED flag was unset. **Fixed:** `authenticator-data.ts` now throws
  `AUTHENTICATOR_DATA_TRAILING_BYTES`.
- **FUNC-N6** — `isCborParsingError` branched on error-message substrings.
  **Fixed:** branches on the stable `error.code` (with message fallback).

**Incomplete-feature gaps:**

- **GAP-N1** — Zero tests for `verifyAuthenticationResponse` (the core auth
  function). **Fixed:** new `tests/authentication/verify-response.test.ts`
  (round-trip success, bad signature, credential-id / challenge / origin /
  RP-ID mismatch, UV-required, counter regression, alg allowlist + pin,
  challenge single-use / operation / expired / disabled, `userHandle` match /
  mismatch, `crossOrigin` reject / allow, advisory signals, `originVerifier`).
- **GAP-N2** — Full attestation-statement trust anchoring (the v2.2.0
  deferred work). **Fixed in full:** see _Attestation: full per-format
  verification_ below.
- **GAP-N3** — `clientExtensionResults` was never parsed/returned. **Fixed:**
  both verify paths now surface `clientExtensionResults` (at minimum
  `credProps.rk`).
- **GAP-N4** — `excludeCredentials` not enforced at the verify path. **Fixed:**
  new optional `verifyRegistration(..., { existingCredentialIds })` rejects a
  duplicate with `CREDENTIAL_ALREADY_REGISTERED`. Off when omitted.

**API / type safety:**

- **API-N1** — `WebAuthnError.code` was free-form `string`; `statusCode`
  undocumented. **Fixed:** new exported `WebAuthnErrorCode` open union
  (`WebAuthnErrorCode | (string & {})` to keep existing callers compiling);
  `WebAuthnError.statusCode` documented (400 / 401 / 500).
- **API-N2** — Generated `webAuthnUserID` was discarded at registration.
  **Fixed:** `createRegistrationOptions` now returns `webAuthnUserId`
  alongside `options` and `challenge`. Pairs with FUNC-N1 to enable safe
  usernameless flows.
- **API-N3** — No public way to mint/verify session tokens outside
  `WebAuthnServer`. **Confirmed intentional encapsulation;** documented.
- **API-N4** — Variable-time `buffersEqual` exported next to
  `timingSafeEqualBytes`. **Fixed:** `buffersEqual` now carries a
  NON-constant-time JSDoc warning steering callers to `timingSafeEqualBytes`
  for security comparisons.

**Hygiene / standards:**

- **HYG-N1** — `COSE_KEY_PARAMS` mapped `crv`/`n` and `x`/`e` to the same
  numeric labels (`-1`, `-2`); annotated to make the `kty`-branching footgun
  explicit.
- **HYG-N2** — `src/index.ts` JSDoc overstated reality ("Complete WebAuthn
  Level 3 support" / mobile attestation framing). Banner rewritten honestly to
  match verified behavior.
- **HYG-N3** — Stored-session `expiresAt` re-checked after a custom-adapter
  fetch (defense-in-depth for adapters that do not filter expiry).
- **HYG-N4** — `registration/verify-response.ts` decoded `clientDataJSON`
  twice. **Fixed:** single decode.
- **HYG-N5** — Dead `verifyHash` constant-time loop duplicated
  `timingSafeEqualBytes`. **Fixed:** delegates to `crypto.timingSafeEqual`;
  the export is kept for back-compat.
- **HYG-N6** — `AuthenticationExtensionsClientOutputs` listed legacy
  `hmacCreateSecret` but was missing `prf` / `largeBlob`. **Fixed:**
  modernized to WebAuthn L3 (`credProps`, `prf`, `largeBlob`);
  `hmacCreateSecret` retained as `@deprecated`.

### Attestation: full per-format verification + FIDO MDS (GAP-N2 resolved)

The v2.2.0 deferred attestation work shipped in full. New `src/attestation/`
foundation: a strict in-house DER/ASN.1 reader (`asn1.ts`), a synchronous Node
`crypto.X509Certificate` chain helper (`x509.ts`, fail-closed, no
revocation), a pluggable `MetadataService` (`metadata.ts` +
`src/types/metadata.ts`) with a `StaticMetadataService` provider, and the
bundled Apple WebAuthn Root CA PEM (`roots/apple-webauthn-root-ca.ts`,
verified with `openssl`).

Per-format verifiers under `src/attestation/formats/`:

- `apple` — chain to the bundled Apple WebAuthn Root CA (+ any RP roots),
  nonce extension OID `1.2.840.113635.100.8.2 == hash(authData ‖
clientDataHash)`, leaf key matches the credential key. **Trust-anchored
  without a `metadataService`.**
- `fido-u2f` — reconstructs `0x00 ‖ rpIdHash ‖ clientDataHash ‖ credentialId ‖
(0x04 ‖ x ‖ y)`, verifies ES256 with the attestation cert (P-256 only);
  trust-anchored only with an RP-supplied root, else
  `attestationVerified: false` (honest).
- `packed` — self path retained (verified via credential key); x5c path
  verifies `sig` with the leaf, enforces leaf requirements (v3, OU,
  BasicConstraints CA=false), and matches the AAGUID extension; trust-anchored
  only with an RP-supplied root.
- `android-key` — `sig` + leaf key match + KeyDescription extension
  `attestationChallenge == clientDataHash`; trust-anchored with MDS Google
  roots. Keymaster authorization-list constraints not additionally asserted
  (documented caveat).
- `tpm` — full `TPMS_ATTEST` / `TPMT_PUBLIC` parse + `pubArea` key matches
  credential key + `certInfo.attested.name == nameAlg ‖ digest(pubArea)` +
  `extraData == hash(attToBeSigned)` + AIK signature + EKU
  `2.23.133.8.3`; trust-anchored with an MDS root. AIK SAN
  manufacturer/model/version not additionally asserted (documented caveat).
- `android-safetynet` — JWS parse + signature verify with header `x5c[0]`,
  leaf CN `attest.android.com`, nonce binding, `ctsProfileMatch`, timestamp
  freshness; chain to an RP-supplied GlobalSign root (none bundled).
  **DEPRECATED by Google — docs recommend the Play Integrity API.**

`registration/attestation.ts` dispatches by `fmt` to the format verifiers,
derives the AAGUID from `authData`, and the verify path surfaces `trustPath`
into `VerifiedRegistrationInfo`. `attestationVerified: true` is reported
**only** when the statement is cryptographically verified **and** (for chain
formats) trust-anchored to a known root; otherwise `false`. Verification
**throws** only when a present statement is cryptographically invalid — never
merely because a trust anchor is missing (honest framing preserved).

### Verification summary

- `yarn typecheck` — clean
- `yarn lint` — clean
- `yarn format:check` — clean
- `yarn test` — **311 passing** (was 166 at v2.2.0 baseline; +145 across new
  authentication / extension / hygiene / attestation suites)
- `yarn build` — clean (ESM + CJS + DTS via tsup)
- Dependencies — verified at latest stable; **zero new runtime dependencies
  added** (production-only dep remains `cbor-x`); engine pin `>=24.13.0`
  intact

## Deep Audit Details (2026-05-26) — v2.1.0 → v2.2.0

Full record + resumable tracker: `docs/features/package-polish-v2.2.0/` (`findings.md`, `00-tracker.json`).

**Dependencies:** updated all to latest stable, including majors ESLint 9→10.4.0 and
TypeScript 5.9→6.0.3 (verified `typescript-eslint` 8.60.0 supports both); replaced the
banned `@eslint/js` + individual `@typescript-eslint/*` packages with the
`typescript-eslint` meta + flat config.

**Findings fixed (16):**

- SEC-1 (critical): mobile JSON attestation could bypass cryptographic verification → now opt-in (`enableMobileAttestation`, default off).
- SEC-2/SEC-3: RSA, ES512 (P-521) and Ed25519 signature verification were broken/fragile (hand-rolled ASN.1) → rewritten via JWK key import.
- SEC-4/SEC-5: session-token KDF (bare HMAC → HKDF-SHA256) and IV (16 → 12 bytes).
- SEC-7: counter parsing 32-bit overflow.
- SEC-8: non-constant-time RP-ID-hash comparison → `timingSafeEqual`.
- SEC-9: algorithm allowlist not enforced at registration → enforced.
- SEC-6: attestation statement ignored → `packed` self-attestation verified; `fmt`/`attestationVerified` surfaced; cert-chain formats reported (not trust-anchored).
- FUNC-1: `decodeCBORFirst` was a stub → real RFC 8949 implementation.
- FUNC-2: COSE public-key boundary swallowed extension bytes → bounded via `decodeCBORFirst`.
- API-1: error classes + COSE enums were `type`-only exports → now value exports.
- HYG-1/2/4/5/6 + CI-1: dead `console.ts` removed; `challenge.ts` typed error; `funding` field; stray root doc relocated; `substr`→`substring`; CI/publish Node 24.x + `yarn --immutable`.

**Verification:** `yarn typecheck`, `yarn lint`, `yarn format:check` clean; `yarn test`
166/166 passing (was 131; the prior crypto tests used dummy bytes and never verified a
real signature); `yarn build` (ESM + CJS + DTS) succeeds.

## Last Audit Details (2026-03-24)

- Package Manager: npm scripts verified, yarn lockfile also present
- Dependencies: no dependency audit performed in this pass
- Build: passes
- Lint: not run in this pass
- TypeScript: DTS generation succeeded as part of build
- Tests: passes (131 tests)

## Next Audit Due

2026-05-30 (3-day freshness cycle from 2026-05-27)

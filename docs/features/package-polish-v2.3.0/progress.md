# Progress — Package Polish v2.3.0

Running log. The authoritative resume state is `00-tracker.json` (find the first `pending`/`in_progress` sub-task). This file is the human-readable narrative.

**Target:** 2.2.0 → 2.3.0 · **Started:** 2026-05-26

## Status snapshot

- **Phase 0 — Planning & scaffolding:** ✅ complete
- **Phase 1 — Deps & toolchain:** ✅ complete (all deps already at latest stable)
- **Phase 2 — Critical security:** ✅ complete
- **Phase 3 — Spec-compliance & correctness:** ✅ complete
- **Phase 4 — Extensions, API & hygiene:** ✅ complete
- **Phase 5 — Attestation foundation:** ✅ complete
- **Phase 6 — Attestation formats (+ FIDO MDS):** ✅ complete
- **Phase 7 — Documentation refresh:** ✅ complete
- **Phase 8 — Release v2.3.0:** ⏳ pending

## Log

### 2026-05-26 — Phase 0 (planning & scaffolding)

- Confirmed the v2.2.0 polish is complete and published (npm latest = 2.2.0). This run targets the next minor, **2.3.0**.
- Established green baseline: 166 tests pass; typecheck/lint/build clean; working tree clean.
- Verified all 11 dependencies are already at latest stable (refreshed during v2.2.0 earlier today) — Phase 1 is verify-only.
- Ran a fresh deep audit (general-purpose agent) and found NEW issues beyond v2.2.0's 16: SEC-N1 (stored challenge never validated → replay), SEC-N2/N3 (alg not pinned at auth), SEC-N4 (crossOrigin), SEC-N5/N6 (BE/BS + UV + counter signals), SEC-N7 (session-token field validation), FUNC-N1 (userHandle), FUNC-N2..N6, GAP-N1..N4, API-N1..N4, HYG-N1..N6. Full per-format attestation spec compiled. See `findings.md`.
- Confirmed 3 scope decisions with the user: **full attestation + FIDO MDS**, **tests approved**, **secure-by-default**.
- Invoked skills (RULE #0): security-review, security-best-practices, nodejs-best-practices, vitest.
- Scaffolded the resumable plan: `00-overview.md`, `findings.md`, `00-tracker.json`, `phase01..08`, this `progress.md`.
- **Next:** Phase 1 dependency verification, then commit Phase 0+1 as the first green checkpoint.

### 2026-05-26 — Phase 1 (dependency verification & toolchain)

- Confirmed all 11 dependencies are at latest stable on npm — no bumps needed (they were refreshed during the v2.2.0 polish earlier today).
- `yarn install --immutable` clean → no `yarn.lock` drift.
- No banned dependencies; only `cbor-x` in production; `engines.node >= 24.13.0` and `packageManager: yarn@4.14.1` intact.
- Formatted the new plan files with prettier so `yarn format:check` is repo-wide clean.
- Verification gate green (166 tests; typecheck/lint/build/format all clean).
- Committed Phase 0 + Phase 1 together as the first green checkpoint.
- **Next:** Phase 2 — critical security (challenge lifecycle, algorithm pinning at auth, session hardening) + the approved regression tests.

### 2026-05-26 — Phase 2 (critical security)

- **SEC-N1 (challenge replay):** `WebAuthnServer.verifyRegistration` / `verifyAuthentication` now validate the stored challenge (existence, operation, expiry) via a new `consumeChallengeFromStore()` and consume it once in a `finally` so it can never be replayed. Controlled by `enforceChallengeStore` (default `true` when a storage adapter is configured; set `false` to manage challenges yourself). New codes: `CHALLENGE_NOT_FOUND`, `CHALLENGE_OPERATION_MISMATCH`, `CHALLENGE_EXPIRED`.
- **SEC-N2/N3 (algorithm pinning):** `cose.ts` rejects a COSE `alg` inconsistent with the key's `kty`/`crv` (`COSE_ALG_MISMATCH`) — closes the P-256-declaring-ES512 and RSA-padding-swap vectors. The authentication path now enforces the `supportedAlgorithms` allowlist (not just registration) and pins `credential.alg` when set (`ALGORITHM_MISMATCH`). `WebAuthnCredential.alg` + `VerifiedRegistrationInfo.credential.alg` added; registration returns the algorithm.
- **SEC-N7:** session-token `iv`/`tag`/`salt` length validation before the cipher primitives.
- **HYG-N3:** stored-session expiry re-checked after adapter fetch (defense-in-depth; the bundled memory adapter already filters in `find()`).
- **Tests (+20 → 186):** new `tests/authentication/verify-response.test.ts` (round-trip + every negative path + alg pinning + challenge lifecycle), `tests/session/manager.test.ts`, and session-token field-validation tests.
- Gate green: typecheck/lint/test (186)/build/format all clean. Committed + pushed.
- **Next:** Phase 3 — spec-compliance & correctness (userHandle/webAuthnUserID, crossOrigin, COSE length validation, downgrade signals, origin handling).

### 2026-05-26 — Phase 3 (spec-compliance & correctness)

- **FUNC-N1 / API-N2 (usernameless):** `verifyAuthenticationResponse` reads and validates `userHandle` against `credential.webAuthnUserID` (`USER_HANDLE_MISMATCH`) and returns it; `createRegistrationOptions` now returns `webAuthnUserId` so the RP can persist the WebAuthn user handle.
- **SEC-N4 (crossOrigin):** both verify paths reject `clientData.crossOrigin === true` unless `allowCrossOriginIframe` (new config, default false) — `CROSS_ORIGIN_NOT_ALLOWED`.
- **FUNC-N2 (COSE validation):** `=== undefined` / `instanceof` guards + byte-length validation (EC2 32/48/66 per curve, RSA modulus ≥ 256, Ed25519 32).
- **FUNC-N5:** reject trailing bytes after the COSE key when the ED flag is unset (`AUTHENTICATOR_DATA_TRAILING_BYTES`).
- **SEC-N5/N6:** advisory `backupStateChanged` / `userVerificationDowngraded` / `counterSupported` in `VerifiedAuthenticationInfo` (`WebAuthnCredential.userVerified` added as the registration-time source). No hard rejection — RP decides policy.
- **FUNC-N3:** optional `originVerifier(origin)` matcher (supports normalization + native `android:apk-key-hash:` origins).
- **FUNC-N4:** warn when a requested attestation type isn't trust-anchored (full enforcement lands with the attestation phases).
- **FUNC-N6:** `isCborParsingError` branches on `error.code` before message text.
- **Tests (+17 → 203):** new `tests/crypto/cose.test.ts` (length validation, alg/crv consistency, trailing bytes) + auth verify-response additions (userHandle, crossOrigin, advisory signals, originVerifier).
- Gate green: typecheck/lint/test (203)/build/format. Committed + pushed.
- **Next:** Phase 4 — extensions, API surface & hygiene.

### 2026-05-27 — Phase 4 (extensions, API surface & hygiene)

_Implemented via a delegated general-purpose sub-agent; diff reviewed and the full gate re-run in the main thread before committing._

- **GAP-N3/HYG-N6:** both verify paths now return `clientExtensionResults`; `AuthenticationExtensionsClientOutputs` modernized (`credProps.rk`, `prf`, `largeBlob`; legacy `hmacCreateSecret` kept `@deprecated`).
- **API-N1:** exported an open `WebAuthnErrorCode` union (`WebAuthnErrorCode | (string & {})`) enumerating every thrown code; typed the error `code` fields; documented `statusCode`. Open union keeps existing string codes assignable — no caller break.
- **GAP-N4:** `verifyRegistration` accepts an optional `{ existingCredentialIds }`; rejects `CREDENTIAL_ALREADY_REGISTERED`. Backward compatible.
- **Hygiene:** honest `index.ts` banner (HYG-N2); single `clientDataJSON` decode in registration (HYG-N4); `verifyHash` delegates to `crypto.timingSafeEqual` (HYG-N5); `buffersEqual` NON-constant-time warning (API-N4); session-token encapsulation documented (API-N3).
- **Tests (+17 → 220):** new `tests/extensions-api.test.ts`, `tests/utils/hash.test.ts`, buffer additions.
- Gate green: typecheck/lint/test (220)/build/format. Committed + pushed.
- **Next:** Phase 5 — attestation foundation (DER reader, X509 chain helper, MetadataService, Apple root).

### 2026-05-27 — Phase 5 (attestation foundation)

_Delegated to a sub-agent; scope and full gate verified in the main thread._

- New `src/attestation/`: `asn1.ts` (strict in-house DER reader + `findExtension`), `x509.ts` (synchronous Node `X509Certificate` chain verification + `publicKeyMatchesCOSE`, fail-closed), `metadata.ts` (`StaticMetadataService`), `roots/apple-webauthn-root-ca.ts` (the **real** Apple WebAuthn Root CA, fetched and openssl-verified), `types.ts` (Phase 6 contract).
- `src/types/metadata.ts`: a **synchronous** `MetadataService` interface — deliberately sync so `verifyRegistrationResponse` stays synchronous (no breaking async change). Offline-by-default: the RP supplies FIDO MDS roots/entries.
- `config.metadataService` wired; public API exported. **Zero new runtime dependencies.**
- **Tests (+45 → 265):** `tests/attestation/{asn1,x509,metadata}.test.ts`.
- Gate green: typecheck/lint/test (265)/build/format. Committed + pushed.
- **Next:** Phase 6 — per-format attestation verification + FIDO MDS (the largest phase).

### 2026-05-27 — Phase 6 (full attestation verification + FIDO MDS)

_Single comprehensive sub-agent (kept the six formats coherent on shared X.509/ASN.1 primitives); the dispatcher, the Apple verifier, and the shared helpers were reviewed in the main thread and the full gate re-run._

- **All six formats** under `src/attestation/formats/`: `apple` (chain to bundled Apple root + nonce-ext binding + key match — trust-anchored without MDS), `fido-u2f` (U2F sig-base + chain), `packed` (self path kept; x5c with leaf-requirements + AAGUID ext), `android-key` (KeyDescription `attestationChallenge` ext), `tpm` (full `TPMS_ATTEST`/`TPMT_PUBLIC` parse + AIK sig + EKU), `android-safetynet` (JWS — **deprecated, docs recommend Play Integrity**).
- **Honest framing (security invariant):** `attestationVerified: true` **only** when trust-anchored — Apple via its bundled root, the cert-chain formats via roots supplied through the RP's `MetadataService`. No `metadataService`/roots → `false` (never a false positive, never a throw). Throws happen only for cryptographically-invalid statements.
- **Wiring:** `verifyAttestationStatement` dispatches by `fmt`; `verifyRegistrationResponse` passes `authData`/`aaguid`/`metadataService` and surfaces `trustPath`. **FUNC-N4:** `requireTrustedAttestation` (default false) throws `ATTESTATION_NOT_TRUSTED` when a requested attestation can't be anchored; otherwise warns.
- **Tests (+46 → 311):** a real signed-cert builder mints chains with dynamic custom extensions; every format has a trust-anchored happy path (`attestationVerified === true`) plus negative/throw paths. Zero new runtime deps; zero regressions.
- Caveats for docs: TPM AIK SAN and android-key Keymaster authorization-list constraints are not additionally asserted (the security-critical bindings are); android-safetynet needs an RP-supplied GlobalSign root.
- Gate green: typecheck/lint/test (311)/build/format. Committed + pushed.
- **Next:** Phase 7 — documentation refresh (parallelized across sub-agents).

### 2026-05-29 — Phase 7 (documentation refresh)

_Three parallel sub-agents on disjoint file sets; instruction files updated in the main thread._

- **Sub-agent A → `Readme.md` + `SECURITY.md`:** Current State 2.3.0 / 311 tests; honest attestation capability matrix (per-format trust-anchoring rules + caveats); `StaticMetadataService` + `APPLE_WEBAUTHN_ROOT_CA_PEM` usage example; corrected `createRegistrationOptions` return shape + all new result fields documented; usernameless mini-guide; `WebAuthnErrorCode` + `statusCode` docs; expanded security posture.
- **Sub-agent B → `CHANGELOG.md` + `docs/migration.md`:** `[2.3.0]` entry in Keep-a-Changelog style with **Upgrade notes** (5 secure-by-default switches) + Security/Added/Changed/Fixed sections; new `2.2 → 2.3` migration section with before/after code.
- **Sub-agent C → `docs/api-reference.md` + `AI-INTEGRATION-GUIDE.md` + `docs/audit-records.md`:** every new config option / result field / export / error code documented against real source; stale storage-adapter signatures corrected; AI-guide refreshed (usernameless flow, trust-anchored attestation, DB schema additions); audit record appended for v2.3.0.
- **Main thread → instruction files:** package-root `CLAUDE.md` / `AGENTS.md` (version 2.3.0, 311 tests, v2.3.0 security posture, tracker path); `.claude/CLAUDE.md` / `.claude/AGENTS.md` (Last Updated 2026-05-29); parent monorepo `CLAUDE.md` / `AGENTS.md` (`webauthn-server-buildkit` 2.2.0 → 2.3.0).
- Zero source changes; 311 tests still pass; `yarn format:check` clean.
- **Next:** Phase 8 — release v2.3.0.

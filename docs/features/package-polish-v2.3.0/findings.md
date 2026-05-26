# Audit Findings — webauthn-server-buildkit v2.3.0 polish (2026-05-26)

Baseline before any change: `yarn typecheck` clean, `yarn lint` clean, `yarn test` **166 passed**, `yarn build` success, working tree clean. Dependencies are **all already at latest stable** (refreshed during the v2.2.0 polish earlier today), so the dependency step is verify-and-confirm, not version bumps.

This is the **second** polish pass. The v2.2.0 pass already found + fixed 16 issues (SEC-1..10, FUNC-1..3, API-1, HYG-1..6). Those are NOT repeated here. This file captures the **new** findings from the v2.3.0 deep audit, plus the concrete spec for the deferred attestation work the user has now approved in full (Full attestation + FIDO MDS).

Severity: 🔴 Critical/High · 🟠 Medium · 🟡 Low/Hygiene. Phase = where it's fixed.

User decisions for this pass (see `00-overview.md`):

- **Attestation:** implement **full attestation + FIDO MDS** trust anchoring (all formats). Large; multi-session; resumable.
- **Tests:** **approved** — add regression tests for the security work + the currently-untested authentication path (overrides the standing no-tests-unless-asked rule, scoped to this work).
- **Compatibility:** **secure-by-default** — turn the new protections on by default and document them as CHANGELOG upgrade notes (same approach v2.2.0 used for the session-token change).

---

## Security

### 🔴 SEC-N1 — Stored challenge is never validated on the verify path (replay / no single-use / no expiry) · Phase 2

`src/server.ts` writes challenges to `storageAdapter.challenges.create(...)` during option generation, but neither `verifyRegistration` nor `verifyAuthentication` ever calls `challenges.find()`. Verification only compares `clientData.challenge === expectedChallenge` (a value the caller supplies), then `delete`s it on success. Consequences:

- The stored challenge's `operation` type and `expiresAt` are never consulted — the entire `challenges` table is write+delete only.
- No server-enforced single-use: a reused `expectedChallenge` re-verifies happily.
- No server-enforced expiry: a captured `clientDataJSON` + assertion replays indefinitely as long as the RP passes the same `expectedChallenge`.

**Fix (secure-by-default):** when a storage adapter is configured, the verify path MUST `challenges.find(expectedChallenge)` first; reject if absent, if `operation` doesn't match the flow, or if expired; then consume-once (`delete`). Add `WebAuthnServer.verifyRegistration`/`verifyAuthentication` wrappers that perform this lifecycle (the low-level `verifyRegistrationResponse`/`verifyAuthenticationResponse` stay challenge-string-only for callers managing their own lifecycle). Provide a config switch to restore legacy behavior. Document loudly.

### 🟠 SEC-N2 — Credential algorithm is not pinned: allowlist runs only at registration, never at authentication · Phase 2

`src/crypto/verify.ts` + `src/crypto/cose.ts`: `verifySignature` derives the digest purely from the COSE key's own `alg` (or infers it from the curve), with **no `alg`↔`crv` consistency check** and **no binding to the algorithm the credential registered with**. The `config.supportedAlgorithms.includes(...)` allowlist is applied only in `registration/verify-response.ts:176`, never in `authentication/verify-response.ts`. If the stored `publicKey` bytes are ever influenced (storage bug / confused-deputy write), the attacker controls the verification algorithm (incl. RSA PSS vs PKCS#1 padding — SEC-N3).

**Fix:** (1) in `parseCOSEPublicKey`/`getCOSEAlgorithmIdentifier`, reject keys whose `alg` is inconsistent with `kty`/`crv` (EC2 P-256→ES256, P-384→ES384, P-521→ES512; OKP Ed25519→EdDSA; RSA→one of RS*/PS*). (2) Re-apply the `supportedAlgorithms` allowlist inside `verifyAuthenticationResponse`. (3) Persist the registered `alg` on the credential and enforce identical alg at auth (the returned `VerifiedRegistrationInfo.credential` should carry `alg`).

### 🟠 SEC-N3 — RSA padding (PSS vs PKCS#1) selected by the key, not enforced · Phase 2

`src/crypto/cose.ts:173-175` hardcodes RSA→`RS256` when `alg` is absent, but when present an attacker-supplied RSA COSE key picks the padding scheme used at verification (`verify.ts` branches on `algInfo.isPSS`). Folds into SEC-N2's "pin full algorithm (incl. padding) at registration, enforce at authentication."

### 🟠 SEC-N4 — `crossOrigin` flag in clientDataJSON never checked · Phase 3

W3C §7.1 step 9 / §7.2 step 13 require the RP to verify `C.crossOrigin`. `ParsedClientDataJSON.crossOrigin` is typed (`src/types/base.ts:134`) but never read in either verify path. A ceremony inside an attacker's cross-origin iframe passes.

**Fix:** add `allowCrossOriginIframe` config (default `false`); reject `clientData.crossOrigin === true` unless enabled. Secure-by-default.

### 🟠 SEC-N5 — Backup-state (BE/BS) and user-verification downgrades undetectable across ceremonies · Phase 3

BE/BS flags are recorded at registration but never re-validated at authentication; a single-device credential (BE=0) suddenly presenting BE=1 (or vice-versa) is a cloning/migration signal that's silently lost. UV downgrade: a credential registered with UV=1 can later authenticate with UV=0 (default `userVerification: 'preferred'` doesn't require UV) and nothing flags it.

**Fix:** let `verifyAuthenticationResponse` accept the stored credential's `backedUp`/`userVerified` and surface `backupStateChanged` / `userVerificationDowngraded` signals in `VerifiedAuthenticationInfo`. Document RP responsibility.

### 🟡 SEC-N6 — Counter clone-detection is a silent no-op for counter=0 authenticators · Phase 3

`src/authentication/verify-response.ts:102-112` correctly rejects `counter <= stored` except when both are 0. Many platform passkeys always report 0, so clone detection is permanently disabled for them — inherent to WebAuthn, but the library gives the RP no signal.

**Fix:** return `counterSupported: boolean` in `VerifiedAuthenticationInfo`; document.

### 🟡 SEC-N7 — Session-token fields fed to crypto without shape validation · Phase 2

`src/session/token.ts:80-125`: `parseSessionToken` JSON-parses untrusted input and feeds `salt`/`iv`/`tag` straight into `createDecipheriv`/`setAuthTag`. GCM fails closed, so low severity, but field lengths are unvalidated.

**Fix:** validate `iv.length === 12`, `tag.length === 16`, `salt.length === 32` before constructing the decipher; reject with a generic error otherwise.

---

## Functionality / Correctness

### 🟠 FUNC-N1 — `userHandle` never validated/returned; discoverable-credential (usernameless) flow unsafe · Phase 3

`AuthenticatorAssertionResponseJSON.userHandle` (`src/types/responses.ts:24`) is never read; `VerifiedAuthenticationInfo` never returns it. W3C §7.2 steps 5-6 require, for client-side discoverable credentials, that the RP verify the `userHandle` maps to the owning user. Combined with API-N2 (the generated `webAuthnUserID` is discarded at registration), usernameless login can't be implemented safely on top of this API.

**Fix:** read `response.response.userHandle`; accept optional `expectedUserHandle`; verify against `credential.webAuthnUserID`; return `userHandle` in `VerifiedAuthenticationInfo`. (Paired with API-N2.)

### 🟠 FUNC-N2 — COSE key parsing uses truthy guards, validates no byte lengths · Phase 3

`src/crypto/cose.ts:88,98,115,131` use `if (!kty)`, `if (!crv || !x || !y)`, etc. A coordinate of zero length / wrong length passes parsing and only fails at Node import; `if (!crv)` would reject a (non-standard) curve value of 0.

**Fix:** explicit `=== undefined` checks + byte-length validation (P-256 x/y=32, P-384=48, P-521=66; Ed25519 x=32; RSA n≥256 for 2048-bit).

### 🟠 FUNC-N3 — Origin match is exact-string only; no `android:apk-key-hash` support · Phase 3

`includes(clientData.origin)` exact match. Scheme/host case or trailing differences silently mismatch; standard Android FIDO2 clients send `android:apk-key-hash:<b64>` origins that can't be expressed.

**Fix:** document that origins must be the exact normalized strings the client sends; optionally accept a matcher function; explicitly support `android:apk-key-hash:` origins.

### 🟡 FUNC-N4 — `attestationType` requested but never enforced/verified · Phase 3

`config.attestationType: 'direct'` is forwarded into creation options (`generate-options.ts:140`) but verify never requires attestation to be present/verified. RP asks for `direct`, gets `attestationVerified: false` and no error.

**Fix:** once attestation verification exists (Phase 6), when `attestationType !== 'none'` require a trust-anchored result (or warn). Until then, warn when requested attestation is not trust-anchored.

### 🟡 FUNC-N5 — Trailing bytes after the COSE key silently dropped when ED flag unset · Phase 3

`src/crypto/authenticator-data.ts:84-87`: `if (flags.extensionData && remaining>0)` captures extensions, but `!extensionData && remaining>0` (malformed trailing data) is silently ignored.

**Fix:** throw `VerificationError('Unexpected trailing bytes after credential public key')` when `!extensionData && remaining > 0`.

### 🟡 FUNC-N6 — `isCborParsingError` branches on error-message substrings · Phase 3

`src/registration/mobile-attestation.ts:170-182` matches `error.message` text — brittle to refactors/localization.

**Fix:** tag CBOR/COSE errors with a stable `code` and branch on `error.code`.

---

## Incomplete-feature gaps

### 🔴 GAP-N1 — Zero tests for `verifyAuthenticationResponse` (the core auth function) · Phases 2-3

`tests/authentication/` has only `generate-options.test.ts`. No round-trip auth test, no counter-regression, no RP-ID/origin mismatch, no UV-required, no bad-signature. Highest-risk omission for a published auth library. **User approved adding tests.**

### 🟠 GAP-N2 — Full attestation-statement trust-anchoring (the v2.2.0-deferred GAP-2) · Phases 5-6

User approved **full attestation + FIDO MDS**. Per-format requirements and Node-built-in sufficiency:

| Format                | Verification requires                                                                                                                                                                                                                             | Node `crypto.X509Certificate` enough?                                      | Extra needed                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **packed (self)**     | already done in v2.2.0 (sig over `authData‖clientDataHash` with credential key)                                                                                                                                                                   | —                                                                          | —                                                                       |
| **packed (x5c)**      | verify `sig` with **leaf cert** key; validate x5c chain to a trusted root; check leaf cert requirements (v3, OU="Authenticator Attestation", BasicConstraints CA=false); verify AAGUID extension OID `1.3.6.1.4.1.45724.1.1.4` == authData AAGUID | Partial (parse, `.publicKey`, `.verify`, `.raw`; no path-build/revocation) | DER reader for AAGUID ext; root store / **FIDO MDS**                    |
| **fido-u2f**          | reconstruct `0x00‖rpIdHash‖clientDataHash‖credentialId‖(0x04‖x‖y)`; verify `sig` (ES256) with attestation cert; validate chain                                                                                                                    | Mostly (sig via `.publicKey`+`crypto.verify`)                              | root store (or MDS); P-256 only                                         |
| **tpm**               | verify `certInfo` (TPMS_ATTEST) + `pubArea` (TPMT_PUBLIC); `pubArea` key == credential key; `certInfo.extraData == hash(attToBeSigned)`; verify `sig` with AIK cert; validate AIK chain; SAN manufacturer/model/version + EKU `2.23.133.8.3`      | No (TPM binary structures)                                                 | TPM struct parser; ASN.1 for SAN/EKU; root store / MDS                  |
| **android-key**       | verify `sig` with leaf key; leaf key == credential key; parse Android Key Attestation ext OID `1.3.6.1.4.1.11129.2.1.17` (`attestationChallenge == clientDataHash`, purpose/origin); chain to Google HW-attestation roots                         | No (complex ASN.1 ext)                                                     | ASN.1 parser; Google roots; CRL                                         |
| **android-safetynet** | parse JWS `response`; verify JWT chain (leaf `attest.android.com`) to GlobalSign root; `nonce == b64(hash(authData‖clientDataHash))`; `ctsProfileMatch`/`basicIntegrity`; timestamp. **Deprecated by Google (Play Integrity replaces it).**       | No (JWS/JWT)                                                               | JWT/JWS verify; GlobalSign root; time. Consider Play Integrity instead. |
| **apple**             | verify Apple Anonymous Attestation chain to **Apple WebAuthn Root CA**; nonce ext OID `1.2.840.113635.100.8.2` == `hash(authData‖clientDataHash)`; leaf key == credential key; no `sig` field                                                     | Partial (`.verify`/`.checkIssued`/`.publicKey`); nonce ext needs ASN.1     | ASN.1 reader for nonce ext; bundled Apple root                          |

**Bottom line:** Node `crypto.X509Certificate` (Node 15+) covers cert-chain + signature for packed-x5c / fido-u2f / apple; **every format needs an ASN.1/DER reader for its custom extension**, and tpm / android-safetynet need extra structure/JWT parsing. **FIDO MDS** maps AAGUID→trusted roots + per-authenticator policy. Architecture decision (Phase 5): keep the package offline-by-default and lean — implement an in-house minimal DER reader for the simple extensions (AAGUID/Apple nonce), use Node `X509Certificate` for chains, bundle only the small static **Apple WebAuthn Root CA**, and expose a pluggable **MetadataService / trust-anchor provider** so the RP supplies the (large, frequently-updated) FIDO MDS blob rather than us bundling/fetching it at import. Add a vetted ASN.1 dependency ONLY if TPM/Android-key parsing proves infeasible in-house (user pre-approved "possibly one small ASN.1 dependency").

### 🟡 GAP-N3 — `clientExtensionResults` never parsed/returned (the v2.2.0-deferred GAP-1) · Phase 4

`RegistrationCredentialJSON.clientExtensionResults` is required in the type but never read. The `credProps.rk` output is the only reliable signal whether a discoverable credential was actually created (so usernameless will work). `largeBlob`, `prf` (modern replacement for `hmac-secret`), `appid` are dropped. `AuthenticationExtensionsClientOutputs` (`responses.ts:54-60`) lacks `prf`, `largeBlob`, `credProps` is incomplete vs WebAuthn L3.

**Fix:** parse + return `clientExtensionResults` (at least `credProps.rk`); modernize the type (add `prf`, `largeBlob`).

### 🟡 GAP-N4 — `excludeCredentials` not enforced at registration verify · Phase 4

Passed into options but the verify path never rejects an already-registered credential.

**Fix:** optionally accept the existing credential set in `verifyRegistration` and reject duplicates; document.

---

## API / Type safety

### 🟡 API-N1 — Error `code` is free-form `string`; no typed union/enum · Phase 4

`src/types/errors.ts:7` `code: string`. Consumers can't exhaustively switch. `statusCode` (400/401/500) is set but undocumented.

**Fix:** export a `WebAuthnErrorCode` union/enum of the known codes; type `WebAuthnError.code` against it; document `statusCode`.

### 🟠 API-N2 — Generated `webAuthnUserID` is discarded; `VerifiedRegistrationInfo.credential` ≠ `WebAuthnCredential` · Phase 3

`generateRegistrationOptions` (`generate-options.ts:77`) generates the WebAuthn user handle but never returns it, so the RP can't populate `WebAuthnCredential.webAuthnUserID` → breaks `findByWebAuthnUserId` (memory.ts:91) for usernameless flows. Mapping `VerifiedRegistrationInfo` → `WebAuthnCredential` is non-obvious (`credentialDeviceType`/`credentialBackedUp` live on the parent, not on `.credential`).

**Fix:** return the generated `webAuthnUserID` from `createRegistrationOptions`; add `alg` to the returned credential (pairs with SEC-N2); provide/ document a `VerifiedRegistrationInfo → WebAuthnCredential` mapping helper.

### 🟡 API-N3 — No public way to mint/verify session tokens outside `WebAuthnServer` · Phase 4 (decide/document)

`SessionData` is an exported type but `createSessionToken`/`parseSessionToken`/`SessionManager` aren't exported. Likely intentional encapsulation — confirm + document, or export read-only helpers.

### 🟡 API-N4 — Variable-time `buffersEqual` exported next to `timingSafeEqualBytes` (footgun) · Phase 4

`index.ts` exports both; a consumer could pick the wrong one for a security compare.

**Fix:** document `buffersEqual` as non-security (JSDoc + README), or deprecate it in favor of `timingSafeEqualBytes`.

---

## Hygiene / Standards

- **HYG-N1** — `src/crypto/cose.ts:62-67` maps `crv` & `n` both to `-1`, `x` & `e` both to `-2`. Works via `kty` branching but a footgun. Comment or split per-type. · Phase 4
- **HYG-N2** — `src/index.ts` JSDoc claims "Complete WebAuthn Level 3 support" + "Mobile Attestation Support: iOS and Android platform validation". Both overstate reality. Soften to match verified behavior. · Phase 4 (revisit Phase 7 once attestation lands)
- **HYG-N3** — `src/session/manager.ts`: stored-session `expiresAt` not re-checked after fetch from a custom adapter. Defense-in-depth re-validate. · Phase 2
- **HYG-N4** — `registration/verify-response.ts:105,107` decodes `clientDataJSON` twice (buffer + string). Decode once. · Phase 4
- **HYG-N5** — `src/utils/hash.ts:33-63` `verifyHash` is dead (only re-exported); hand-rolled constant-time loop duplicates `timingSafeEqualBytes`. Route through `crypto.timingSafeEqual` or remove. · Phase 4
- **HYG-N6** — `src/types/responses.ts:54-60` `AuthenticationExtensionsClientOutputs` lists legacy `hmacCreateSecret`, missing `prf`. Modernize (with GAP-N3). · Phase 4

---

## Phase map (summary)

| Phase | Theme                         | Findings                                                                                                                |
| ----- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1     | Deps + toolchain verify       | (deps already latest — verify, lockfile, gate)                                                                          |
| 2     | Critical security             | SEC-N1, SEC-N2, SEC-N3, SEC-N7, HYG-N3 (+ auth tests)                                                                   |
| 3     | Spec-compliance & correctness | FUNC-N1, API-N2, SEC-N4, FUNC-N2, FUNC-N5, SEC-N5, SEC-N6, FUNC-N3, FUNC-N4, FUNC-N6                                    |
| 4     | Extensions, API & hygiene     | GAP-N3, HYG-N6, API-N1, GAP-N4, HYG-N2, HYG-N1, HYG-N4, HYG-N5, API-N3, API-N4                                          |
| 5     | Attestation foundation        | GAP-N2 (DER reader, X509 chain util, MetadataService iface, Apple root)                                                 |
| 6     | Attestation formats           | GAP-N2 (apple, fido-u2f, packed-x5c, android-key, tpm, android-safetynet/Play Integrity, FIDO MDS), FUNC-N4 enforcement |
| 7     | Documentation refresh         | all docs + CLAUDE.md/AGENTS.md (revisit HYG-N2 wording)                                                                 |
| 8     | Release v2.3.0                | version bump, gate, publish                                                                                             |

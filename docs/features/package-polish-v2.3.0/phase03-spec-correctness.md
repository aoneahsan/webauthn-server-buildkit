# Phase 03 — Spec-compliance & correctness

**Goal:** Bring the verification flows in line with the W3C WebAuthn spec and make discoverable-credential (usernameless) flows implementable and safe.

## Findings addressed

- 🟠 **FUNC-N1 + API-N2** — `userHandle` unvalidated/unreturned; generated `webAuthnUserID` discarded.
- 🟠 **SEC-N4** — `crossOrigin` never checked.
- 🟠 **FUNC-N2** — COSE key truthy guards, no length validation.
- 🟡 **FUNC-N5** — trailing bytes after COSE key silently dropped when ED unset.
- 🟠 **SEC-N5 / 🟡 SEC-N6** — BE/BS + UV downgrade + counter-support signals.
- 🟠 **FUNC-N3** — origin exact-string only; no `android:apk-key-hash`.
- 🟡 **FUNC-N4** — `attestationType` requested but not enforced (interim warn; full enforcement Phase 6).
- 🟡 **FUNC-N6** — `isCborParsingError` branches on message text.

## Approach

### FUNC-N1 + API-N2 — userHandle & webAuthnUserID

- `createRegistrationOptions` returns the generated `webAuthnUserID` (Base64URL) alongside the options so the RP can persist it on `WebAuthnCredential.webAuthnUserID`.
- `verifyAuthenticationResponse` reads `response.response.userHandle`; accepts optional `expectedUserHandle`; if both present and mismatched → `USER_HANDLE_MISMATCH`. Returns `userHandle` in `VerifiedAuthenticationInfo`.
- Add `alg` to `VerifiedRegistrationInfo.credential` (pairs with SEC-N2) and to `WebAuthnCredential` (additive optional).

### SEC-N4 — crossOrigin

- Add `allowCrossOriginIframe?: boolean` config (default `false`). In both verify paths, after origin check: if `clientData.crossOrigin === true && !allowCrossOriginIframe` → `CROSS_ORIGIN_NOT_ALLOWED`.

### FUNC-N2 — COSE key validation (crypto/cose.ts)

- Replace `if (!x)` etc. with `=== undefined` checks; add byte-length validation: EC2 P-256 x/y=32, P-384=48, P-521=66; OKP Ed25519 x=32; RSA n≥256 (2048-bit), e present. Reject `INVALID_COSE_KEY` with a specific reason.

### FUNC-N5 — trailing bytes (crypto/authenticator-data.ts)

- When `!flags.extensionData && remainingBytes.length > 0` → `VerificationError('Unexpected trailing bytes after credential public key', 'AUTHENTICATOR_DATA_TRAILING_BYTES')`.

### SEC-N5/N6 — downgrade & counter signals

- `verifyAuthenticationResponse` accepts optional stored `backedUp` / `userVerified` and returns:
  - `backupStateChanged: boolean` (stored `backedUp` !== current `backupState`),
  - `userVerificationDowngraded: boolean` (stored `userVerified` true but current false),
  - `counterSupported: boolean` (false when both stored and new counter are 0).
- Documented as advisory signals; RP decides policy. No hard rejection by default (avoids breaking counter=0 passkeys).

### FUNC-N3 — origin handling

- Document that `origin` entries must be exact normalized origin strings the client sends.
- Accept `android:apk-key-hash:<b64>` entries in the `origin` allowlist (passed through `includes` as-is — they're already exact strings, just document + add to the type's allowed shapes and tests).
- Optionally accept a matcher function `originVerifier?: (origin: string) => boolean` in config for advanced normalization.

### FUNC-N4 — attestationType (interim)

- When `config.attestationType && config.attestationType !== 'none'` and the verified attestation result is not trust-anchored, `logger?.('warn', ...)`. Hard enforcement lands in Phase 6 once attestation verification exists.

### FUNC-N6 — error code routing

- Tag CBOR/COSE parse errors with a stable `code` (e.g. throw `VerificationError(..., 'CBOR_DECODE_ERROR')` / `'COSE_PARSE_ERROR'`); branch on `error.code` in `mobile-attestation.ts` rather than `error.message` substrings.

## Tests

Extend `tests/authentication/verify-response.test.ts` and add fixtures for: userHandle match/mismatch, crossOrigin rejection, COSE length validation (short coordinate rejected), trailing-byte rejection, downgrade signals, android:apk-key-hash origin acceptance.

## Verification gate

`yarn typecheck` · `yarn lint` · `yarn test` · `yarn build` · `yarn format:check` — all clean.

## Commit

ONE commit for Phase 3, tracker + progress updated. Push.

## Run log

| Date | What happened | Result |
| ---- | ------------- | ------ |
|      |               |        |

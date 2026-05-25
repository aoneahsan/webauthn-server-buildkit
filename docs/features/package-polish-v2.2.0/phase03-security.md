# Phase 03 — Security Hardening

**Goal:** Close the mobile-attestation bypass (opt-in default off), strengthen session-token crypto, add constant-time compares, enforce the algorithm allowlist, and add bounded attestation-statement verification.

**Skills:** `security-review`, `nodejs-best-practices`, `vitest`.

## Steps

1. **SEC-1 — Mobile attestation opt-in.**
   - Add `enableMobileAttestation?: boolean` to `WebAuthnServerConfig` (default `false`) and to `InternalConfig`/`buildInternalConfig`.
   - In `verify-response.ts`, only call `detectMobileAttestation`/`validateMobileAttestation` when `config.enableMobileAttestation === true`. When disabled, always run the standard WebAuthn path (a JSON attestation then fails normal CBOR parsing → standard error).
   - When enabled, `config.logger?.('warn', ...)` a loud one-time warning that mobile attestation provides no cryptographic attestation guarantee.
   - Document thoroughly (README security section + migration note).
2. **SEC-4/SEC-5 — `src/session/token.ts`.**
   - `deriveKey` → `hkdfSync('sha256', Buffer.from(secret), salt, Buffer.from('webauthn-server-buildkit/session'), 32)` returning a 32-byte Buffer.
   - `IV_LENGTH` → `12`.
   - Keep token JSON structure (`iv/data/tag/salt`) so decryption still reads stored IV; only new tokens use the new params. Add a CHANGELOG note: existing sessions invalidated.
3. **SEC-8 — Constant-time compare.** Add `timingSafeEqualBytes` helper (wrapping `crypto.timingSafeEqual` with length guard) and use it for RP-ID-hash comparisons in both verify-response files (replace `buffersEqual` there). Keep `buffersEqual` for non-security uses or redirect it.
4. **SEC-9 — Algorithm allowlist.** In registration verify, parse the COSE key's algorithm and ensure it ∈ `config.supportedAlgorithms`; throw `VerificationError('UNSUPPORTED_ALGORITHM')` otherwise. In authentication, the key's alg drives verification; optionally assert membership too.
5. **SEC-6 — Attestation-statement verification (bounded).**
   - Read `attestationObject.fmt`. Implement `none` (no statement, current), `packed` (self-attestation: verify `sig` over `authData||clientDataHash` with the credential public key; x5c basic: verify `sig` with the leaf cert public key + alg), and `fido-u2f` (reconstruct the U2F signature base + verify with x5c leaf).
   - For `tpm`/`android-key`/`android-safetynet`/`apple`: do NOT silently trust — set an `attestationVerified: false` indicator (and document), or throw if a strict flag is set. Surface `fmt` in `VerifiedRegistrationInfo`.
   - Keep default `attestationType: 'none'` behaviour unchanged for existing users.
6. **Tests:** mobile-attestation disabled-by-default (JSON attestation rejected via standard path) and enabled path; session round-trip with new KDF/IV; algorithm-allowlist rejection; packed self-attestation verify.
7. **Verification gate + commit:** `feat(security): opt-in mobile attestation, HKDF session keys, constant-time compares, alg allowlist, packed/fido-u2f attestation`.

## Acceptance

- With defaults, a JSON "mobile" attestation no longer yields `verified: true`.
- Session tokens use HKDF + 12-byte IV; round-trip create/validate works.
- Packed self-attestation verifies; unsupported formats are flagged, not trusted.

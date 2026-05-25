# Audit Findings — webauthn-server-buildkit (2026-05-26)

Baseline before any change: `yarn typecheck` clean, `yarn lint` clean, `yarn test` **131 passed**, `yarn build` success. The green baseline is misleading for crypto: existing crypto tests use dummy filler bytes and only assert "does not throw" — they never verify a real signature.

Severity: 🔴 Critical/High · 🟠 Medium · 🟡 Low/Hygiene. Phase = where it's fixed.

---

## Security

### 🔴 SEC-1 — Mobile-attestation authentication bypass · Phase 3

`src/registration/mobile-attestation.ts` → `validateMobileAttestation()` accepts a client-supplied JSON blob (`{ publicKey, credentialId }`) and returns `verified: true` with **no challenge check, no signature verification, no cryptographic origin binding**. `detectMobileAttestation()` routes to it whenever `attestationObject` base64-decodes to JSON starting with `{`/`[`, so an attacker can choose this path to bypass the secure CBOR/WebAuthn verification in `verify-response.ts`.
**Fix (user-approved):** gate behind `enableMobileAttestation` config (default `false`). When disabled, never take the JSON path — standard WebAuthn only. When enabled, keep behaviour but log a loud warning and document that it provides no cryptographic attestation guarantee.

### 🔴 SEC-2 — RSA & ES512 signature verification broken · Phase 2

`src/crypto/verify.ts` → `rsaKeyToSPKI()` / `ec2KeyToSPKI()` build ASN.1 DER with **single-byte length headers** (`Buffer.from([0x30, len])`). DER requires long-form for lengths ≥ 128. RSA-2048 modulus is 256 bytes and P-521 points are 133 bytes, so the encoded SPKI is malformed → `RS256/384/512`, `PS256/384/512`, and `ES512` verification silently fail/throw for real keys. Only `ES256`/`ES384` (lengths < 128) happen to work.
**Fix:** drop hand-rolled SPKI; import keys via Node's **JWK** format (`createPublicKey({ key: { kty, crv, x, y | n, e }, format: 'jwk' })`) for EC2/RSA/OKP. Correct, maintained, and removes ~120 lines of fragile ASN.1.

### 🟠 SEC-3 — Ed25519 key import is fragile · Phase 2

`verify.ts` → `verifyEd25519Signature()` uses `createPublicKey({ key, format: 'raw', type: 'public' } as unknown as ...)`. The `as unknown` cast hides an unsupported/edge API shape.
**Fix:** import as JWK (`{ kty: 'OKP', crv: 'Ed25519', x }`) — same rewrite as SEC-2.

### 🟠 SEC-4 — Weak session-token key derivation · Phase 3

`src/session/token.ts` → `deriveKey()` is bare `HMAC-SHA256(secret, salt)`, not a standard KDF.
**Fix:** use `hkdfSync('sha256', secret, salt, info, 32)`. (Invalidates existing tokens — documented per user decision.)

### 🟠 SEC-5 — Non-standard AES-GCM IV length · Phase 3

`token.ts` uses `IV_LENGTH = 16`. NIST SP 800-38D recommends **96-bit (12-byte)** IVs for GCM.
**Fix:** 12-byte IV for new tokens. (Decryption reads IV from the token, so this only affects newly issued tokens.)

### 🟠 SEC-6 — No attestation-statement verification · Phase 3

`src/registration/verify-response.ts` ignores `attestationObject.fmt`/`attStmt` entirely on the standard path. Any attestation is accepted as long as `authData` parses. `attestationType` config has no verification effect.
**Fix (scoped):** verify `none` (current, correct), implement `packed` (self + x5c basic) and `fido-u2f`, and **explicitly flag** `tpm`/`android-key`/`android-safetynet`/`apple` as unverified rather than silently trusting them. Surface `fmt` + an attestation-verified indicator in the result. Full TPM/SafetyNet/Apple chains documented as a future enhancement.

### 🟠 SEC-7 — Counter integer overflow · Phase 2

`src/utils/buffer.ts` → `bufferToNumber()` does `(num << 8) | byte`. JS bitwise ops are 32-bit signed, so 4-byte counters ≥ 2^24 are corrupted (can go negative). Breaks the cloned-authenticator counter-regression check for high counters.
**Fix:** unsigned/`DataView.getUint32(0,false)` or `num * 256 + byte`.

### 🟡 SEC-8 — Non-constant-time buffer comparison · Phase 3/4

`buffer.ts` → `buffersEqual()` returns early on first mismatch (used for RP-ID-hash compare). Low risk (hash isn't secret) but inconsistent with `hash.ts` `verifyHash()` which is constant-time.
**Fix:** route security-sensitive comparisons through `crypto.timingSafeEqual`.

### 🟡 SEC-9 — No algorithm allowlist enforcement · Phase 3

Registration never checks the credential's algorithm ∈ `config.supportedAlgorithms`. A credential using an unconfigured algorithm is accepted.
**Fix:** validate the registered/asserted algorithm against `supportedAlgorithms`.

### 🟡 SEC-10 — Challenge not validated against storage · Phase 5 (document)

`server.ts` stores challenges but `verifyRegistration`/`verifyAuthentication` only compare the caller-supplied `expectedChallenge` against client data; they never check storage existence/expiry/one-time-use. The caller owns the challenge lifecycle.
**Fix:** document the caller's responsibility clearly (and note the optional pattern of consuming the stored challenge). No silent behaviour change.

---

## Functionality / Correctness

### 🔴 FUNC-1 — `decodeCBORFirst` is a stub · Phase 2

`src/crypto/cbor.ts` → returns `remainingBytes: new Uint8Array(0)` always, with a comment admitting it's a placeholder. It's **exported in the public API** (`index.ts`).
**Fix:** implement real byte-offset tracking with cbor-x.

### 🟠 FUNC-2 — COSE public-key boundary swallows extensions · Phase 2

`src/crypto/authenticator-data.ts` takes **all** remaining bytes as `credentialPublicKey` even when the `extensionData` flag is set (the two branches are identical dead code). Stored public key then includes trailing extension CBOR.
**Fix:** use `decodeCBORFirst` (FUNC-1) to bound the COSE key, capture extensions separately.

### 🟡 FUNC-3 — `challenge.ts` throws generic `Error` · Phase 4

Inconsistent with the library's typed error hierarchy.
**Fix:** throw `ConfigurationError`.

---

## API / Packaging

### 🔴 API-1 — Error classes exported as types only · Phase 4

`src/index.ts` lists `WebAuthnError`, `RegistrationError`, `AuthenticationError`, `VerificationError`, `ConfigurationError`, `StorageError`, `SessionError` inside an `export type { ... }` block. They are runtime **classes** the library throws, but consumers can't import them as values or `instanceof`-check them.
**Fix:** export the error classes (and any other runtime value) via a value `export { ... }`; keep pure types in `export type`.

---

## Incomplete-feature gaps

- **GAP-1 — Extension outputs** are never parsed/returned (`clientExtensionResults`). Low priority; document. · Phase 5
- **GAP-2 — Attestation formats** beyond none/packed/fido-u2f (see SEC-6). · documented future

---

## Hygiene / Standards

- **HYG-1** — `src/utils/console.ts` is dead code (not imported, not exported). Delete. · Phase 4
- **HYG-2** — `src/config/support.ts` `SUPPORT_CONFIG` is defined but never exported/surfaced; `package.json` has no `funding` field. Surface + add funding. · Phase 4
- **HYG-3** — `eslint.config.js` imports `@eslint/js` (banned by global standard: "NEVER use `@eslint/js`") and never wires up `@typescript-eslint/eslint-plugin` (`plugins: {}`), so no TS lint rules run. Rewrite using `typescript-eslint`. · Phase 1
- **HYG-4** — Stray `simplewebauthn-server-documentation-part.md` (24 KB) at repo root. Move under `docs/` or remove (it's reference-only; package CLAUDE.md says this lib is NOT a wrapper). · Phase 4
- **HYG-5** — `tsconfig` has `noUnusedLocals/noUnusedParameters: true` but eslint disables `no-unused-vars` — align. · Phase 1
- **HYG-6** — `buffer.ts` `hexToBuffer` uses deprecated `String.substr`. Minor. · Phase 4

---

## Dependencies (as of 2026-05-26)

| Package                          | Current spec | Resolved | Latest stable | Action           |
| -------------------------------- | ------------ | -------- | ------------- | ---------------- |
| cbor-x                           | ^1.6.0       | 1.6.4    | 1.6.4         | spec → ^1.6.4    |
| @types/node                      | ^25.2.0      | 25.7.0   | 25.9.1        | → ^25.9.1        |
| @typescript-eslint/eslint-plugin | ^8.54.0      | 8.59.3   | 8.60.0        | → ^8.60.0        |
| @typescript-eslint/parser        | ^8.54.0      | 8.59.3   | 8.60.0        | → ^8.60.0        |
| @vitest/coverage-v8              | ^4.0.17      | 4.1.6    | 4.1.7         | → ^4.1.7         |
| eslint                           | ^9.39.2      | 9.39.4   | **10.4.0**    | attempt major 10 |
| eslint-config-prettier           | ^10.1.8      | 10.1.8   | 10.1.8        | current          |
| eslint-plugin-prettier           | ^5.5.5       | 5.5.5    | 5.5.5         | current          |
| prettier                         | ^3.8.0       | 3.8.3    | 3.8.3         | spec → ^3.8.3    |
| tsup                             | ^8.5.1       | 8.5.1    | 8.5.1         | current          |
| typescript                       | ^5.9.3       | 5.9.3    | **6.0.3**     | attempt major 6  |
| vitest                           | ^4.0.17      | 4.1.6    | 4.1.7         | → ^4.1.7         |

`typescript-eslint` meta-package not currently a dep — will add it for the flat-config rewrite (replaces banned `@eslint/js`).

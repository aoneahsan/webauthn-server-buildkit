# Phase 02 — Crypto Correctness Fixes (+ round-trip tests)

**Goal:** Make signature verification actually correct for all advertised algorithms; fix CBOR boundary + counter parsing; prove it with real round-trip tests.

**Skills:** `security-review`, `nodejs-best-practices`, `vitest`, `simplify`.

## Steps

1. **SEC-2/SEC-3 — `src/crypto/verify.ts` JWK rewrite.**
   - Replace `ec2KeyToSPKI`/`rsaKeyToSPKI`/`verifyEd25519Signature` + the manual `createVerify` paths with `createPublicKey({ key: jwk, format: 'jwk' })`:
     - EC2 → `{ kty: 'EC', crv: 'P-256'|'P-384'|'P-521', x, y }` (base64url of the COSE x/y).
     - RSA → `{ kty: 'RSA', n, e }` (base64url). Use `verify(hash, data, { key, padding, saltLength }, sig)` for PSS vs PKCS1.
     - OKP → `{ kty: 'OKP', crv: 'Ed25519', x }`, `verify(null, data, key, sig)`.
   - ECDSA WebAuthn signatures are DER-encoded already (Node verifies DER by default) — keep that behaviour; no `ieee-p1363` conversion needed for `createVerify`/`verify` with der.
   - Preserve the public signature `verifySignature(signature, data, publicKey): boolean` and `VerificationError` semantics (return false on crypto failure, throw on unsupported alg/key type).
2. **FUNC-1 — `src/crypto/cbor.ts` `decodeCBORFirst`.** Implement real byte tracking. cbor-x `Decoder` exposes the consumed position via decoding against a shared buffer; use the documented approach (e.g. `decoder.decode` + `decoder.position`/`decodeMultiple`) to return `{ value, remainingBytes }` correctly.
3. **FUNC-2 — `src/crypto/authenticator-data.ts`.** Use `decodeCBORFirst` to bound `credentialPublicKey` to exactly the COSE key bytes; assign any trailing bytes (when `extensionData` flag set) to `extensionsData`. Remove the identical dead `if/else` branches.
4. **SEC-7 — `src/utils/buffer.ts` `bufferToNumber`.** Fix 32-bit overflow: use `DataView`/`readUInt32BE`-style unsigned read (or `num * 256 + byte`), so 4-byte counters up to 2^32-1 parse correctly.
5. **Tests (user-approved) — `tests/crypto/`:**
   - `verify.test.ts`: generate real key pairs with `node:crypto.generateKeyPairSync` for `ec` (P-256/384/521), `rsa` (RS256 + PSS), `ed25519`; export to COSE-shaped input; sign data; assert `verifySignature` returns `true`, and `false` for tampered data/sig.
   - counter parsing test for values `0`, `2^24`, `2^31`, `2^32-1`.
   - `cbor.test.ts`: `decodeCBORFirst` returns correct `remainingBytes` for concatenated CBOR items.
6. **Verification gate + commit:** `fix(crypto): correct RSA/ES512/Ed25519 verification via JWK import, real decodeCBORFirst, counter overflow + round-trip tests`.

## Acceptance

- Real RS256/PS256/ES256/ES384/ES512/Ed25519 signatures verify `true`; tampered → `false`.
- `decodeCBORFirst` returns real remaining bytes.
- Counter ≥ 2^24 parses correctly.

# Phase 02 — Critical security

**Goal:** Close the highest-severity new findings: the stored-challenge replay gap, algorithm pinning at authentication, and session-token hardening. Secure-by-default with config switches + upgrade notes.

## Findings addressed

- 🔴 **SEC-N1** — stored challenge never validated on verify (replay / no single-use / no expiry).
- 🟠 **SEC-N2** — `supportedAlgorithms` allowlist only at registration; no `alg`↔`crv` consistency; alg not pinned at auth.
- 🟠 **SEC-N3** — RSA PSS-vs-PKCS#1 padding chosen by key, not enforced (folds into SEC-N2).
- 🟡 **SEC-N7** — session-token fields fed to crypto without shape validation.
- 🟡 **HYG-N3** — stored-session expiry not re-checked after adapter fetch.

## Approach

### SEC-N1 — challenge lifecycle (server.ts)

- The low-level `verifyRegistrationResponse` / `verifyAuthenticationResponse` stay challenge-string-only (callers who manage their own lifecycle).
- The `WebAuthnServer.verifyRegistration` / `verifyAuthentication` wrappers, when a `storageAdapter` is configured, MUST:
  1. `challenges.find(expectedChallenge)` → reject `CHALLENGE_NOT_FOUND` if absent.
  2. Check `operation` matches the flow (`'registration'` vs `'authentication'`) → `CHALLENGE_OPERATION_MISMATCH`.
  3. Check not expired (`expiresAt > now`) → `CHALLENGE_EXPIRED`.
  4. Run the standard verification.
  5. Consume-once: `challenges.delete(expectedChallenge)` on success AND on the rejections above (so a bad attempt can't be retried with the same nonce).
- Add `enforceChallengeStore?: boolean` config (default **true** when a storage adapter is present; secure-by-default). Setting it `false` restores legacy behavior for callers who intentionally manage challenges themselves.
- Document as an upgrade note: relying parties that configured a storage adapter but passed challenges not issued via `generate*Options` must now either issue via the server or set `enforceChallengeStore: false`.

### SEC-N2/N3 — algorithm pinning

- `src/crypto/cose.ts`: in `parseCOSEPublicKey` / `getCOSEAlgorithmIdentifier`, reject keys whose declared `alg` is inconsistent with `kty`/`crv` (EC2 P-256→ES256, P-384→ES384, P-521→ES512; OKP Ed25519→EdDSA; RSA→`alg ∈ {RS256,RS384,RS512,PS256,PS384,PS512}`). When `alg` is absent, derive the canonical alg from the curve/kty (existing behavior) — never let a present-but-wrong `alg` change the digest/padding.
- `src/authentication/verify-response.ts`: re-apply `config.supportedAlgorithms.includes(getCOSEAlgorithmIdentifier(publicKey))` before `verifySignature`; reject `UNSUPPORTED_CREDENTIAL_ALGORITHM`.
- Persist the registered `alg` on `VerifiedRegistrationInfo.credential.alg` (additive). When the RP passes the stored `credential.alg` to `verifyAuthenticationResponse` (optional), enforce identical alg → `ALGORITHM_MISMATCH`. (Full credential-level pin requires `WebAuthnCredential.alg` — additive type change, coordinate with Phase 3 API-N2.)

### SEC-N7 — session-token field validation (session/token.ts)

- In `parseSessionToken`, after JSON-parsing the outer payload, validate `iv.length === 12`, `tag.length === 16`, `salt.length === 32` before `createDecipheriv`/`setAuthTag`; reject with a generic `SessionError('Invalid session token')` otherwise (no internal detail leak).

### HYG-N3 — stored-session expiry (session/manager.ts)

- After fetching `storedSession` from a custom adapter, re-validate `storedSession.expiresAt > now` before returning; treat expired as invalid.

## Tests (approved)

New `tests/authentication/verify-response.test.ts`:

- round-trip success (real ES256 sign → verify) using existing crypto test helpers/fixtures;
- counter regression rejection (and counter=0/0 allowed);
- RP-ID mismatch, origin mismatch rejections;
- UV-required rejection when `requireUserVerification`;
- bad-signature rejection;
- algorithm-not-in-allowlist rejection at auth.
  New `tests/server/challenge-lifecycle.test.ts` (or extend an existing server test): single-use enforcement (second verify with same challenge rejected), expiry, operation mismatch, `enforceChallengeStore:false` legacy path.
  Extend `tests/session/token.test.ts`: malformed-field rejection.

## Verification gate

`yarn typecheck` · `yarn lint` · `yarn test` · `yarn build` · `yarn format:check` — all clean.

## Commit

ONE commit for Phase 2, tracker + progress updated. Push.

## Run log

| Date | What happened | Result |
| ---- | ------------- | ------ |
|      |               |        |

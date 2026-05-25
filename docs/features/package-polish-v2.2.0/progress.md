# Progress Log — package-polish-v2.2.0

Session-by-session log. Newest first. The authoritative status is `00-tracker.json`.

## 2026-05-26 — Session 1 (Phase 00: planning)

- Invoked skills: `writing-plans`, `planning-with-files`, `nodejs-best-practices`.
- Read the entire `src/` tree + tests + configs + docs.
- Established green baseline: `yarn typecheck` clean, `yarn lint` clean, `yarn test` **131 passed**, `yarn build` success.
- Queried npm `latest` for all deps (see findings.md table). Two majors available: ESLint 10, TypeScript 6.
- Compiled full audit → `findings.md` (SEC-1..10, FUNC-1..3, API-1, GAP-1..2, HYG-1..6).
- Asked the user 3 decision questions; captured answers in tracker `userDecisions`:
  - Mobile attestation → opt-in, default OFF + docs.
  - Crypto round-trip tests → approved.
  - Versioning → minor 2.2.0, document session-token invalidation.
- Scaffolded resumable plan: `00-overview.md`, `findings.md`, `00-tracker.json`, this file, phase 01–06 files.

### Verification gate results

| Gate      | Baseline      |
| --------- | ------------- |
| typecheck | ✅ clean      |
| lint      | ✅ clean      |
| test      | ✅ 131 passed |
| build     | ✅ success    |

### Errors encountered

| Error      | Attempt | Resolution |
| ---------- | ------- | ---------- |
| (none yet) |         |            |

## 2026-05-26 — Session 1 (Phase 01: dependencies & toolchain)

- Verified `typescript-eslint@8.60.0` peers allow `eslint ^10` and `typescript >=4.8.4 <6.1.0` → both majors safe.
- Removed individual `@typescript-eslint/*` packages; added `typescript-eslint` meta. Bumped: ESLint 10.4.0, TypeScript 6.0.3, @types/node 25.9.1, vitest+coverage 4.1.7, prettier 3.8.3, cbor-x 1.6.4.
- Rewrote `eslint.config.js` (flat, `tseslint.config()`); removed banned `@eslint/js`; `no-unused-vars: error`; prettier via `eslint-plugin-prettier/recommended`. Dropped `--ext` from lint scripts.
- `tsconfig.json`: added `types: ["node"]`, `ignoreDeprecations: "6.0"`, kept `baseUrl` (tsup dts needs it), `paths` → `./src/*`.
- Fixed one unused `catch (error)` in `mobile-attestation.ts`. Normalized repo formatting with prettier 3.8.3.

### Verification gate (Phase 01)

| Gate         | Result         |
| ------------ | -------------- |
| typecheck    | ✅ clean       |
| lint         | ✅ clean       |
| test         | ✅ 131 passed  |
| build        | ✅ ESM+CJS+DTS |
| format:check | ✅ clean       |

### Errors encountered (Phase 01)

| Error                                        | Attempt | Resolution                                     |
| -------------------------------------------- | ------- | ---------------------------------------------- |
| TS5101 baseUrl deprecated (TS6)              | 1       | Removed baseUrl                                |
| TS5090 non-relative paths w/o baseUrl        | 2       | `paths` → `./src/*`                            |
| @types/node globals not found w/o baseUrl    | 2       | Added `types: ["node"]`                        |
| tsup DTS build re-raised baseUrl deprecation | 3       | Re-added baseUrl + `ignoreDeprecations: "6.0"` |

### New finding

- CI-1 [low]: `ci.yml` matrix tests Node 20/22 but engine requires ≥24.13.0 → bump to 24.x (Phase 04/05).

### Next

Phase 02 (crypto correctness): JWK key import in `crypto/verify.ts`, real `decodeCBORFirst`, COSE boundary, counter overflow + round-trip tests.

## 2026-05-26 — Session 1 (Phase 02: crypto correctness)

- **SEC-2/SEC-3** — Rewrote `crypto/verify.ts` to import keys via `createPublicKey({ format: 'jwk' })` + `crypto.verify`. Removed ~120 lines of hand-rolled ASN.1/SPKI that silently broke RSA (256-byte modulus) and P-521. Validated via inline run + tests before proceeding.
- **FUNC-1** — Implemented a real `decodeCBORFirst` using a self-contained RFC 8949 item-length scanner. (cbor-x exposes no public byte-offset API and `decode` throws on trailing bytes.)
- **FUNC-2** — `authenticator-data.ts` now bounds the COSE key via `decodeCBORFirst`; trailing bytes become `extensionsData`. Removed the dead duplicate `if/else`.
- **SEC-7 / HYG-6** — `bufferToNumber` (multiplication) and `numberToBuffer` (div/mod) handle full uint32 counters; `substr` → `substring`.
- Tests: real key-pair round-trips for ES256/384/512, RS256/384/512, PS256/384/512, Ed25519; `decodeCBORFirst`; counter parsing. Suite **131 → 157**.

### Verification gate (Phase 02)

| Gate         | Result         |
| ------------ | -------------- |
| typecheck    | ✅ clean       |
| lint         | ✅ clean       |
| test         | ✅ 157 passed  |
| build        | ✅ ESM+CJS+DTS |
| format:check | ✅ clean       |

### Key finding confirmed

- The previous "131 passing" was misleading: old crypto tests used dummy bytes and only asserted "does not throw". Real RSA/ES512 verification was broken in production and untested.

### Next

Phase 03 (security hardening): mobile-attestation opt-in (`enableMobileAttestation`, default off), session HKDF + 12-byte IV, constant-time compares, algorithm allowlist, packed/fido-u2f attestation.

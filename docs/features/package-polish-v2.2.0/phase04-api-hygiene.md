# Phase 04 — API Correctness & Code Hygiene

**Goal:** Make error classes usable by consumers, remove dead code, align with global standards.

**Skills:** `simplify`, `nodejs-best-practices`, `typescript-advanced-types`.

## Steps

1. **API-1 — Export error classes as values.** In `src/index.ts`, move `WebAuthnError`, `RegistrationError`, `AuthenticationError`, `VerificationError`, `ConfigurationError`, `StorageError`, `SessionError` out of the `export type { ... }` block into a value `export { ... } from './types'`. Verify the built `dist/index.js`/`.cjs` actually contain the classes and consumers can `instanceof`-check. (Also confirm `VERSION` stays a value export.)
2. **HYG-1 — Delete `src/utils/console.ts`** (dead code) and remove any reference from `src/utils/index.ts`.
3. **FUNC-3/HYG-5 — `src/crypto/challenge.ts`** throw `ConfigurationError` (not generic `Error`); keep messages.
4. **HYG-2 — Support config.** Export `SUPPORT_CONFIG` from `src/index.ts`; add a `funding` field to `package.json` pointing at the support URL.
5. **HYG-4 — Stray root doc.** Move `simplewebauthn-server-documentation-part.md` into `docs/reference/` (or delete if redundant) — keep the repo root clean per project docs rule. It is reference-only; the package is NOT a wrapper.
6. **HYG-6 — `buffer.ts`** replace deprecated `substr` with `slice`/`substring`; final consistency pass on comparison helpers.
7. **Verification gate + commit:** `refactor(api): export error classes as values; remove dead code; hygiene + funding`.

## Acceptance

- `import { VerificationError } from 'webauthn-server-buildkit'` works as a value; `e instanceof VerificationError` is true for thrown errors.
- No dead modules; repo root clean; `funding` present.

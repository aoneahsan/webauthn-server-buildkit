# Phase 01 — Dependency Updates & Toolchain Modernization

**Goal:** All deps at latest stable that work together; modernize the ESLint setup to comply with the global standard (no `@eslint/js`) and actually run TS lint rules.

**Skills:** `nodejs-best-practices`, `eslint-prettier-config`, `vite`/`vitest` (config awareness), `simplify`.

## Steps

1. **Minor/patch bumps** (safe): `yarn add -D @types/node@^25.9.1 @typescript-eslint/eslint-plugin@^8.60.0 @typescript-eslint/parser@^8.60.0 @vitest/coverage-v8@^4.1.7 vitest@^4.1.7 prettier@^3.8.3` and `yarn add cbor-x@^1.6.4`.
2. **Major attempts**:
   - TypeScript 6: `yarn add -D typescript@^6.0.3`, then `yarn typecheck`. Fix any new strict errors in `src/`.
   - ESLint 10: check `typescript-eslint` peer support first (`npm view typescript-eslint peerDependencies` / `eslint` range). If supported, `yarn add -D eslint@^10` + `typescript-eslint@latest`; else hold at `eslint@^9.39.4` and document in findings/CHANGELOG.
3. **Rewrite `eslint.config.js`** using the `typescript-eslint` meta-package (`tseslint.config(...)`):
   - Replace banned `@eslint/js` import.
   - Wire `tseslint.configs.recommended` so TS rules run.
   - Set `@typescript-eslint/no-unused-vars: 'error'` (align with tsconfig `noUnusedLocals`), keep test override.
   - Keep `no-console` rule; logger/util exceptions as needed (note: `console.ts` is slated for deletion in Phase 4).
4. **Lockfile hygiene:** ensure only `yarn.lock`; remove any `package-lock.json`/`pnpm-lock.yaml` if present.
5. **Verification gate:** `yarn typecheck && yarn lint && yarn test && yarn build` — all clean.
6. **Commit:** `chore(deps): update to latest stable + modernize eslint flat config (typescript-eslint)` + tracker update.

## Notes / risks

- If TS 6 emits many new errors, fix conservatively (prefer correctness over `// @ts-expect-error`).
- If a major must be held back, record the exact reason (peer range) in CHANGELOG + findings.
- `noExternal: ['cbor-x']` means cbor-x is bundled; keep it a runtime `dependency`.

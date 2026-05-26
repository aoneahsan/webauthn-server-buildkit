# Phase 01 — Dependency verification & toolchain

**Goal:** Confirm every dependency is at the latest stable version (no pre-release/alpha), refresh the lockfile if drifted, and confirm the toolchain (ESLint 10 + TypeScript 6 + tsup + Vitest 4) is intact. Dependencies were already brought to latest during the v2.2.0 polish today, so this is verify-and-confirm, not bumps.

## Findings addressed

- (none new) — dependency hygiene per the user's first requirement.

## Baseline (2026-05-26)

All at latest stable: `cbor-x@1.6.4`, `@types/node@25.9.1`, `@vitest/coverage-v8@4.1.7`, `eslint@10.4.0`, `eslint-config-prettier@10.1.8`, `eslint-plugin-prettier@5.5.5`, `prettier@3.8.3`, `tsup@8.5.1`, `typescript@6.0.3`, `typescript-eslint@8.60.0`, `vitest@4.1.7`.

## Steps

1. `npm view <pkg> version` for all 11 deps; confirm each `package.json` spec `^x.y.z` resolves to the latest stable. (Done in Phase 0 — all current.)
2. `yarn install` to confirm `yarn.lock` resolves cleanly; check for drift.
3. Confirm no banned deps: `@capacitor-firebase/crashlytics|performance`, `@eslint/js`. Confirm only `cbor-x` is a production dependency.
4. Confirm `engines.node >= 24.13.0` and `packageManager: yarn@4.14.1` intact.
5. If any dep had a newer stable, bump spec, reinstall, and run the gate; fix any fallout (deprecations/type errors).

## Deliverables

- `package.json` + `yarn.lock` confirmed current.

## Verification gate

`yarn typecheck` · `yarn lint` · `yarn test` · `yarn build` · `yarn format:check` — all clean.

## Commit

Phase 0 (scaffolding) + Phase 1 committed together as the first green checkpoint, tracker + progress updated.

## Run log

| Date | What happened | Result |
| ---- | ------------- | ------ |
|      |               |        |

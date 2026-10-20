# Package inventory — webauthn-server-buildkit

The fleet-standard dependency inventory (`~/.claude/rules/fleet-tasks.md`). Keep it accurate on **every**
add, remove or upgrade.

**Last Updated:** 2026-10-20 · **Manifest units:** 1 (`package.json` at the repo root — no workspaces, no
nested manifest) · **Package manager:** yarn (local) · **Node:** `>=24.13.0` (`.nvmrc` = `24.13.0`)

---

## Runtime dependencies

| Package  | Range    | Used by                                                                           | Notes                                                                                                                                                                                                                                |
| -------- | -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cbor-x` | `^1.6.4` | `src/crypto/cbor.ts` — decoding attestation objects, COSE keys and extension maps | Configured with `mapsAsObjects: false` so CBOR maps decode to `Map`, which COSE integer keys require. **Bundled into `dist` by `tsup` (`noExternal`)** — see the open issue below about it also being a declared runtime dependency. |

No other runtime dependencies. The library uses Node's built-in `crypto` for every signature, hash, HKDF
derivation and AES-256-GCM operation, and Node's `X509Certificate` for chain work.

## Dev dependencies

| Package                  | Range     | Purpose                                                                                                                                                              |
| ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`             | `^6.0.3`  | Compiler. Pinned to the 6.x line — TypeScript 7 removes the JS compiler API that `typescript-eslint` depends on (`~/.claude/rules/package-version-known-issues.md`). |
| `tsup`                   | `^8.5.1`  | Build. Emits ESM + CJS + `.d.ts`/`.d.cts` from `src/index.ts`.                                                                                                       |
| `eslint`                 | `^10.4.1` | Lint runner.                                                                                                                                                         |
| `typescript-eslint`      | `^8.60.1` | TS lint rules. **Never `@eslint/js`** (broken versioning — house rule).                                                                                              |
| `eslint-config-prettier` | `^10.1.8` | Disables lint rules that fight the formatter.                                                                                                                        |
| `eslint-plugin-prettier` | `^5.5.6`  | Runs Prettier as a lint rule.                                                                                                                                        |
| `prettier`               | `^3.8.3`  | Formatter.                                                                                                                                                           |
| `@types/node`            | `^25.9.2` | Node type definitions.                                                                                                                                               |

## Intentional pins and constraints

| Constraint                             | Reason                                                                                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript` on `^6.0.3`, not 7.x      | TS 7 (the native Go port) ships no JS compiler API; `typescript-eslint` peers cap at `<6.1.0` and its parser crashes on TS 7. Global ledger: `~/.claude/rules/package-version-known-issues.md`. |
| `engines.node >= 24.13.0`              | Matches `.nvmrc` and the CI matrix. Excludes Node 20 and 22 LTS — an unusually high floor for a library; raising or lowering it is a **major** version decision.                                |
| `cbor-x` bundled via `noExternal`      | Keeps the install to a single import graph and avoids version skew in the CBOR layer, which is security-relevant.                                                                               |
| `sourcemap: false` in `tsup.config.ts` | Published output ships without source maps (`~/.claude/rules/build-test-quality.md`). Do not re-enable.                                                                                         |

## Packages removed

| Package                         | Removed                | Why                                                                                                                                               |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest`, `@vitest/coverage-v8` | 2026-06-02 (`f8fe54e`) | Automated-testing infrastructure removed along with the 311-test suite. See the open issue below — this is a material gap for a security library. |
| `cypress`                       | 2026-06-02 (`f8fe54e`) | Same removal.                                                                                                                                     |

## Published surface

|                             |                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `files` allowlist           | `dist`, `AI-INTEGRATION-GUIDE.md`, `CHANGELOG.md`, `SECURITY.md` (+ npm's automatic `README.md`, `LICENSE`, `package.json`)             |
| Denylist                    | **None.** `.npmignore` was deleted 2026-07-25 — the allowlist is the single source. Never reintroduce one.                              |
| Entry points                | `.` only, plus `./package.json`. ESM `dist/index.js`, CJS `dist/index.cjs`, types `dist/index.d.ts` / `dist/index.d.cts` per condition. |
| Manifests sharing this name | 1. Verified after a build — `tsup` writes no `dist/package.json`.                                                                       |

## Verification

```bash
yarn typecheck && yarn lint && yarn build
npm pack --dry-run                     # inspect the tarball contents
```

There is **no `test` script** — see `docs/REPORTED-ISSUES.md`.

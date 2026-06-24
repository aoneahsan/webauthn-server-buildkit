# AGENTS.md - WebAuthn Server Buildkit

> AI agent instructions for the server-side WebAuthn package.

**Last Updated:** 2026-06-08

## Task Speed Over Docs (IRON-SOLID — BEHAVIORAL)

Finish the real task fast + correctly FIRST; docs/trackers/sync are a footnote (≤~20% of effort) — never let recording outpace the fix. HARD STOP when doc work outpaces the change → ship, then ONE line if anything. No new summary/status/completion files unless asked; edit/delete over add; delete stale docs. Full rule: `~/.claude/CLAUDE.md`. (Est. 2026-06-19)

## Gitignore Hygiene (IRON-SOLID)
`.gitignore` stays current with the project structure — ignore only recoverable artifacts (build/`dist`/`www`/`node_modules`/logs/caches/IDE), never lose source. Custom rules always present: `*.ignore.*`, `project-record-ignore/`. This is a **PRIVATE** repo -> `.env`/secrets/keystores ARE tracked in git.
Full rule + private/public protocol: `~/.claude/rules/project-config.md`.
Gitignore Last Verified: 2026-06-24

## Project Overview

`webauthn-server-buildkit` is a TypeScript package for secure, framework-independent WebAuthn server workflows. It pairs with `capacitor-biometric-authentication` but works in any Node.js backend. This package is custom-built; do not describe it as a thin wrapper around another server library.

## Global Standards (pointers — never copy content here)

These global rules apply; read them at their canonical locations rather than duplicating them in this repo:

- **Generic master project rules:** `/home/ahsan/Documents/ahsan-notebook/static/assets/txt-files-important/generic-project-rules.md` (43 tagged rules). Priority order: RULE #0 (invoke matching skills before any edit) → master rules → this file.
- **Centralized logger rule:** route any log output through one `logger` utility — never `console.*` directly. Full rule in `~/.claude/CLAUDE.md`. (This is a backend library; consumers pass their own `logger`, and the package keeps logging behind its `debug`/`logger` config.)
- **No automated tests unless explicitly requested:** do not add/expand test files; running existing build/typecheck/lint as a gate is fine. Full rule in `~/.claude/CLAUDE.md`. (This package currently ships no test runner — testing infra was removed portfolio-wide; quality = typecheck + build + lint.)
- **Store rejection rules + history:** global-only references at `~/.claude/play-console-rejection-rules.json` and `~/.claude/chrome-web-store-rejection-rules.json` (N/A for this npm library — there is no app/extension store artifact; npm publishing checklist below applies instead).
- **Dependency upgrades:** use `npx -y npm-check-updates -u && yarn install` (latest STABLE), not `yarn upgrade --latest`. For this published package, hold back any major that would raise `engines.node` past what consumers can run.

## Current Verified State

- Package version: `2.3.0`
- Build: `tsup` for ESM, CommonJS, and DTS output generation
- Node.js engine requirement: `>=24.13.0`
- Toolchain: TypeScript 6, ESLint 10 (typescript-eslint flat config), Prettier 3
- Primary production dependency: `cbor-x` (zero new runtime deps in 2.3.0)

### Security posture (as of v2.3.0)

- Signature verification imports COSE keys via JWK; RSA, P-521 (ES512) and Ed25519 verify correctly.
- COSE key byte-length validation + `alg`↔`crv` consistency check (blocks digest/padding substitution; `COSE_ALG_MISMATCH`).
- Algorithm pinning at **authentication**: `supportedAlgorithms` allowlist enforced at both registration and auth; `credential.alg` pinned when set (`ALGORITHM_MISMATCH`).
- Stored challenge consumed once (single-use / expiry / operation) when a storage adapter is configured (`enforceChallengeStore`, default `true`).
- Cross-origin iframe ceremonies rejected by default (`allowCrossOriginIframe`).
- `userHandle` validated against `credential.webAuthnUserID` (`USER_HANDLE_MISMATCH`); `createRegistrationOptions` returns `webAuthnUserId`.
- Session tokens: HKDF-SHA256 KDF + 12-byte GCM IV + iv/tag/salt length validation.
- Constant-time RP-ID-hash comparison; timing-safe attestation nonce + buffer comparisons.
- Full per-format attestation verification (apple, fido-u2f, packed-x5c, android-key, tpm, android-safetynet) with **honest framing**: `attestationVerified: true` only when trust-anchored — apple via the bundled Apple WebAuthn Root CA, others via an RP-supplied `MetadataService` (FIDO MDS). android-safetynet is deprecated by Google; docs recommend Play Integrity. No CRL/OCSP (offline). TPM AIK SAN + android-key Keymaster authz-list not additionally asserted; the security-critical bindings are.
- Mobile JSON attestation is **opt-in** (`enableMobileAttestation`, default `false`).
- Error classes + COSE enums are runtime value exports; typed `WebAuthnErrorCode` open union + documented `statusCode` (400/401/500).
- Active v2.3.0 audit/fix tracker: `docs/features/package-polish-v2.3.0/00-tracker.json`.

## Architecture

- `src/authentication/` -- authentication option generation and verification flows
- `src/registration/` -- registration option generation and verification flows
- `src/session/` -- encrypted session token creation and validation
- `src/crypto/` -- CBOR, COSE, challenge generation, and signature verification
- `src/adapters/` -- storage adapter abstractions and built-in memory adapter

## Agent Responsibilities

| Agent           | Role                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| **Claude Code** | Primary implementation. Writes code, runs checks, updates docs.          |
| **Codex**       | Reviews, provides specs. Does NOT implement unless explicitly requested. |

## Critical Verification Rule

After making changes to this package:

1. Run `yarn build` to verify the build succeeds.
2. Run `yarn lint` and `yarn typecheck` for code quality.
3. Re-verify any local consumer (frontend-test-app, backend-test-app) only after the package build succeeds.

## Critical Instruction Sync Rule

- Any important development rule added to `CLAUDE.md` or `AGENTS.md` for this package must be added to both files in the same update pass.
- If one instruction file is missing, create it before finishing the task so package guidance stays mirrored.
- Keep this package-level rule aligned with the monorepo root instruction files.
- When user asks to add a rule to "just one" file, ALWAYS add to BOTH regardless.

## File Freshness Rule

- CLAUDE.md and AGENTS.md MUST be reviewed and updated at least once every 3 days.
- On every Claude Code session start, check "Last Updated" dates in both files.
- If either file is older than 3 days, update it immediately before doing other work.
- Update the "Last Updated" field at the top of each file whenever content changes.

## Claude Code Agent Rule

- For every prompt or task in this package, use an agent-first Claude Code workflow to provide the best development experience possible.
- Claude Code agents should be the default path for exploration, planning, refactors, implementation, reviews, and other systematic work.
- Treat direct manual execution as the exception for only genuinely trivial tasks.

## Package Manager Hierarchy: nvm → npm (global) → yarn (local) (IRON-SOLID)

Three tiers, each tool ONLY for its tier — for the best, most reproducible dev results:
- **`nvm`** → install/update Node.js (which bundles `npm`): `nvm install --lts`. Use nvm to get/update `npm` itself.
- **`npm`** → ALL global packages: `npm install -g yarn` (install yarn globally if missing) + `npm install -g <pkg>` (every other global CLI).
- **`yarn`** → ALL local project work: `yarn`, `yarn add <pkg>`, `yarn add -D <pkg>` inside the project.

❌ NEVER use `npm`/`pnpm` for LOCAL installs. NEVER use `pnpm` at all. ✅ Only `yarn.lock` in the project — delete `package-lock.json` and `pnpm-lock.yaml`.

## Command Surface

```bash
yarn build          # Build ESM, CJS, and DTS via tsup
yarn dev            # Watch mode for development
yarn lint           # Lint source files
yarn typecheck      # TypeScript type checking
yarn format         # Format source files
```

## Cross-Project Impact Verification

- After changes to this package, check whether `frontend-test-app` or `backend-test-app` depend on the changed APIs.
- If they do, rebuild those consumers and verify they still work before considering the task complete.
- When changing exported types or public API surface, update `Readme.md` and `docs/api-reference.md` in the same pass.

## NPM Publishing Checklist

1. Verify build, lint, and typecheck all pass.
2. Update version in `package.json`.
3. Update changelog and `Readme.md` if needed.
4. Run `yarn build` (production build).
5. Run `npm publish` to publish.
6. Verify on npmjs.com that the new version is live.

## Working Rules

- Preserve framework independence and type safety.
- Re-verify docs when exported behavior changes.
- Use release checks before publish-oriented work.
- Run build, lint, and typecheck before release-oriented changes.
- Audit records and package update history are maintained in `docs/audit-records.md`.
- Portfolio file maintenance rules are documented in `docs/portfolio-maintenance.md`.

## Important Notes

- This package is custom-built; do not describe it as a thin wrapper around another server library.
- Current engine requirement in `package.json`: Node.js `>=24.13.0`.
- Primary production dependency: `cbor-x`.

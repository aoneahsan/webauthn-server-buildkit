# CLAUDE.md

Guidance for Claude Code when working with `webauthn-server-buildkit`.

**Last Updated:** 2026-04-03

## Project Overview

`webauthn-server-buildkit` is a TypeScript WebAuthn server package focused on secure, framework-independent backend biometric authentication. It pairs naturally with `capacitor-biometric-authentication` but remains usable in any Node.js backend stack. This package is custom-built; do not describe it as a thin wrapper around another server library.

## Current Verified State

- Package version: `2.1.0`
- Tests: 131 tests passing (Vitest)
- Build: `tsup` for ESM, CommonJS, and DTS output generation
- Node.js engine requirement: `>=24.13.0`
- Primary production dependency: `cbor-x`

## Architecture

- `src/authentication/` -- authentication option generation and verification flows
- `src/registration/` -- registration option generation and verification flows
- `src/session/` -- encrypted session token creation and validation
- `src/crypto/` -- CBOR, COSE, challenge generation, and signature verification
- `src/adapters/` -- storage adapter abstractions and built-in memory adapter
- `tests/` -- Vitest coverage for adapters, crypto, session, registration, and authentication flows

## Critical Verification Rule

After making changes to this package:
1. Run `yarn build` to verify the build succeeds.
2. Run `yarn test` to verify all 131 tests pass.
3. Run `yarn lint` and `yarn typecheck` for code quality.
4. Re-verify any local consumer (frontend-test-app, backend-test-app) only after the package build succeeds.

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

## Package Manager Policy

- Use `yarn` for all project-local dependency installation, dependency updates, script execution, and publish preparation in this package.
- Use `pnpm` for all global package installation on the system.
- Use `npm` only to install or update `pnpm` globally when `pnpm` is missing or needs an update.
- If `yarn` is missing globally, install it with `pnpm`, not `npm`.
- Keep `yarn.lock` and remove other lockfiles such as `package-lock.json`, `pnpm-lock.yaml`, and `npm-shrinkwrap.json`.

## Commands

```bash
yarn build          # Build ESM, CJS, and DTS via tsup
yarn dev            # Watch mode for development
yarn test           # Run all Vitest tests
yarn lint           # Lint source files
yarn typecheck      # TypeScript type checking
yarn format         # Format source files
```

## Cross-Project Impact Verification

- After changes to this package, check whether `frontend-test-app` or `backend-test-app` depend on the changed APIs.
- If they do, rebuild those consumers and verify they still work before considering the task complete.
- When changing exported types or public API surface, update `Readme.md` and `docs/api-reference.md` in the same pass.

## NPM Publishing Checklist

1. Verify build, tests, lint, and typecheck all pass.
2. Update version in `package.json`.
3. Update changelog and `Readme.md` if needed.
4. Run `yarn build` (production build).
5. Run `npm publish` to publish.
6. Verify on npmjs.com that the new version is live.

## Working Rules

- Keep `Readme.md` and package docs aligned with verified behavior when public APIs change.
- Run build, tests, lint, and typecheck before release-oriented changes.
- Preserve framework-independent, type-safe WebAuthn behavior.
- Audit records and package update history are maintained in `docs/audit-records.md`.
- Portfolio file maintenance rules are documented in `docs/portfolio-maintenance.md`.

## Important Notes

- This package is custom-built; do not describe it as a thin wrapper around another server library.
- Current engine requirement in `package.json`: Node.js `>=24.13.0`.
- Primary production dependency: `cbor-x`.

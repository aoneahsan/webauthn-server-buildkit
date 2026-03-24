# CLAUDE.md

This file provides guidance for working in the `webauthn-server-buildkit` repository.

## Critical Verification Rule

After making changes to this package:

1. Run `npm run build`
2. Re-verify any local consumer only after the package build succeeds

## Project Overview

`webauthn-server-buildkit` is a TypeScript WebAuthn server package focused on secure, framework-independent backend biometric authentication. It is designed to pair naturally with `capacitor-biometric-authentication`, but it remains usable in any Node.js backend stack.

## Current Verified State

- Reviewed on: `2026-03-24`
- Package version: `2.1.0`
- Tests: `npm test` passed with 131 tests
- Build: `npm run build` passed
- Package uses `tsup` for ESM, CommonJS, and DTS output generation

## Commands

```bash
npm run build
npm run dev
npm test
npm run test:coverage
npm run lint
npm run lint:fix
npm run typecheck
npm run format
npm run format:check
```

## Architecture

- `src/authentication/`: authentication option generation and verification flows
- `src/registration/`: registration option generation and verification flows
- `src/session/`: encrypted session token creation and validation
- `src/crypto/`: CBOR, COSE, challenge generation, and signature verification
- `src/adapters/`: storage adapter abstractions and built-in memory adapter
- `tests/`: Vitest coverage for adapters, crypto, session, registration, and authentication flows

## Working Rules

- Keep documentation aligned with the verified package state and version.
- Default to `npm` commands in docs because they were verified during this refresh pass.
- Do not claim a currently active `yarn link` relationship unless it has been rechecked.
- When refreshing package-level info, update `Readme.md`, `.claude/CLAUDE.md`, and the dated portfolio file in the same pass.

## Portfolio File Maintenance Rule

- Maintain exactly one current root portfolio info file for this package.
- File naming format: `WEBAUTHN-SERVER-BUILDKIT_portfolio-info_YYYY-MM-DD.md`
- Refresh the portfolio file only after at least 7 days have passed unless a major release or material capability change happens sooner.
- Keep at most 10 update-history records inside the portfolio file.
- Whenever the portfolio file changes, update the root `Readme.md` in the same pass.

## Important Notes

- This package is custom-built; do not describe it as a thin wrapper around another server library.
- Current engine requirement in `package.json`: Node.js `>=24.13.0`
- Primary production dependency: `cbor-x`

## Package Update History

| Date | Updated By | Notes |
| --- | --- | --- |
| 2026-03-24 | Codex | Refreshed docs, verified tests/build, added portfolio maintenance rule |
| 2026-02-02 | Claude | Full update to latest versions, all checks passing |

## Comprehensive Audit Record

| Date | Audit Type | Status | Issues Found | Issues Resolved |
| --- | --- | --- | --- | --- |
| 2026-03-24 | Portfolio + Docs Refresh | Passed | 0 | 0 |
| 2026-02-02 | Package Update | Passed | 0 | 0 |
| 2026-01-23 | Full Audit | Passed | 0 | 0 |

### Last Audit Details

- Package Manager: npm scripts verified, yarn lockfile also present
- Dependencies: no dependency audit performed in this pass
- Build: passes
- Lint: not run in this pass
- TypeScript: DTS generation succeeded as part of build
- Tests: passes

### Next Audit Due: 2026-03-31

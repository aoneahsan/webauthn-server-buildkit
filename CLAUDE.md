# CLAUDE.md

Guidance for Claude Code when working with `webauthn-server-buildkit`.

**Last Updated:** 2026-06-05

## Project Overview

`webauthn-server-buildkit` is a TypeScript WebAuthn server package focused on secure, framework-independent backend biometric authentication. It pairs naturally with `capacitor-biometric-authentication` but remains usable in any Node.js backend stack. This package is custom-built; do not describe it as a thin wrapper around another server library.

## Current Verified State

- Package version: `2.3.0`
- Build: `tsup` for ESM, CommonJS, and DTS output generation
- Node.js engine requirement: `>=24.13.0`
- Toolchain: TypeScript 6, ESLint 10 (typescript-eslint flat config), Prettier 3
- Primary production dependency: `cbor-x` (zero new runtime deps added in 2.3.0)

### Security posture (as of v2.3.0)

- Signature verification imports COSE keys via JWK (`createPublicKey({ format: 'jwk' })`) — RSA, P-521 (ES512) and Ed25519 verify correctly.
- COSE key byte-length validation + `alg`↔`crv` consistency check (blocks digest/padding substitution; `COSE_ALG_MISMATCH`).
- Algorithm pinning at **authentication**: `supportedAlgorithms` allowlist enforced at both registration and auth; `credential.alg` pinned when set (`ALGORITHM_MISMATCH`).
- Stored challenge is consumed once (single-use / expiry / operation) when a storage adapter is configured (`enforceChallengeStore`, default `true`; new codes `CHALLENGE_NOT_FOUND` / `CHALLENGE_OPERATION_MISMATCH` / `CHALLENGE_EXPIRED`).
- Cross-origin iframe ceremonies rejected by default (`allowCrossOriginIframe`, default `false`; `CROSS_ORIGIN_NOT_ALLOWED`).
- `userHandle` validated against `credential.webAuthnUserID` (`USER_HANDLE_MISMATCH`) — usernameless flows are safe; `createRegistrationOptions` returns `webAuthnUserId`.
- Session tokens: HKDF-SHA256 KDF + 12-byte GCM IV + iv/tag/salt length validation.
- Constant-time RP-ID-hash comparison; timing-safe attestation nonce + buffer comparisons.
- Full per-format attestation verification (apple, fido-u2f, packed-x5c, android-key, tpm, android-safetynet) with **honest framing**: `attestationVerified: true` only when trust-anchored — apple via the bundled Apple WebAuthn Root CA, others via an RP-supplied `MetadataService` (FIDO MDS). android-safetynet is deprecated by Google; docs recommend Play Integrity. No CRL/OCSP (offline by design). TPM AIK SAN and android-key Keymaster authz-list are not additionally asserted (the security-critical bindings are).
- Mobile JSON attestation is **opt-in** (`enableMobileAttestation`, default `false`); the standard WebAuthn path runs by default.
- Error classes + COSE enums are exported as runtime values (`instanceof` / enum members work); typed `WebAuthnErrorCode` open union + documented `statusCode` (400/401/500).
- The active v2.3.0 audit/fix tracker lives at `docs/features/package-polish-v2.3.0/00-tracker.json`.

## Architecture

- `src/authentication/` -- authentication option generation and verification flows
- `src/registration/` -- registration option generation and verification flows
- `src/session/` -- encrypted session token creation and validation
- `src/crypto/` -- CBOR, COSE, challenge generation, and signature verification
- `src/adapters/` -- storage adapter abstractions and built-in memory adapter

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

- Keep `Readme.md` and package docs aligned with verified behavior when public APIs change.
- Run build, lint, and typecheck before release-oriented changes.
- Preserve framework-independent, type-safe WebAuthn behavior.
- Audit records and package update history are maintained in `docs/audit-records.md`.
- Portfolio file maintenance rules are documented in `docs/portfolio-maintenance.md`.

## Important Notes

- This package is custom-built; do not describe it as a thin wrapper around another server library.
- Current engine requirement in `package.json`: Node.js `>=24.13.0`.
- Primary production dependency: `cbor-x`.

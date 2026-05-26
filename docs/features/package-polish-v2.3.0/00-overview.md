# Package Polish v2.3.0 — Overview

**Package:** `webauthn-server-buildkit`
**From:** 2.2.0 → **Target:** 2.3.0 (minor)
**Created:** 2026-05-26
**Tracker (resume point):** `docs/features/package-polish-v2.3.0/00-tracker.json`
**Findings:** `docs/features/package-polish-v2.3.0/findings.md`
**Progress log:** `docs/features/package-polish-v2.3.0/progress.md`

## What & why

A second, deeper polish pass over the package: (1) verify all dependencies are at latest stable and fix any fallout, (2) run a full deep audit for security / correctness / completeness / hygiene issues, (3) fix everything found, one phase at a time, (4) close the feature gaps v2.2.0 explicitly deferred — most significantly **full attestation-statement verification with FIDO Metadata Service trust anchoring**, (5) refresh all documentation, and (6) release 2.3.0 to npm.

This is a large, multi-session effort (full attestation + FIDO MDS alone is comparable in size to what mainstream WebAuthn servers ship across many files). The whole task is **resumable**: re-running the originating prompt reads `00-tracker.json`, finds the first phase/sub-task that is `pending`/`in_progress`, reads that phase's `.md` file, and continues — never restarting from scratch.

## User decisions (captured 2026-05-26)

| Decision                  | Choice                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Attestation depth**     | **Full attestation + FIDO MDS** — all formats (apple, fido-u2f, packed-x5c, android-key, tpm, android-safetynet/Play Integrity), trust-anchored. Accepts multi-session scope; possibly one small ASN.1 dependency if in-house parsing proves infeasible.            |
| **Tests**                 | **Approved** — add regression tests for the security work + the currently-untested authentication path. Overrides the standing "no new tests unless asked" rule, scoped to this work only.                                                                          |
| **Compatibility posture** | **Secure-by-default** — new protections ON by default, documented as CHANGELOG upgrade notes (same approach v2.2.0 used for the session-token change). Provide config switches to restore legacy behavior where a default change could break existing integrations. |

## Scope

In scope (mapped to phases in the tracker):

- **Deps:** verify latest stable across all 11 deps (already current); refresh `yarn.lock`; keep ESLint 10 + TypeScript 6 toolchain.
- **Security:** challenge single-use/expiry/operation enforcement from storage; algorithm pinning (alg↔crv consistency + allowlist at auth + RSA padding); session-token field validation; stored-session expiry re-check.
- **Spec-compliance:** `userHandle` validation + return; return generated `webAuthnUserID`; `crossOrigin` rejection; COSE key length validation; trailing-byte rejection; BE/BS + UV downgrade signals; counter-support signal; origin handling incl. `android:apk-key-hash`; error routing by code.
- **Completeness:** parse + return `clientExtensionResults` (`credProps.rk`, modern `prf`/`largeBlob`); typed error-code union; `excludeCredentials` duplicate rejection support.
- **Attestation (the big one):** in-house minimal DER reader, Node `X509Certificate` chain verification, pluggable `MetadataService`/trust-anchor provider, bundled Apple WebAuthn Root CA, and per-format verification for all six formats with FIDO MDS.
- **Docs:** README, CHANGELOG (2.3.0 + upgrade notes), `docs/api-reference.md`, `docs/migration.md`, `AI-INTEGRATION-GUIDE.md`, `docs/audit-records.md`, and CLAUDE.md + AGENTS.md at every level (package root, `.claude/`, monorepo root, nested folders).
- **Release:** version bump, full verification gate, `npm pack --dry-run`, commit, push, `npm publish` (explicit user confirmation), verify live.

Out of scope:

- Rewriting the public `WebAuthnServer` API shape (additive changes only).
- Changing the storage-adapter contract beyond what challenge lifecycle requires (additive optional methods only).
- Frontend / consumer apps beyond verifying they still compile against the changed API surface.

## Acceptance criteria

- All audit findings in `findings.md` are fixed or explicitly documented as deferred with rationale.
- Full attestation verification implemented for all six formats with a pluggable FIDO MDS trust-anchor provider; honest framing retained where a trust anchor isn't supplied.
- `verifyAuthenticationResponse` has real round-trip + negative-path test coverage.
- Verification gate green at every committed phase: `yarn typecheck` (0), `yarn lint` (0), `yarn test` (all pass), `yarn build` (0 warnings), `yarn format:check` (clean).
- Documentation matches verified behavior; no overstated claims.
- `webauthn-server-buildkit@2.3.0` published and verified live on npm.

## Verification gate (every phase)

```
yarn typecheck   # 0 errors
yarn lint        # 0 errors/warnings
yarn test        # all pass
yarn build       # 0 warnings (ESM + CJS + DTS)
yarn format:check
```

## Commit policy

ONE commit per **completed + verified** phase (green checkpoint), with the tracker + progress update in the same commit. Push after each (authorized by project CLAUDE.md). This maximizes resumability for a multi-session task. `npm publish` requires explicit user confirmation at Phase 8.

## Known risks

- Full attestation + FIDO MDS is large; sequencing is apple → fido-u2f → packed-x5c → android-key → tpm → android-safetynet, simplest first, each independently committable.
- Secure-by-default behavior changes (challenge lifecycle, alg pinning at auth, crossOrigin) may require existing integrations to adjust — mitigated with config switches + documented upgrade notes.
- TPM and android-safetynet may need a vetted ASN.1/JWT dependency if in-house parsing is infeasible (user pre-approved one small dependency).
- android-safetynet is deprecated by Google (Play Integrity is the successor) — implement verification for completeness but recommend Play Integrity in docs.
- npm token: the documented global token was expired previously; publishing may need a fresh token + explicit `--userconfig`/`always-auth` (see project memory `npm-publish-token-expired`).

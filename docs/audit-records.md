# Audit Records - WebAuthn Server Buildkit

Records of package updates, audits, and verification history.

**Last Updated:** 2026-05-26

## Package Update History

| Date       | Updated By | Notes                                                                                |
| ---------- | ---------- | ------------------------------------------------------------------------------------ |
| 2026-05-26 | Claude     | v2.2.0 polish: deps→latest (ESLint 10, TS 6), full security/code audit + fixes, docs |
| 2026-03-24 | Codex      | Refreshed docs, verified tests/build, added portfolio maintenance rule               |
| 2026-02-02 | Claude     | Full update to latest versions, all checks passing                                   |

## Comprehensive Audit Record

| Date       | Audit Type               | Status | Issues Found | Issues Resolved |
| ---------- | ------------------------ | ------ | ------------ | --------------- |
| 2026-05-26 | Deep security + code     | Passed | 16           | 16              |
| 2026-03-24 | Portfolio + Docs Refresh | Passed | 0            | 0               |
| 2026-02-02 | Package Update           | Passed | 0            | 0               |
| 2026-01-23 | Full Audit               | Passed | 0            | 0               |

## Deep Audit Details (2026-05-26) — v2.1.0 → v2.2.0

Full record + resumable tracker: `docs/features/package-polish-v2.2.0/` (`findings.md`, `00-tracker.json`).

**Dependencies:** updated all to latest stable, including majors ESLint 9→10.4.0 and
TypeScript 5.9→6.0.3 (verified `typescript-eslint` 8.60.0 supports both); replaced the
banned `@eslint/js` + individual `@typescript-eslint/*` packages with the
`typescript-eslint` meta + flat config.

**Findings fixed (16):**

- SEC-1 (critical): mobile JSON attestation could bypass cryptographic verification → now opt-in (`enableMobileAttestation`, default off).
- SEC-2/SEC-3: RSA, ES512 (P-521) and Ed25519 signature verification were broken/fragile (hand-rolled ASN.1) → rewritten via JWK key import.
- SEC-4/SEC-5: session-token KDF (bare HMAC → HKDF-SHA256) and IV (16 → 12 bytes).
- SEC-7: counter parsing 32-bit overflow.
- SEC-8: non-constant-time RP-ID-hash comparison → `timingSafeEqual`.
- SEC-9: algorithm allowlist not enforced at registration → enforced.
- SEC-6: attestation statement ignored → `packed` self-attestation verified; `fmt`/`attestationVerified` surfaced; cert-chain formats reported (not trust-anchored).
- FUNC-1: `decodeCBORFirst` was a stub → real RFC 8949 implementation.
- FUNC-2: COSE public-key boundary swallowed extension bytes → bounded via `decodeCBORFirst`.
- API-1: error classes + COSE enums were `type`-only exports → now value exports.
- HYG-1/2/4/5/6 + CI-1: dead `console.ts` removed; `challenge.ts` typed error; `funding` field; stray root doc relocated; `substr`→`substring`; CI/publish Node 24.x + `yarn --immutable`.

**Verification:** `yarn typecheck`, `yarn lint`, `yarn format:check` clean; `yarn test`
166/166 passing (was 131; the prior crypto tests used dummy bytes and never verified a
real signature); `yarn build` (ESM + CJS + DTS) succeeds.

## Last Audit Details (2026-03-24)

- Package Manager: npm scripts verified, yarn lockfile also present
- Dependencies: no dependency audit performed in this pass
- Build: passes
- Lint: not run in this pass
- TypeScript: DTS generation succeeded as part of build
- Tests: passes (131 tests)

## Next Audit Due

2026-04-06 (3-day freshness cycle from 2026-04-03)

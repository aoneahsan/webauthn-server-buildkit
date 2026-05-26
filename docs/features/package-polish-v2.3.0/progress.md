# Progress — Package Polish v2.3.0

Running log. The authoritative resume state is `00-tracker.json` (find the first `pending`/`in_progress` sub-task). This file is the human-readable narrative.

**Target:** 2.2.0 → 2.3.0 · **Started:** 2026-05-26

## Status snapshot

- **Phase 0 — Planning & scaffolding:** ✅ complete
- **Phase 1 — Deps & toolchain:** ✅ complete (all deps already at latest stable)
- **Phase 2 — Critical security:** ✅ complete
- **Phase 3 — Spec-compliance & correctness:** ⏳ pending
- **Phase 4 — Extensions, API & hygiene:** ⏳ pending
- **Phase 5 — Attestation foundation:** ⏳ pending
- **Phase 6 — Attestation formats (+ FIDO MDS):** ⏳ pending
- **Phase 7 — Documentation refresh:** ⏳ pending
- **Phase 8 — Release v2.3.0:** ⏳ pending

## Log

### 2026-05-26 — Phase 0 (planning & scaffolding)

- Confirmed the v2.2.0 polish is complete and published (npm latest = 2.2.0). This run targets the next minor, **2.3.0**.
- Established green baseline: 166 tests pass; typecheck/lint/build clean; working tree clean.
- Verified all 11 dependencies are already at latest stable (refreshed during v2.2.0 earlier today) — Phase 1 is verify-only.
- Ran a fresh deep audit (general-purpose agent) and found NEW issues beyond v2.2.0's 16: SEC-N1 (stored challenge never validated → replay), SEC-N2/N3 (alg not pinned at auth), SEC-N4 (crossOrigin), SEC-N5/N6 (BE/BS + UV + counter signals), SEC-N7 (session-token field validation), FUNC-N1 (userHandle), FUNC-N2..N6, GAP-N1..N4, API-N1..N4, HYG-N1..N6. Full per-format attestation spec compiled. See `findings.md`.
- Confirmed 3 scope decisions with the user: **full attestation + FIDO MDS**, **tests approved**, **secure-by-default**.
- Invoked skills (RULE #0): security-review, security-best-practices, nodejs-best-practices, vitest.
- Scaffolded the resumable plan: `00-overview.md`, `findings.md`, `00-tracker.json`, `phase01..08`, this `progress.md`.
- **Next:** Phase 1 dependency verification, then commit Phase 0+1 as the first green checkpoint.

### 2026-05-26 — Phase 1 (dependency verification & toolchain)

- Confirmed all 11 dependencies are at latest stable on npm — no bumps needed (they were refreshed during the v2.2.0 polish earlier today).
- `yarn install --immutable` clean → no `yarn.lock` drift.
- No banned dependencies; only `cbor-x` in production; `engines.node >= 24.13.0` and `packageManager: yarn@4.14.1` intact.
- Formatted the new plan files with prettier so `yarn format:check` is repo-wide clean.
- Verification gate green (166 tests; typecheck/lint/build/format all clean).
- Committed Phase 0 + Phase 1 together as the first green checkpoint.
- **Next:** Phase 2 — critical security (challenge lifecycle, algorithm pinning at auth, session hardening) + the approved regression tests.

### 2026-05-26 — Phase 2 (critical security)

- **SEC-N1 (challenge replay):** `WebAuthnServer.verifyRegistration` / `verifyAuthentication` now validate the stored challenge (existence, operation, expiry) via a new `consumeChallengeFromStore()` and consume it once in a `finally` so it can never be replayed. Controlled by `enforceChallengeStore` (default `true` when a storage adapter is configured; set `false` to manage challenges yourself). New codes: `CHALLENGE_NOT_FOUND`, `CHALLENGE_OPERATION_MISMATCH`, `CHALLENGE_EXPIRED`.
- **SEC-N2/N3 (algorithm pinning):** `cose.ts` rejects a COSE `alg` inconsistent with the key's `kty`/`crv` (`COSE_ALG_MISMATCH`) — closes the P-256-declaring-ES512 and RSA-padding-swap vectors. The authentication path now enforces the `supportedAlgorithms` allowlist (not just registration) and pins `credential.alg` when set (`ALGORITHM_MISMATCH`). `WebAuthnCredential.alg` + `VerifiedRegistrationInfo.credential.alg` added; registration returns the algorithm.
- **SEC-N7:** session-token `iv`/`tag`/`salt` length validation before the cipher primitives.
- **HYG-N3:** stored-session expiry re-checked after adapter fetch (defense-in-depth; the bundled memory adapter already filters in `find()`).
- **Tests (+20 → 186):** new `tests/authentication/verify-response.test.ts` (round-trip + every negative path + alg pinning + challenge lifecycle), `tests/session/manager.test.ts`, and session-token field-validation tests.
- Gate green: typecheck/lint/test (186)/build/format all clean. Committed + pushed.
- **Next:** Phase 3 — spec-compliance & correctness (userHandle/webAuthnUserID, crossOrigin, COSE length validation, downgrade signals, origin handling).

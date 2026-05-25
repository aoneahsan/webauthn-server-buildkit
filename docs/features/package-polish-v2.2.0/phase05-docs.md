# Phase 05 — Documentation Refresh

**Goal:** Every doc reflects v2.2.0 behaviour, the new config, and the security posture.

**Skills:** `documentation-writer`, `technical-writing`, `copywriting` (tone), `api-documentation`.

## Steps

1. **`Readme.md`** — update: version, config table (add `enableMobileAttestation`, default off + warning), supported algorithms (note ES256/384/512, RS256/384/512, PS\*, Ed25519 now genuinely verified), attestation support (none/packed/fido-u2f; others flagged), error handling section (errors are value exports — show `instanceof`), session security note (HKDF, ephemeral), challenge-lifecycle responsibility (SEC-10).
2. **`CHANGELOG.md`** — add `## [2.2.0] - 2026-05-26`:
   - Dependencies updated (list majors taken / held).
   - Security: fixed RSA/ES512/Ed25519 verification; mobile attestation now opt-in (default off) — **behaviour change**; HKDF session keys + 12-byte IV — **existing session tokens invalidated, users re-authenticate once**; constant-time compares; algorithm allowlist; packed/fido-u2f attestation.
   - Fixes: decodeCBORFirst, counter overflow, COSE key boundary, error classes now value exports.
3. **`docs/api-reference.md`** — sync new config field, error-import guidance, attestation result shape.
4. **`docs/migration.md`** — add a "2.1 → 2.2" section (session invalidation, mobile-attestation opt-in, error import change if anyone relied on type-only).
5. **`AI-INTEGRATION-GUIDE.md`** — align config + security notes (it's shipped in `files`).
6. **`docs/audit-records.md`** — append the 2026-05-26 audit summary + resolutions (link to this feature folder).
7. **CLAUDE.md / AGENTS.md sync** (IRON-SOLID — update BOTH at each level, bump `Last Updated`):
   - Package root `CLAUDE.md` + `AGENTS.md`: bump verified state (version 2.2.0, dep set, security posture), `Last Updated: 2026-05-26`.
   - `.claude/CLAUDE.md` (+ create `.claude/AGENTS.md` if missing to satisfy the mirror rule).
   - Monorepo root `../CLAUDE.md` + `../AGENTS.md`: bump webauthn-server-buildkit line to 2.2.0.
8. **Verification gate + commit:** `docs: refresh README/CHANGELOG/api-reference/migration + sync CLAUDE/AGENTS for v2.2.0`.

## Acceptance

- No doc references stale behaviour; CHANGELOG has the 2.2.0 entry; CLAUDE.md/AGENTS.md synced + dated.

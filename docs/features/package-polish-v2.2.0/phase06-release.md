# Phase 06 — Release v2.2.0

**Goal:** Ship 2.2.0 to npm cleanly, after explicit user go-ahead.

**Skills:** `release`, `git-commit`.

## Steps

1. **Bump version** in `package.json` → `2.2.0`. (`VERSION` export is injected at build from package.json via tsup `define`, so no separate constant to edit. Confirm.)
2. **Final verification gate (all must be clean):**
   - `yarn typecheck`
   - `yarn lint`
   - `yarn test` (incl. new round-trip tests)
   - `yarn build` (0 warnings)
   - `npm pack --dry-run` → review the published file list (`dist` + `AI-INTEGRATION-GUIDE.md` only; no stray files).
3. **Commit release:** `chore(release): webauthn-server-buildkit v2.2.0` (include final tracker update marking phases complete).
4. **Push** to `origin main` (authorized by project CLAUDE.md). Resolve via rebase if remote diverged.
5. **Publish — REQUIRES EXPLICIT USER CONFIRMATION (`awaitingUser: true`).** Do NOT run `npm publish` autonomously. When the user says go:
   - Confirm `npm whoami` → `aoneahsan`.
   - `npm publish` (public).
   - Verify the new version is live on npmjs.com and `npm view webauthn-server-buildkit version` → `2.2.0`.
6. **Cross-project check:** per monorepo rule, confirm `frontend-test-app` / `backend-test-app` (if they consume changed APIs) still build. Note the session-token-format change and mobile-attestation default for any consumer.
7. **Report back** to the user: what shipped, the behaviour changes, and live npm confirmation.

## Acceptance

- 2.2.0 tagged in package.json, committed, pushed.
- Published + verified live (after user go-ahead).
- Tracker fully `complete`; runHistory final row added.

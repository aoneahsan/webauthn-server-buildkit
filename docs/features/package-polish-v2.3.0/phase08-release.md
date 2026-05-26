# Phase 08 — Release v2.3.0

**Goal:** Ship `webauthn-server-buildkit@2.3.0` to npm.

## Steps

1. **Bump version** — `package.json` `version` → `2.3.0`. The `VERSION` export is injected at build from package.json; confirm built output reports `2.3.0`.
2. **Final verification gate** — `yarn typecheck` · `yarn lint` · `yarn test` (all pass) · `yarn build` (0 warnings, ESM+CJS+DTS) · `yarn format:check`.
3. **`npm pack --dry-run`** — review the file list (dist + Readme + AI-INTEGRATION-GUIDE + LICENSE + package.json); confirm no stray files, no source, no `docs/features`.
4. **Cross-project check** — confirm `frontend-test-app` / `backend-test-app` still compile against the changed API surface (only if they consume changed APIs).
5. **Commit release** — single release commit; **push** to origin main (authorized by project CLAUDE.md).
6. **npm publish** — REQUIRES explicit user go-ahead (`awaitingUser: true`). The documented global token may be expired; if so, ask the user for a fresh token and publish with an explicit temp `--userconfig` containing the token + `always-auth` (token in `/tmp`, never committed, removed after) — per memory `npm-publish-token-expired`.
7. **Verify live** — `npm view webauthn-server-buildkit version` == `2.3.0`; `dist-tags.latest` == `2.3.0`.

## Verification gate

Full gate green + `npm pack --dry-run` clean + live npm version confirmed.

## Commit

Release commit (version bump + final tracker/progress). Push. Then publish (after user confirmation) and finalize tracker `status: COMPLETE`.

## Run log

| Date | What happened | Result |
| ---- | ------------- | ------ |
|      |               |        |

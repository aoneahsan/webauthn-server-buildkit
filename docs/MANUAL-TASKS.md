# Manual / User-Only Tasks — webauthn-server-buildkit

> The ONE place for everything only you (the human) can do. Fixed path: `docs/MANUAL-TASKS.md`.
> Global spec: `~/.claude/rules/manual-tasks.md`. Last updated: 2026-06-24

This is a framework-independent TypeScript WebAuthn/FIDO2 **server library** published to npm —
there is no app/store artifact, no keystore, and no `.env`/secrets in the repo. The agent finished
all automatable work (verification gates, format hygiene, and a full public documentation site).
What remains needs your credentials, a real device, or an irreversible publish/deploy.

## ⏳ Pending manual tasks

| #   | Task                                                         | Why only you                                                                                                                        | Detailed runbook                                                                                                         | Status                                 |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| 1   | `npm publish` a new version (only when a new version is cut) | Needs your npm auth token; publishing is an irreversible registry action                                                            | `CLAUDE.md` → "NPM Publishing Checklist". Current `2.3.0` is green and already published — nothing to publish right now. | ☐ Not started (no new version pending) |
| 2   | Deploy the docs site to **Firebase Hosting**                 | Needs Firebase project access (`firebase login` + a hosting site named `webauthn-server-buildkit-docs`)                             | docs repo `README.md` / `DEPLOY` → `yarn build && npx firebase-tools deploy --only hosting`                              | ☐ Not started                          |
| 3   | Enable **GitHub Pages** for the docs repo + point DNS        | Repo Settings → Pages toggle + DNS CNAME for `webauthn-server-buildkit-docs.aoneahsan.com` are account/registrar actions            | docs repo `.github/workflows/deploy.yml` (already written; runs on push to `main`) + `static/CNAME`                      | ☐ Not started                          |
| 4   | Live-device WebAuthn round-trip verification                 | Needs a real browser + platform/roaming authenticator (Touch ID / Windows Hello / security key); cannot run a server or device here | `examples/express/` + `docs/troubleshooting.md`                                                                          | ☐ Not started                          |

## ✅ Completed manual tasks

(none yet — move rows here with the date once done)

---

### Done by the agent on 2026-06-24 (for reference — no action needed)

- Verified all quality gates green: `yarn typecheck`, `yarn lint`, `yarn build` (ESM + CJS + DTS), `yarn format:check`.
- Confirmed zero functional/source gaps (mature, already-published v2.3.0; full per-format attestation verification).
- Fixed `format:check` hygiene (CLAUDE.md / AGENTS.md / eslint.config.js).
- Created a NEW **public** Docusaurus 3 documentation site repo `aoneahsan/webauthn-server-buildkit-docs`
  documenting the full real API, with the SEO floor (robots.txt AI-bot allowlist, sitemap, llms.txt,
  JSON-LD) and dual-hosting config (Firebase + GitHub Pages). Build is clean. **Deploy is task #2/#3 above.**

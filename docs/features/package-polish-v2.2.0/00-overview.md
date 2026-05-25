# webauthn-server-buildkit — v2.2.0 Polish, Audit & Release

> **For Claude:** This is a resumable, multi-phase task. The single source of resume truth is `00-tracker.json` in this folder. On any re-run of the originating prompt: read the tracker, find the first `pending`/`in_progress` sub-task, read its phase file, invoke matching skills (RULE #0), continue. NEVER restart from scratch.

**Goal:** Update all dependencies to the latest stable versions, fix every issue introduced by those updates, run a full deep code audit (functionality, security, incomplete-feature gaps), fix all findings one-by-one, refresh all documentation, and release as a **minor** version bump (`2.1.0 → 2.2.0`) to npm.

**Package:** `webauthn-server-buildkit` — a framework-independent TypeScript WebAuthn **server** library (registration/authentication option generation + verification, encrypted session tokens, pluggable storage adapters, CBOR/COSE crypto). Custom-built (not a wrapper). Engine: Node `>=24.13.0`. Sole runtime dep: `cbor-x` (bundled by tsup).

---

## Originating user prompt (summary)

1. Update package dependencies to the **latest stable** versions (major/minor/patch — what `yarn add <pkg>` resolves to on npm `latest`, not pre-release/alpha).
2. Fix any deprecations / breakages caused by the updates.
3. Do a **full deep code-base audit**: functionality issues, security issues, incomplete-feature gaps, and any other issues.
4. Create a solid plan and fix **all** findings one-by-one, as best as possible.
5. Bump the version (a **minor** update → 2.2.0) and **release on npm**, then report back.
6. Fully update documentation: README, CHANGELOG, package docs, `CLAUDE.md`/`AGENTS.md` at all levels.
7. **Resumability is mandatory**: persist the plan as markdown files + a JSON tracker so re-running the prompt continues from where it left off (never redo completed work).

---

## User decisions (confirmed 2026-05-26)

| Topic                            | Decision                                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mobile attestation bypass**    | Make it **opt-in** via a new `enableMobileAttestation` config flag (**default `false`**). When disabled, only the standard WebAuthn path runs (closes the bypass for everyone by default). When enabled, keep behaviour but emit loud warnings and document that it provides **no** cryptographic attestation guarantee. |
| **Crypto tests**                 | **Approved** to add real round-trip regression tests (generate genuine key pairs, sign, verify). This explicitly overrides the standing "no new tests unless asked" rule, scoped to this security work.                                                                                                                  |
| **Versioning**                   | **Minor `2.2.0`**. Document in CHANGELOG that existing **session tokens are invalidated** on upgrade (one-time re-auth) and that the mobile-attestation default changed.                                                                                                                                                 |
| **Major deps (ESLint 10, TS 6)** | Attempt both; verify the toolchain works together; pin back only if the plugin ecosystem can't support them yet, documenting the reason.                                                                                                                                                                                 |

---

## Acceptance criteria

- [ ] All deps at latest stable that work together; `yarn.lock` updated; lockfile hygiene (yarn only).
- [ ] Every finding in `findings.md` is either fixed or explicitly documented as a scoped future item with rationale.
- [ ] Signature verification proven correct for ES256/384/512, RS256/PS256, Ed25519 via round-trip tests.
- [ ] Mobile-attestation path is opt-in (default off); secure path cannot be silently bypassed.
- [ ] Error classes are importable as values (`instanceof` works for consumers).
- [ ] `yarn typecheck && yarn lint && yarn test && yarn build` all clean (0 errors/warnings).
- [ ] README, CHANGELOG, docs, CLAUDE.md/AGENTS.md (all levels) updated and synced.
- [ ] Version bumped to 2.2.0; package published to npm (after explicit user go-ahead) and verified live.

---

## Phase map

| Phase | Title                                         | File                      |
| ----- | --------------------------------------------- | ------------------------- |
| 00    | Planning & resumable scaffolding              | this folder               |
| 01    | Dependency updates & toolchain modernization  | `phase01-dependencies.md` |
| 02    | Crypto correctness fixes (+ round-trip tests) | `phase02-crypto.md`       |
| 03    | Security hardening                            | `phase03-security.md`     |
| 04    | API correctness & code hygiene                | `phase04-api-hygiene.md`  |
| 05    | Documentation refresh                         | `phase05-docs.md`         |
| 06    | Release v2.2.0                                | `phase06-release.md`      |

**Verification gate (run at the end of every phase):** `yarn typecheck` → `yarn lint` → `yarn test` → `yarn build`, all clean.

**Commit policy:** ONE commit per completed+verified phase (green checkpoint), including the tracker update. `npm publish` only after explicit user confirmation.

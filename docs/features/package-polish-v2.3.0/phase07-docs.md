# Phase 07 — Documentation refresh

**Goal:** Bring every doc surface in line with verified v2.3.0 behavior. Invoke `documentation-writer` skill. No overstated claims.

## Findings addressed

- 🟡 **HYG-N2** (final honest-claim wording, now that attestation is implemented).
- Documentation requirement from the originating prompt.

## Deliverables

1. **`Readme.md`** — Current State (2.3.0 / final test count); new config (`enableMobileAttestation` already; add `allowCrossOriginIframe`, `enforceChallengeStore`, `metadataService`, `requireTrustedAttestation`, `originVerifier`); full attestation usage (how to supply a `MetadataService` + FIDO MDS, bundled Apple root); new result fields (`userHandle`, `webAuthnUserID`, `alg`, `backupStateChanged`, `userVerificationDowngraded`, `counterSupported`, `clientExtensionResults`/`credProps.rk`); error-code union + `statusCode`; honest attestation capability matrix; usernameless flow guide.
2. **`CHANGELOG.md`** — `[2.3.0]` with **Upgrade notes** (secure-by-default behavior changes: challenge store enforcement, alg pinning at auth, crossOrigin rejection; how to restore legacy via config) + Security / Fixed / Changed / Added sections.
3. **`docs/api-reference.md`** — new config options, new result fields, `MetadataService` interface, attestation functions, `WebAuthnErrorCode`.
4. **`docs/migration.md`** — new `2.2 → 2.3` section (behavior changes + config switches + new optional fields).
5. **`AI-INTEGRATION-GUIDE.md`** — new options + attestation/MDS notes + usernameless flow.
6. **`docs/audit-records.md`** — append the v2.3.0 deep audit (findings + resolutions + verification summary).
7. **Instruction files (sync BOTH CLAUDE.md + AGENTS.md at every level):**
   - Package root `CLAUDE.md` + `AGENTS.md` — verified state (2.3.0 / test count / security posture incl. attestation), `Last Updated`.
   - `.claude/CLAUDE.md` + `.claude/AGENTS.md` — bump date.
   - Monorepo root `../CLAUDE.md` + `../AGENTS.md` (01-biometrics-package) — version ref → 2.3.0 (note: separate 01-code workspace repo).
   - Any nested folder instruction files.

## Verification gate

`yarn typecheck` · `yarn lint` · `yarn test` · `yarn build` · `yarn format:check` — all clean (docs shouldn't affect, but run to be safe; ensure markdown is prettier-clean if covered).

## Commit

ONE commit for Phase 7, tracker + progress updated. Push.

## Run log

| Date | What happened | Result |
| ---- | ------------- | ------ |
|      |               |        |

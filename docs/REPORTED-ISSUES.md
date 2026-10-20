# Reported issues — webauthn-server-buildkit

OPEN issues only. Fixed entries move to `docs/RESOLVED-ISSUES.md` with a resolution date and the fixing
version. Never delete an entry. Standard: `~/.claude/rules/project-issue-reporting.md`.

**Last Updated:** 2026-07-25

---

### ISSUE-001 — No automated test suite for a security-critical library

- **Severity:** High (for a library whose whole purpose is cryptographic verification)
- **Affected version:** `2.3.0` and the current `main`
- **Reported:** 2026-07-25, during the package-standardisation pass
- **Status:** OPEN — owner decision needed

**Symptom.** The repository contains no test files and `package.json` has no `test` script. CI
(`.github/workflows/ci.yml`) runs `lint`, `typecheck` and `build` only. Nothing executes a single assertion
against the verification logic.

**Root cause.** A Vitest suite of 311 tests existed at the `2.3.0` release (2026-05-27). Commit `f8fe54e`
(2026-06-02), "chore: remove cypress and all automated-testing infrastructure", deleted `tests/` in full and
removed `vitest` + `@vitest/coverage-v8` from `package.json`. This was consistent with the global
"No Automated Tests Unless Explicitly Requested" rule — that rule is about **applications**, and applying it
to a cryptographic verification library removed the only mechanism that would catch a regression in
signature verification, challenge enforcement or attestation trust-anchoring.

**Why it matters here specifically.** This library's failure mode is silent. A regression that made
`verifyAuthentication` return `verified: true` too eagerly would pass typecheck, pass lint, pass build, and
produce a login flow that works perfectly for every user while authenticating nobody. Static gates cannot
detect that class of defect; only assertions can.

**Suggested fix.** Restore a test suite scoped to the security-critical paths, at minimum: signature
verification per algorithm, challenge single-use and expiry, RP-ID hash and origin matching, counter and
flag handling, and per-format attestation with both trust-anchored and un-anchored fixtures. The deleted
suite is recoverable from git — `git show f8fe54e^:tests/` — so this is a restore plus an update, not a
rewrite.

**Interim mitigation applied 2026-07-25.** The README `Limitations` section and the `CHANGELOG` now state
plainly that no test suite ships, so a prospective adopter is not misled by the `2.3.0` entry's
"311 tests pass" line, which was true when written.

**Owner decision required:** restore the suite (recommended), or accept and document the gap permanently.

---

### ISSUE-002 — `cbor-x` is bundled yet also a runtime dependency, forcing 6 unused packages plus a native binary on every consumer

- **Severity:** Medium (install weight and supply-chain surface; no functional impact)
- **Affected version:** `2.3.0` and the current `main`
- **Reported:** 2026-07-25
- **Status:** OPEN — deliberately not changed unilaterally; see the trade-off

**Symptom.** `tsup.config.ts` sets `noExternal: ['cbor-x']`, so `cbor-x` is compiled into `dist/index.js`
and `dist/index.cjs`. It is nonetheless declared in `dependencies`, so every consumer also downloads it and
its native accelerator chain — `cbor-x` -> `cbor-extract` -> a prebuilt platform binary plus
`node-gyp-build-optional-packages` and `detect-libc`: 6 packages in total.

**Evidence it is unused at runtime.** The built output contains no `require('cbor-x')` / `from 'cbor-x'`,
and the package is fully functional with `cbor-x` deleted from `node_modules` — a CBOR encode/decode
round-trip and a session round-trip both succeed with exit code 0.

**The trade-off — why this was not simply changed.** The bundled `cbor-x` still references `cbor-extract`
and `node-gyp-build-optional-packages` by dynamic resolution. Those are `cbor-x`'s **optional native
accelerator**. With the dependency present, decoding can use the fast native path; with it absent, `cbor-x`
falls back to its JavaScript implementation — functionally identical (proven above) but slower. So the
declared dependency is not dead weight by accident; it may be buying decode performance on a hot path.

**Options.**

1. **Move `cbor-x` to `devDependencies`** — consumers drop 6 packages including a platform-specific native
   binary, shrinking install size and supply-chain surface. Cost: CBOR decoding always uses the JS fallback.
2. **Keep it as-is** and document that the native accelerator is intentional. Cost: every consumer installs
   a native binary for code that is already bundled, which is surprising and is a real supply-chain surface.
3. **Stop bundling** (`noExternal` removed) so the declared dependency is the one actually loaded. Cost:
   version skew in the CBOR layer, which is security-relevant here.

**Recommendation:** option 1, unless a benchmark shows the native path materially matters for the payload
sizes WebAuthn actually produces (attestation objects are small — typically well under 2 kB). Because this
changes the dependency graph of a published security library that currently has no regression suite
(ISSUE-001), it is left for an explicit owner decision rather than applied during a documentation pass.

---

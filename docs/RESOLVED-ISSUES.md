# Resolved Issues — webauthn-server-buildkit

**Last updated:** 2026-10-20

### ISSUE-003 — `docs/project-development-plan/roadmap.md` is stale and contradicts the shipped package

- **Severity:** Low (internal document; not published in the tarball)
- **Affected version:** current `main`
- **Reported:** 2026-07-25
- **Status:** RESOLVED — stale project-development plan removed on 2026-10-20

**Symptom.** The roadmap describes the package as "Version 0.1.0 (Current)" with a "Target Release: August
2025" for 0.2.0, and claims "Test Coverage: ~70% coverage with 89 test cases". The package is at `2.3.0` and
has no tests at all (ISSUE-001). Every factual claim in the file is wrong.

**Why it matters.** It is reachable from the public repository, and a contributor reading it would form a
completely incorrect picture of the project's state and test posture.

**Suggested fix.** Rewrite it against the current state, or delete it — the delete-first documentation rule
favours removal over maintaining a document nobody updates. It was deliberately **not** linked from the new
README for this reason.

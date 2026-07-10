# CLAUDE.md

See the root `CLAUDE.md` for complete project guidance. This file supplements with .claude-specific configuration notes.

**Last Updated:** 2026-05-29

## Note

All development rules, verification procedures, audit records, and working guidelines have been consolidated into the root `CLAUDE.md` and `docs/` directory. Refer to those files for current guidance.


## Sub-agents & Skills — Main-Context-First (IRON-SOLID)
Default/built-in sub-agents (`general-purpose`, `Explore`, `Plan`, `claude`, `fork`, …) do NOT have
access to `/skills`, so delegating to them silently SKIPS the skills RULE #0 requires. Do all
skill-relevant work in the **MAIN context**; use a sub-agent ONLY when a **custom** agent exists in
`.claude/agents/` for that job; a default `Explore`/`Plan` agent is allowed ONLY for read-only,
no-skill search/exploration. When a relevant skill is missing, **install/enable it** rather than
proceeding skill-less. (Owner directive 2026-07-11; full text in `~/.claude/CLAUDE.md`.)

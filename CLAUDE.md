# CLAUDE.md

Guidance for Claude Code when working with `webauthn-server-buildkit`.

**Last Updated:** 2026-04-03

## Project Overview

Framework-independent TypeScript WebAuthn server utilities package.

## Critical Instruction Sync Rule

- Any important development rule added to `CLAUDE.md` or `AGENTS.md` for this package must be added to both files in the same update pass.
- If one instruction file is missing, create it before finishing the task so package guidance stays mirrored.
- Keep this package-level rule aligned with the monorepo root instruction files.

## Claude Code Agent Rule

- For every prompt or task in this package, use an agent-first Claude Code workflow to provide the best development experience possible.
- Claude Code agents should be the default path for exploration, planning, refactors, implementation, reviews, and other systematic work.
- Treat direct manual execution as the exception for only genuinely trivial tasks.

## Package Manager Policy

- Use `yarn` for all project-local dependency installation, dependency updates, script execution, and publish preparation in this package.
- Use `pnpm` for all global package installation on the system.
- Use `npm` only to install or update `pnpm` globally when `pnpm` is missing or needs an update.
- If `yarn` is missing globally, install it with `pnpm`, not `npm`.
- Keep `yarn.lock` and remove other lockfiles such as `package-lock.json`, `pnpm-lock.yaml`, and `npm-shrinkwrap.json`.

## Commands

```bash
yarn build
yarn dev
yarn test
yarn lint
yarn typecheck
yarn format
```

## Working Rules

- Keep `Readme.md` and package docs aligned with verified behavior when public APIs change.
- Run build, tests, lint, and typecheck before release-oriented changes.
- Preserve framework-independent, type-safe WebAuthn behavior.

# Stage 4 patch overlay

This archive is an overlay for `Badger42/max-mini-app-platform` at `main`
commit `d170defef9218d8e7d0e4760ed7694a2c680fed8` (the repository state checked
on 2026-11-17). Extract the archive into the repository root and allow the
repository-relative files to overwrite their counterparts. Then run:

```bash
bash apply-stage4.sh
npm install
npm run lint
npm run typecheck
npm test
```

`npm test` remains the same built-in Node test runner command.

## Scope note

The current `main` history contains a later commit named `restore telegramm`
after the Stage 3 commit. Telegram is therefore a first-class adapter in the
actual base, regardless of the earlier Stage 4 assumption that only Web and
MAX remain. This patch preserves it, retains its separate launch parser, and
applies the same lifecycle/download hardening to its browser fallback.

The Stage 3 Launch Context and injected `services.downloadFile` support were
also inconsistent between the Stage 3 commit and the current restored main
branch. This patch restores those contracts and adds regression coverage rather
than treating them as already present.

## GitHub write limitation

The connected GitHub integration allowed repository reads but denied branch
creation with HTTP 403 (`Resource not accessible by integration`). No files
were written to `main`, and no pull request was opened. This is a source overlay
for review/application, not a claim that a remote branch or PR exists.

## Runtime requirement

`engines.node` is raised from `>=20` to `>=22.13.0`: Node 20 is EOL, and this
sets the minimum to a maintained LTS line compatible with ESLint 10. The CI
matrix also includes Node 26 (current Active LTS).

## Included files

The overlay replaces the platform loader, BackButton helper, download helper,
Web/MAX/Telegram adapter integration, platform factory and domain JSDoc types.
It adds `eslint.config.js`, `.github/workflows/ci.yml`, Stage 4 regression tests
and the manual client matrix. `apply-stage4.sh` appends the Stage 4 links to the
existing README without replacing its platform/API guidance.

## Lockfile

The base repository has no `package-lock.json`. The patch deliberately does not
invent one and CI does not use `npm ci`. Once a lockfile is generated with npm
in a network-enabled checkout and committed, change the CI install step to
`npm ci`.

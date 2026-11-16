# Stage 3 — Domain contracts and typing

This archive is a source-overlay patch bundle for `Badger42/max-mini-app-platform`.
It contains only files changed or added for the Stage 3 work. Extract it at the
repository root and allow the files to overwrite their existing counterparts.

## Apply and validate

```bash
# From the repository root, after extracting the archive:
npm install
npm run typecheck
npm test
```

`typescript` is added as a development dependency. Runtime source remains plain
JavaScript; TypeScript is used only for JSDoc `checkJs` validation and compile-time
contract assertions.

## Scope note

The source branch inspected for this patch still contains Telegram launch
handling and adapters. Their removal is assigned to Stage 2 in the supplied
plan, so this patch does not silently delete those paths. Their types and
normalizers are isolated as legacy compatibility code. The canonical
`BridgeType` is Web (`null`) or MAX (`'max'`). `runtime.platform` and
`runtime.version` remain documented migration aliases because this repository
does not contain evidence that all external consuming applications have
migrated.

## Verification performed while preparing this bundle

- `npm run typecheck` passed using TypeScript 5.8.3 available in the build
  environment.
- Focused Node tests passed: `tests/platform-contracts.test.mjs` and
  `tests/stage1-regressions.test.mjs` (18 tests).
- The complete repository test suite was not run against a full checkout in
  this environment. The GitHub integration allowed reading the repository but
  rejected branch/ref writes with HTTP 403, and a local clone was unavailable.

This archive is not a Git-generated unified diff. It is an overlay bundle with
repository-relative paths so it can be applied without replacing unrelated
files.

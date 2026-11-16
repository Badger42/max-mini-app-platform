# Archive information

This archive contains the complete repository file tree from `Badger42/max-mini-app-platform` at commit `5beac14af656875cac958cf66577b14627e361a4` (the `main` snapshot reviewed for Stage 1), with Stage 1 fixes applied in-place.

## Included Stage 1 fixes

- BackButton navigation lock is released when `router.back()` throws synchronously.
- Incomplete native BackButton APIs are treated as unsupported by all methods.
- Unknown/missing native download and MAX share statuses are rejected as protocol errors.
- Native MAX `downloadFile()` is not advertised or invoked for `platform === 'web'`.
- Synchronous exceptions from Promise-based MAX and Telegram sharing/download operations are returned as Promise rejections.
- Added `tests/stage1-regressions.test.mjs`.

## Validation

The complete Node test suite was run from the project root using `npm test`: **41 tests passed, 0 failed**. The archive is a source snapshot; it does not include `node_modules` or a deployment build. Real MAX WebView testing is still required.

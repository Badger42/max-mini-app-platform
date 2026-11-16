# Archive information

This is a complete source snapshot of `Badger42/max-mini-app-platform` at
`main` commit `cb38e600fd90d35c1bd095780299255f561f9772`, with Stage 3 domain
contract and JSDoc type-checking changes applied. It retains all three supported
runtime targets: regular Web, MAX Mini Apps and Telegram Mini Apps.

## Stage 3 changes

- First-class JSDoc contract for Web, MAX and Telegram adapter APIs.
- Strict per-operation result types and platform-specific SDK result normalizers.
- Promise-based operations preserve native synchronous user-activation calls
  and convert synchronous SDK exceptions into rejected Promises.
- MAX deep links are restricted to the exact `max.ru` hostname.
- Native and effective URL-sharing capabilities are distinguished.
- TypeScript `checkJs` validation is enabled without emitting or migrating
  runtime JavaScript to TypeScript.
- Added operation result type tests and contract regression tests.
- Updated platform API and Telegram integration documentation.

## Telegram support

Telegram is not deprecated or a legacy-only path. The canonical `BridgeType`
includes `null` (Web), `'max'` and `'telegram'`. Telegram launch detection,
conditional SDK loading, native adapter, fallback adapter, platform-specific
operation results and tests remain supported.

## Contents and validation

The archive contains the complete repository source and test tree. It excludes
`node_modules` and generated deployment output. Run `npm install`, then:

```bash
npm run typecheck
npm test
```

Real MAX and Telegram WebView testing remains necessary for host-specific
behavior that cannot be reproduced by Node's test runner.

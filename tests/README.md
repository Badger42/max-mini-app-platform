# Tests

The repository uses Node's built-in test runner; Node.js 20 or newer is required.
TypeScript is a development-only dependency used for JSDoc checking and type tests.

Run the complete suite:

```bash
npm test
```

Run platform-focused tests:

```bash
npm run test:platform
```

The tests cover runtime detection, duplicate launch parameters, adapter
selection, Web/MAX/Telegram adapter contracts, URL validation, operation result
normalization, capability alignment, BackButton lifecycle/concurrency, Bridge
loading, timeout, retry and late-load behavior.

Automated tests do not replace integration testing inside real MAX and
Telegram clients (Android, iOS, Desktop and Web).

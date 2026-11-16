# Tests

The repository has no runtime or third-party test dependencies. Node's built-in
test runner is used; Node.js 20 or newer is required.

Run the complete suite:

```bash
npm test
```

Run only the platform tests:

```bash
npm run test:platform
```

The tests cover runtime detection, duplicate launch parameters, adapter
selection, common adapter contracts, URL validation, result normalization,
BackButton lifecycle/concurrency, Bridge loading, timeout, retry and late-load
behavior.

Automated tests do not replace integration testing inside real MAX and
Telegram clients (Android, iOS, Desktop and Web).

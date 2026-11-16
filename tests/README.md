# Tests

The repository has no runtime or third-party test dependencies. Node's built-in
test runner is used; Node.js 20 or newer is required.

Run the complete suite:

```bash
npm test
```

Run platform and integration tests:

```bash
npm run test:platform
```

The tests cover Launch Context detection, duplicate/conflicting parameters,
raw-data exclusion, adapter selection, MAX fallback context preservation,
download-service delegation, relative URLs, native download user-gesture
synchrony, URL validation, status normalization, BackButton lifecycle and MAX
Bridge loading/timeout behavior.

Automated tests do not replace integration testing inside real MAX clients
(Android, iOS and Desktop), especially for native download and WebView cookie
behavior.

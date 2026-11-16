# Tests

The scaffold has no package manifest or test-runner dependency. The platform
smoke tests use Node's built-in test runner and can be run with Node 22:

```bash
node --experimental-default-type=module --test tests/*.test.mjs
```

The tests cover Telegram launch detection, platform selection, the Telegram
fallback adapter, native file-download argument mapping, prepared-message
sharing, and URL sharing. They do not replace testing inside the real Telegram
clients (Android, iOS, Desktop and Telegram Web).

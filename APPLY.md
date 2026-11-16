# Using this project archive

This ZIP contains the **complete project**, not an overlay patch. Extract it to
a new directory, then run:

```bash
npm install
npm run typecheck
npm test
```

Telegram support is included as a first-class runtime next to regular Web and
MAX. `BridgeType` is `null | 'max' | 'telegram'`; Telegram is not a deprecated
compatibility adapter.

For implementation details, see `README.md`, `docs/platform-api.md`,
`docs/platform-contract.md` and `docs/telegram-integration.md`.

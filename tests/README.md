# Tests and verification

The standalone module uses Node's built-in test runner. The supported Node
runtime is `>=22.13.0`. This deliberately avoids the EOL Node 20 line and meets
ESLint 10's Node.js 22.13+ requirement.

Run the checks locally:

```bash
npm install
npm run lint
npm run typecheck
npm test
```

Or run all three quality gates with one command:

```bash
npm run check
```

Run only platform-focused tests:

```bash
npm run test:platform
```

`npm test` is intentionally unchanged. ESLint uses the flat ESM config in
`eslint.config.js`. `lint:fix` is available for rules with safe automatic fixes.

## What the automated suite covers

- Launch-context selection and protocol diagnostics.
- SDK script deduplication, existing scripts, timeout, explicit retry, late
  events, cleanup and already-present global bridges.
- BackButton navigation locks, synchronous/asynchronous failures, route
  completion/cancellation, modal close concurrency, reinitialization and
  disposal.
- HTTP errors, opaque responses, network/CORS failures, object URL cleanup,
  anchor cleanup, credentials and injected download-service routing.
- Web/MAX/Telegram adapter contracts and native capability isolation in the
  corresponding fallback.

Node tests use deterministic fake DOM/SDK surfaces. They do not prove that a
real MAX WebView invokes native operations as expected.

## Manual integration matrix — real MAX clients

Record the MAX app version, OS/device, test date and observed result for each
row. Leave the result as **not run** until it has been checked in that actual
client. A Node mock must never be marked as a real-client pass.

| Scenario | Real-client check | Result |
|---|---|---|
| Chrome / ordinary Web | MAX CDN is not requested; Web adapter is selected immediately | Not run |
| MAX Android | SDK availability, native download, external/deep links, BackButton | Not run |
| MAX iOS | SDK availability, download prompt, link behavior, safe area and keyboard in consuming app | Not run |
| MAX Desktop | SDK availability, download and link behavior | Not run |
| MAX `platform === 'web'` | Native download capability is false; browser/injected fallback runs once | Not run |
| MAX CDN unavailable | App starts with MAX fallback; no native SDK calls | Not run |
| Slow network / timeout | Bootstrap completes with fallback; late `load` does not switch adapter | Not run |
| Download from user click | Native download is invoked in the originating click handler | Not run |
| Download through injected service | Credentials, CORS, cookies and app-specific Blob saving are correct | Not run |
| BackButton with modal | Only the top modal closes; async close is not duplicated | Not run |
| BackButton with route | Exactly one back navigation occurs; cancelled/error route releases lock | Not run |
| BackButton at main route | Native button is hidden or follows the app's documented main-route contract | Not run |
| Dispose / reinitialize | Old handler and subscriptions are removed; no late native UI side effects | Not run |

For the Telegram runtime currently present on `main`, repeat the analogous SDK,
CDN failure, download and BackButton checks in Telegram Android/iOS/Desktop.
That additional row group is retained because the latest repository commit
restored Telegram as a first-class target; this patch does not silently remove
it as a side effect of a MAX-focused reliability stage.

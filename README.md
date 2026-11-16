# Web + MAX Mini App platform adapter for Vue 3

A small integration module for an existing Vue 3 / Vue CLI application. It
supports a regular Web runtime and MAX Mini Apps without requiring changes to
the application's Vue Router, Axios, UI components, modal manager or existing
HttpOnly-cookie authentication. This module does not implement MAX
Authentication.

## Integration

1. Copy `src/platform` and `src/plugins/platform.js` into the consuming app.
2. Do not add a static MAX Bridge script tag to `public/index.html`.
3. Merge the flow from `examples/main.js` into the existing `src/main.js`.
4. Detect the launch context before creating Vue Router; the router may rewrite
   the URL fragment.
5. Optionally inject the app's existing download function as
   `services.downloadFile`.
6. Register the plugin and mount the app as usual. Use `this.$platform` from
   Options API components.

## Launch Context

`detectLaunchContext()` returns one sanitized value for the entire bootstrap:

```js
{
  type: 'max', // 'web' | 'max'
  launch: {
    platform: 'android', // 'ios' | 'android' | 'desktop' | 'web' | null
    version: '1.0',
  },
  detection: {
    status: 'valid', // 'valid' | 'absent' | 'invalid' | 'conflicting'
    reason: null,
  },
}
```

An ordinary Web context has `type: 'web'`, `launch: null` and status `absent`.
Invalid or conflicting MAX-like launch markers fail closed to Web and retain
a diagnostic reason. They do not load MAX Bridge. Duplicate parameter values
are `invalid`; repeated parameter values that disagree are `conflicting`.

The detector inspects MAX launch markers before Vue Router starts. It does not
use User-Agent or SDK globals to identify MAX. Raw `WebAppData` is checked only
for presence and is never exposed by the returned object. Launch context is
not authentication and must not grant user identity or data access.

## Bootstrap and public API

The bootstrap sequence is:

1. Call `detectLaunchContext()`.
2. Load MAX Bridge only when `launchContext.type === 'max'`.
3. Pass `launchContext`, `bridge`, `bridgeError` and optional `services` to
   `createPlatform()`.
4. Register the Vue plugin and mount the application.

The adapter exposes:

```js
this.$platform.launchContext
this.$platform.bridgeType       // null for Web, 'max' for MAX
this.$platform.bridgeAvailable
this.$platform.bridgeError

this.$platform.openExternalLink(url)
this.$platform.openPlatformLink(url)
this.$platform.downloadFile(url, fileName, options)
this.$platform.shareUrl(url, text)
this.$platform.sharePreparedMessage(params)

this.$platform.backButton.show()
this.$platform.backButton.hide()
this.$platform.backButton.onClick(handler)
```

`launchContext.type` is always `web|max`; `bridgeType` describes host-Bridge
availability semantics and remains `null|max`. A MAX fallback preserves the
original launch context and Bridge error, keeps Web operations working, marks
native capabilities unsupported and never retries or switches adapters
spontaneously.

See [docs/platform-api.md](docs/platform-api.md) and
[docs/platform-contract.md](docs/platform-contract.md) for the complete API.

## Downloads and existing Axios services

Pass the consuming application's download service to the factory:

```js
const platform = createPlatform({
  launchContext,
  bridge,
  bridgeError,
  services: {
    downloadFile: existingDownloadService
  }
})
```

The service contract is `(url, fileName, options) => Promise`. The URL is
passed unchanged, so a relative API URL is supported. The service owns Axios,
interceptors, `withCredentials`, headers, CORS behavior and Blob saving. The
module adds no Axios dependency. A successful service resolution is normalized
to `{ status: 'requested' }`; thrown errors and rejected Promises remain
rejections. If the app's Axios method returns only a Blob, wrap it in the
consuming application so the wrapper saves the Blob before resolving.

Download routing:

| Runtime | Behavior |
|---|---|
| Web | Injected service, otherwise Fetch/Blob fallback |
| MAX with native download | `WebApp.downloadFile(url, fileName)` |
| MAX without native download | Injected service, otherwise Fetch/Blob fallback |
| MAX fallback without Bridge | Injected service, otherwise Fetch/Blob fallback |

Native MAX download requires an absolute HTTPS URL and must be called directly
from the originating user click handler. Prepare a short-lived or signed URL
before the click; do not await an Axios request before invoking native
download. The standalone Fetch/Blob fallback retains its HTTPS requirement,
`credentials` option and CORS behavior. The adapter never starts native and
browser downloads together.

## Other integration points

- **BackButton:** use `bindBackButton.js` once, connected to the app's existing
  modal manager and Vue Router. Close the top modal first, then navigate back.
- **Modals:** keep the existing HTML/CSS modal manager; verify fixed positioning,
  stacking, scroll locking and keyboard/viewport behavior in MAX WebView.
- **Authentication:** this module does not change the existing cookie flow.
  Verify CORS, `withCredentials`, `SameSite`, `Secure`, third-party-cookie
  restrictions and CSRF policy in the actual WebView.
- **Routing:** retain the existing router. If using hash history, test fragment
  hand-off explicitly because MAX launch parameters also use the fragment.
- **Bridge loading:** the MAX SDK is injected dynamically only after a valid
  MAX launch is detected. A Bridge timeout leaves the app on the MAX fallback.

## Testing

Run the built-in Node test suite with Node.js 20 or newer:

```bash
npm test
npm run test:platform
```

Automated tests do not replace real MAX WebView testing on Android, iOS and
Desktop. In particular, test native download from a real click, cross-domain
cookie behavior, and the consuming application's actual Axios download service.

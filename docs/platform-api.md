# Platform Adapter API

The module supports exactly two runtime types: a regular Web application and a
MAX Mini App. It exposes the same adapter API through the Vue plugin as
`this.$platform`.

## Launch context

Call `detectLaunchContext()` before creating Vue Router or mounting the app.
The returned object has this shape:

```js
{
  type: 'max', // 'web' | 'max'
  launch: {
    platform: 'android', // 'ios' | 'android' | 'desktop' | 'web' | null
    version: '...',
  },
  detection: {
    status: 'valid', // 'valid' | 'absent' | 'invalid' | 'conflicting'
    reason: null,
  },
}
```

A regular Web launch has `type: 'web'`, `launch: null`, and
`detection.status: 'absent'`. Malformed or conflicting launch markers also fail
closed to `type: 'web'`, but retain `invalid` or `conflicting` diagnostics. They
do not cause a MAX Bridge request.

Only the presence and shape of launch markers are inspected. The raw
`WebAppData` value is never returned or copied into the adapter. Launch context
is not authentication, proof of identity, or authorization to access data.

## Bootstrap and factory

```js
const launchContext = detectLaunchContext()
let bridge = null
let bridgeError = null

if (launchContext.type === 'max') {
  try {
    bridge = await loadMaxBridge()
  } catch (error) {
    bridgeError = error
  }
}

const platform = createPlatform({
  launchContext,
  bridge,
  bridgeError,
  services: { downloadFile: existingDownloadService }
})
```

`createPlatform()` selects one adapter from `launchContext.type`. A failed MAX
Bridge produces a MAX fallback adapter; it preserves the same launch context
and bridge error and never retries or switches adapters automatically.

## Runtime identity

```js
this.$platform.launchContext
this.$platform.bridgeType
this.$platform.bridgeAvailable
this.$platform.bridgeError
this.$platform.runtime.clientPlatform
this.$platform.runtime.clientVersion
```

`launchContext.type` is always `'web'` or `'max'`. `bridgeType` describes the
presence of a host bridge: `null` for Web and `'max'` for MAX, including the MAX
fallback. `bridgeAvailable` independently reports whether the Bridge loaded.

The runtime platform/version fields prefer values reported by the SDK and fall
back to the sanitized launch metadata when the Bridge is unavailable.

## Links

Use `openExternalLink(url)` and `openPlatformLink(url)`. Both require absolute
HTTPS URLs. MAX maps them to `WebApp.openLink(url)` and
`WebApp.openMaxLink(url)` respectively. Web uses `window.open()`.

The return value `{ status: 'requested' }` means the opening API was invoked;
it does not guarantee that a popup was not blocked or that the user followed it.

## Download service

The adapters accept an optional application-owned service:

```js
createPlatform({
  launchContext,
  bridge,
  services: {
    downloadFile(url, fileName, options) {
      return existingAxiosDownload(url, fileName, options)
    }
  }
})
```

The service receives the URL unchanged, including relative API URLs, plus the
file name and optional third argument. It must return a Promise. Successful
resolution becomes `{ status: 'requested' }`; a resolved
`{ status: 'cancelled' }` remains cancelled. Synchronous exceptions and
rejected Promises are propagated as rejections.

The adapter does not know about Axios, interceptors, credentials, headers, or
response shapes. If the existing service returns a Blob, wrap it in the
consuming application so that the wrapper performs the download before it
resolves. Axios is not a dependency of this module.

Routing is:

| Runtime | Download implementation |
|---|---|
| Web | Injected service, otherwise Fetch/Blob fallback |
| MAX with native capability | `WebApp.downloadFile(url, fileName)` |
| MAX without native capability | Injected service, otherwise Fetch/Blob fallback |
| MAX fallback without Bridge | Injected service, otherwise Fetch/Blob fallback |

The native MAX path accepts an absolute HTTPS URL only. The injected service is
not subjected to that validation, so it can receive a relative API URL. The
standalone Fetch/Blob fallback retains its HTTPS requirement and its own CORS
and credentials behavior. The adapter never starts both download paths.

Call the adapter's `downloadFile()` directly in the originating click handler
when native MAX download is required. Prepare any authenticated or short-lived
URL before the click; do not await an Axios request before calling the native
method.

## Capabilities and results

All adapters expose boolean capability keys:

- `nativeDownload`
- `backButton`
- `nativeExternalLinks`
- `nativePlatformLinks`
- `closingConfirmation`
- `shareUrl`
- `sharePreparedMessage`

The `native*` keys describe MAX Bridge support. `shareUrl` describes effective
availability, including Web Share or clipboard fallback. `sharePreparedMessage`
has no Web equivalent.

`downloadFile()` returns `requested` when a request was accepted/started, not
when bytes have finished downloading. Native MAX may also return `cancelled`.
`shareUrl()` returns `shared`, `cancelled`, or `copied` depending on the selected
runtime and capability. Unsupported prepared-message sharing rejects.

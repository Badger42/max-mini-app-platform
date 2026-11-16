# Platform Adapter Contract

This document defines the shared contract for Web, MAX and the MAX fallback.
The package remains plain JavaScript; `platformTypes.js` provides JSDoc types.

## Launch Context

The detector, bootstrap, factory and adapters use the same shape:

```js
{
  type: 'max', // 'web' | 'max'
  launch: {
    platform: 'android', // 'ios' | 'android' | 'desktop' | 'web' | null
    version: '1.0', // string | null
  },
  detection: {
    status: 'valid', // 'valid' | 'absent' | 'invalid' | 'conflicting'
    reason: null, // string | null; stable diagnostic code
  },
}
```

For ordinary Web, `launch` is `null` and detection is `absent`. Invalid and
conflicting MAX-like parameters fail closed to `type: 'web'`, `launch: null`;
the diagnostic status and reason remain available. A duplicate parameter with
the same value is invalid. Repeated values that disagree are conflicting.

The MAX parser uses `WebAppData` only as a presence marker and never returns,
stores, logs or forwards its value. Launch parameters are only a runtime
selection hint. They must not be used for authentication, identity, or access
control. User-Agent is not used to detect MAX.

## Adapter identity

- `launchContext.type`: `'web'` or `'max'`.
- `bridgeType`: `null` for Web and `'max'` for MAX, including the fallback.
- `bridgeAvailable`: whether MAX Bridge loaded successfully.
- `bridgeError`: the Bridge load failure, or `null` when not applicable.
- `launchContext`: the original sanitized object passed through bootstrap and
  the factory, including in MAX fallback.

`runtime.clientPlatform` and `runtime.clientVersion` prefer SDK-reported values
and fall back to the launch metadata if Bridge loading failed. Browser
User-Agent remains Web diagnostic data and is not used for environment
selection.

## Capabilities

| Capability | Meaning |
|---|---|
| `nativeDownload` | MAX Bridge exposes native download and the host platform is not `web` |
| `backButton` | The complete native BackButton API is available |
| `nativeExternalLinks` | MAX Bridge exposes `openLink` |
| `nativePlatformLinks` | MAX Bridge exposes `openMaxLink` |
| `closingConfirmation` | Both close-confirmation methods are available |
| `shareUrl` | URL sharing works through MAX or a supported browser mechanism |
| `sharePreparedMessage` | MAX Bridge supports prepared-message sharing |

The MAX fallback retains Web operations and injected services but advertises
all native capabilities as unsupported. Its BackButton methods remain safe
no-ops, and it never attempts to access `window.WebApp`, reload the SDK, or
switch adapters during the current page lifecycle.

## Download service port

`createPlatform({ services: { downloadFile } })` accepts an optional function
with the contract:

```js
(downloadUrl, fileName, options) => Promise<unknown>
```

It receives the original URL without URL rewriting. This is intentional:
application services may accept relative API endpoints and own Axios
interceptors, credentials, headers, Blob handling and error translation.
The service must resolve only after its download workflow has completed. If it
returns a Blob rather than performing the download, the consuming application
must wrap it and save the Blob before resolving.

The adapter normalizes a fulfilled service call to `{ status: 'requested' }`;
a service result `{ status: 'cancelled' }` remains cancelled. A thrown
exception or rejected Promise reaches the caller as a rejection.

Selection order:

1. Web: injected service, else the standalone Fetch/Blob helper.
2. MAX with native capability: native `WebApp.downloadFile()` only.
3. MAX without native capability: injected service, else Fetch/Blob.
4. MAX fallback: injected service, else Fetch/Blob.

Native MAX requires an absolute HTTPS URL and is invoked synchronously from the
adapter method, before any Promise continuation, to preserve the user gesture.
The injected service is not forced to use HTTPS or absolute URLs. The built-in
Fetch/Blob helper retains its own HTTPS, CORS and credentials requirements.
Native and browser download paths are mutually exclusive.

## Operation results

- Link-opening methods return `{ status: 'requested' }` when an opening API was
  invoked; they do not prove that the user followed the link.
- Native MAX `downloadFile()` returns `requested` for `downloading` and
  `cancelled` for `cancelled`. `requested` is not a completion event.
- Injected download-service success returns `{ status: 'requested' }` unless
  the service explicitly resolves to `{ status: 'cancelled' }`.
- `shareUrl()` returns `shared`, `cancelled`, or `copied`, or rejects.
- Unsupported prepared-message sharing rejects.

All asynchronous errors are propagated as rejected Promises.

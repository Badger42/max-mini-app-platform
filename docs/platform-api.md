# Unified Platform Adapter API

The adapter exposes one public contract for regular Web, MAX and Telegram.
The detailed operation and capability definitions live in
[Platform Adapter Contract](platform-contract.md).

## Runtime identification

Use:

```js
this.$platform.bridgeType
this.$platform.bridgeAvailable
this.$platform.bridgeError
this.$platform.runtime.clientPlatform
this.$platform.runtime.clientVersion
```

`bridgeType` is:

- `null` — regular Web browser.
- `'max'` — MAX launch context was detected, whether or not its SDK loaded.
- `'telegram'` — Telegram launch context was detected, whether or not its SDK loaded.

`bridgeAvailable` reports whether the detected SDK loaded successfully. Do not
use launch parameters or this property for authentication or authorization.

`runtime.clientPlatform` and `runtime.clientVersion` describe values reported
by the host SDK. The old `runtime.platform` and `runtime.version` remain
backward-compatible aliases. Web diagnostics such as `navigator.userAgent` are
exposed separately under `runtime.browser.userAgent`.

## Links

Use:

```js
this.$platform.openExternalLink(url)
this.$platform.openPlatformLink(url)
```

Both methods require an absolute HTTPS URL. `openExternalLink()` requests
opening a normal external URL. `openPlatformLink()` asks the current host to
handle its own deep link:

| Adapter | Native method |
|---|---|
| MAX | `WebApp.openMaxLink(url)` |
| Telegram | `Telegram.WebApp.openTelegramLink(url)` |
| Web | `window.open(url, '_blank')` |

MAX `openPlatformLink()` accepts only `https://max.ru/...`; use
`openExternalLink()` for other domains. Telegram delegates to
`openTelegramLink()`. If a native method is unavailable, the adapter uses a
browser fallback. `{ status: 'requested' }` means the opener was invoked; it
does not guarantee that a popup or host screen was displayed.

## Capabilities

All adapters expose the same capability keys:

- `nativeDownload`
- `backButton`
- `nativeExternalLinks`
- `nativePlatformLinks`
- `closingConfirmation`
- `nativeShareUrl`
- `shareUrl`
- `sharePreparedMessage`

The `native*` keys describe host SDK support. `shareUrl` describes effective
availability, including supported browser fallbacks. Telegram URL sharing uses
its host link opener, not a dedicated native share method; therefore its
`nativeShareUrl` is false while `shareUrl` may still be true.

## Operation results

`downloadFile()` returns `Promise<DownloadResult>`. MAX's documented download
statuses are `downloading` and `cancelled`; Telegram's callback is normalized
separately from `accepted`/`cancelled`. Browser Blob fallback returns
`requested` after it triggers the download request. None of these statuses
means that the file has finished downloading.

`openExternalLink()` and `openPlatformLink()` return `LinkOpenResult`:
`requested` means the opener was called, not that navigation completed.

`shareUrl()` returns `Promise<ShareUrlResult>`:

- MAX uses `shareMaxContent({ link, text })` for sharing inside MAX and returns
  `shared` or `cancelled`.
- Telegram opens the `t.me/share/url` composer and returns `opened` when the
  host link method was called, or `requested` for browser `window.open()`.
- Web uses `navigator.share()` and falls back to Clipboard. The latter returns
  `copied` only after `writeText()` resolves.

`sharePreparedMessage()` returns `Promise<PreparedMessageResult>`:

- MAX requires a Bot API message `mid` plus `chatType` (`DIALOG` or `CHAT`).
- Telegram requires the PreparedInlineMessage ID returned by
  `savePreparedInlineMessage`.

These identifiers and workflows are not interchangeable.

## Errors and user activation

Promise-based methods always return Promises, including validation errors and
synchronous exceptions thrown by native SDK methods. The original error object
is preserved. Unknown or missing MAX SDK statuses reject with
`PlatformProtocolError`.

MAX and Telegram methods that require user activation are invoked synchronously
inside the original method call stack. Do not defer calls with `.then()`,
`queueMicrotask()` or a timer when invoking them from a user gesture.

For BackButton lifecycle integration, see
[`examples/backButtonIntegration.js`](../examples/backButtonIntegration.js).

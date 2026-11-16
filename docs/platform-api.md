# Unified Platform Adapter API

The adapter exposes one public contract for regular Web, MAX and Telegram.
The detailed capability and operation-result definitions live in
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

`bridgeType` is one of:

- `null` — regular Web browser.
- `'max'` — MAX launch context was detected, whether or not its SDK loaded.
- `'telegram'` — Telegram launch context was detected, whether or not its SDK loaded.

`bridgeAvailable` reports whether the detected SDK loaded successfully. Do not
use launch parameters or this property for authentication or authorization.

`runtime.clientPlatform` and `runtime.clientVersion` describe values reported by
the host SDK. The old `runtime.platform` and `runtime.version` remain as
deprecated aliases. Web diagnostics, such as `navigator.userAgent`, are exposed
separately under `runtime.browser.userAgent`.

## Links

Use:

```js
this.$platform.openExternalLink(url)
this.$platform.openPlatformLink(url)
```

Both methods require an absolute HTTPS URL. `openExternalLink()` requests opening
a normal external URL. `openPlatformLink()` asks the current host to handle a
platform-specific URL:

| Adapter | Native method |
|---|---|
| MAX | `WebApp.openMaxLink(url)` |
| Telegram | `WebApp.openTelegramLink(url)` |
| Web | `window.open(url, '_blank')` |

When a native link method is unavailable, the adapters use a browser fallback.
The returned `{ status: 'requested' }` means the opening API was invoked; it
does not guarantee that a popup was not blocked or that the user followed it.

This method is intentionally platform-relative. It does not mean that a MAX
deep link will be opened natively from Telegram, or vice versa.

## Capabilities

All adapters expose the same keys:

- `nativeDownload`
- `backButton`
- `nativeExternalLinks`
- `nativePlatformLinks`
- `closingConfirmation`
- `shareUrl`
- `sharePreparedMessage`

The `native*` keys describe host SDK support. `shareUrl` describes effective
availability, including supported Web Share or clipboard fallbacks.
`sharePreparedMessage` is true only when the selected host provides the
platform-specific prepared-message operation.

## Operation results

`downloadFile()` normalizes a native accepted/started request to
`{ status: 'requested', platformStatus: 'downloading' }` or
`{ status: 'requested', platformStatus: 'accepted' }`. A declined operation
returns `{ status: 'cancelled', platformStatus: 'cancelled' }`.
`requested` does not mean that the file has finished downloading.

`shareUrl()` may return `shared`, `opened`, `copied`, `cancelled`, `requested`
or reject. Telegram's `opened` means its composer-opening method was invoked,
not that the user sent the content.

`sharePreparedMessage()` uses platform-specific identifiers:
MAX requires a Bot API message `mid` plus `chatType`; Telegram requires the
PreparedInlineMessage ID returned by `savePreparedInlineMessage`.

See [Platform Adapter Contract](platform-contract.md) for the full semantics.

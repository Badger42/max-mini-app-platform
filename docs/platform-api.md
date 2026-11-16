# Unified Platform Adapter API

The adapter exposes one public contract for regular Web, MAX and Telegram.

## Runtime identification

Use:

```js
this.$platform.bridgeType
this.$platform.bridgeAvailable
this.$platform.bridgeError
```

`bridgeType` is one of:

- `null` — regular Web browser.
- `'max'` — MAX was detected, whether or not its SDK loaded.
- `'telegram'` — Telegram was detected, whether or not its SDK loaded.

`bridgeAvailable` reports whether the detected SDK loaded successfully. Do not use launch parameters or this property for authentication or authorization.

The old `isMax`, `isTelegram` and `environment` flags have been removed. `bridgeType` plus `bridgeAvailable` represent the same state without multiple overlapping flags.

## Links

Use:

```js
this.$platform.openExternalLink(url)
this.$platform.openPlatformLink(url)
```

`openExternalLink()` opens a normal external HTTPS URL.

`openPlatformLink()` opens a URL handled by the current host application:

| Adapter | Native method |
|---|---|
| MAX | `WebApp.openMaxLink(url)` |
| Telegram | `WebApp.openTelegramLink(url)` |
| Web | `window.open(url, '_blank')` |

This method is intentionally platform-relative. It does not mean that a MAX deep link will be opened natively from Telegram, or vice versa.

The old `openMaxLink()` and `openTelegramLink()` public methods have been removed.

## Capabilities

The `capabilities` object has the same keys in each adapter:

- `nativeDownload`
- `backButton`
- `nativeExternalLinks`
- `nativePlatformLinks`
- `closingConfirmation`
- `shareUrl`
- `sharePreparedMessage`

Check a capability before exposing UI that depends on that native feature. Methods still exist in every adapter; unsupported actions return a rejected Promise or a safe no-op as appropriate.

## Platform-specific behavior remains encapsulated

The adapter intentionally normalizes the public method name, not every platform's internal API payload:

- MAX prepared sharing uses Bot API `mid` plus `chatType`.
- Telegram prepared sharing uses the PreparedInlineMessage ID from `savePreparedInlineMessage`.
- MAX and Telegram native downloads have different signatures and callback semantics.

Keep Bot API tokens and platform-specific preparation calls on the backend.

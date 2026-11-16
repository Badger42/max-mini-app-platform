# Telegram platform adapter

Telegram is a first-class supported runtime alongside regular Web and MAX. Its
launch detection, SDK loader, adapter, fallback adapter, operation types and
tests are maintained as part of the common platform API.

## Telegram launch detection

Telegram launch parameters are passed in the URL fragment. The detector checks
for `tgWebAppData`, or for the `tgWebAppPlatform` + `tgWebAppVersion` pair.
Duplicate protocol fields are rejected. Detection is only a script-loading hint;
it is not authentication. The adapter never validates `initData` and does not
use `initDataUnsafe`.

## SDK loading

`loadTelegramBridge.js` injects
`https://telegram.org/js/telegram-web-app.js?65` only when `detectPlatform()`
returns `telegram`. It has a configurable timeout, a single in-flight Promise
and retry behavior after rejection. The sample bootstrap calls
`Telegram.WebApp.ready()` after Vue mounts.

## Unified adapter API

Use the common methods from `this.$platform`:

- `bridgeType`: `null`, `max` or `telegram`.
- `bridgeAvailable`: whether the selected platform SDK loaded.
- `openExternalLink(url)`: opens a normal HTTPS URL.
- `openPlatformLink(url)`: delegates to `openTelegramLink()`.
- `downloadFile(url, fileName)`.
- `shareUrl(url, text?)`.
- `sharePreparedMessage({ messageId })`.
- `backButton.show()`, `hide()` and `onClick(handler)`.

No Telegram-only method needs to be called from Vue components. The common
`openPlatformLink()` chooses the host-specific API, while platform capabilities
indicate whether native methods are available.

## Telegram-specific operation contracts

- `downloadFile()` maps to Telegram's
  `downloadFile({ url, file_name }, callback)`. The callback reports whether
  the user accepted the download prompt; it does not confirm completion. Its
  `accepted` result is normalized independently from MAX's `downloading`.
- `openPlatformLink()` maps to `Telegram.WebApp.openTelegramLink()`.
- `shareUrl()` opens Telegram's official `https://t.me/share/url` composer.
  `opened` means the host link method was invoked, not that the user sent the
  message. A browser fallback returns `requested` because popup success cannot
  be reliably inferred.
- `sharePreparedMessage({ messageId })` maps to `shareMessage(messageId)`.
  The ID must be a PreparedInlineMessage ID obtained through Bot API
  `savePreparedInlineMessage`; it is not an arbitrary Telegram message ID.
- `backButton` and closing confirmation map to the corresponding Telegram
  WebApp methods.
- `ready()` calls Telegram's method after Vue mounts.

Telegram Bot API 8.0 media methods are enabled only when the client version
supports them and the relevant SDK method exists. An incomplete native API is
not advertised as a capability.

If sharing a physical file as a Telegram message is required, the backend must
prepare a suitable inline message using Telegram's Bot API. Keep the bot token
on the backend. The frontend receives only the prepared inline message ID.

This differs from MAX: MAX uses a bot message `mid` and `chatType` with
`shareMaxContent()`. The IDs and backend preparation workflows are
platform-specific.

## Telegram file download headers

For consistent download behavior, Telegram's documentation recommends that
the file response include `Content-Disposition: attachment; filename="..."`
and `Access-Control-Allow-Origin: https://web.telegram.org`, especially when
running in Telegram Web. Use HTTPS URLs and test target Telegram clients.

## Fallback mode

If Telegram launch parameters are present but the SDK fails to load, the app
starts with `bridgeType: 'telegram'` and `bridgeAvailable: false`. Web APIs,
Vue Router, Axios and existing cookie authentication remain available. Native
Telegram BackButton, download and prepared-message sharing are marked
unavailable. URL sharing may still use the browser `window.open()` fallback.

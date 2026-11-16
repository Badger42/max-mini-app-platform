# Telegram platform adapter

The repository now supports three runtime targets: regular Web, MAX Mini Apps,
and Telegram Mini Apps. Each target is selected once before Vue mounts.

## Telegram launch detection

Telegram launch parameters are passed in the URL fragment. The detector checks
for `tgWebAppData`, or for the `tgWebAppPlatform` + `tgWebAppVersion` pair. This
is only a script-loading hint; it is not authentication. The adapter never reads
or validates `initData` and does not use `initDataUnsafe`.

## SDK loading

`loadTelegramBridge.js` injects `https://telegram.org/js/telegram-web-app.js?65`
only when `detectPlatform()` returns `telegram`. It has a configurable timeout,
a single in-flight Promise and retry behavior after rejection. The sample
bootstrap calls `Telegram.WebApp.ready()` after Vue mounts.

## Adapter API

- `downloadFile(url, fileName)` maps to Telegram's
  `downloadFile({ url, file_name }, callback)`. The normalized result is
  `{ status: 'accepted' | 'cancelled' }`; `accepted` means the user accepted the
  prompt, not that the download completed.
- `openExternalLink(url)` maps to `openLink(url)`.
- `openTelegramLink(url)` maps to `openTelegramLink(url)`.
- `shareUrl(url, text?)` opens Telegram's official `t.me/share/url` composer.
- `sharePreparedMessage({ messageId })` maps to `shareMessage(messageId)`.
  The ID must be a prepared inline message ID obtained through the Bot API
  `savePreparedInlineMessage` method; it is not an arbitrary message ID.
- `backButton` and closing confirmation map to the corresponding Telegram
  WebApp methods.

The Telegram share URL method returns `{ status: 'opened' }`; this only means
the share composer was opened. The prepared-message method returns
`{ status: 'shared' | 'cancelled' }` from Telegram's callback.

## Backend requirements for prepared file sharing

If sharing a physical file as a Telegram message is required, the backend must
prepare a suitable inline message using Telegram's Bot API. Keep the bot token
on the backend. The frontend receives only the prepared inline message ID and
passes it to `this.$platform.sharePreparedMessage({ messageId })`.

This differs from MAX: MAX uses a bot message `mid` and `chatType` with
`shareMaxContent()`. The adapter method accepts `{ messageId, chatType? }` to
keep the call shape uniform, but the IDs and backend preparation workflows are
platform-specific.

## Telegram file download headers

For consistent download behavior, Telegram's documentation recommends that
the file response include `Content-Disposition: attachment; filename="..."`
and `Access-Control-Allow-Origin: https://web.telegram.org`, especially when
running in Telegram Web. Use HTTPS URLs. Test the target Telegram clients.

## Fallback mode

If Telegram launch parameters are present but the SDK fails to load, the app
starts using `telegram-fallback`. Web APIs, Vue Router, Axios and existing
cookie authentication remain available. Native Telegram BackButton,
downloadFile and prepared-message sharing are marked unavailable. URL sharing
may still use the browser Web Share API or clipboard fallback.

## Testing

Run the local smoke tests with Node 22:

```bash
node --experimental-default-type=module --test tests/*.test.mjs
```

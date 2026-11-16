# MAX Mini App platform adapter for Vue 3 / Vue CLI

A small integration scaffold for an existing Vue 3 application using Options API.
It does not change the app's colours, UI components, Vue Router, Axios or existing
cookie authentication. No MAX or Telegram authentication is implemented.

## Short integration plan

1. Copy `src/platform` and `src/plugins/platform.js` into the matching folders of
   your Vue CLI project.
2. Do **not** add MAX or Telegram SDK script tags to `public/index.html`.
   The appropriate SDK is loaded dynamically only after its launch parameters
   have been detected.
3. Merge the bootstrap flow from `examples/main.js` into your current `src/main.js`.
   Keep your existing Router, store and other plugin registrations before `mount()`.
4. Use `this.$platform` in Options API components for platform features.
5. Connect the existing file-download flow to `this.$platform.downloadFile()`.
   For MAX, call it synchronously from the user's click handler with a direct HTTPS
   file URL. Do not await an API request before calling the native method.
6. Test MAX and Telegram on Android, iOS and Desktop, plus the ordinary website.

## Runtime detection and conditional SDK loading

MAX launch parameters (`WebAppData`, `WebAppPlatform`, `WebAppVersion`) and
Telegram launch parameters (`tgWebAppData`, `tgWebAppPlatform`,
`tgWebAppVersion`) are read from the URL fragment before Vue Router is mounted.
This is only a runtime-loading decision, **not authentication or a security
boundary**. Never use launch fragment values or `initDataUnsafe` to authorize a
user or grant access to data.

Only the detected SDK is dynamically injected:

- MAX: `https://st.max.ru/js/max-web-app.js`
- Telegram: `https://telegram.org/js/telegram-web-app.js?65`

Regular web users do not request either platform CDN. SDK loading has a five
second timeout by default. On failure, the app starts with the corresponding
fallback adapter; the selected adapter is not switched automatically later in
the same page lifecycle.

Both MAX and Telegram use the URL fragment for launch parameters, so
`createWebHashHistory()` can conflict with the initial launch data. Prefer
`createWebHistory()` with an SPA fallback on the frontend server, or implement
and test a deliberate fragment hand-off before using hash history.

## Using the adapter from Options API

```js
export default {
  methods: {
    openHelp() {
      this.$platform.openExternalLink('https://example.com/help')
    },

    downloadPreparedFile(file) {
      // file.url should already be available before the click.
      // In MAX, this must be invoked directly from the click handler.
      return this.$platform.downloadFile(file.url, file.fileName)
    }
  }
}
```

Available adapter members:

- `environment`: `web`, `max`, `max-fallback`, `telegram` or `telegram-fallback`.
- `isMax`, `isTelegram`, `bridgeAvailable`, `bridgeError`, `runtime`, `capabilities`.
- `downloadFile(url, fileName, options?)`.
- `openExternalLink(url)`, `openMaxLink(url)`, `openTelegramLink(url)`.
- `shareUrl(url, text?)` and `sharePreparedMessage({ messageId, chatType? })`.
- `backButton.show()`, `backButton.hide()`, `backButton.onClick(handler)`.
  `onClick` returns an unsubscribe function.
- `enableClosingConfirmation()`, `disableClosingConfirmation()`.

`capabilities` describes native functions available in the selected runtime. Do
not assume a capability exists just because the app was opened in MAX; feature
availability can vary by client version.

## File downloading

### MAX

The adapter calls `window.WebApp.downloadFile(url, fileName)`. MAX requires an
HTTPS URL and a user click. The native method returns `{ status: 'downloading' }`
or `{ status: 'cancelled' }`; `downloading` means accepted/started, not completed.
The documented API does not expose a download-progress or completion callback.

Prepare the file URL before the click. If your API endpoint requires an HttpOnly
cookie, do not assume the native downloader forwards that cookie or arbitrary
headers. Prefer a short-lived, scoped HTTPS download URL (for example, a signed
object-storage URL or an opaque backend ticket). Do not put permanent credentials
in the URL.

### Telegram

The adapter calls `Telegram.WebApp.downloadFile({ url, file_name }, callback)`.
The callback reports whether the user accepted the download prompt; it does not
confirm that the file has finished downloading. Telegram recommends that the
file response include `Content-Disposition: attachment; filename="..."` and
`Access-Control-Allow-Origin: https://web.telegram.org` for consistent behavior,
especially in Telegram Web.

### Web and platform fallbacks

The adapter uses `fetch` -> `Blob` -> object URL -> `<a download>`. The helper
accepts `options.credentials`:

- `same-origin` is the safe default.
- Use `include` only if a cross-origin endpoint needs cookies and its CORS policy
  explicitly allows the frontend origin and credentialed requests.

For signed storage URLs, `same-origin` (or a deliberately configured `omit`) is
usually preferable. The API must allow CORS for cross-origin fetches. The helper
returns `{ status: 'requested' }`, not proof that the browser finished saving it.

If your current website already has a reliable Axios/Blob download implementation,
you can keep it: move that implementation behind `webAdapter.downloadFile()`
instead of replacing it with the generic helper.

## Sharing content

Use `this.$platform.shareUrl(url, text)` to share a link. MAX uses
`shareMaxContent({ link, text })`, Telegram opens its `t.me/share/url` composer,
and Web uses `navigator.share()` where available or copies the URL to the clipboard.
The Telegram result `{ status: 'opened' }` means the share composer opened; it does
not prove that the user sent the message.

For prepared media/files, use `sharePreparedMessage()` after the backend has
prepared a platform-specific message:

```js
// MAX: messageId is the `mid` returned by Bot API POST /messages.
this.$platform.sharePreparedMessage({ messageId: maxMid, chatType: 'DIALOG' })

// Telegram: messageId is returned by Bot API savePreparedInlineMessage.
this.$platform.sharePreparedMessage({ messageId: telegramPreparedMessageId })
```

The IDs and backend workflows are different. Telegram's `shareMessage()` requires
a prepared inline message ID (Bot API 8.0+); MAX requires a bot message `mid` and
`chatType` (`DIALOG` or `CHAT`). Keep bot tokens and Bot API calls on the backend.

## Modals and BackButton

Existing Vue modal components do not need to be rewritten. They remain HTML/CSS
inside the WebView. Check fixed positioning, stacking (`z-index`), scroll locking,
keyboard/viewport behaviour on iOS, and whether transformed/overflow-hidden
ancestors affect `position: fixed`.

Connect the single platform BackButton handler to your existing modal manager and Vue
Router: close the topmost open modal first; otherwise navigate back if your app
has an internal previous route. Register the handler once and call the returned
unsubscribe function when the navigation manager is disposed. This scaffold
exposes the BackButton API but intentionally does not assume a particular modal
library or Router setup.

Telegram's `WebApp.ready()` is called by the example bootstrap after Vue mounts;
MAX and Web adapters expose a no-op `ready()` method for a stable bootstrap API.

## Separate frontend and backend domains

This scaffold does not change authentication. Existing Axios and HttpOnly Cookie
authentication continue as before, subject to browser/WebView cookie rules. For
Blob fallback downloads across origins, check CORS and credential settings. For
native MAX and Telegram downloads, prefer a short-lived file URL so the native
downloader does not need the frontend's cookie.

## Notes

- No static MAX or Telegram SDK `<script>` tag is required.
- No MAX or Telegram login/authentication flow is included.
- All examples are JavaScript and compatible with the Options API approach.
- The `examples/main.js` file is an integration example; do not overwrite your
  real `main.js` without merging your existing imports and plugin registrations.

## Optional BackButton integration

`src/platform/bindBackButton.js` is a small helper for connecting the MAX button
with your existing modal manager and Router. It does not depend on a modal
package. Supply four callbacks/references: `router`, `hasOpenModal`,
`closeTopModal`, and `canGoBack`. The helper closes the top modal first; only
when there is no modal does it call `router.back()`. Call `refresh()` after a
modal opens/closes. `router.afterEach()` refreshes visibility after navigation.

See `examples/backButtonIntegration.js` for the expected shape. Replace the
illustrative `$modalManager` and `$navigationHistory` APIs with your project's
actual APIs; they are placeholders, not Vue built-ins.

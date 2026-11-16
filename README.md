# Cross-platform Mini App adapter for Vue 3 / Vue CLI

A small integration scaffold for an existing Vue 3 application using Options API.
It supports regular Web, MAX Mini Apps and Telegram Mini Apps without changing
the app's colours, UI components, Vue Router, Axios or existing cookie
authentication. No MAX or Telegram authentication is implemented.

## Short integration plan

1. Copy `src/platform` and `src/plugins/platform.js` into the matching folders of
   your Vue CLI project.
2. Do **not** add MAX or Telegram SDK script tags to `public/index.html`.
   The selected SDK is loaded dynamically only after its launch parameters have
   been detected.
3. Merge the bootstrap flow from `examples/main.js` into your current `src/main.js`.
   Keep your existing Router, store and other plugin registrations before `mount()`.
4. Use `this.$platform` in Options API components.
5. Test regular Web, MAX Android/iOS/Desktop and Telegram Android/iOS/Desktop.

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

Regular Web users do not request either platform CDN. SDK loading has a five
second timeout by default. On failure, the app starts with the corresponding
fallback adapter; the selected adapter is not switched automatically later in
the same page lifecycle.

Both MAX and Telegram use the URL fragment for launch parameters, so
`createWebHashHistory()` can conflict with the initial launch data. Prefer
`createWebHistory()` with an SPA fallback on the frontend server, or implement
and test a deliberate fragment hand-off before using hash history.

## Unified public API

All adapters expose the same platform-neutral API:

```js
this.$platform.bridgeType
this.$platform.bridgeAvailable
this.$platform.bridgeError

this.$platform.openExternalLink(url)
this.$platform.openPlatformLink(url)

this.$platform.downloadFile(url, fileName)
this.$platform.shareUrl(url, text)
this.$platform.sharePreparedMessage(params)

this.$platform.backButton.show()
this.$platform.backButton.hide()
this.$platform.backButton.onClick(handler)
```

`bridgeType` is `null`, `'max'` or `'telegram'`. It identifies the host SDK,
not the physical device. `bridgeAvailable` indicates whether the SDK loaded.
The pair replaces the overlapping `isMax`, `isTelegram` and `environment`
properties.

The old `openMaxLink()` and `openTelegramLink()` public methods are replaced by
`openPlatformLink()`:

| Adapter | `openExternalLink(url)` | `openPlatformLink(url)` |
|---|---|---|
| MAX | `WebApp.openLink(url)` | `WebApp.openMaxLink(url)` |
| Telegram | `Telegram.WebApp.openLink(url)` | `Telegram.WebApp.openTelegramLink(url)` |
| Web | `window.open(url, '_blank')` | `window.open(url, '_blank')` |

MAX `openPlatformLink()` accepts only `https://max.ru/...`; use
`openExternalLink()` for other HTTPS hosts. Telegram delegates to its own
platform deep-link handler.

### Capabilities

Every adapter exposes the same boolean capability keys:

- `nativeDownload`
- `backButton`
- `nativeExternalLinks`
- `nativePlatformLinks`
- `closingConfirmation`
- `nativeShareUrl`
- `shareUrl`
- `sharePreparedMessage`

`native*` flags describe host SDK methods; `shareUrl` describes effective
availability including supported browser/host fallbacks. Telegram's URL share
uses `openTelegramLink()` rather than a dedicated share API, so
`nativeShareUrl` is false even when `shareUrl` is available.

See [docs/platform-api.md](docs/platform-api.md) for the full operation contracts.

## File downloading

### MAX

The adapter calls `window.WebApp.downloadFile(url, fileName)`. MAX requires an
HTTPS URL and a user click. The returned status `downloading` means accepted or
started, not completed. The documented API does not expose a progress or
completion callback.

Prepare the file URL before the click. If the endpoint requires an HttpOnly
cookie, do not assume the native downloader forwards that cookie or arbitrary
headers. Prefer a short-lived, scoped HTTPS download URL. Do not put permanent
credentials in the URL.

### Telegram

The adapter calls
`Telegram.WebApp.downloadFile({ url, file_name }, callback)`. The callback
reports whether the user accepted the download prompt; it does not confirm
that the file has finished downloading. The Telegram `accepted` callback value
is intentionally normalized separately from MAX's `downloading` status.

### Web and platform fallbacks

The adapter uses `fetch` -> `Blob` -> object URL -> `<a download>`. The helper
accepts `options.credentials`:

- `same-origin` is the safe default.
- Use `include` only if a cross-origin endpoint needs cookies and its CORS policy
  explicitly allows the frontend origin and credentialed requests.

For signed storage URLs, `same-origin` (or a deliberately configured `omit`)
is usually preferable. The API must allow CORS for cross-origin fetches. If your
existing website already has a reliable Axios/Blob download implementation,
keep it behind `webAdapter.downloadFile()`.

## Sharing

Use `shareUrl(url, text?)` for a normal HTTPS link:

- MAX uses `shareMaxContent({ link, text })` for sharing inside MAX.
- Telegram opens the `t.me/share/url` composer.
- Web uses `navigator.share()` where available, or copies the URL to the clipboard.

The returned statuses are operation-specific. MAX reports `shared` or
`cancelled`; Telegram reports `opened` when its host composer opener is called
(or `requested` for the browser popup fallback); Web Share reports `shared` or
`cancelled`, and Clipboard reports `copied` only after a successful write.

Use `sharePreparedMessage()` only after the backend has prepared a platform-
specific message:

```js
// MAX: messageId is the `mid` returned by Bot API POST /messages.
this.$platform.sharePreparedMessage({
  messageId: maxMid,
  chatType: 'DIALOG'
})

// Telegram: messageId is returned by Bot API savePreparedInlineMessage.
this.$platform.sharePreparedMessage({
  messageId: telegramPreparedMessageId
})
```

The IDs and backend workflows are different. Telegram's `shareMessage()`
requires a PreparedInlineMessage ID; MAX requires a bot message `mid` and
`chatType` (`DIALOG` or `CHAT`). Keep bot tokens and Bot API calls on the backend.

## Modals and BackButton

Existing Vue modal components do not need to be rewritten. They remain HTML/CSS
inside the WebView. Check fixed positioning, stacking (`z-index`), scroll
locking, keyboard/viewport behaviour on iOS, and whether transformed or
overflow-hidden ancestors affect `position: fixed`.

Connect the single platform BackButton handler to your existing modal manager
and Vue Router: close the topmost open modal first; otherwise navigate back if
your app has an internal previous route. Register the handler once and call the
returned unsubscribe function when the navigation manager is disposed. The
scaffold intentionally does not assume a particular modal library or Router
setup.

Telegram's `WebApp.ready()` is called by the example bootstrap after Vue mounts;
MAX and Web adapters expose a no-op `ready()` for a stable bootstrap API.

## Separate frontend and backend domains

This scaffold does not change authentication. Existing Axios and HttpOnly Cookie
authentication continue as before, subject to browser/WebView cookie rules. For
Blob fallback downloads across origins, check CORS and credential settings. For
native MAX and Telegram downloads, prefer short-lived file URLs so the native
downloaders do not need the frontend's cookie.

## Notes

- No static MAX or Telegram SDK `<script>` tag is required.
- No MAX or Telegram login/authentication flow is included.
- All examples are JavaScript and compatible with the Options API approach.
- Merge the example bootstrap into your real `main.js`; do not overwrite existing
  Router/store/plugin registrations.
- `bridgeType`/`bridgeAvailable` supersede `isMax`, `isTelegram` and
  `environment`. `openPlatformLink()` supersedes platform-specific link methods.

## Optional BackButton integration

`src/platform/bindBackButton.js` connects the selected platform's BackButton to
your existing modal manager and Router. It supplies one common API for MAX and
Telegram. Call `refresh()` after a modal opens/closes, and call `dispose()` when
the navigation manager is disposed.

See `examples/backButtonIntegration.js` for the expected shape. Replace
illustrative modal/navigation APIs with your project's actual APIs.

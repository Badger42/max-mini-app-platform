# Unified Platform Adapter API

The library exposes one JavaScript API for Web and MAX. JSDoc types for the
public factory, services, capabilities and operation results live in
`src/platform/platformTypes.js`; `npm run typecheck` validates runtime JS
without compiling or emitting TypeScript output.

> **Legacy migration path:** this repository still contains Telegram adapter
> support. Removing Telegram and changing launch detection belongs to the
> preceding platform-migration stage. New code should target Web (`bridgeType`
> `null`) or MAX (`bridgeType` `'max'`).

## Runtime identification

```js
this.$platform.bridgeType
this.$platform.bridgeAvailable
this.$platform.bridgeError
this.$platform.runtime.clientPlatform
this.$platform.runtime.clientVersion
this.$platform.runtime.deviceName
```

`bridgeType` identifies the host, not the physical device. A detected host with
a failed SDK load receives its host-specific fallback adapter and reports
`bridgeAvailable === false`. Runtime metadata is diagnostic only; it is not an
authentication or authorization signal.

`runtime.platform` and `runtime.version` remain deprecated aliases for
`clientPlatform` and `clientVersion`. They are retained pending a migration
check by external consuming applications.

## Links

```js
this.$platform.openExternalLink('https://example.com/path')
this.$platform.openPlatformLink('https://max.ru/some-deep-link')
```

Both methods are synchronous. They return `{ status: 'requested' }` when an
opener is invoked or `{ status: 'unavailable' }` when no browser opener exists.
They do not confirm that a tab/screen was displayed.

- `openExternalLink(url)` accepts an absolute HTTPS URL and uses MAX
  `WebApp.openLink()` when available, otherwise `window.open()`.
- MAX `openPlatformLink(url)` accepts only `https://max.ru/...` (exact
  hostname). Use `openExternalLink()` for every other HTTPS destination.
  When `WebApp.openMaxLink()` is unavailable, the validated MAX link is passed
  to the browser opener.
- Regular Web has no host-specific deep-link API; `openPlatformLink()` is a
  browser-opening fallback, not a promise of native MAX behavior.

URLs must be absolute HTTPS URLs without embedded username/password
credentials. See the [MAX Bridge API](https://dev.max.ru/docs/webapps/bridge/)
for native link routing semantics.

## Capabilities

All adapters expose the same boolean keys:

- `nativeDownload`
- `backButton`
- `nativeExternalLinks`
- `nativePlatformLinks`
- `closingConfirmation`
- `nativeShareUrl`
- `shareUrl`
- `sharePreparedMessage`

`native*` values describe host-SDK support. `shareUrl` is effective capability:
it may be true on Web because Web Share or Clipboard is available even though
`nativeShareUrl` is false. `sharePreparedMessage` has no generic Web fallback.

## Downloads

```js
const result = await this.$platform.downloadFile(url, fileName, options)
```

`result.status` is `requested` or `cancelled`. `requested` means the operation
was accepted/started or a browser download request was triggered; it does not
mean that the file has finished downloading. MAX `platformStatus` is only
`downloading` or `cancelled`. Telegram's legacy callback normalizer is separate
and uses `accepted` or `cancelled`.

The MAX SDK method is invoked synchronously from `downloadFile()` to preserve
the user click. The method returns a Promise and converts synchronous SDK
throws into rejected Promises. Browser fallback uses `fetch` and Blob; configure
`credentials` only according to the endpoint's CORS and cookie requirements.

## Sharing URLs

```js
const result = await this.$platform.shareUrl(url, text)
```

On MAX this retains the existing `WebApp.shareMaxContent({ link, text })`
workflow: content is shared inside MAX. It is not the operating-system share
sheet for external applications. MAX returns `shared` or `cancelled`.

On Web, the adapter prefers `navigator.share()` (`shared` after resolution,
`cancelled` for `AbortError`) and falls back to Clipboard (`copied` only after
`writeText()` succeeds). Other failures reject the Promise.

No external/system-share method is introduced because the current repository
does not establish that consuming applications need that separate workflow.

## Prepared-message sharing

MAX expects the `mid` value returned by Bot API `POST /messages` plus a
`chatType` of `DIALOG` or `CHAT`:

```js
await this.$platform.sharePreparedMessage({
  messageId: maxMessageMid,
  chatType: 'DIALOG'
})
```

It returns `shared` or `cancelled`. Keep bot tokens and Bot API calls on the
backend. The Telegram legacy method continues to accept a PreparedInlineMessage
ID and is not interchangeable with MAX `mid`.

## Errors and user activation

Promise-based public methods always return Promises, including validation
errors and synchronous native-SDK exceptions. Unknown or missing documented
SDK result statuses reject with `PlatformProtocolError`. The original
synchronous SDK exception is preserved.

MAX native methods are still called synchronously within the original method
call stack. Do not defer those calls with `.then()`, `queueMicrotask()`, or a
timer when invoking them from a user gesture.

For BackButton lifecycle integration, see
[`examples/backButtonIntegration.js`](../examples/backButtonIntegration.js).

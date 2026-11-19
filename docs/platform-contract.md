# Platform Adapter Contract

This document defines the public contract shared by regular Web, MAX Mini Apps
and Telegram Mini Apps. Runtime modules remain JavaScript. JSDoc declarations
in `src/platform/platformTypes.js` are checked by TypeScript with `checkJs` and
no emitted JavaScript.

## Runtime identity

- `bridgeType`: `null` for Web, `'max'` for MAX and `'telegram'` for Telegram.
- `bridgeAvailable`: whether the selected host SDK loaded successfully.
- `bridgeError`: the SDK loading failure, if any.
- `runtime.clientPlatform` and `runtime.clientVersion`: values reported by the
  selected host SDK, or `null` when unavailable.
- `runtime.deviceName`: MAX-reported device name, or `null`.
- `runtime.browser.userAgent`: browser diagnostics only; never used to infer
  platform identity.

`runtime.platform` and `runtime.version` remain backward-compatible aliases.
They are not removed here because the repository does not contain migration
confirmation from external consuming applications.

Launch-fragment parsing is a loading hint, not authentication or authorization.
Duplicate protocol values are rejected. No launch-fragment value or
`initDataUnsafe` may be used to grant access to backend resources.

## Capabilities

The capability model distinguishes host-native support from effective public
availability:

| Capability | Meaning |
|---|---|
| `nativeDownload` | The selected host SDK exposes native file download in this context |
| `backButton` | The complete native BackButton API, including unsubscription, is available (Telegram requires client version 6.1 or later) |
| `nativeExternalLinks` | The host SDK exposes its external-link API |
| `nativePlatformLinks` | The host SDK exposes its host-specific deep-link API |
| `closingConfirmation` | Both native closing-confirmation methods exist (Telegram requires client version 6.2 or later) |
| `nativeShareUrl` | The host SDK exposes a dedicated native URL/text sharing operation |
| `shareUrl` | URL sharing is available through native support or a documented browser/host fallback |
| `sharePreparedMessage` | Native prepared-message sharing is available |

For MAX, `nativeShareUrl` and `sharePreparedMessage` are based on the presence
of `shareMaxContent`. `shareUrl` can remain true without that SDK method when
Web Share or Clipboard is available. For Telegram, `nativeShareUrl` is false:
Telegram URL sharing opens the official `t.me/share/url` composer through
`openTelegramLink`, which is a host link operation rather than a dedicated
share method. `sharePreparedMessage` is based on `shareMessage` and the
minimum supported client version. The Web adapter reports `nativeShareUrl:
false` and derives `shareUrl` from Web Share/Clipboard.

Every native capability is derived from the same captured native method
reference used by its corresponding operation. Platform-specific APIs must not
be reported as available when the selected implementation cannot call them.

## Operation results

Results are operation-specific and are not interchangeable at the type level.

### `downloadFile()`

Returns `Promise<DownloadResult>`:

- MAX `{ status: 'requested', platformStatus: 'downloading' }` — MAX accepted
  or started the request.
- MAX `{ status: 'cancelled', platformStatus: 'cancelled' }` — MAX reports that
  the user cancelled.
- Telegram's callback maps `true` to `requested` with
  `platformStatus: 'accepted'`, and `false` to `cancelled`.
- The Web Blob fallback resolves to `{ status: 'requested' }` after it has
  triggered the browser download request.

`requested` never means that the file is fully downloaded. MAX documents only
`downloading` and `cancelled`; Telegram's callback is a separate SDK contract
and its `accepted` value is not accepted by the MAX normalizer.

### `openExternalLink()` and `openPlatformLink()`

These methods are synchronous and return `LinkOpenResult`:

- `requested` means the opening method was invoked.
- `unavailable` means no browser opener exists in the current runtime.

Neither status confirms that a new tab, host screen, or user navigation
actually occurred. In particular, `window.open()` may return `null` when used
with `noopener`; the adapter does not infer popup blocking from that value.

`openExternalLink()` accepts any valid absolute HTTPS URL and uses the native
external-link method when available. MAX `openPlatformLink()` accepts only an
HTTPS URL whose exact hostname is `max.ru`; other HTTPS URLs must be passed to
`openExternalLink()`. Look-alike domains such as `max.ru.attacker.example` are
rejected. Telegram `openPlatformLink()` delegates to the Telegram host's
`openTelegramLink()` and Web uses a browser opener.

### `shareUrl()`

Returns `Promise<ShareUrlResult>`:

- MAX `shareMaxContent({ link, text })` returns `shared` or `cancelled`.
  This is sharing inside MAX, not an operating-system share sheet for arbitrary
  external applications.
- Web Share API returns `shared` after `navigator.share()` resolves and
  `cancelled` only for `AbortError`. Other errors reject.
- Clipboard fallback returns `copied` only after
  `navigator.clipboard.writeText()` resolves. Clipboard errors reject.
- Telegram opens the official `https://t.me/share/url` composer. `opened`
  means the Telegram host opener was invoked, not that the user sent the
  content. When only `window.open()` is available, the result is `requested`,
  which does not prove that the popup was displayed. If no opener exists, the
  result is `unavailable`.

No separate external/system-share method is introduced in this stage: the
repository does not establish a consuming-app requirement for that workflow.
If such a requirement appears, it should receive a distinct method and result
contract rather than changing the meaning of `shareUrl()`.

### `sharePreparedMessage()`

Returns `Promise<PreparedMessageResult>` and accepts only `shared` or
`cancelled`:

- MAX requires the bot message `mid` returned by Bot API `POST /messages` and a
  `chatType` of `DIALOG` or `CHAT`. This is not an arbitrary message ID.
- Telegram requires the PreparedInlineMessage ID returned by Bot API
  `savePreparedInlineMessage`. It is not an arbitrary Telegram message ID and
  does not use MAX's `chatType` field.

The platform-specific inputs are represented by separate JSDoc types.

## Promise and error semantics

- Promise-based public methods (`downloadFile`, `shareUrl`,
  `sharePreparedMessage`) always return a Promise, including invalid input and
  synchronous native-SDK exceptions.
- The original exception object is preserved when a native SDK method throws.
- A resolved SDK response with a missing or unknown documented status rejects
  with `PlatformProtocolError`; it is never converted to a successful status.
- Native MAX and Telegram methods that require user activation are invoked
  synchronously in the current method call stack. Do not move them into
  `.then()`, a timer or a microtask.
- Synchronous link methods validate input and can throw synchronously.
- `enableClosingConfirmation()` and `disableClosingConfirmation()` preserve
  the return behavior of the underlying host method (or no-op).
- `ready()` calls `WebApp.ready()` for MAX and `Telegram.WebApp.ready()` for
  Telegram; Web and fallback adapters safely no-op. These operations are not
  declared Promise-only.

## URL and SDK constraints

All public URL operations require absolute HTTPS URLs and reject embedded URL
credentials. MAX `openPlatformLink()` uses an exact hostname comparison to
`max.ru`; there is no substring-based allowlist.

MAX native download is not exposed when `WebApp.platform === 'web'`, even if a
method is present on the SDK object. In that context the browser Blob fallback
is used instead.

## SDK loading

`loadBridgeScript()` owns shared script-injection mechanics. MAX and Telegram
have separate wrappers for their CDN URL and global bridge lookup. A timeout
or load error rejects the current attempt and removes it from the in-flight
map so a later explicit call can retry. A late load event cannot resolve a
previously rejected promise or replace an adapter already selected by
bootstrap.

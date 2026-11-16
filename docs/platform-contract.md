# Platform Adapter Contract

This document defines the operation-level contract implemented by the Web and
MAX adapters. Runtime code remains JavaScript. JSDoc declarations in
`src/platform/platformTypes.js` are checked by TypeScript with `checkJs` and no
emitted JavaScript.

> **Migration note:** the current repository still contains a Telegram adapter
> and Telegram launch detection. Those are legacy compatibility paths from the
> preceding platform-migration stage, which is not part of this change. The
> canonical `BridgeType` is `null | 'max'`; Telegram is isolated as
> `LegacyBridgeType` until that migration is applied. Do not treat this note as
> evidence that the repository has already completed the Web + MAX migration.

## Runtime identity

- `bridgeType`: `null` for Web, `'max'` for MAX. The current runtime may also
  return `'telegram'` through the explicitly legacy factory branch.
- `bridgeAvailable`: whether the selected host SDK loaded successfully.
- `bridgeError`: the SDK loading failure, if any.
- `runtime.clientPlatform` and `runtime.clientVersion`: values reported by the
  selected host SDK, or `null` when unavailable.
- `runtime.deviceName`: MAX-reported device name, or `null`.
- `runtime.browser.userAgent`: browser diagnostics only; never used to infer
  platform identity.

`runtime.platform` and `runtime.version` remain backward-compatible aliases.
They are not removed here because the repository contains consuming examples
and documentation but no migration evidence from external consuming apps.
Remove them only in a separately versioned breaking change after consumer
verification.

Launch-fragment parsing is a loading hint, not authentication or authorization.
Duplicate protocol values are rejected. No launch fragment value or
`initDataUnsafe` may be used to grant access to backend resources.

## Capabilities

The capability model distinguishes host-native support from effective public
availability:

| Capability | Meaning |
|---|---|
| `nativeDownload` | The selected host SDK exposes native file download in this context |
| `backButton` | The complete native BackButton API, including unsubscription, is available |
| `nativeExternalLinks` | The host SDK exposes its external-link API |
| `nativePlatformLinks` | The host SDK exposes its host-specific deep-link API |
| `closingConfirmation` | Both native closing-confirmation methods exist |
| `nativeShareUrl` | The host SDK exposes its native URL/text sharing API |
| `shareUrl` | URL sharing is available through native support or the Web Share/Clipboard fallback |
| `sharePreparedMessage` | Native prepared-message sharing is available |

For MAX, `nativeShareUrl` and `sharePreparedMessage` are both based on the
presence of `shareMaxContent`. `shareUrl` can remain true without that SDK
method when Web Share or Clipboard is available. The Web adapter reports
`nativeShareUrl: false` and derives `shareUrl` from those browser APIs.

Every native capability is derived from the same captured native method
reference used by the corresponding operation. Platform-specific APIs must not
be reported as available when the selected implementation cannot call them.

## Operation results

Results are operation-specific. They are not interchangeable at the type
level.

### `downloadFile()`

Returns `Promise<DownloadResult>`:

- `{ status: 'requested', platformStatus: 'downloading' }` — MAX accepted or
  started the request.
- `{ status: 'cancelled', platformStatus: 'cancelled' }` — MAX reports that the
  user cancelled.
- Telegram's legacy callback maps `true` to `requested` with
  `platformStatus: 'accepted'`, and `false` to `cancelled`.
- The Web Blob fallback resolves to `{ status: 'requested' }` after it has
  triggered the browser download request.

`requested` never means that the file is fully downloaded. MAX documents only
`downloading` and `cancelled`; Telegram's callback is a separate, legacy API and
its `accepted` value is not accepted by the MAX normalizer.

### `openExternalLink()` and `openPlatformLink()`

These methods are synchronous and return `LinkOpenResult`:

- `requested` means the opening method was invoked.
- `unavailable` means no browser opener exists in the current runtime.

Neither status confirms that a new tab, host screen, or user navigation
actually occurred. In particular, `window.open()` may return `null` when used
with `noopener`; the adapter does not infer popup blocking from that value.

`openExternalLink()` accepts any valid absolute HTTPS URL and uses the native
external-link method when available. `openPlatformLink()` in MAX accepts only
an HTTPS URL whose exact hostname is `max.ru`; other HTTPS URLs must be passed
to `openExternalLink()`. Look-alike domains such as
`max.ru.attacker.example` are rejected.

MAX's documented `openMaxLink()` routes MAX links inside MAX and may route
non-MAX hosts externally. This adapter deliberately enforces the narrower
public `openPlatformLink()` contract so callers cannot accidentally conflate
host deep links with arbitrary external URLs. See the
[MAX Bridge documentation](https://dev.max.ru/docs/webapps/bridge/).

### `shareUrl()`

Returns `Promise<ShareUrlResult>`:

- MAX `shareMaxContent({ link, text })` returns `shared` or `cancelled`.
  This is sharing **inside MAX**, not an operating-system share sheet for
  sending to arbitrary external applications.
- Web Share API returns `shared` after `navigator.share()` resolves and
  `cancelled` only for `AbortError`. Other errors reject.
- Clipboard fallback returns `copied` only after `navigator.clipboard.writeText()`
  resolves. Clipboard errors reject.
- Telegram's `opened` and `requested` results exist only on its legacy path and
  do not confirm sending or successful browser navigation.

No separate external/system-share method is introduced in this stage: the
repository does not establish a consuming-app requirement for that workflow.
If such a requirement appears, it should receive a distinct method and result
contract rather than changing the meaning of `shareUrl()`.

### `sharePreparedMessage()`

Returns `Promise<PreparedMessageResult>` and accepts only `shared` or
`cancelled` for the MAX path. MAX requires the bot message `mid` returned by
Bot API `POST /messages` and a `chatType` of `DIALOG` or `CHAT`. This is not an
arbitrary message ID. The Telegram adapter retains its separate legacy
PreparedInlineMessage ID contract.

## Promise and error semantics

- Public Promise-based methods (`downloadFile`, `shareUrl`,
  `sharePreparedMessage`) always return a Promise, including invalid input and
  synchronous native-SDK exceptions.
- The original exception object is preserved when a native SDK method throws.
- A resolved SDK response with a missing or unknown status rejects with
  `PlatformProtocolError`; it is never converted to a successful status.
- MAX SDK calls are made synchronously in the method's current call stack before
  Promise wrapping/normalization. Do not move them into `.then()`, a timer, or a
  microtask; this preserves user activation requirements.
- Synchronous link methods validate input and can throw synchronously.
- `enableClosingConfirmation()`, `disableClosingConfirmation()` and `ready()`
  preserve the return behavior of the underlying host method (or no-op) and are
  not declared Promise-only operations.

## URL and SDK constraints

All public URL operations require absolute HTTPS URLs and reject embedded URL
credentials. MAX `openPlatformLink()` uses an exact hostname comparison to
`max.ru`; there is no substring-based allowlist.

MAX native download is not exposed when `WebApp.platform === 'web'`, even if a
method is present on the SDK object. In that context the browser Blob fallback
is used instead.

## SDK loading

`loadBridgeScript()` owns shared script-injection mechanics. MAX and the
legacy Telegram integration keep separate wrappers for CDN URL/global lookup.
A timeout or load error rejects the current attempt and removes it from the
in-flight map so a later explicit call can retry. A late load event cannot
resolve a previously rejected promise or replace an adapter already selected
by bootstrap.

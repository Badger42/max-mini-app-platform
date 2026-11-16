# Platform Adapter Contract

This document defines the public contract shared by Web, MAX, Telegram and
fallback adapters. The project remains plain JavaScript; `platformTypes.js`
provides JSDoc types without introducing a TypeScript build step.

## Runtime identity

- `bridgeType`: `null` for Web, `'max'` or `'telegram'` for a recognized host.
- `bridgeAvailable`: whether that host's SDK loaded successfully.
- `bridgeError`: the SDK loading failure, if any.
- `runtime.clientPlatform` and `runtime.clientVersion`: values reported by the
  host SDK, or `null` when unavailable.
- `runtime.deviceName`: a host-reported device name, never an inferred
  User-Agent string.

`runtime.platform` and `runtime.version` remain as backward-compatible aliases
for `clientPlatform` and `clientVersion`. New code should use the longer names.

Launch parameters are used only to select which SDK to load. They are not proof
of identity, must not authorize access, and must not replace backend validation.

## Capabilities

The capability keys are stable across all adapters:

| Capability | Meaning |
|---|---|
| `nativeDownload` | The selected host SDK exposes its native download method |
| `backButton` | The complete native BackButton API is available |
| `nativeExternalLinks` | The host SDK exposes `openLink` |
| `nativePlatformLinks` | The host SDK exposes its platform-specific link method |
| `closingConfirmation` | The host SDK exposes both confirmation methods |
| `shareUrl` | URL sharing is available through the native or supported browser mechanism |
| `sharePreparedMessage` | The selected host SDK supports prepared-message sharing |

The `native*` keys describe native host support. `shareUrl` describes effective
public availability, including browser share/clipboard fallback. Prepared
message sharing has no generic Web equivalent.

All adapters expose the same methods. If a native feature is not available, the
adapter uses a documented browser fallback where one exists; otherwise the
method rejects with an explanatory error or is a safe no-op for UI controls.

## Operation results

- Link-opening methods return `{ status: 'requested' }` when the opening API
  was invoked. This does not prove that a popup was not blocked or that the user
  followed the link.
- `downloadFile()` returns `{ status: 'requested' }` when the platform accepted
  or initiated the request, or `{ status: 'cancelled' }` when the user declined.
  Native source information may be preserved in `platformStatus`. This is not
  a download-completion event.
- `shareUrl()` may return `shared`, `opened`, `copied`, `cancelled`,
  `requested`, or reject. `opened` means the Telegram composer API was invoked,
  not that the user sent the content.
- `sharePreparedMessage()` returns `shared` or `cancelled` when the host
  provides a result. The identifiers and payloads remain platform-specific.

Do not treat `requested`, `opened`, or `accepted` as proof of completed work.
All asynchronous failures are propagated as rejected promises.

## URL requirements

Public URL operations accept absolute HTTPS URLs only. URLs with embedded
username/password credentials are rejected. This keeps URL behavior consistent
between native adapters and browser fallbacks.

## SDK loading

`loadBridgeScript()` owns the shared script-injection mechanics. MAX and
Telegram keep separate wrappers for their CDN URL and global bridge lookup.
A timeout or load error rejects the current attempt and removes it from the
in-flight map so a later explicit call can retry. A late load event cannot
resolve a previously rejected promise or replace an adapter already selected
by the bootstrap.

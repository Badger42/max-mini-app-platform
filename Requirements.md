# Platform integration requirements — Web + MAX

## Scope

The module supports only a regular Web application and MAX Mini Apps. It is an
integration layer for an existing Vue 3 / Vue CLI application; it must not
require rewriting Vue Router, Axios, modal components, UI styling or existing
cookie authentication.

## Runtime selection

- Detect MAX launch parameters before Vue Router is created or mounted.
- Do not use User-Agent or an already-loaded SDK global as the primary signal.
- Return a Launch Context with `type`, sanitized `launch` metadata and
  `detection` diagnostics (`valid`, `absent`, `invalid`, `conflicting`).
- Never retain or forward the raw `WebAppData` value.
- Load MAX Bridge only for a valid MAX context.
- Keep a MAX context and its diagnostics when Bridge loading fails; do not
  switch adapters or retry automatically during the same page lifecycle.
- Launch parameters are not authentication or authorization evidence.

## Adapter factory

`createPlatform()` receives `launchContext`, `bridge`, `bridgeError` and
optional `services`. `launchContext.type` chooses exactly one Web or MAX
adapter. `bridgeType` remains a separate compatibility field (`null` for Web,
`max` for MAX), and `bridgeAvailable` reports whether the Bridge loaded.

## Download service

- Web and MAX fallback paths use the consuming application's injected
  `services.downloadFile(url, fileName, options)` when present.
- The injected service is Promise-based, receives the URL unchanged, and owns
  Axios configuration, authentication, headers, Blob handling and error
  translation.
- Do not add Axios as a dependency of the standalone module.
- Normalize successful service completion to `{ status: 'requested' }`,
  preserve an explicit cancelled result, and propagate synchronous/rejected
  errors as Promise rejections.
- Retain Fetch/Blob as the documented standalone fallback when no service is
  supplied.
- Native MAX download is a separate path, requires absolute HTTPS, and must be
  invoked synchronously from the original user gesture. Do not start native and
  browser downloads concurrently.

## Existing application integration

- Keep existing HttpOnly Cookie authentication; do not implement MAX
  Authentication or trust launch data as identity.
- Preserve existing Vue Router and modal manager.
- Integrate the native BackButton once, closing the topmost modal before route
  navigation.
- Keep dynamic Bridge loading out of ordinary Web startup.
- Verify CORS, cookie policy, viewport and downloads inside the actual MAX
  WebView; automated unit tests cannot replace this integration testing.

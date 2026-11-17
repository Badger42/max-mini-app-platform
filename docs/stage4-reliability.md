# Stage 4 — Reliability and lifecycle contracts

## Bridge loader

`loadBridgeScript()` keeps an in-flight Promise per script id and records the
lifecycle state of loader-observed script elements outside the DOM. A global
bridge is returned immediately when it already exists. A script known to have
failed, timed out or completed without a bridge is removed before retry. An
unknown foreign script is not treated as loaded merely because it exists: the
loader observes it for a bounded period, and an explicit subsequent call can
replace it after the failed attempt. Error and timeout cleanup removes event
listeners and clears the timer; late events cannot settle the rejected attempt.

The loader never changes the selected adapter after bootstrap. Retrying SDK
loading is an explicit caller decision.

## BackButton

`bindBackButton()` owns one native handler for a given adapter BackButton
service. Rebinding first disposes the prior binding. Router after-hooks, router
errors and a timeout release navigation locks; sync throws and rejected
navigation Promises do the same. An async modal close is serialized against
rapid presses. `dispose()` is idempotent, removes every subscription once,
clears the timer and prevents pending callbacks from refreshing native UI.

The helper receives structural callbacks only. It does not import Vue, Vue
Router or a modal implementation.

## Downloads

The standalone browser fallback uses Fetch -> Blob -> object URL -> anchor.
It rejects HTTP errors and opaque responses, keeps `same-origin` credentials as
the default, and reports network/CORS request failures distinctly. Once an
object URL exists, cleanup is in `finally`: the anchor is detached and the URL
is revoked immediately on failure or after the configured delay on success
(default: 30000 ms, preserving the existing delay).

An injected `services.downloadFile(url, fileName, options)` takes precedence
for Web and SDK fallback paths. Its options and relative URL are passed through;
the adapter does not start a second Fetch download. Native MAX download remains
a separate synchronous path so user activation is preserved.

## Launch context and fallback

The Stage 3 Launch Context is sanitized and retained on each adapter, including
fallback. MAX and Telegram protocols keep separate parsers; the context
coordinator only selects the detected protocol and rejects mixed markers.
Launch parameters are not authentication data.

Fallback reuses the Web adapter's browser operations, injected download service
and download options, while setting every native capability to `false`. It
never calls MAX or Telegram SDK methods.

## Dependency boundaries

Platform adapters and helpers do not import Vue. `src/plugins/platform.js`
remains the only Vue-specific registration module. The BackButton helper uses
structural navigation/modal contracts. The injected download service is an
application-owned port and does not import Axios. MAX/Telegram globals and CDN
URLs remain in their respective adapters/loaders.

## CI / lockfile policy

The minimum Node version is raised from `>=20` to `>=22.13.0`. ESLint 10
supports Node 22 from 22.13.0, and Node 20 reached end of life on 2026-03-24;
CI also checks Node 26, the current Active LTS line. The workflow uses
`actions/checkout@v7` and `actions/setup-node@v7`; dependency caching is
explicitly disabled because this repository has no lockfile to key it safely.

The repository currently has no package lockfile. CI therefore uses
`npm install`, not `npm ci`. Commit and maintain `package-lock.json` in a
separate deliberate change before switching CI to `npm ci`; do not add a
handwritten or incomplete lockfile. CI runs ESLint, typecheck and `npm test` on
the declared minimum Node line and current Active LTS. The standalone package
has no Vue consuming-application production build, so CI does not claim to
validate that build.

See [tests/README.md](../tests/README.md) for the manual MAX client matrix.

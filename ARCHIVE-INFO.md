# Phase 2 overlay information

This archive contains the implementation overlay for `max-mini-app-platform`
after Stage 1, based on commit `cb38e600fd90d35c1bd095780299255f561f9772`.

## Main changes

- Restricts runtime support to Web and MAX.
- Introduces a sanitized Launch Context and passes it through bootstrap,
  adapter factory and MAX fallback.
- Adds an injectable application download service for Web and fallback paths.
- Keeps native MAX download as a separate synchronous user-gesture path.
- Removes the obsolete generic fallback factory and old detector API.
- Replaces platform integration docs and tests with Web + MAX contracts.

## Validation

Run `npm test` and `npm run test:platform` with Node.js 20 or newer. Also test
native download and existing application download-service integration inside a
real MAX WebView. The latter cannot be validated by this standalone unit suite.

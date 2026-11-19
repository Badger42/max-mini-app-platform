# Launch parameters and application selection

The platform adapter exposes a deliberately small, normalized launch contract:

```js
platform.launchParameters.startParam
```

For MAX this value is read from `window.WebApp.initDataUnsafe.start_param` after
MAX Bridge has loaded. Telegram uses the analogous `initDataUnsafe.start_param`
field. Regular Web and host fallback adapters expose `null`.

The detector understands both raw launch fragments and Vue Router hash URLs
such as `#/orders/42?tgWebAppData=...`. MAX launch detection follows the SDK's
source precedence: current hash, the original navigation URL exposed by the
Performance API, then the SDK's per-key `sessionStorage` values. Telegram
detection follows its SDK's behavior: current hash fields take precedence and
missing fields are merged from `__telegram__initParams` in `sessionStorage`.
Storage and Performance API access are best-effort; inaccessible values do not
prevent normal Web startup.

The value is available after `createPlatform()` returns and before `createApp()`
is called. This makes it possible to select a root Vue application, Router and
Store without mounting an intermediate application or changing the URL hash.

Example:

```js
const platform = createPlatform({ launchContext, bridgeType, bridge, bridgeError })
const selectedApp = await resolveApp(platform.launchParameters)
const app = createApp(selectedApp.component)
app.use(PlatformPlugin, platform)
for (const plugin of selectedApp.plugins ?? []) app.use(plugin)
app.mount('#app')
platform.ready()
```

`startParam` is untrusted input. It is only a routing/context hint. Do not use it
for authentication, authorization, user identity, file access, or permission
decisions. Validate any referenced resource through the existing backend.

If the SDK cannot be loaded, the fallback adapter cannot expose the parsed
`startParam` and reports `null`; host detection still uses the persisted launch
markers. The fallback is intentionally not treated as an authenticated host
session.

## Official references

- [MAX Mini App deep links and startapp](https://dev.max.ru/docs/webapps/introduction)
- [MAX Bridge initDataUnsafe and start_param](https://dev.max.ru/docs/webapps/bridge)
- [Telegram Mini App start parameters](https://core.telegram.org/bots/webapps)

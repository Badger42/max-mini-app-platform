# Launch parameters and application selection

The platform adapter exposes a deliberately small, normalized launch contract:

```js
platform.launchParameters.startParam
```

For MAX this value is read from `window.WebApp.initDataUnsafe.start_param` after
MAX Bridge has loaded. Telegram uses the analogous `initDataUnsafe.start_param`
field. Regular Web and host fallback adapters expose `null`.

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

If the SDK cannot be loaded, the adapter cannot read the SDK's parsed launch
payload and reports `null`; the fallback is intentionally not treated as an
authenticated host session.

## Official references

- [MAX Mini App deep links and startapp](https://dev.max.ru/docs/webapps/introduction)
- [MAX Bridge initDataUnsafe and start_param](https://dev.max.ru/docs/webapps/bridge)
- [Telegram Mini App start parameters](https://core.telegram.org/bots/webapps)

# Applying the platform API refactor

This is an overlay for `Badger42/max-mini-app-platform` at base commit
`24a64aeea47feefe49e570a881be89111dfdee89`.

## Apply

1. Check out the repository and create your own working branch.
2. Unzip this archive into the repository root, preserving paths and replacing
   files when prompted.
3. Run the tests:

   ```bash
   node --experimental-default-type=module --test tests/*.test.mjs
   ```

4. Review the diff and commit it on your branch.

## API migration

Replace:

```js
this.$platform.isMax
this.$platform.isTelegram
this.$platform.openMaxLink(url)
this.$platform.openTelegramLink(url)
```

with:

```js
this.$platform.bridgeType === 'max'
this.$platform.bridgeType === 'telegram'
this.$platform.openPlatformLink(url)
```

`bridgeType` is `null` for Web, `'max'` for MAX, and `'telegram'` for Telegram.
`bridgeAvailable` independently tells whether the relevant SDK loaded. The
separate `environment` property has been removed because it duplicated these
two values.

The SDK-specific calls remain encapsulated:

- MAX `openPlatformLink()` calls `WebApp.openMaxLink()`.
- Telegram `openPlatformLink()` calls `WebApp.openTelegramLink()`.
- Web opens the URL in a new browser tab/window.

The public capability key `nativePlatformLinks` replaces the platform-specific
`nativeMaxLinks` and `nativeTelegramLinks`.

## Files in this overlay

- Updated MAX, Telegram, Web and fallback adapters.
- Updated adapter factory.
- New shared `adapterUtils.js` helpers for HTTPS validation, BackButton and
  closing confirmation.
- Updated bootstrap example.
- Updated README and Telegram integration documentation.
- New `docs/platform-api.md`.
- Expanded platform adapter tests.

The MAX and Telegram SDK loaders and launch detectors are unchanged.

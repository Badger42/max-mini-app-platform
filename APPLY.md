# Applying Phase 2 — Web + MAX integration architecture

This overlay targets `Badger42/max-mini-app-platform` after Stage 1, at base
commit `cb38e600fd90d35c1bd095780299255f561f9772`.

## Apply

1. Create a feature branch from the target commit.
2. Copy the files from this archive into the repository root, preserving paths.
3. Delete the paths listed in `DELETE-FILES.txt`.
4. Run `npm test` with Node.js 20 or newer.
5. Review the diff and validate in a real MAX WebView before release.

## API migration

Replace the old string detector and factory arguments:

```js
const detectedPlatform = detectPlatform()
createPlatform({ bridgeType: detectedPlatform === 'web' ? null : detectedPlatform })
```

with the Launch Context pipeline:

```js
const launchContext = detectLaunchContext()
let bridge = null
let bridgeError = null

if (launchContext.type === 'max') {
  try {
    bridge = await loadMaxBridge()
  } catch (error) {
    bridgeError = error
  }
}

const platform = createPlatform({
  launchContext,
  bridge,
  bridgeError,
  services: { downloadFile: existingDownloadService }
})
```

The adapter now exposes `launchContext.type` (`web|max`) and retains
`bridgeType` (`null|max`) for bridge identity. The old `detectPlatform()` and
`createPlatform({ bridgeType, error })` shapes are replaced. MAX fallback
creation now requires the Launch Context and Bridge error.

## Download service integration

The consuming application's function must have the shape
`downloadFile(url, fileName, options) => Promise`. It receives relative URLs
unchanged. If an Axios implementation resolves to a Blob, wrap it in the
consuming app and save the Blob before resolving. No Axios dependency is added
to this module.

Native MAX download is not routed through this service when native capability
exists; it is invoked synchronously from the user action and accepts only an
absolute HTTPS URL.

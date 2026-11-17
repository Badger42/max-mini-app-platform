// Example bootstrap for Vue CLI + Vue 3.
// Merge this flow into the consuming application's src/main.js and preserve
// its existing Router/store/Axios registrations before mount().

import { createApp } from 'vue'
import App from '../src/App.vue'

import detectLaunchContext from '../src/platform/detectLaunchContext.js'
import loadMaxBridge from '../src/platform/loadMaxBridge.js'
import loadTelegramBridge from '../src/platform/loadTelegramBridge.js'
import createPlatform from '../src/platform/createPlatform.js'
import PlatformPlugin from '../src/plugins/platform.js'

/** @param {import('../src/platform/platformTypes.js').DownloadServices} [services] */
async function bootstrap(services = {}) {
  const launchContext = detectLaunchContext()
  const bridgeType = launchContext.type === 'web' ? null : launchContext.type

  /** @type {import('../src/platform/platformTypes.js').MaxBridge|import('../src/platform/platformTypes.js').TelegramBridge|null} */
  let bridge = null
  /** @type {Error|null} */
  let bridgeError = null

  if (bridgeType === 'max') {
    try {
      bridge = await loadMaxBridge({ timeoutMs: 5000 })
    } catch (error) {
      bridgeError = error instanceof Error ? error : new Error(String(error))
      console.error('[platform] MAX Bridge unavailable:', error)
    }
  } else if (bridgeType === 'telegram') {
    try {
      bridge = await loadTelegramBridge({ timeoutMs: 5000 })
    } catch (error) {
      bridgeError = error instanceof Error ? error : new Error(String(error))
      console.error('[platform] Telegram SDK unavailable:', error)
    }
  }

  // Supply the consuming application's Axios/Blob download operation here.
  // It receives (url, fileName, options) and owns credentials/CORS/saving.
  const platform = createPlatform({
    launchContext,
    bridgeType,
    bridge,
    bridgeError,
    services
  })

  const app = createApp(App)
  app.use(PlatformPlugin, platform)

  // Register existing Router/store/other plugins here, before mount().
  // app.use(router)
  // app.use(store)

  app.mount('#app')
  platform.ready()
}

bootstrap().catch(error => {
  console.error('[app] Bootstrap failed:', error)
})

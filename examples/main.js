// Example bootstrap for Vue CLI + Vue 3.
// Merge this flow into your existing src/main.js and keep your existing
// Router, store, Axios and other plugin registrations before mount().

import { createApp } from 'vue'
import App from '../src/App.vue'

import detectPlatform from '../src/platform/detectPlatform.js'
import loadMaxBridge from '../src/platform/loadMaxBridge.js'
import loadTelegramBridge from '../src/platform/loadTelegramBridge.js'
import createPlatform from '../src/platform/createPlatform.js'
import PlatformPlugin from '../src/plugins/platform.js'

async function bootstrap() {
  const detectedPlatform = detectPlatform()
  const bridgeType = detectedPlatform === 'web' ? null : detectedPlatform

  let bridge = null
  let bridgeError = null

  if (bridgeType === 'max') {
    try {
      bridge = await loadMaxBridge({ timeoutMs: 5000 })
    } catch (error) {
      bridgeError = error
      console.error('[platform] MAX Bridge unavailable:', error)
    }
  } else if (bridgeType === 'telegram') {
    try {
      bridge = await loadTelegramBridge({ timeoutMs: 5000 })
    } catch (error) {
      bridgeError = error
      console.error('[platform] Telegram SDK unavailable:', error)
    }
  }

  const platform = createPlatform({
    bridgeType,
    bridge,
    error: bridgeError
  })

  const app = createApp(App)
  app.use(PlatformPlugin, platform)

  // Register existing Router/store/other plugins here, before mount().
  // app.use(router)
  // app.use(store)

  app.mount('#app')

  // Telegram hides its loading placeholder after essential UI is mounted.
  // MAX and Web adapters expose a no-op ready() for a common bootstrap API.
  platform.ready()
}

bootstrap().catch(error => {
  console.error('[app] Bootstrap failed:', error)
})

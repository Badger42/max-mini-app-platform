// Example bootstrap for Vue CLI + Vue 3.
// Merge this flow into your existing src/main.js; keep your Router, store,
// Axios and other plugins where they are currently registered.

import { createApp } from 'vue'
import App from '../src/App.vue'

import detectPlatform from '../src/platform/detectPlatform.js'
import loadMaxBridge from '../src/platform/loadMaxBridge.js'
import loadTelegramBridge from '../src/platform/loadTelegramBridge.js'
import createPlatform from '../src/platform/createPlatform.js'
import PlatformPlugin from '../src/plugins/platform.js'

async function bootstrap() {
  const environment = detectPlatform()
  let platform

  if (environment === 'max') {
    try {
      const webApp = await loadMaxBridge({ timeoutMs: 5000 })
      platform = createPlatform({ environment: 'max', webApp })
    } catch (error) {
      console.error('[platform] MAX Bridge unavailable:', error)
      platform = createPlatform({ environment: 'max-fallback', error })
    }
  } else if (environment === 'telegram') {
    try {
      const webApp = await loadTelegramBridge({ timeoutMs: 5000 })
      platform = createPlatform({ environment: 'telegram', webApp })
    } catch (error) {
      console.error('[platform] Telegram SDK unavailable:', error)
      platform = createPlatform({ environment: 'telegram-fallback', error })
    }
  } else {
    // Ordinary website: do not request either platform CDN.
    platform = createPlatform({ environment: 'web' })
  }

  const app = createApp(App)
  app.use(PlatformPlugin, platform)

  // Register existing Router/store/other plugins here, before mount.
  // app.use(router)
  // app.use(store)

  app.mount('#app')

  // Telegram hides its loading placeholder after essential UI is mounted.
  // MAX and Web adapters expose a no-op ready() for a stable bootstrap contract.
  platform.ready()
}

bootstrap().catch((error) => {
  console.error('[app] Bootstrap failed:', error)
})

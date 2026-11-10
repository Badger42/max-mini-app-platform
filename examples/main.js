// Example bootstrap for Vue CLI + Vue 3.
// Merge this flow into your existing src/main.js; keep your Router, store,
// Axios and other plugins where they are currently registered.

import { createApp } from 'vue'
import App from '../src/App.vue'

import detectMaxLaunch from '../src/platform/detectMaxLaunch'
import loadMaxBridge from '../src/platform/loadMaxBridge'
import createPlatform from '../src/platform/createPlatform'
import PlatformPlugin from '../src/plugins/platform'

async function bootstrap() {
  let platform

  if (!detectMaxLaunch()) {
    // Ordinary website: do not request https://st.max.ru at all.
    platform = createPlatform({ environment: 'web' })
  } else {
    try {
      const webApp = await loadMaxBridge({ timeoutMs: 5000 })
      platform = createPlatform({ environment: 'max', webApp })
    } catch (error) {
      // MAX launch detected, but the Bridge CDN/API is unavailable.
      console.error('[platform] MAX Bridge unavailable:', error)
      platform = createPlatform({ environment: 'max-fallback', error })
    }
  }

  const app = createApp(App)
  app.use(PlatformPlugin, platform)

  // Register existing Router/store/other plugins here, before mount.
  // app.use(router)
  // app.use(store)

  app.mount('#app')
}

bootstrap().catch((error) => {
  // This catches an unexpected bootstrap error, not an ordinary Bridge error.
  console.error('[app] Bootstrap failed:', error)
})

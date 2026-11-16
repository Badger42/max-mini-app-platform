// Example bootstrap for Vue 3 + Vue CLI. Merge this flow into your existing
// src/main.js; keep Router, store, Axios and other app registrations.

import { createApp } from 'vue'
import App from '../src/App.vue'

import detectLaunchContext from '../src/platform/detectLaunchContext.js'
import loadMaxBridge from '../src/platform/loadMaxBridge.js'
import createPlatform from '../src/platform/createPlatform.js'
import PlatformPlugin from '../src/plugins/platform.js'

// Assign your existing app download function here when you want to keep its
// Axios interceptors, cookie settings, headers and Blob handling. Omit it to
// use the module's standalone Fetch/Blob fallback.
const services = {
  // downloadFile: existingDownloadService
}

async function bootstrap() {
  // Do this before creating Vue Router: a router may rewrite the URL fragment.
  const launchContext = detectLaunchContext()

  let bridge = null
  let bridgeError = null

  if (launchContext.type === 'max') {
    try {
      bridge = await loadMaxBridge({ timeoutMs: 5000 })
    } catch (error) {
      bridgeError = error
      console.error('[platform] MAX Bridge unavailable:', error)
    }
  }

  const platform = createPlatform({
    launchContext,
    bridge,
    bridgeError,
    services
  })

  const app = createApp(App)
  app.use(PlatformPlugin, platform)

  // Register the existing Router/store/other plugins here, before mount().
  // app.use(router)
  // app.use(store)

  app.mount('#app')
  platform.ready()
}

bootstrap().catch(error => {
  console.error('[app] Bootstrap failed:', error)
})

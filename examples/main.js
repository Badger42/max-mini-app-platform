// Example bootstrap for Vue CLI + Vue 3.
// Merge this flow into the consuming application's src/main.js and preserve
// its existing services. Resolve the root app before createApp() so startapp can
// choose the component, Router and Store without changing window.location.

import { createApp } from 'vue'

import detectLaunchContext from '../src/platform/detectLaunchContext.js'
import loadMaxBridge from '../src/platform/loadMaxBridge.js'
import loadTelegramBridge from '../src/platform/loadTelegramBridge.js'
import createPlatform from '../src/platform/createPlatform.js'
import PlatformPlugin from '../src/plugins/platform.js'

/**
 * @typedef {{component: unknown, plugins?: unknown[]}} ResolvedApplication
 * @typedef {Object} BootstrapOptions
 * @property {(parameters: import('../src/platform/platformTypes.js').LaunchParameters) => ResolvedApplication|Promise<ResolvedApplication>} resolveApp
 * @property {unknown[]} [plugins] Plugins shared by every app variant (for example, a common diagnostics plugin).
 * @property {import('../src/platform/platformTypes.js').DownloadServices} [services]
 * @property {string} [mountTarget]
 */

/**
 * @param {Partial<BootstrapOptions>} [options]
 * @returns {Promise<{app: unknown, platform: import('../src/platform/platformTypes.js').PlatformAdapter}>}
 */
export async function bootstrap({
  resolveApp,
  plugins = [],
  services = {},
  mountTarget = '#app'
} = {}) {
  if (typeof resolveApp !== 'function') {
    throw new TypeError('resolveApp is required and must return { component, plugins? }')
  }

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

  const platform = createPlatform({
    launchContext,
    bridgeType,
    bridge,
    bridgeError,
    services
  })

  // This runs after launch data is available and before createApp()/mount().
  const selectedApp = await resolveApp(platform.launchParameters)
  if (!selectedApp || !selectedApp.component) {
    throw new TypeError('resolveApp must return an object with a Vue component')
  }

  const app = createApp(/** @type {any} */ (selectedApp.component))
  app.use(PlatformPlugin, platform)

  for (const plugin of [...plugins, ...(selectedApp.plugins || [])]) {
    app.use(/** @type {any} */ (plugin))
  }

  app.mount(mountTarget)
  platform.ready()
  return { app, platform }
}

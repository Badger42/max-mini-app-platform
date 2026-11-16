import createFallbackAdapter from './createFallbackAdapter.js'

/**
 * Legacy Telegram fallback factory; retained for the preceding migration stage.
 * @param {Error|string|null} error
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createTelegramFallbackAdapter(error, options = {}) {
  return createFallbackAdapter('telegram', error, options)
}

import createFallbackAdapter from './createFallbackAdapter.js'

/**
 * Backward-compatible Telegram fallback adapter factory.
 */
export default function createTelegramFallbackAdapter(error, options = {}) {
  return createFallbackAdapter('telegram', error, options)
}

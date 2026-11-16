import createMaxAdapter from './maxAdapter.js'
import createWebAdapter from './webAdapter.js'
import createFallbackAdapter from './createFallbackAdapter.js'
import createTelegramAdapter from './telegramAdapter.js'

/**
 * Selects exactly one adapter before Vue is mounted.
 *
 * bridgeType identifies the host, not the physical device:
 * - null / 'web': regular browser
 * - 'max': MAX WebApp bridge
 * - 'telegram': Telegram WebApp bridge
 *
 * A recognized host with a missing bridge receives a host-specific fallback.
 */
export default function createPlatform({
  bridgeType = null,
  bridge = null,
  error = null,
  downloadOptions = {}
} = {}) {
  if (bridgeType === null || bridgeType === 'web') {
    return createWebAdapter({ downloadOptions })
  }

  if (bridgeType === 'max' && bridge) {
    return createMaxAdapter(bridge, { downloadOptions })
  }

  if (bridgeType === 'telegram' && bridge) {
    return createTelegramAdapter(bridge, { downloadOptions })
  }

  if (bridgeType === 'max' || bridgeType === 'telegram') {
    return createFallbackAdapter(bridgeType, error, { downloadOptions })
  }

  throw new TypeError(`Unsupported bridgeType: ${bridgeType}`)
}

import createMaxAdapter from './maxAdapter.js'
import createWebAdapter from './webAdapter.js'
import createMaxFallbackAdapter from './maxFallbackAdapter.js'
import createTelegramAdapter from './telegramAdapter.js'
import createTelegramFallbackAdapter from './telegramFallbackAdapter.js'

/**
 * Selects one platform adapter before Vue is mounted.
 *
 * bridgeType identifies the host SDK, not the physical device:
 * - null: regular browser
 * - 'max': MAX WebApp bridge
 * - 'telegram': Telegram WebApp bridge
 *
 * A missing bridge for a recognized host selects that host's fallback.
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

  if (bridgeType === 'max') {
    return bridge
      ? createMaxAdapter(bridge, { downloadOptions })
      : createMaxFallbackAdapter(error, { downloadOptions })
  }

  if (bridgeType === 'telegram') {
    return bridge
      ? createTelegramAdapter(bridge, { downloadOptions })
      : createTelegramFallbackAdapter(error, { downloadOptions })
  }

  throw new TypeError(`Unsupported bridgeType: ${bridgeType}`)
}

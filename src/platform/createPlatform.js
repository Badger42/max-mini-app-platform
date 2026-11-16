import createMaxAdapter from './maxAdapter.js'
import createWebAdapter from './webAdapter.js'
import createFallbackAdapter from './createFallbackAdapter.js'
import createTelegramAdapter from './telegramAdapter.js'

/**
 * Select exactly one adapter before Vue is mounted.
 * `null` selects Web; the Telegram branch is a legacy compatibility path.
 *
 * @param {import('./platformTypes.js').CreatePlatformOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
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
    return createMaxAdapter(/** @type {import('./platformTypes.js').MaxBridge} */ (bridge), { downloadOptions })
  }

  if (bridgeType === 'telegram' && bridge) {
    return createTelegramAdapter(
      /** @type {import('./platformTypes.js').TelegramBridge} */ (bridge),
      { downloadOptions }
    )
  }

  if (bridgeType === 'max' || bridgeType === 'telegram') {
    return createFallbackAdapter(bridgeType, error, { downloadOptions })
  }

  throw new TypeError(`Unsupported bridgeType: ${bridgeType}`)
}

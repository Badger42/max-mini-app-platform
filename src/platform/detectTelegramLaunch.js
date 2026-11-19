import {
  getEffectiveTelegramLaunchHash,
  parseLaunchHashParams
} from './launchParameterSources.js'

const TELEGRAM_LAUNCH_KEYS = [
  'tgWebAppData',
  'tgWebAppPlatform',
  'tgWebAppVersion'
]

/**
 * Parse Telegram launch parameters from the URL fragment.
 * This is a script-loading hint, never an authentication result.
 * @param {string|null|undefined} hash
 * @returns {import('./platformTypes.js').TelegramLaunchParseResult}
 */
export function parseTelegramLaunchHash(hash) {
  const params = parseLaunchHashParams(hash)
  const hasDuplicates = TELEGRAM_LAUNCH_KEYS.some(key => params.getAll(key).length > 1)

  /** @param {string} key @returns {string|null} */
  const getUniqueValue = key => {
    const values = params.getAll(key)
    return values.length === 1 ? values[0] : null
  }

  const platform = getUniqueValue('tgWebAppPlatform')
  const version = getUniqueValue('tgWebAppVersion')
  const initData = getUniqueValue('tgWebAppData')

  return {
    isTelegramLaunch: !hasDuplicates && Boolean(initData || (platform && version)),
    platform: platform || null,
    version: version || null,
    invalid: hasDuplicates
  }
}

/** @returns {boolean} */
/** @returns {boolean} */
export default function detectTelegramLaunch() {
  // Do not use window.Telegram as evidence of Telegram host context.
  // Telegram's SDK merges the persisted __telegram__initParams after routing.
  return parseTelegramLaunchHash(getEffectiveTelegramLaunchHash()).isTelegramLaunch
}

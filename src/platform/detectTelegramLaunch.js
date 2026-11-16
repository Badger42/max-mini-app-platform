const TELEGRAM_LAUNCH_KEYS = [
  'tgWebAppData',
  'tgWebAppPlatform',
  'tgWebAppVersion'
]

/**
 * Parse legacy Telegram launch parameters from the URL fragment.
 * This is a script-loading hint, never an authentication result.
 * @param {string|null|undefined} hash
 * @returns {{isTelegramLaunch: boolean, platform: string|null, version: string|null, invalid: boolean}}
 */
export function parseTelegramLaunchHash(hash) {
  const fragment = String(hash || '').replace(/^#/, '')
  const params = new URLSearchParams(fragment)
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
  if (typeof window === 'undefined' || !window.location) {
    return false
  }
  // Do not use window.Telegram as evidence of Telegram host context.
  return parseTelegramLaunchHash(window.location.hash).isTelegramLaunch
}

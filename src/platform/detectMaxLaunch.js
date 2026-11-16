const MAX_PLATFORMS = new Set(['ios', 'android', 'desktop', 'web'])
const MAX_LAUNCH_KEYS = ['WebAppData', 'WebAppPlatform', 'WebAppVersion']

/**
 * Parse MAX launch parameters from the URL fragment.
 * Duplicate protocol keys are rejected rather than silently trusting one.
 * This is environment detection only, never authentication.
 *
 * @param {string|null|undefined} hash
 * @returns {import('./platformTypes.js').MaxLaunchParseResult}
 */
export function parseMaxLaunchHash(hash) {
  const fragment = String(hash || '').replace(/^#/, '')
  const params = new URLSearchParams(fragment)
  const hasDuplicates = MAX_LAUNCH_KEYS.some(key => params.getAll(key).length > 1)

  /** @param {string} key @returns {string|null} */
  const getUniqueValue = key => {
    const values = params.getAll(key)
    return values.length === 1 ? values[0] : null
  }

  const platformValue = getUniqueValue('WebAppPlatform')
  const version = getUniqueValue('WebAppVersion')
  const webAppData = getUniqueValue('WebAppData')
  const platform = typeof platformValue === 'string' && MAX_PLATFORMS.has(platformValue)
    ? /** @type {import('./platformTypes.js').MaxClientPlatform} */ (platformValue)
    : null

  const isMaxLaunch = !hasDuplicates && Boolean(
    webAppData || (platform && version)
  )

  return {
    status: hasDuplicates ? 'invalid' : (isMaxLaunch ? 'detected' : 'not-detected'),
    isMaxLaunch,
    platform,
    version: version || null,
    invalid: hasDuplicates
  }
}

/** @returns {boolean} */
export default function detectMaxLaunch() {
  if (typeof window === 'undefined' || !window.location) {
    return false
  }

  // SDK globals are not proof of host context: another script may have loaded it.
  return parseMaxLaunchHash(window.location.hash).isMaxLaunch
}

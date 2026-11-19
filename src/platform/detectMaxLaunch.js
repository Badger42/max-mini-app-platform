import {
  getEffectiveMaxLaunchHash,
  parseLaunchHashParams
} from './launchParameterSources.js'

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
  const params = parseLaunchHashParams(hash)
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
  // SDK globals are not proof of MAX host context: another script may have loaded it.
  // MAX also restores parameters from the original navigation URL and
  // per-key sessionStorage after a hash router replaces location.hash.
  return parseMaxLaunchHash(getEffectiveMaxLaunchHash()).isMaxLaunch
}

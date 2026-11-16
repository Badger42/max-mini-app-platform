const MAX_PLATFORMS = new Set(['ios', 'android', 'desktop', 'web'])
const MAX_LAUNCH_KEYS = ['WebAppData', 'WebAppPlatform', 'WebAppVersion']

/**
 * Parse MAX launch parameters from the URL fragment.
 *
 * Duplicate protocol parameters are rejected rather than silently trusting the
 * first value. This is environment detection only, never authentication.
 */
export function parseMaxLaunchHash(hash) {
  const fragment = String(hash || '').replace(/^#/, '')
  const params = new URLSearchParams(fragment)
  const hasDuplicates = MAX_LAUNCH_KEYS.some(key => params.getAll(key).length > 1)

  const getUniqueValue = key => {
    const values = params.getAll(key)
    return values.length === 1 ? values[0] : null
  }

  const platformValue = getUniqueValue('WebAppPlatform')
  const version = getUniqueValue('WebAppVersion')
  const webAppData = getUniqueValue('WebAppData')
  const platform = MAX_PLATFORMS.has(platformValue) ? platformValue : null

  const isMaxLaunch = !hasDuplicates && Boolean(
    webAppData || (platform && version)
  )

  return {
    isMaxLaunch,
    platform,
    version: version || null,
    invalid: hasDuplicates
  }
}

export default function detectMaxLaunch() {
  if (typeof window === 'undefined' || !window.location) {
    return false
  }

  // SDK globals are not proof of host context: another script may have loaded it.
  return parseMaxLaunchHash(window.location.hash).isMaxLaunch
}

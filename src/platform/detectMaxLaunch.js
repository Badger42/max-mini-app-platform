const MAX_PLATFORMS = new Set(['ios', 'android', 'desktop', 'web'])

/**
 * Read MAX launch parameters from the URL fragment.
 *
 * MAX documents the fragment parameters WebAppData, WebAppPlatform and
 * WebAppVersion. This is environment detection only; it is NOT authentication
 * and must never be used as proof of a user's identity.
 */
export function parseMaxLaunchHash(hash) {
  const fragment = String(hash || '').replace(/^#/, '')
  const params = new URLSearchParams(fragment)
  const platform = params.get('WebAppPlatform')
  const version = params.get('WebAppVersion')
  const hasWebAppData = params.has('WebAppData')

  const isMaxLaunch = hasWebAppData || (
    MAX_PLATFORMS.has(platform) && Boolean(version)
  )

  return {
    isMaxLaunch,
    platform: MAX_PLATFORMS.has(platform) ? platform : null,
    version: version || null
  }
}

export default function detectMaxLaunch() {
  // Useful when the host has already injected the Bridge for some reason.
  if (typeof window !== 'undefined' && window.WebApp) {
    return true
  }

  if (typeof window === 'undefined' || !window.location) {
    return false
  }

  return parseMaxLaunchHash(window.location.hash).isMaxLaunch
}

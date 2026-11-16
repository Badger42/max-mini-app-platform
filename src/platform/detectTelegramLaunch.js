/**
 * Telegram Mini Apps pass launch parameters in the URL fragment.
 * This is runtime detection only. It is NOT authentication and must never be
 * used as proof of a user's identity.
 */
export function parseTelegramLaunchHash(hash) {
  const fragment = String(hash || '').replace(/^#/, '')
  const params = new URLSearchParams(fragment)
  const platform = params.get('tgWebAppPlatform')
  const version = params.get('tgWebAppVersion')
  const hasInitDataMarker = params.has('tgWebAppData')

  return {
    isTelegramLaunch: hasInitDataMarker || Boolean(platform && version),
    platform: platform || null,
    version: version || null
  }
}

export default function detectTelegramLaunch() {
  if (typeof window === 'undefined') {
    return false
  }

  // Also recognize an SDK object supplied by the host before our bootstrap.
  if (window.Telegram && window.Telegram.WebApp) {
    return true
  }

  if (!window.location) {
    return false
  }

  return parseTelegramLaunchHash(window.location.hash).isTelegramLaunch
}

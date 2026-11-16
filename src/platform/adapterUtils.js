/**
 * Platform-neutral helpers shared by all adapters.
 * Platform-specific SDK method names must remain inside their adapters.
 */

export function requireHttpsUrl(value, methodName = 'operation') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${methodName}: a URL is required`)
  }

  let url

  try {
    url = new URL(value)
  } catch (_) {
    throw new TypeError(`${methodName}: a valid absolute URL is required`)
  }

  if (url.protocol !== 'https:') {
    throw new TypeError(`${methodName}: only HTTPS URLs are supported`)
  }

  if (url.username || url.password) {
    throw new TypeError(`${methodName}: URLs containing credentials are not supported`)
  }

  return url.href
}

/**
 * `window.open()` returns null with noopener in several browsers, even when
 * the new tab was requested successfully. Do not interpret that return value
 * as popup-blocking feedback.
 */
export function openInBrowser(url) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { status: 'unavailable' }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
  return { status: 'requested' }
}

export function canOpenInBrowser() {
  return typeof window !== 'undefined' && typeof window.open === 'function'
}

/**
 * Normalizes the structurally identical BackButton APIs exposed by MAX and
 * Telegram. The returned unsubscribe function is idempotent.
 */
export function createBackButton(nativeBackButton) {
  const supported = Boolean(
    nativeBackButton &&
    typeof nativeBackButton.show === 'function' &&
    typeof nativeBackButton.hide === 'function' &&
    typeof nativeBackButton.onClick === 'function' &&
    typeof nativeBackButton.offClick === 'function'
  )

  return {
    supported,

    show() {
      if (supported) {
        return nativeBackButton.show()
      }
    },

    hide() {
      if (supported) {
        return nativeBackButton.hide()
      }
    },

    onClick(handler) {
      if (!supported || typeof handler !== 'function') {
        return () => {}
      }

      nativeBackButton.onClick(handler)
      let subscribed = true

      return () => {
        if (!subscribed) return
        subscribed = false
        nativeBackButton.offClick(handler)
      }
    }
  }
}

/**
 * Normalizes closing-confirmation methods shared by MAX and Telegram.
 */
export function createClosingConfirmation(bridge) {
  const supported = Boolean(
    bridge &&
    typeof bridge.enableClosingConfirmation === 'function' &&
    typeof bridge.disableClosingConfirmation === 'function'
  )

  return {
    supported,

    enable() {
      if (supported) {
        return bridge.enableClosingConfirmation()
      }
    },

    disable() {
      if (supported) {
        return bridge.disableClosingConfirmation()
      }
    }
  }
}

/**
 * MAX reports `downloading`; Telegram's callback is normalized to `accepted`.
 * These statuses mean a request was accepted, not that bytes reached device.
 * Unexpected responses are protocol errors rather than presumed successes.
 */
export function normalizeDownloadResult(result) {
  const platformStatus = result && typeof result.status === 'string'
    ? result.status
    : null

  switch (platformStatus) {
    case 'downloading':
    case 'accepted':
      return { status: 'requested', platformStatus }

    case 'cancelled':
      return { status: 'cancelled', platformStatus }

    default:
      throw new Error(
        `Unexpected download result from platform SDK: ${platformStatus || 'missing status'}`
      )
  }
}

/** MAX shareMaxContent() documents only `shared` and `cancelled` outcomes. */
export function normalizeShareResult(result) {
  const platformStatus = result && typeof result.status === 'string'
    ? result.status
    : null

  if (platformStatus === 'shared' || platformStatus === 'cancelled') {
    return { status: platformStatus }
  }

  throw new Error(
    `Unexpected share result from platform SDK: ${platformStatus || 'missing status'}`
  )
}

export function unavailable(methodName) {
  return Promise.reject(new Error(`${methodName} is not available in this runtime`))
}

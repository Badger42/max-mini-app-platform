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
      if (nativeBackButton && typeof nativeBackButton.show === 'function') {
        return nativeBackButton.show()
      }
    },

    hide() {
      if (nativeBackButton && typeof nativeBackButton.hide === 'function') {
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
 * MAX reports `downloading`; Telegram reports whether the user accepted.
 * Both mean that a download was requested, not that bytes reached the device.
 */
export function normalizeDownloadResult(result) {
  const platformStatus = result && typeof result.status === 'string'
    ? result.status
    : null

  if (platformStatus === 'cancelled') {
    return { status: 'cancelled', platformStatus }
  }

  return {
    status: 'requested',
    ...(platformStatus ? { platformStatus } : {})
  }
}

export function normalizeShareResult(result) {
  if (result && typeof result === 'object') {
    const status = result.status
    if (['shared', 'cancelled', 'opened', 'copied', 'requested'].includes(status)) {
      return result
    }

    return { status: 'requested', platformResult: result }
  }

  return { status: 'requested' }
}

export function unavailable(methodName) {
  return Promise.reject(new Error(`${methodName} is not available in this runtime`))
}

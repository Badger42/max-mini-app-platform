/**
 * Shared helpers used by the platform adapters.
 * Keep platform-specific API method names inside the respective adapters.
 */

export function requireHttpsUrl(value, methodName) {
  let url

  try {
    url = new URL(value)
  } catch (_) {
    throw new TypeError(`${methodName}: a valid absolute URL is required`)
  }

  if (url.protocol !== 'https:') {
    throw new TypeError(`${methodName}: only HTTPS URLs are supported`)
  }

  return url.href
}

export function openInBrowser(url) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return false
  }

  return Boolean(window.open(url, '_blank', 'noopener,noreferrer'))
}

/**
 * Normalizes the structurally identical BackButton APIs exposed by MAX and
 * Telegram. The caller supplies the native BackButton object.
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

export function unavailable(methodName) {
  return Promise.reject(new Error(`${methodName} is not available in this runtime`))
}

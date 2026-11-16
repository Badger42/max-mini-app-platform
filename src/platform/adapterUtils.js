/**
 * Platform-neutral helpers shared by the Web and MAX adapters.
 * Platform-specific SDK method names remain inside their adapters.
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

export function openInBrowser(url) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { status: 'unavailable' }
  }

  // noopener can make window.open() return null even when the tab was requested.
  window.open(url, '_blank', 'noopener,noreferrer')
  return { status: 'requested' }
}

export function canOpenInBrowser() {
  return typeof window !== 'undefined' && typeof window.open === 'function'
}

/**
 * Invoke the application's download service or the standalone Blob fallback.
 * The injected service owns URL/authentication/Axios details. In particular,
 * the Web adapter must not rewrite relative API URLs to absolute HTTPS URLs.
 */
export function invokeDownloadService(service, url, fileName, options, fallback) {
  if (typeof url !== 'string' || !url.trim()) {
    return Promise.reject(new TypeError('downloadFile: a URL is required'))
  }

  if (typeof fileName !== 'string' || !fileName.trim()) {
    return Promise.reject(new TypeError('A file name is required'))
  }

  if (service !== undefined && service !== null && typeof service !== 'function') {
    return Promise.reject(new TypeError('services.downloadFile must be a function'))
  }

  let operation
  try {
    operation = typeof service === 'function'
      ? service(url, fileName, options)
      : fallback(url, fileName, options)
  } catch (error) {
    return Promise.reject(error)
  }

  return Promise.resolve(operation).then(result => {
    // The public contract intentionally exposes a small, adapter-neutral result.
    if (result && typeof result.status === 'string') {
      if (result.status === 'cancelled') return { status: 'cancelled' }
      if (result.status !== 'requested') {
        throw new Error(`Unexpected download service result: ${result.status}`)
      }
    }
    return { status: 'requested' }
  })
}

/**
 * The native BackButton API must be complete before it is advertised as
 * supported: offClick is required for deterministic subscription disposal.
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
      if (supported) return nativeBackButton.show()
    },
    hide() {
      if (supported) return nativeBackButton.hide()
    },
    onClick(handler) {
      if (!supported || typeof handler !== 'function') return () => {}
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

export function createClosingConfirmation(bridge) {
  const supported = Boolean(
    bridge &&
    typeof bridge.enableClosingConfirmation === 'function' &&
    typeof bridge.disableClosingConfirmation === 'function'
  )

  return {
    supported,
    enable() {
      if (supported) return bridge.enableClosingConfirmation()
    },
    disable() {
      if (supported) return bridge.disableClosingConfirmation()
    }
  }
}

/** MAX reports `downloading` when the native request has been accepted. */
export function normalizeDownloadResult(result) {
  const platformStatus = result && typeof result.status === 'string'
    ? result.status
    : null

  if (platformStatus === 'downloading') {
    return { status: 'requested', platformStatus }
  }

  if (platformStatus === 'cancelled') {
    return { status: 'cancelled', platformStatus }
  }

  throw new Error(
    `Unexpected download result from MAX Bridge: ${platformStatus || 'missing status'}`
  )
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
    `Unexpected share result from MAX Bridge: ${platformStatus || 'missing status'}`
  )
}

export function unavailable(methodName) {
  return Promise.reject(new Error(`${methodName} is not available in this runtime`))
}

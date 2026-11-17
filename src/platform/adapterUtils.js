/**
 * Platform-neutral helpers shared by adapters. Platform-specific SDK method
 * names and status values remain in their respective adapter modules.
 */

/**
 * Validate and canonicalize an absolute HTTPS URL.
 * @param {unknown} value
 * @param {string} [methodName]
 * @returns {string}
 */
export function requireHttpsUrl(value, methodName = 'operation') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${methodName}: a URL is required`)
  }

  let url
  try {
    url = new URL(value)
  } catch {
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
 * MAX deep links are documented as `https://max.ru/...`. Do not accept
 * look-alike domains such as `max.ru.attacker.example` or `evilmax.ru`.
 * @param {unknown} value
 * @param {string} [methodName]
 * @returns {string}
 */
export function requireMaxDeepLink(value, methodName = 'openPlatformLink') {
  const href = requireHttpsUrl(value, methodName)
  const url = new URL(href)

  if (url.hostname !== 'max.ru') {
    throw new TypeError(`${methodName}: a MAX deep link on https://max.ru is required`)
  }

  return href
}

/**
 * Validate a file name before starting either native or browser download.
 * @param {unknown} value
 * @returns {string}
 */
export function requireFileName(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('A file name is required')
  }
  return value
}

/**
 * Execute the application's injected download service, if supplied.
 * The service owns URL resolution, Axios/fetch policy, credentials, Blob
 * handling and saving. It is invoked synchronously so callers can preserve the
 * original user-gesture stack where the service requires it.
 *
 * @param {(url: string, fileName: string, options: Record<string, unknown>) => unknown} service
 * @param {string} url
 * @param {string} fileName
 * @param {Record<string, unknown>} options
 * @returns {Promise<import('./platformTypes.js').DownloadResult>}
 */
export function runDownloadService(service, url, fileName, options) {
  let result
  try {
    result = service(url, fileName, options)
  } catch (error) {
    return Promise.reject(error)
  }

  return Promise.resolve(result).then(value => {
    if (value === undefined || value === null ||
        (typeof value === 'object' && !('status' in value))) {
      return { status: 'requested' }
    }

    const status = typeof value === 'object'
      ? /** @type {{status?: unknown}} */ (value).status
      : undefined
    if (status === 'requested') return { status: 'requested' }
    if (status === 'cancelled') return { status: 'cancelled' }

    throw new Error(`Unexpected download service result: ${String(status)}`)
  })
}

/**
 * `window.open()` returns null with noopener in several browsers, even when
 * the new tab was requested successfully. Do not interpret that as failure.
 * @param {string} url
 * @returns {import('./platformTypes.js').LinkOpenResult}
 */
export function openInBrowser(url) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { status: 'unavailable' }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
  return { status: 'requested' }
}

/** @returns {boolean} */
export function canOpenInBrowser() {
  return typeof window !== 'undefined' && typeof window.open === 'function'
}

/**
 * Error raised when an SDK resolves with an undocumented or malformed result.
 */
export class PlatformProtocolError extends Error {
  /**
   * @param {'downloadFile'|'shareUrl'|'sharePreparedMessage'} operation
   * @param {string|null} receivedStatus
   */
  constructor(operation, receivedStatus) {
    const label = receivedStatus || 'missing status'
    super(`Unexpected ${operation} result from platform SDK: ${label}`)
    this.name = 'PlatformProtocolError'
    /** @type {'downloadFile'|'shareUrl'|'sharePreparedMessage'} */
    this.operation = operation
    /** @type {string|null} */
    this.receivedStatus = receivedStatus
  }
}

/**
 * Read a status from untrusted SDK output without widening it to arbitrary
 * strings at the public boundary.
 * @param {unknown} result
 * @returns {string|null}
 */
function readPlatformStatus(result) {
  if (typeof result !== 'object' || result === null || !('status' in result)) {
    return null
  }
  const status = /** @type {{status?: unknown}} */ (result).status
  return typeof status === 'string' ? status : null
}

/**
 * @param {unknown} result
 * @returns {import('./platformTypes.js').DownloadResult}
 */
export function normalizeMaxDownloadResult(result) {
  const platformStatus = readPlatformStatus(result)
  switch (platformStatus) {
    case 'downloading': return { status: 'requested', platformStatus }
    case 'cancelled': return { status: 'cancelled', platformStatus }
    default: throw new PlatformProtocolError('downloadFile', platformStatus)
  }
}

/**
 * @param {unknown} result
 * @returns {import('./platformTypes.js').DownloadResult}
 */
export function normalizeTelegramDownloadResult(result) {
  const platformStatus = readPlatformStatus(result)
  switch (platformStatus) {
    case 'accepted': return { status: 'requested', platformStatus }
    case 'cancelled': return { status: 'cancelled', platformStatus }
    default: throw new PlatformProtocolError('downloadFile', platformStatus)
  }
}

/**
 * @param {unknown} result
 * @returns {import('./platformTypes.js').MaxShareUrlResult}
 */
export function normalizeMaxShareResult(result) {
  const platformStatus = readPlatformStatus(result)
  if (platformStatus === 'shared' || platformStatus === 'cancelled') {
    return { status: platformStatus }
  }
  throw new PlatformProtocolError('shareUrl', platformStatus)
}

/**
 * @param {unknown} result
 * @returns {import('./platformTypes.js').MaxPreparedMessageResult}
 */
export function normalizeMaxPreparedMessageResult(result) {
  const platformStatus = readPlatformStatus(result)
  if (platformStatus === 'shared' || platformStatus === 'cancelled') {
    return { status: platformStatus }
  }
  throw new PlatformProtocolError('sharePreparedMessage', platformStatus)
}

/**
 * Normalize the structurally identical BackButton APIs used by MAX and
 * Telegram. The returned unsubscribe function is idempotent.
 * @param {import('./platformTypes.js').NativeBackButton|undefined} nativeBackButton
 * @returns {import('./platformTypes.js').BackButtonService}
 */
export function createBackButton(nativeBackButton) {
  const supported = Boolean(
    nativeBackButton &&
    typeof nativeBackButton.show === 'function' &&
    typeof nativeBackButton.hide === 'function' &&
    typeof nativeBackButton.onClick === 'function' &&
    typeof nativeBackButton.offClick === 'function'
  )
  const nativeButton = supported ? nativeBackButton : null

  return {
    supported,
    show() {
      if (nativeButton) nativeButton.show()
    },
    hide() {
      if (nativeButton) nativeButton.hide()
    },
    onClick(handler) {
      if (!nativeButton || typeof handler !== 'function') return () => {}
      nativeButton.onClick(handler)
      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        nativeButton.offClick(handler)
      }
    }
  }
}

/**
 * Normalize native closing-confirmation methods. Unsupported methods are safe
 * no-ops; a partial SDK object must never be called accidentally.
 * @param {import('./platformTypes.js').MaxBridge|import('./platformTypes.js').TelegramBridge|null} bridge
 */
export function createClosingConfirmation(bridge) {
  const enableNative = bridge && bridge.enableClosingConfirmation
  const disableNative = bridge && bridge.disableClosingConfirmation
  const supported = typeof enableNative === 'function' && typeof disableNative === 'function'

  return {
    supported,
    enable() {
      if (typeof enableNative === 'function') return enableNative.call(bridge)
    },
    disable() {
      if (typeof disableNative === 'function') return disableNative.call(bridge)
    }
  }
}

/** @param {string} methodName @returns {Promise<never>} */
export function unavailable(methodName) {
  return Promise.reject(new Error(`${methodName} is not available in this runtime`))
}

import { requireHttpsUrl, requireFileName } from './adapterUtils.js'

const DEFAULT_REVOKE_DELAY_MS = 30000
const VALID_CREDENTIALS = new Set(['omit', 'same-origin', 'include'])

/**
 * Browser fallback: fetch -> Blob -> object URL -> anchor click.
 * The returned status means the download was requested, not completed.
 *
 * The object URL is revoked after 30 seconds by default. This gives the browser
 * a short window to start consuming the download while avoiding a long-lived
 * Blob URL. Failed attempts revoke it immediately.
 *
 * @param {string} url
 * @param {string} fileName
 * @param {import('./platformTypes.js').DownloadOptions} [options]
 * @returns {Promise<import('./platformTypes.js').DownloadResult>}
 */
export default async function downloadBlob(
  url,
  fileName,
  { credentials = 'same-origin', revokeDelayMs = DEFAULT_REVOKE_DELAY_MS } = {}
) {
  const validUrl = requireHttpsUrl(url, 'downloadFile')
  const validFileName = requireFileName(fileName)

  if (!VALID_CREDENTIALS.has(credentials)) {
    throw new TypeError('credentials must be omit, same-origin or include')
  }
  if (!Number.isFinite(revokeDelayMs) || revokeDelayMs < 0) {
    throw new TypeError('revokeDelayMs must be a non-negative finite number')
  }
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available in this runtime')
  }
  if (typeof document === 'undefined' || !document.body ||
      typeof URL.createObjectURL !== 'function' ||
      typeof URL.revokeObjectURL !== 'function') {
    throw new Error('Blob downloads are not available in this runtime')
  }

  let response
  try {
    response = await fetch(validUrl, { credentials })
  } catch (error) {
    throw new Error('Download request failed; check the network and the server CORS policy', {
      cause: error
    })
  }

  if (response.type === 'opaque' || response.type === 'opaqueredirect') {
    throw new Error('The response is opaque; check the server CORS configuration')
  }
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  /** @type {HTMLAnchorElement|null} */
  let link = null
  let revokeScheduled = false
  /** @type {unknown} */
  let operationError = null

  try {
    link = /** @type {HTMLAnchorElement} */ (document.createElement('a'))
    link.href = objectUrl
    link.download = validFileName
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()

    const schedule = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
      ? window.setTimeout.bind(window)
      : setTimeout

    schedule(() => {
      try { URL.revokeObjectURL(objectUrl) } catch { /* Best-effort browser resource cleanup. */ }
    }, revokeDelayMs)
    revokeScheduled = true

    return { status: 'requested' }
  } catch (error) {
    operationError = error
    throw error
  } finally {
    let cleanupError = null

    if (link) {
      try {
        if (link.parentNode) link.parentNode.removeChild(link)
      } catch (error) {
        cleanupError = error
      }

      // Try the element-level removal API if the parent refused removal.
      if (link.parentNode && typeof link.remove === 'function') {
        try {
          link.remove()
          cleanupError = null
        } catch (error) {
          cleanupError ||= error
        }
      }
    }

    if (!revokeScheduled) {
      try { URL.revokeObjectURL(objectUrl) } catch (error) {
        cleanupError ||= error
      }
    }

    if (operationError === null && cleanupError !== null) {
      throw cleanupError
    }
  }
}

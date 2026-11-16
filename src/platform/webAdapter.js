import downloadBlob from './downloadBlob.js'
import {
  requireHttpsUrl,
  requireFileName,
  openInBrowser,
  unavailable
} from './adapterUtils.js'

/**
 * Create the regular browser adapter. The sharing capability is effective:
 * Web Share API or Clipboard may provide it without a host bridge.
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createWebAdapter({ downloadOptions = {} } = {}) {
  const hasWebShare = (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  )
  const hasClipboard = (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  )

  return {
    bridgeType: null,
    bridgeAvailable: false,
    bridgeError: null,

    runtime: {
      clientPlatform: null,
      clientVersion: null,
      deviceName: null,
      browser: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || null : null
      },
      // Backward-compatible aliases. Prefer clientPlatform/clientVersion.
      platform: null,
      version: null
    },

    capabilities: {
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativePlatformLinks: false,
      closingConfirmation: false,
      nativeShareUrl: false,
      shareUrl: Boolean(hasWebShare || hasClipboard),
      sharePreparedMessage: false
    },

    /**
     * @param {string} url
     * @param {string} fileName
     * @param {import('./platformTypes.js').DownloadOptions} [options]
     * @returns {Promise<import('./platformTypes.js').DownloadResult>}
     */
    downloadFile(url, fileName, options = {}) {
      let validUrl
      let validFileName
      try {
        validUrl = requireHttpsUrl(url, 'downloadFile')
        validFileName = requireFileName(fileName)
      } catch (error) {
        return Promise.reject(error)
      }

      return downloadBlob(validUrl, validFileName, {
        ...downloadOptions,
        ...options
      })
    },

    /**
     * @param {string} url
     * @returns {import('./platformTypes.js').LinkOpenResult}
     */
    openExternalLink(url) {
      return openInBrowser(requireHttpsUrl(url, 'openExternalLink'))
    },

    /**
     * A regular browser has no host-specific deep-link API; opening the
     * supplied HTTPS URL is only a browser request, not a native MAX action.
     * @param {string} url
     * @returns {import('./platformTypes.js').LinkOpenResult}
     */
    openPlatformLink(url) {
      return openInBrowser(requireHttpsUrl(url, 'openPlatformLink'))
    },

    /**
     * Prefer Web Share API; use Clipboard only when Web Share is unavailable.
     * Clipboard is reported as copied only after writeText resolves.
     *
     * @param {string} url
     * @param {string} [text]
     * @returns {Promise<import('./platformTypes.js').ShareUrlResult>}
     */
    async shareUrl(url, text = '') {
      const validUrl = requireHttpsUrl(url, 'shareUrl')

      if (hasWebShare) {
        try {
          await navigator.share({ url: validUrl, text: text || undefined })
          return { status: 'shared' }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return { status: 'cancelled' }
          }
          throw error
        }
      }

      if (hasClipboard) {
        await navigator.clipboard.writeText(text ? `${text}\n${validUrl}` : validUrl)
        return { status: 'copied' }
      }

      return unavailable('URL sharing')
    },

    /** @returns {Promise<never>} */
    sharePreparedMessage() {
      return unavailable('Prepared-message sharing')
    },

    backButton: {
      supported: false,
      show() {},
      hide() {},
      onClick() {
        return () => {}
      }
    },

    enableClosingConfirmation() {},
    disableClosingConfirmation() {},
    ready() {}
  }
}

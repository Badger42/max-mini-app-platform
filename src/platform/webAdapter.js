import downloadBlob from './downloadBlob.js'
import {
  requireHttpsUrl,
  requireFileName,
  runDownloadService,
  openInBrowser,
  unavailable
} from './adapterUtils.js'

/**
 * Create the regular browser adapter. A supplied application download service
 * takes precedence over the standalone Fetch/Blob fallback.
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createWebAdapter({
  downloadOptions = {},
  services = {},
  launchContext = null
} = {}) {
  const hasWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const hasClipboard = typeof navigator !== 'undefined' &&
    navigator.clipboard && typeof navigator.clipboard.writeText === 'function'
  const downloadService = services.downloadFile

  return {
    bridgeType: null,
    bridgeAvailable: false,
    bridgeError: null,
    launchContext,
    launchParameters: Object.freeze({ startParam: null }),

    runtime: {
      clientPlatform: null,
      clientVersion: null,
      deviceName: null,
      browser: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || null : null
      },
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
      let validFileName
      try {
        validFileName = requireFileName(fileName)
      } catch (error) {
        return Promise.reject(error)
      }

      const mergedOptions = { ...downloadOptions, ...options }
      if (typeof downloadService === 'function') {
        return runDownloadService(downloadService, url, validFileName, mergedOptions)
      }

      try {
        return downloadBlob(requireHttpsUrl(url, 'downloadFile'), validFileName, mergedOptions)
      } catch (error) {
        return Promise.reject(error)
      }
    },

    /** @param {string} url @returns {import('./platformTypes.js').LinkOpenResult} */
    openExternalLink(url) {
      return openInBrowser(requireHttpsUrl(url, 'openExternalLink'))
    },

    /** @param {string} url @returns {import('./platformTypes.js').LinkOpenResult} */
    openPlatformLink(url) {
      return openInBrowser(requireHttpsUrl(url, 'openPlatformLink'))
    },

    /** @param {string} url @param {string} [text] */
    async shareUrl(url, text = '') {
      const validUrl = requireHttpsUrl(url, 'shareUrl')
      if (hasWebShare) {
        try {
          await navigator.share({ url: validUrl, text: text || undefined })
          return { status: 'shared' }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return { status: 'cancelled' }
          throw error
        }
      }
      if (hasClipboard) {
        await navigator.clipboard.writeText(text ? `${text}\n${validUrl}` : validUrl)
        return { status: 'copied' }
      }
      return unavailable('URL sharing')
    },

    sharePreparedMessage() {
      return unavailable('Prepared-message sharing')
    },

    backButton: {
      supported: false,
      show() {},
      hide() {},
      onClick() { return () => {} }
    },

    enableClosingConfirmation() {},
    disableClosingConfirmation() {},
    ready() {}
  }
}

import downloadBlob from './downloadBlob.js'
import { openInBrowser, unavailable } from './adapterUtils.js'

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
      platform: 'browser',
      version: null,
      deviceName: typeof navigator !== 'undefined' ? navigator.userAgent : null
    },

    capabilities: {
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativePlatformLinks: false,
      closingConfirmation: false,
      shareUrl: Boolean(hasWebShare || hasClipboard),
      sharePreparedMessage: false
    },

    downloadFile(url, fileName, options = {}) {
      return downloadBlob(url, fileName, {
        ...downloadOptions,
        ...options
      })
    },

    openExternalLink(url) {
      return openInBrowser(url)
    },

    openPlatformLink(url) {
      // A regular browser has no host-specific deep-link API.
      return openInBrowser(url)
    },

    async shareUrl(url, text = '') {
      if (hasWebShare) {
        try {
          await navigator.share({ url, text: text || undefined })
          return { status: 'shared' }
        } catch (error) {
          if (error && error.name === 'AbortError') {
            return { status: 'cancelled' }
          }
          throw error
        }
      }

      if (hasClipboard) {
        await navigator.clipboard.writeText(text ? `${text}\n${url}` : url)
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
      onClick() {
        return () => {}
      }
    },

    enableClosingConfirmation() {},
    disableClosingConfirmation() {},
    ready() {}
  }
}

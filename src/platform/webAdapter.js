import downloadBlob from './downloadBlob.js'

function unavailable(methodName) {
  return Promise.reject(new Error(`${methodName} is not available in a regular browser`))
}

export default function createWebAdapter({ downloadOptions = {} } = {}) {
  return {
    environment: 'web',
    isMax: false,
    isTelegram: false,
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
      nativeMaxLinks: false,
      nativeTelegramLinks: false,
      closingConfirmation: false,
      shareUrl: Boolean(
        typeof navigator !== 'undefined' &&
        (typeof navigator.share === 'function' ||
          (navigator.clipboard && typeof navigator.clipboard.writeText === 'function'))
      ),
      sharePreparedMessage: false
    },

    downloadFile(url, fileName, options = {}) {
      return downloadBlob(url, fileName, {
        ...downloadOptions,
        ...options
      })
    },

    openExternalLink(url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      return Boolean(opened)
    },

    openMaxLink(url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      return Boolean(opened)
    },

    openTelegramLink(url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      return Boolean(opened)
    },

    async shareUrl(url, text = '') {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
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

      if (typeof navigator !== 'undefined' && navigator.clipboard &&
          typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text ? `${text}\n${url}` : url)
        return { status: 'copied' }
      }

      return unavailable('URL sharing')
    },

    sharePreparedMessage() {
      return unavailable('Prepared-message sharing')
    },

    backButton: {
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

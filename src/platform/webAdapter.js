import downloadBlob from './downloadBlob'

export default function createWebAdapter({ downloadOptions = {} } = {}) {
  return {
    environment: 'web',
    isMax: false,
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
      closingConfirmation: false
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

    backButton: {
      show() {},
      hide() {},
      onClick() {
        return () => {}
      }
    },

    enableClosingConfirmation() {},
    disableClosingConfirmation() {}
  }
}

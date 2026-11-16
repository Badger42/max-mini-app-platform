import downloadBlob from './downloadBlob.js'
import {
  requireHttpsUrl,
  openInBrowser,
  createBackButton,
  createClosingConfirmation
} from './adapterUtils.js'

export default function createMaxAdapter(webApp, { downloadOptions = {} } = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.WebApp object is required')
  }

  const backButton = createBackButton(webApp.BackButton)
  const closingConfirmation = createClosingConfirmation(webApp)

  const hasNativeDownload = typeof webApp.downloadFile === 'function'
  const hasExternalLinks = typeof webApp.openLink === 'function'
  const hasPlatformLinks = typeof webApp.openMaxLink === 'function'
  const hasShareUrl = typeof webApp.shareMaxContent === 'function'

  return {
    bridgeType: 'max',
    bridgeAvailable: true,
    bridgeError: null,

    runtime: {
      platform: webApp.platform || null,
      version: webApp.version || null,
      deviceName: webApp.deviceName || null
    },

    capabilities: {
      nativeDownload: hasNativeDownload,
      backButton: backButton.supported,
      nativeExternalLinks: hasExternalLinks,
      nativePlatformLinks: hasPlatformLinks,
      closingConfirmation: closingConfirmation.supported,
      shareUrl: hasShareUrl,
      sharePreparedMessage: hasShareUrl
    },

    downloadFile(url, fileName, options = {}) {
      const validUrl = requireHttpsUrl(url, 'downloadFile')

      if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
        return Promise.reject(new TypeError('A file name is required'))
      }

      // Call directly from the user's click handler: MAX checks for a user gesture.
      if (hasNativeDownload) {
        return webApp.downloadFile(validUrl, fileName)
      }

      return downloadBlob(validUrl, fileName, {
        ...downloadOptions,
        ...options
      })
    },

    openExternalLink(url) {
      const validUrl = requireHttpsUrl(url, 'openExternalLink')

      if (hasExternalLinks) {
        return webApp.openLink(validUrl)
      }

      return openInBrowser(validUrl)
    },

    /**
     * Opens a link handled by the current host platform.
     * MAX maps this to WebApp.openMaxLink().
     */
    openPlatformLink(url) {
      const validUrl = requireHttpsUrl(url, 'openPlatformLink')

      if (hasPlatformLinks) {
        return webApp.openMaxLink(validUrl)
      }

      return openInBrowser(validUrl)
    },

    shareUrl(url, text = '') {
      const validUrl = requireHttpsUrl(url, 'shareUrl')

      if (!hasShareUrl) {
        return Promise.reject(new Error('MAX shareMaxContent is unavailable'))
      }

      return webApp.shareMaxContent({
        link: validUrl,
        ...(text ? { text: String(text) } : {})
      })
    },

    /**
     * messageId is MAX's `mid` returned by Bot API POST /messages.
     * chatType must be DIALOG or CHAT.
     */
    sharePreparedMessage({ messageId, chatType } = {}) {
      if (!messageId || typeof messageId !== 'string') {
        return Promise.reject(new TypeError('A MAX message ID (mid) is required'))
      }

      if (!['DIALOG', 'CHAT'].includes(chatType)) {
        return Promise.reject(new TypeError('chatType must be DIALOG or CHAT'))
      }

      if (!hasShareUrl) {
        return Promise.reject(new Error('MAX shareMaxContent is unavailable'))
      }

      return webApp.shareMaxContent({ mid: messageId, chatType })
    },

    backButton,

    enableClosingConfirmation() {
      return closingConfirmation.enable()
    },

    disableClosingConfirmation() {
      return closingConfirmation.disable()
    },

    // MAX does not require Telegram's ready() signal; keep a common API.
    ready() {}
  }
}

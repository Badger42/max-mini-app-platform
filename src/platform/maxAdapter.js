import downloadBlob from './downloadBlob.js'
import createWebAdapter from './webAdapter.js'
import {
  requireHttpsUrl,
  openInBrowser,
  createBackButton,
  createClosingConfirmation,
  normalizeDownloadResult,
  normalizeShareResult
} from './adapterUtils.js'

export default function createMaxAdapter(webApp, { downloadOptions = {} } = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.WebApp object is required')
  }

  const backButton = createBackButton(webApp.BackButton)
  const closingConfirmation = createClosingConfirmation(webApp)
  const webFallback = createWebAdapter({ downloadOptions })

  // MAX Bridge exposes the method in some browser contexts, but native file
  // downloads are not supported when the host-reported platform is `web`.
  const hasNativeDownload = webApp.platform !== 'web' &&
    typeof webApp.downloadFile === 'function'
  const hasExternalLinks = typeof webApp.openLink === 'function'
  const hasPlatformLinks = typeof webApp.openMaxLink === 'function'
  const hasShareUrl = typeof webApp.shareMaxContent === 'function'

  const clientPlatform = webApp.platform || null
  const clientVersion = webApp.version || null

  return {
    bridgeType: 'max',
    bridgeAvailable: true,
    bridgeError: null,

    runtime: {
      clientPlatform,
      clientVersion,
      deviceName: webApp.deviceName || null,
      // Backward-compatible aliases. Prefer clientPlatform/clientVersion.
      platform: clientPlatform,
      version: clientVersion
    },

    capabilities: {
      nativeDownload: hasNativeDownload,
      backButton: backButton.supported,
      nativeExternalLinks: hasExternalLinks,
      nativePlatformLinks: hasPlatformLinks,
      closingConfirmation: closingConfirmation.supported,
      // Effective capability: the Web Share/clipboard fallback is also valid.
      shareUrl: hasShareUrl || webFallback.capabilities.shareUrl,
      sharePreparedMessage: hasShareUrl
    },

    downloadFile(url, fileName, options = {}) {
      const validUrl = requireHttpsUrl(url, 'downloadFile')

      if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
        return Promise.reject(new TypeError('A file name is required'))
      }

      // Invoke the native method synchronously to preserve the user gesture.
      if (hasNativeDownload) {
        let result
        try {
          result = webApp.downloadFile(validUrl, fileName)
        } catch (error) {
          return Promise.reject(error)
        }

        return Promise.resolve(result).then(normalizeDownloadResult)
      }

      return downloadBlob(validUrl, fileName, {
        ...downloadOptions,
        ...options
      })
    },

    openExternalLink(url) {
      const validUrl = requireHttpsUrl(url, 'openExternalLink')

      if (hasExternalLinks) {
        webApp.openLink(validUrl)
        return { status: 'requested' }
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
        webApp.openMaxLink(validUrl)
        return { status: 'requested' }
      }

      return openInBrowser(validUrl)
    },

    shareUrl(url, text = '') {
      const validUrl = requireHttpsUrl(url, 'shareUrl')

      if (!hasShareUrl) {
        return webFallback.shareUrl(validUrl, text)
      }

      // Invoke synchronously; the SDK owns its native UI lifecycle.
      let result
      try {
        result = webApp.shareMaxContent({
          link: validUrl,
          ...(text ? { text: String(text) } : {})
        })
      } catch (error) {
        return Promise.reject(error)
      }

      return Promise.resolve(result).then(normalizeShareResult)
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

      let result
      try {
        result = webApp.shareMaxContent({ mid: messageId, chatType })
      } catch (error) {
        return Promise.reject(error)
      }

      return Promise.resolve(result).then(normalizeShareResult)
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

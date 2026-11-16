import downloadBlob from './downloadBlob.js'
import createWebAdapter from './webAdapter.js'
import {
  requireHttpsUrl,
  requireMaxDeepLink,
  requireFileName,
  openInBrowser,
  createBackButton,
  createClosingConfirmation,
  normalizeMaxDownloadResult,
  normalizeMaxShareResult,
  normalizeMaxPreparedMessageResult
} from './adapterUtils.js'

/**
 * Create the MAX adapter.
 *
 * Public Promise-based methods always return a Promise, including validation
 * errors and synchronous exceptions thrown by the native SDK. Native calls are
 * still invoked in the current call stack to preserve MAX user activation.
 *
 * @param {import('./platformTypes.js').MaxBridge} webApp
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createMaxAdapter(webApp, { downloadOptions = {} } = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.WebApp object is required')
  }

  const backButton = createBackButton(webApp.BackButton)
  const closingConfirmation = createClosingConfirmation(webApp)
  const webFallback = createWebAdapter({ downloadOptions })

  // MAX documents downloads in the MAX client, not in its browser runtime.
  const nativeDownload = webApp.downloadFile
  const nativeOpenLink = webApp.openLink
  const nativeOpenMaxLink = webApp.openMaxLink
  const nativeShareMaxContent = webApp.shareMaxContent
  const hasNativeDownload = webApp.platform !== 'web' &&
    typeof nativeDownload === 'function'
  const hasExternalLinks = typeof nativeOpenLink === 'function'
  const hasPlatformLinks = typeof nativeOpenMaxLink === 'function'
  const hasShareMaxContent = typeof nativeShareMaxContent === 'function'

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
      nativeShareUrl: hasShareMaxContent,
      // Effective availability includes the Web Share/clipboard fallback.
      shareUrl: hasShareMaxContent || webFallback.capabilities.shareUrl,
      sharePreparedMessage: hasShareMaxContent
    },

    /**
     * Ask MAX to download a file or use the Web Blob fallback.
     * A `requested` result is not a completion notification.
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

      if (hasNativeDownload) {
        let result
        try {
          // Do not defer this call: MAX checks the current user gesture.
          result = nativeDownload.call(webApp, validUrl, validFileName)
        } catch (error) {
          return Promise.reject(error)
        }

        return Promise.resolve(result).then(normalizeMaxDownloadResult)
      }

      return downloadBlob(validUrl, validFileName, {
        ...downloadOptions,
        ...options
      })
    },

    /**
     * Open an ordinary external HTTPS URL.
     * @param {string} url
     * @returns {import('./platformTypes.js').LinkOpenResult}
     */
    openExternalLink(url) {
      const validUrl = requireHttpsUrl(url, 'openExternalLink')

      if (hasExternalLinks) {
        nativeOpenLink.call(webApp, validUrl)
        return { status: 'requested' }
      }

      return openInBrowser(validUrl)
    },

    /**
     * Open only an official MAX deep link (`https://max.ru/...`). Use
     * `openExternalLink()` for every other HTTPS URL.
     * @param {string} url
     * @returns {import('./platformTypes.js').LinkOpenResult}
     */
    openPlatformLink(url) {
      const validUrl = requireMaxDeepLink(url, 'openPlatformLink')

      if (hasPlatformLinks) {
        nativeOpenMaxLink.call(webApp, validUrl)
        return { status: 'requested' }
      }

      return openInBrowser(validUrl)
    },

    /**
     * Share a URL inside MAX via shareMaxContent(). This is the in-MAX share
     * flow, not the OS share sheet for external applications. The browser
     * fallback uses Web Share, then Clipboard.
     *
     * @param {string} url
     * @param {string} [text]
     * @returns {Promise<import('./platformTypes.js').ShareUrlResult>}
     */
    shareUrl(url, text = '') {
      let validUrl
      try {
        validUrl = requireHttpsUrl(url, 'shareUrl')
      } catch (error) {
        return Promise.reject(error)
      }

      if (!hasShareMaxContent) {
        return webFallback.shareUrl(validUrl, text)
      }

      let result
      try {
        // Invoke synchronously; MAX checks the current user gesture.
        result = nativeShareMaxContent.call(webApp, {
          link: validUrl,
          ...(text ? { text: String(text) } : {})
        })
      } catch (error) {
        return Promise.reject(error)
      }

      return Promise.resolve(result).then(normalizeMaxShareResult)
    },

    /**
     * Share a message previously sent by the bot. `messageId` is the `mid`
     * from Bot API POST /messages; it is not an arbitrary message identifier.
     *
     * @param {import('./platformTypes.js').PreparedMessageInput} [params]
     * @returns {Promise<import('./platformTypes.js').PreparedMessageResult>}
     */
    sharePreparedMessage(params) {
      if (!params || typeof params !== 'object') {
        return Promise.reject(new TypeError('A prepared-message request is required'))
      }

      const { messageId } = params
      if (!('chatType' in params)) {
        return Promise.reject(new TypeError('chatType must be DIALOG or CHAT'))
      }
      const chatType = params.chatType
      if (!messageId || typeof messageId !== 'string') {
        return Promise.reject(new TypeError('A MAX message ID (mid) is required'))
      }

      if (!['DIALOG', 'CHAT'].includes(chatType)) {
        return Promise.reject(new TypeError('chatType must be DIALOG or CHAT'))
      }

      if (!hasShareMaxContent) {
        return Promise.reject(new Error('MAX shareMaxContent is unavailable'))
      }

      let result
      try {
        // Keep the SDK call inside this stack for user-gesture validation.
        result = nativeShareMaxContent.call(webApp, { mid: messageId, chatType })
      } catch (error) {
        return Promise.reject(error)
      }

      return Promise.resolve(result).then(normalizeMaxPreparedMessageResult)
    },

    backButton,

    enableClosingConfirmation() {
      return closingConfirmation.enable()
    },

    disableClosingConfirmation() {
      return closingConfirmation.disable()
    },

    // MAX has no ready() handshake; keep a common bootstrap method.
    ready() {}
  }
}

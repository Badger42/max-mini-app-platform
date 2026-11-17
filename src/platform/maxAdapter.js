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
 * Create the MAX adapter. Promise-based public methods convert synchronous
 * native exceptions into rejections while retaining the current user-gesture
 * stack for native MAX calls.
 *
 * @param {import('./platformTypes.js').MaxBridge} webApp
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createMaxAdapter(webApp, {
  downloadOptions = {},
  services = {},
  launchContext = null
} = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.WebApp object is required')
  }

  const backButton = createBackButton(webApp.BackButton)
  const closingConfirmation = createClosingConfirmation(webApp)
  const webFallback = createWebAdapter({ downloadOptions, services, launchContext })

  const nativeDownload = webApp.downloadFile
  const nativeOpenLink = webApp.openLink
  const nativeOpenMaxLink = webApp.openMaxLink
  const nativeShareMaxContent = webApp.shareMaxContent
  const hasNativeDownload = webApp.platform !== 'web' && typeof nativeDownload === 'function'
  const hasExternalLinks = typeof nativeOpenLink === 'function'
  const hasPlatformLinks = typeof nativeOpenMaxLink === 'function'
  const hasShareMaxContent = typeof nativeShareMaxContent === 'function'

  const clientPlatform = webApp.platform || null
  const clientVersion = webApp.version || null

  return {
    bridgeType: 'max',
    bridgeAvailable: true,
    bridgeError: null,
    launchContext,

    runtime: {
      clientPlatform,
      clientVersion,
      deviceName: webApp.deviceName || null,
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
      shareUrl: hasShareMaxContent || webFallback.capabilities.shareUrl,
      sharePreparedMessage: hasShareMaxContent
    },

    /**
     * Use native MAX download only when the client exposes it and is not the
     * browser platform. Otherwise delegate once to the injected service or the
     * Web Blob fallback. Native MAX requires an absolute HTTPS URL.
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

      if (!hasNativeDownload) {
        return webFallback.downloadFile(url, validFileName, options)
      }

      let validUrl
      try {
        validUrl = requireHttpsUrl(url, 'downloadFile')
      } catch (error) {
        return Promise.reject(error)
      }

      let result
      try {
        // Do not defer this call: MAX checks the current user gesture.
        result = nativeDownload.call(webApp, validUrl, validFileName)
      } catch (error) {
        return Promise.reject(error)
      }

      return Promise.resolve(result).then(normalizeMaxDownloadResult)
    },

    /** @param {string} url @returns {import('./platformTypes.js').LinkOpenResult} */
    openExternalLink(url) {
      const validUrl = requireHttpsUrl(url, 'openExternalLink')
      if (hasExternalLinks) {
        nativeOpenLink.call(webApp, validUrl)
        return { status: 'requested' }
      }
      return openInBrowser(validUrl)
    },

    /** @param {string} url @returns {import('./platformTypes.js').LinkOpenResult} */
    openPlatformLink(url) {
      const validUrl = requireMaxDeepLink(url, 'openPlatformLink')
      if (hasPlatformLinks) {
        nativeOpenMaxLink.call(webApp, validUrl)
        return { status: 'requested' }
      }
      return openInBrowser(validUrl)
    },

    /** @param {string} url @param {string} [text] */
    shareUrl(url, text = '') {
      let validUrl
      try {
        validUrl = requireHttpsUrl(url, 'shareUrl')
      } catch (error) {
        return Promise.reject(error)
      }

      if (!hasShareMaxContent) return webFallback.shareUrl(validUrl, text)

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

    /** @param {import('./platformTypes.js').PreparedMessageInput} [params] */
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
    enableClosingConfirmation() { return closingConfirmation.enable() },
    disableClosingConfirmation() { return closingConfirmation.disable() },
    ready() {}
  }
}

import createWebAdapter from './webAdapter.js'
import { WEB_LAUNCH_CONTEXT } from './detectLaunchContext.js'
import {
  createBackButton,
  createClosingConfirmation,
  normalizeDownloadResult,
  normalizeShareResult,
  openInBrowser,
  requireHttpsUrl
} from './adapterUtils.js'

export default function createMaxAdapter(webApp, {
  downloadOptions = {},
  services = {},
  launchContext = {
    type: 'max',
    launch: {
      platform: webApp?.platform || null,
      version: webApp?.version || null
    },
    detection: { status: 'valid', reason: null }
  }
} = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.WebApp object is required')
  }

  const backButton = createBackButton(webApp.BackButton)
  const closingConfirmation = createClosingConfirmation(webApp)
  const webFallback = createWebAdapter({
    downloadOptions,
    services,
    launchContext: launchContext || WEB_LAUNCH_CONTEXT
  })

  // A Web-reported MAX bridge is not a native download host.
  const hasNativeDownload = webApp.platform !== 'web' &&
    typeof webApp.downloadFile === 'function'
  const hasExternalLinks = typeof webApp.openLink === 'function'
  const hasPlatformLinks = typeof webApp.openMaxLink === 'function'
  const hasShareUrl = typeof webApp.shareMaxContent === 'function'

  const clientPlatform = webApp.platform || launchContext?.launch?.platform || null
  const clientVersion = webApp.version || launchContext?.launch?.version || null

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
      shareUrl: hasShareUrl || webFallback.capabilities.shareUrl,
      sharePreparedMessage: hasShareUrl
    },

    downloadFile(url, fileName, options = {}) {
      // Do not make this method async or defer the native call: MAX requires
      // downloadFile() to be invoked in the originating user gesture.
      if (!hasNativeDownload) {
        return webFallback.downloadFile(url, fileName, options)
      }

      let validUrl
      try {
        validUrl = requireHttpsUrl(url, 'downloadFile')
        if (typeof fileName !== 'string' || !fileName.trim()) {
          throw new TypeError('A file name is required')
        }
      } catch (error) {
        return Promise.reject(error)
      }

      let result
      try {
        result = webApp.downloadFile(validUrl, fileName)
      } catch (error) {
        return Promise.reject(error)
      }

      return Promise.resolve(result).then(normalizeDownloadResult)
    },

    openExternalLink(url) {
      const validUrl = requireHttpsUrl(url, 'openExternalLink')
      if (hasExternalLinks) {
        webApp.openLink(validUrl)
        return { status: 'requested' }
      }
      return openInBrowser(validUrl)
    },

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
      if (!hasShareUrl) return webFallback.shareUrl(validUrl, text)

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
    enableClosingConfirmation() { return closingConfirmation.enable() },
    disableClosingConfirmation() { return closingConfirmation.disable() },
    ready() {}
  }
}

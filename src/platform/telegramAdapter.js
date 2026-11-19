import createWebAdapter from './webAdapter.js'
import {
  requireHttpsUrl,
  requireFileName,
  openInBrowser,
  canOpenInBrowser,
  createBackButton,
  createClosingConfirmation,
  normalizeTelegramDownloadResult,
  readLaunchParameters
} from './adapterUtils.js'

/** @param {string} methodName @returns {Promise<never>} */
function unavailable(methodName) {
  return Promise.reject(new Error(`Telegram ${methodName} is not available in this client version`))
}

/**
 * @param {import('./platformTypes.js').TelegramBridge} webApp
 * @param {string} requiredVersion
 * @returns {boolean}
 */
function supportsVersion(webApp, requiredVersion) {
  if (typeof webApp.isVersionAtLeast === 'function') {
    try { return Boolean(webApp.isVersionAtLeast(requiredVersion)) } catch { return false }
  }

  const current = String(webApp.version || '').split('.')
  const required = requiredVersion.split('.')
  if (!current.length || current.some(part => !/^\d+$/.test(part))) return false

  for (let index = 0; index < required.length; index += 1) {
    const currentPart = Number(current[index] || 0)
    const requiredPart = Number(required[index] || 0)
    if (currentPart > requiredPart) return true
    if (currentPart < requiredPart) return false
  }
  return true
}

/**
 * Telegram adapter. Telegram is a first-class supported platform alongside
 * regular Web and MAX.
 * @param {import('./platformTypes.js').TelegramBridge} webApp
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createTelegramAdapter(webApp, {
  downloadOptions = {},
  services = {},
  launchContext = null
} = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.Telegram.WebApp object is required')
  }

  const supportsBackButton = supportsVersion(webApp, '6.1')
  const supportsClosingConfirmation = supportsVersion(webApp, '6.2')
  const supportsBotApi8 = supportsVersion(webApp, '8.0')
  const backButton = createBackButton(supportsBackButton ? webApp.BackButton : undefined)
  const closingConfirmation = createClosingConfirmation(
    supportsClosingConfirmation ? webApp : null
  )
  const webFallback = createWebAdapter({ downloadOptions, services, launchContext })
  const nativeDownload = webApp.downloadFile
  const nativeShareMessage = webApp.shareMessage
  const nativeOpenLink = webApp.openLink
  const nativeOpenTelegramLink = webApp.openTelegramLink
  const hasNativeDownload = supportsBotApi8 && typeof nativeDownload === 'function'
  const hasShareMessage = supportsBotApi8 && typeof nativeShareMessage === 'function'
  const hasExternalLinks = typeof nativeOpenLink === 'function'
  const hasPlatformLinks = typeof nativeOpenTelegramLink === 'function'

  const clientPlatform = webApp.platform || null
  const clientVersion = webApp.version || null

  return {
    bridgeType: 'telegram',
    bridgeAvailable: true,
    bridgeError: null,
    launchContext,
    launchParameters: readLaunchParameters(webApp),

    runtime: {
      clientPlatform,
      clientVersion,
      deviceName: null,
      platform: clientPlatform,
      version: clientVersion
    },

    capabilities: {
      nativeDownload: hasNativeDownload,
      backButton: backButton.supported,
      nativeExternalLinks: hasExternalLinks,
      nativePlatformLinks: hasPlatformLinks,
      closingConfirmation: closingConfirmation.supported,
      nativeShareUrl: false,
      shareUrl: hasPlatformLinks || canOpenInBrowser(),
      sharePreparedMessage: hasShareMessage
    },

    /**
     * Telegram's callback indicates whether the user accepted the prompt; it
     * does not report download completion. Fallbacks use the injected service
     * before Fetch/Blob.
     * @param {string} url
     * @param {string} fileName
     * @param {import('./platformTypes.js').DownloadOptions} [options]
     * @returns {Promise<import('./platformTypes.js').DownloadResult>}
     */
    downloadFile(url, fileName, options = {}) {
      let validFileName
      try { validFileName = requireFileName(fileName) } catch (error) {
        return Promise.reject(error)
      }

      if (!hasNativeDownload) return webFallback.downloadFile(url, validFileName, options)

      let validUrl
      try { validUrl = requireHttpsUrl(url, 'downloadFile') } catch (error) {
        return Promise.reject(error)
      }

      // Constructing this Promise calls downloadFile synchronously.
      return new Promise((resolve, reject) => {
        try {
          nativeDownload.call(webApp,
            { url: validUrl, file_name: validFileName },
            accepted => resolve(normalizeTelegramDownloadResult({
              status: accepted ? 'accepted' : 'cancelled'
            }))
          )
        } catch (error) {
          reject(error)
        }
      })
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
      const validUrl = requireHttpsUrl(url, 'openPlatformLink')
      if (hasPlatformLinks) {
        nativeOpenTelegramLink.call(webApp, validUrl)
        return { status: 'requested' }
      }
      return openInBrowser(validUrl)
    },

    /** @param {string} url @param {string} [text] */
    shareUrl(url, text = '') {
      let validUrl
      try { validUrl = requireHttpsUrl(url, 'shareUrl') } catch (error) {
        return Promise.reject(error)
      }

      const shareLink = new URL('https://t.me/share/url')
      shareLink.searchParams.set('url', validUrl)
      if (text) shareLink.searchParams.set('text', String(text))

      if (hasPlatformLinks) {
        try { nativeOpenTelegramLink.call(webApp, shareLink.toString()) } catch (error) {
          return Promise.reject(error)
        }
        return Promise.resolve({ status: 'opened' })
      }
      return Promise.resolve(openInBrowser(shareLink.toString()))
    },

    /** @param {import('./platformTypes.js').PreparedMessageInput} [params] */
    sharePreparedMessage(params) {
      const messageId = params && params.messageId
      if (!messageId || typeof messageId !== 'string') {
        return Promise.reject(new TypeError('A Telegram prepared inline message ID is required'))
      }
      if (!hasShareMessage) return unavailable('shareMessage')

      return new Promise((resolve, reject) => {
        try {
          nativeShareMessage.call(webApp, messageId, sent => {
            resolve({ status: sent ? 'shared' : 'cancelled' })
          })
        } catch (error) {
          reject(error)
        }
      })
    },

    backButton,
    enableClosingConfirmation() { return closingConfirmation.enable() },
    disableClosingConfirmation() { return closingConfirmation.disable() },
    ready() {
      if (typeof webApp.ready === 'function') return webApp.ready()
    }
  }
}

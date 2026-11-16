import downloadBlob from './downloadBlob.js'
import {
  requireHttpsUrl,
  openInBrowser,
  createBackButton,
  createClosingConfirmation
} from './adapterUtils.js'

function unavailable(methodName) {
  return Promise.reject(
    new Error(`Telegram ${methodName} is not available in this client version`)
  )
}

function supportsVersion(webApp, requiredVersion) {
  if (typeof webApp.isVersionAtLeast === 'function') {
    return webApp.isVersionAtLeast(requiredVersion)
  }

  const current = String(webApp.version || '').split('.').map(Number)
  const required = requiredVersion.split('.').map(Number)

  if (!current.length || current.some(Number.isNaN)) {
    return false
  }

  for (let index = 0; index < required.length; index += 1) {
    const currentPart = current[index] || 0
    const requiredPart = required[index] || 0

    if (currentPart > requiredPart) return true
    if (currentPart < requiredPart) return false
  }

  return true
}

export default function createTelegramAdapter(webApp, { downloadOptions = {} } = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.Telegram.WebApp object is required')
  }

  const backButton = createBackButton(webApp.BackButton)
  const closingConfirmation = createClosingConfirmation(webApp)

  const supportsBotApi8 = supportsVersion(webApp, '8.0')
  const hasNativeDownload = supportsBotApi8 && typeof webApp.downloadFile === 'function'
  const hasShareMessage = supportsBotApi8 && typeof webApp.shareMessage === 'function'
  const hasExternalLinks = typeof webApp.openLink === 'function'
  const hasPlatformLinks = typeof webApp.openTelegramLink === 'function'

  return {
    bridgeType: 'telegram',
    bridgeAvailable: true,
    bridgeError: null,

    runtime: {
      platform: webApp.platform || null,
      version: webApp.version || null,
      deviceName: null
    },

    capabilities: {
      nativeDownload: hasNativeDownload,
      backButton: backButton.supported,
      nativeExternalLinks: hasExternalLinks,
      nativePlatformLinks: hasPlatformLinks,
      closingConfirmation: closingConfirmation.supported,
      shareUrl: hasPlatformLinks,
      sharePreparedMessage: hasShareMessage
    },

    /**
     * Telegram's downloader accepts { url, file_name } and calls back with
     * whether the user accepted the request. It does not report completion.
     * Invoke directly from the user's click handler.
     */
    downloadFile(url, fileName, options = {}) {
      const validUrl = requireHttpsUrl(url, 'downloadFile')

      if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
        return Promise.reject(new TypeError('A file name is required'))
      }

      if (hasNativeDownload) {
        return new Promise((resolve, reject) => {
          try {
            webApp.downloadFile(
              { url: validUrl, file_name: fileName },
              accepted => resolve({ status: accepted ? 'accepted' : 'cancelled' })
            )
          } catch (error) {
            reject(error)
          }
        })
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
     * Telegram maps this to WebApp.openTelegramLink().
     */
    openPlatformLink(url) {
      const validUrl = requireHttpsUrl(url, 'openPlatformLink')

      if (hasPlatformLinks) {
        return webApp.openTelegramLink(validUrl)
      }

      return openInBrowser(validUrl)
    },

    /**
     * Opens Telegram's official share URL composer.
     * "opened" means the composer was invoked, not that content was sent.
     */
    shareUrl(url, text = '') {
      const validUrl = requireHttpsUrl(url, 'shareUrl')
      const shareLink = new URL('https://t.me/share/url')
      shareLink.searchParams.set('url', validUrl)

      if (text) {
        shareLink.searchParams.set('text', String(text))
      }

      if (hasPlatformLinks) {
        webApp.openTelegramLink(shareLink.toString())
      } else {
        openInBrowser(shareLink.toString())
      }

      return Promise.resolve({ status: 'opened' })
    },

    /**
     * messageId is a PreparedInlineMessage ID returned by Bot API
     * savePreparedInlineMessage. It is not an arbitrary Telegram message ID.
     */
    sharePreparedMessage({ messageId } = {}) {
      if (!messageId || typeof messageId !== 'string') {
        return Promise.reject(
          new TypeError('A Telegram prepared inline message ID is required')
        )
      }

      if (!hasShareMessage) {
        return unavailable('shareMessage')
      }

      return new Promise((resolve, reject) => {
        try {
          webApp.shareMessage(messageId, sent => {
            resolve({ status: sent ? 'shared' : 'cancelled' })
          })
        } catch (error) {
          reject(error)
        }
      })
    },

    backButton,

    enableClosingConfirmation() {
      return closingConfirmation.enable()
    },

    disableClosingConfirmation() {
      return closingConfirmation.disable()
    },

    // Telegram must be told when the app's essential UI is ready.
    ready() {
      if (typeof webApp.ready === 'function') {
        return webApp.ready()
      }
    }
  }
}

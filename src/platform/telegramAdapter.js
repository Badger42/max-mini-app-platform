import downloadBlob from './downloadBlob.js'

function requireHttpsUrl(value, methodName) {
  let url
  try {
    url = new URL(value)
  } catch (_) {
    throw new TypeError(`${methodName}: a valid absolute URL is required`)
  }

  if (url.protocol !== 'https:') {
    throw new TypeError(`${methodName}: only HTTPS URLs are supported`)
  }

  return url.href
}

function unavailable(methodName) {
  return Promise.reject(new Error(`Telegram ${methodName} is not available in this client version`))
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

  const nativeBackButton = webApp.BackButton
  const supportsBotApi8 = supportsVersion(webApp, '8.0')
  const hasNativeDownload = supportsBotApi8 && typeof webApp.downloadFile === 'function'
  const hasShareMessage = supportsBotApi8 && typeof webApp.shareMessage === 'function'
  const hasBackButton = Boolean(
    nativeBackButton &&
    typeof nativeBackButton.show === 'function' &&
    typeof nativeBackButton.hide === 'function' &&
    typeof nativeBackButton.onClick === 'function' &&
    typeof nativeBackButton.offClick === 'function'
  )

  return {
    environment: 'telegram',
    isMax: false,
    isTelegram: true,
    bridgeAvailable: true,
    bridgeError: null,

    runtime: {
      platform: webApp.platform || null,
      version: webApp.version || null,
      deviceName: null
    },

    capabilities: {
      nativeDownload: hasNativeDownload,
      backButton: hasBackButton,
      nativeExternalLinks: typeof webApp.openLink === 'function',
      nativeTelegramLinks: typeof webApp.openTelegramLink === 'function',
      nativeMaxLinks: false,
      closingConfirmation: (
        typeof webApp.enableClosingConfirmation === 'function' &&
        typeof webApp.disableClosingConfirmation === 'function'
      ),
      shareUrl: typeof webApp.openTelegramLink === 'function',
      sharePreparedMessage: hasShareMessage
    },

    /**
     * Telegram's native downloader accepts { url, file_name } and invokes the
     * callback with true when the user accepts the download request. This does
     * not mean that the file has finished downloading.
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
              (accepted) => resolve({ status: accepted ? 'accepted' : 'cancelled' })
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
      if (typeof webApp.openLink === 'function') {
        return webApp.openLink(validUrl)
      }
      return window.open(validUrl, '_blank', 'noopener,noreferrer')
    },

    openTelegramLink(url) {
      const validUrl = requireHttpsUrl(url, 'openTelegramLink')
      if (typeof webApp.openTelegramLink === 'function') {
        return webApp.openTelegramLink(validUrl)
      }
      return window.open(validUrl, '_blank', 'noopener,noreferrer')
    },

    // Kept for the common adapter shape. A MAX deep link is not a Telegram
    // deep link, so Telegram opens it as an ordinary external URL.
    openMaxLink(url) {
      const validUrl = requireHttpsUrl(url, 'openMaxLink')
      if (typeof webApp.openLink === 'function') {
        return webApp.openLink(validUrl)
      }
      return window.open(validUrl, '_blank', 'noopener,noreferrer')
    },

    /**
     * Opens Telegram's native chat picker for a URL.
     * The returned "opened" status means the picker was invoked, not that the
     * user actually sent the message.
     */
    shareUrl(url, text = '') {
      const validUrl = requireHttpsUrl(url, 'shareUrl')
      const shareLink = new URL('https://t.me/share/url')
      shareLink.searchParams.set('url', validUrl)
      if (text) shareLink.searchParams.set('text', String(text))

      if (typeof webApp.openTelegramLink === 'function') {
        webApp.openTelegramLink(shareLink.toString())
      } else {
        window.open(shareLink.toString(), '_blank', 'noopener,noreferrer')
      }

      return Promise.resolve({ status: 'opened' })
    },

    /**
     * Shares a PreparedInlineMessage ID returned by the backend after calling
     * Telegram Bot API savePreparedInlineMessage. This is not an arbitrary
     * message ID and is different from MAX's `mid` value.
     */
    sharePreparedMessage({ messageId } = {}) {
      if (!messageId || typeof messageId !== 'string') {
        return Promise.reject(new TypeError('A Telegram prepared inline message ID is required'))
      }

      if (!hasShareMessage) {
        return unavailable('shareMessage')
      }

      return new Promise((resolve, reject) => {
        try {
          webApp.shareMessage(messageId, (sent) => {
            resolve({ status: sent ? 'shared' : 'cancelled' })
          })
        } catch (error) {
          reject(error)
        }
      })
    },

    backButton: {
      show() {
        if (nativeBackButton && typeof nativeBackButton.show === 'function') {
          nativeBackButton.show()
        }
      },
      hide() {
        if (nativeBackButton && typeof nativeBackButton.hide === 'function') {
          nativeBackButton.hide()
        }
      },
      onClick(handler) {
        if (!hasBackButton) return () => {}
        nativeBackButton.onClick(handler)
        return () => nativeBackButton.offClick(handler)
      }
    },

    enableClosingConfirmation() {
      if (typeof webApp.enableClosingConfirmation === 'function') {
        return webApp.enableClosingConfirmation()
      }
    },

    disableClosingConfirmation() {
      if (typeof webApp.disableClosingConfirmation === 'function') {
        return webApp.disableClosingConfirmation()
      }
    },

    // Call after the Vue app has mounted so Telegram can hide its loading screen.
    ready() {
      if (typeof webApp.ready === 'function') {
        return webApp.ready()
      }
    }
  }
}

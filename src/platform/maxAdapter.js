import downloadBlob from './downloadBlob'

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

export default function createMaxAdapter(webApp, { downloadOptions = {} } = {}) {
  if (!webApp || typeof webApp !== 'object') {
    throw new TypeError('A valid window.WebApp object is required')
  }

  const nativeBackButton = webApp.BackButton
  const hasNativeDownload = typeof webApp.downloadFile === 'function'

  return {
    environment: 'max',
    isMax: true,
    bridgeAvailable: true,
    bridgeError: null,

    runtime: {
      platform: webApp.platform || null,
      version: webApp.version || null,
      deviceName: webApp.deviceName || null
    },

    capabilities: {
      nativeDownload: hasNativeDownload,
      backButton: Boolean(
        nativeBackButton &&
        typeof nativeBackButton.show === 'function' &&
        typeof nativeBackButton.hide === 'function' &&
        typeof nativeBackButton.onClick === 'function' &&
        typeof nativeBackButton.offClick === 'function'
      ),
      nativeExternalLinks: typeof webApp.openLink === 'function',
      nativeMaxLinks: typeof webApp.openMaxLink === 'function',
      closingConfirmation: (
        typeof webApp.enableClosingConfirmation === 'function' &&
        typeof webApp.disableClosingConfirmation === 'function'
      )
    },

    downloadFile(url, fileName, options = {}) {
      const validUrl = requireHttpsUrl(url, 'downloadFile')

      if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
        return Promise.reject(new TypeError('A file name is required'))
      }

      // Invoke this method directly from the user's click handler. Do not await
      // an API request before calling it: MAX checks for a user gesture.
      if (typeof webApp.downloadFile === 'function') {
        return webApp.downloadFile(validUrl, fileName)
      }

      // Bridge exists but this capability is missing: use the documented
      // fetch -> Blob fallback. CORS/credentials must be configured server-side.
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

    openMaxLink(url) {
      const validUrl = requireHttpsUrl(url, 'openMaxLink')
      if (typeof webApp.openMaxLink === 'function') {
        return webApp.openMaxLink(validUrl)
      }
      return window.open(validUrl, '_blank', 'noopener,noreferrer')
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
        if (
          !nativeBackButton ||
          typeof nativeBackButton.onClick !== 'function' ||
          typeof nativeBackButton.offClick !== 'function'
        ) {
          return () => {}
        }

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
    }
  }
}

import downloadBlob from './downloadBlob.js'
import { WEB_LAUNCH_CONTEXT } from './detectLaunchContext.js'
import {
  invokeDownloadService,
  openInBrowser,
  requireHttpsUrl,
  unavailable
} from './adapterUtils.js'

export default function createWebAdapter({
  downloadOptions = {},
  services = {},
  launchContext = WEB_LAUNCH_CONTEXT
} = {}) {
  const hasWebShare = (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  )
  const hasClipboard = (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  )

  return {
    bridgeType: null,
    bridgeAvailable: false,
    bridgeError: null,
    launchContext,

    runtime: {
      clientPlatform: null,
      clientVersion: null,
      deviceName: null,
      browser: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || null : null
      },
      platform: null,
      version: null
    },

    capabilities: {
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativePlatformLinks: false,
      closingConfirmation: false,
      shareUrl: Boolean(hasWebShare || hasClipboard),
      sharePreparedMessage: false
    },

    downloadFile(url, fileName, options = {}) {
      return invokeDownloadService(
        services.downloadFile,
        url,
        fileName,
        { ...downloadOptions, ...options },
        downloadBlob
      )
    },

    openExternalLink(url) {
      return openInBrowser(requireHttpsUrl(url, 'openExternalLink'))
    },

    openPlatformLink(url) {
      return openInBrowser(requireHttpsUrl(url, 'openPlatformLink'))
    },

    async shareUrl(url, text = '') {
      const validUrl = requireHttpsUrl(url, 'shareUrl')

      if (hasWebShare) {
        try {
          await navigator.share({ url: validUrl, text: text || undefined })
          return { status: 'shared' }
        } catch (error) {
          if (error && error.name === 'AbortError') {
            return { status: 'cancelled' }
          }
          throw error
        }
      }

      if (hasClipboard) {
        await navigator.clipboard.writeText(text ? `${text}\n${validUrl}` : validUrl)
        return { status: 'copied' }
      }

      return unavailable('URL sharing')
    },

    sharePreparedMessage() {
      return unavailable('Prepared-message sharing')
    },

    backButton: {
      supported: false,
      show() {},
      hide() {},
      onClick() { return () => {} }
    },

    enableClosingConfirmation() {},
    disableClosingConfirmation() {},
    ready() {}
  }
}

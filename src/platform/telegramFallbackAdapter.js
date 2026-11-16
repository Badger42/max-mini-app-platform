import createWebAdapter from './webAdapter.js'

/**
 * Telegram launch parameters were detected, but the Telegram SDK is unavailable.
 * Preserve browser functionality and expose the selected host through bridgeType.
 */
export default function createTelegramFallbackAdapter(error, options = {}) {
  const web = createWebAdapter(options)

  return {
    ...web,
    bridgeType: 'telegram',
    bridgeAvailable: false,
    bridgeError: error || new Error('Telegram SDK is unavailable'),

    capabilities: {
      ...web.capabilities,
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativePlatformLinks: false,
      closingConfirmation: false,
      sharePreparedMessage: false
    }
  }
}

import createWebAdapter from './webAdapter.js'

/** Telegram launch parameters were detected, but the Telegram SDK is unavailable. */
export default function createTelegramFallbackAdapter(error, options = {}) {
  const web = createWebAdapter(options)

  return {
    ...web,
    environment: 'telegram-fallback',
    isMax: false,
    isTelegram: true,
    bridgeAvailable: false,
    bridgeError: error || new Error('Telegram SDK is unavailable'),

    capabilities: {
      ...web.capabilities,
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativeTelegramLinks: false,
      closingConfirmation: false,
      sharePreparedMessage: false
    }
  }
}

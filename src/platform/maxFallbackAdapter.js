import createWebAdapter from './webAdapter.js'

/**
 * The launch URL says this is MAX, but the Bridge did not become available.
 * Keep regular web functionality and explicitly report missing native features.
 */
export default function createMaxFallbackAdapter(error, options = {}) {
  const web = createWebAdapter(options)

  return {
    ...web,
    environment: 'max-fallback',
    isMax: true,
    isTelegram: false,
    bridgeAvailable: false,
    bridgeError: error || new Error('MAX Bridge is unavailable'),

    capabilities: {
      ...web.capabilities,
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativeMaxLinks: false,
      nativeTelegramLinks: false,
      closingConfirmation: false,
      sharePreparedMessage: false
    }
  }
}

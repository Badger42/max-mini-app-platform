import createWebAdapter from './webAdapter.js'

/**
 * MAX launch parameters were detected, but the MAX Bridge is unavailable.
 * Preserve browser functionality and expose the selected host through bridgeType.
 */
export default function createMaxFallbackAdapter(error, options = {}) {
  const web = createWebAdapter(options)

  return {
    ...web,
    bridgeType: 'max',
    bridgeAvailable: false,
    bridgeError: error || new Error('MAX Bridge is unavailable'),

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

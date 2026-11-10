import createWebAdapter from './webAdapter'

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
    bridgeAvailable: false,
    bridgeError: error || new Error('MAX Bridge is unavailable'),

    // These capabilities require the native MAX client and cannot be emulated.
    capabilities: {
      ...web.capabilities,
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativeMaxLinks: false,
      closingConfirmation: false
    }
  }
}

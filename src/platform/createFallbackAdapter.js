import createWebAdapter from './webAdapter.js'

/**
 * Shared implementation for a recognized host whose SDK failed to load.
 * It reuses the Web adapter for supported browser operations and explicitly
 * disables every host-native capability.
 *
 * @param {'max'|'telegram'} bridgeType
 * @param {Error|string|null} error
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createFallbackAdapter(
  bridgeType,
  error,
  { downloadOptions = {}, services = {}, launchContext = null } = {}
) {
  if (bridgeType !== 'max' && bridgeType !== 'telegram') {
    throw new TypeError(`Unsupported fallback bridgeType: ${bridgeType}`)
  }

  const web = createWebAdapter({ downloadOptions, services, launchContext })

  return {
    ...web,
    bridgeType,
    bridgeAvailable: false,
    bridgeError: error instanceof Error
      ? error
      : new Error(error ? String(error) : `${bridgeType} SDK is unavailable`),
    launchContext,
    capabilities: {
      ...web.capabilities,
      nativeDownload: false,
      backButton: false,
      nativeExternalLinks: false,
      nativePlatformLinks: false,
      closingConfirmation: false,
      nativeShareUrl: false,
      sharePreparedMessage: false
    }
  }
}

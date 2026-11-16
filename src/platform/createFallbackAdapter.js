import createWebAdapter from './webAdapter.js'

/**
 * Shared implementation for a recognized host whose SDK failed to load.
 * The Telegram branch is kept as a first-class platform.
 *
 * @param {'max'|'telegram'} bridgeType
 * @param {Error|string|null} error
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createFallbackAdapter(
  bridgeType,
  error,
  { downloadOptions = {} } = {}
) {
  if (!['max', 'telegram'].includes(bridgeType)) {
    throw new TypeError(`Unsupported fallback bridgeType: ${bridgeType}`)
  }

  const web = createWebAdapter({ downloadOptions })

  return {
    ...web,
    bridgeType,
    bridgeAvailable: false,
    bridgeError: error instanceof Error
      ? error
      : new Error(error ? String(error) : `${bridgeType} SDK is unavailable`),
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

import createWebAdapter from './webAdapter.js'

/**
 * Shared implementation for recognized hosts whose SDK failed to load.
 * Keep browser fallbacks while preserving which host launched the application.
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
      sharePreparedMessage: false
    }
  }
}

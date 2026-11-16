import createWebAdapter from './webAdapter.js'

/**
 * Browser-capability fallback for an application that was launched from MAX
 * but whose Bridge could not be obtained. It never retries or switches later.
 */
export default function createMaxFallbackAdapter(
  launchContext,
  bridgeError,
  { downloadOptions = {}, services = {} } = {}
) {
  const web = createWebAdapter({ downloadOptions, services, launchContext })
  const error = bridgeError instanceof Error
    ? bridgeError
    : new Error(bridgeError ? String(bridgeError) : 'MAX Bridge is unavailable')
  const clientPlatform = launchContext?.launch?.platform || null
  const clientVersion = launchContext?.launch?.version || null

  return {
    ...web,
    bridgeType: 'max',
    bridgeAvailable: false,
    bridgeError: error,
    launchContext,
    runtime: {
      ...web.runtime,
      clientPlatform,
      clientVersion,
      platform: clientPlatform,
      version: clientVersion
    },
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

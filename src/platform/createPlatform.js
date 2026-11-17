import createMaxAdapter from './maxAdapter.js'
import createWebAdapter from './webAdapter.js'
import createFallbackAdapter from './createFallbackAdapter.js'
import createTelegramAdapter from './telegramAdapter.js'

/** @type {import('./platformTypes.js').LaunchContext} */
const DEFAULT_WEB_CONTEXT = Object.freeze({
  type: 'web',
  launch: null,
  detection: Object.freeze({ status: 'absent', reason: null })
})

/**
 * Build a minimal context for direct adapter consumers that select a host
 * explicitly instead of calling detectLaunchContext() during bootstrap.
 * @param {null|'max'|'telegram'} bridgeType
 * @param {import('./platformTypes.js').MaxBridge|import('./platformTypes.js').TelegramBridge|null} bridge
 * @returns {import('./platformTypes.js').LaunchContext}
 */
function createExplicitLaunchContext(bridgeType, bridge) {
  if (bridgeType === null) return DEFAULT_WEB_CONTEXT
  return {
    type: bridgeType,
    launch: {
      platform: bridge?.platform || null,
      version: bridge?.version || null
    },
    detection: { status: 'valid', reason: null }
  }
}

/**
 * Select exactly one adapter before Vue is mounted. Launch Context is retained
 * on every adapter, including a failed-SDK fallback. The injected download
 * service is shared by Web and all browser fallback paths.
 *
 * @param {import('./platformTypes.js').CreatePlatformOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createPlatform({
  bridgeType,
  bridge = null,
  error = null,
  bridgeError = error,
  launchContext,
  downloadOptions = {},
  services = {}
} = {}) {
  if (services.downloadFile !== undefined && typeof services.downloadFile !== 'function') {
    throw new TypeError('services.downloadFile must be a function')
  }

  const selectedType = bridgeType === undefined
    ? (launchContext && launchContext.type !== 'web' ? launchContext.type : null)
    : (bridgeType === 'web' ? null : bridgeType)

  if (selectedType !== null && selectedType !== 'max' && selectedType !== 'telegram') {
    throw new TypeError(`Unsupported bridgeType: ${selectedType}`)
  }

  const context = launchContext || createExplicitLaunchContext(selectedType, bridge)
  if (!context || !['web', 'max', 'telegram'].includes(context.type)) {
    throw new TypeError('launchContext.type must be web, max or telegram')
  }
  if ((context.type === 'web' ? null : context.type) !== selectedType) {
    throw new TypeError('bridgeType must match launchContext.type')
  }
  if (!context.detection || !['valid', 'absent', 'invalid', 'conflicting'].includes(context.detection.status)) {
    throw new TypeError('launchContext must contain a valid detection result')
  }
  if (context.type === 'web' && context.launch !== null) {
    throw new TypeError('A Web Launch Context must not contain host launch metadata')
  }
  if (context.type !== 'web' && (
    context.detection.status !== 'valid' ||
    !context.launch ||
    (context.launch.platform !== null && typeof context.launch.platform !== 'string') ||
    (context.launch.version !== null && typeof context.launch.version !== 'string')
  )) {
    throw new TypeError('A host Launch Context must contain valid launch metadata')
  }

  const adapterOptions = { downloadOptions, services, launchContext: context }

  if (selectedType === null) return createWebAdapter(adapterOptions)

  if (selectedType === 'max' && bridge) {
    return createMaxAdapter(
      /** @type {import('./platformTypes.js').MaxBridge} */ (bridge),
      adapterOptions
    )
  }

  if (selectedType === 'telegram' && bridge) {
    return createTelegramAdapter(
      /** @type {import('./platformTypes.js').TelegramBridge} */ (bridge),
      adapterOptions
    )
  }

  return createFallbackAdapter(selectedType, bridgeError, adapterOptions)
}

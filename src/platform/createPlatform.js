import createMaxAdapter from './maxAdapter.js'
import createWebAdapter from './webAdapter.js'
import createMaxFallbackAdapter from './maxFallbackAdapter.js'
import { WEB_LAUNCH_CONTEXT } from './detectLaunchContext.js'

const DETECTION_STATUSES = new Set(['valid', 'absent', 'invalid', 'conflicting'])

function validateLaunchContext(launchContext) {
  if (!launchContext || !['web', 'max'].includes(launchContext.type)) {
    throw new TypeError('launchContext.type must be "web" or "max"')
  }

  if (!launchContext.detection ||
      !DETECTION_STATUSES.has(launchContext.detection.status) ||
      !(launchContext.detection.reason === null ||
        typeof launchContext.detection.reason === 'string')) {
    throw new TypeError('launchContext.detection is invalid')
  }

  if (launchContext.type === 'max') {
    if (launchContext.detection.status !== 'valid' || !launchContext.launch ||
        !(launchContext.launch.platform === null ||
          ['ios', 'android', 'desktop', 'web'].includes(launchContext.launch.platform)) ||
        !(launchContext.launch.version === null ||
          typeof launchContext.launch.version === 'string')) {
      throw new TypeError('A MAX launchContext requires valid launch metadata')
    }
  } else if (launchContext.launch !== null || launchContext.detection.status === 'valid') {
    throw new TypeError('A Web launchContext cannot contain MAX launch metadata')
  }
}

/**
 * Select one adapter before Vue is mounted. The launch context is the single
 * source of truth for environment selection; a failed MAX Bridge stays MAX.
 */
export default function createPlatform(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('createPlatform options must be an object')
  }
  if (Object.hasOwn(options, 'bridgeType') || Object.hasOwn(options, 'error')) {
    throw new TypeError('Use launchContext and bridgeError instead of bridgeType/error')
  }

  const {
    launchContext = WEB_LAUNCH_CONTEXT,
    bridge = null,
    bridgeError = null,
    services = {},
    downloadOptions = {}
  } = options

  validateLaunchContext(launchContext)

  if (!services || typeof services !== 'object' || Array.isArray(services)) {
    throw new TypeError('services must be an object')
  }
  if (services.downloadFile !== undefined && typeof services.downloadFile !== 'function') {
    throw new TypeError('services.downloadFile must be a function')
  }

  const adapterOptions = { services, downloadOptions, launchContext }

  if (launchContext.type === 'web') {
    return createWebAdapter(adapterOptions)
  }

  if (bridge) {
    return createMaxAdapter(bridge, adapterOptions)
  }

  return createMaxFallbackAdapter(launchContext, bridgeError, adapterOptions)
}

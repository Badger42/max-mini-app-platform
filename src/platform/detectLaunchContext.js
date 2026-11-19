import { parseMaxLaunchHash } from './detectMaxLaunch.js'
import { parseTelegramLaunchHash } from './detectTelegramLaunch.js'
import {
  getEffectiveMaxLaunchHash,
  getEffectiveTelegramLaunchHash,
  parseLaunchHashParams
} from './launchParameterSources.js'

/**
 * The default Web context is also used by SSR and direct adapter consumers.
 */
/** @type {import('./platformTypes.js').LaunchContext} */
export const WEB_LAUNCH_CONTEXT = Object.freeze({
  type: 'web',
  launch: null,
  detection: Object.freeze({ status: 'absent', reason: null })
})

const MAX_LAUNCH_KEYS = ['WebAppData', 'WebAppPlatform', 'WebAppVersion']
const TELEGRAM_LAUNCH_KEYS = ['tgWebAppData', 'tgWebAppPlatform', 'tgWebAppVersion']

/**
 * Check only whether a platform protocol marker is present. Actual parsing and
 * duplicate validation remain inside each platform-specific parser.
 * @param {string} hash
 * @param {string[]} keys
 */
function hasProtocolMarker(hash, keys) {
  const params = parseLaunchHashParams(hash)
  return keys.some(key => params.has(key))
}

/** @param {import('./platformTypes.js').LaunchContext} context */
const asLaunchContext = context => context

/**
 * Detect the host before creating Vue Router or mounting the application.
 * MAX and Telegram retain separate launch parsers; this function only
 * coordinates protocol selection and rejects mixed/partial launch markers.
 * @returns {import('./platformTypes.js').LaunchContext}
 */
export default function detectLaunchContext() {
  // Resolve the same persisted sources used by the official SDKs before the
  // platform loader runs. This remains stable after Vue Router rewrites hash.
  const maxHash = getEffectiveMaxLaunchHash()
  const telegramHash = getEffectiveTelegramLaunchHash()

  const max = parseMaxLaunchHash(maxHash)
  const telegram = parseTelegramLaunchHash(telegramHash)
  const hasMaxMarkers = hasProtocolMarker(maxHash, MAX_LAUNCH_KEYS)
  const hasTelegramMarkers = hasProtocolMarker(telegramHash, TELEGRAM_LAUNCH_KEYS)

  if (hasMaxMarkers && hasTelegramMarkers) {
    return asLaunchContext({
      type: 'web',
      launch: null,
      detection: { status: 'conflicting', reason: 'multiple_platform_protocols' }
    })
  }

  if (max.invalid) {
    return asLaunchContext({
      type: 'web',
      launch: null,
      detection: { status: 'invalid', reason: 'duplicate_max_launch_parameter' }
    })
  }

  if (telegram.invalid) {
    return asLaunchContext({
      type: 'web',
      launch: null,
      detection: { status: 'invalid', reason: 'duplicate_telegram_launch_parameter' }
    })
  }

  if (max.isMaxLaunch) {
    return asLaunchContext({
      type: 'max',
      launch: { platform: max.platform, version: max.version },
      detection: { status: 'valid', reason: null }
    })
  }

  if (telegram.isTelegramLaunch) {
    return asLaunchContext({
      type: 'telegram',
      launch: { platform: telegram.platform, version: telegram.version },
      detection: { status: 'valid', reason: null }
    })
  }

  if (hasMaxMarkers || hasTelegramMarkers) {
    return asLaunchContext({
      type: 'web',
      launch: null,
      detection: { status: 'invalid', reason: 'incomplete_launch_parameters' }
    })
  }

  return WEB_LAUNCH_CONTEXT
}

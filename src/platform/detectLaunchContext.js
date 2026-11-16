import { parseMaxLaunchHash } from './detectMaxLaunch.js'

/**
 * The default Web context is also used by SSR and by direct adapter consumers.
 */
export const WEB_LAUNCH_CONTEXT = Object.freeze({
  type: 'web',
  launch: null,
  detection: Object.freeze({ status: 'absent', reason: null })
})

/**
 * Detect the host before creating Vue Router or mounting the application.
 * Invalid or conflicting MAX markers fail closed to Web and do not trigger a
 * Bridge request; their diagnostic status remains available to the app.
 */
export default function detectLaunchContext() {
  const hash = typeof window !== 'undefined' && window.location
    ? window.location.hash
    : ''
  const parsed = parseMaxLaunchHash(hash)

  if (parsed.detection.status !== 'valid') {
    if (parsed.detection.status === 'absent') return WEB_LAUNCH_CONTEXT

    return {
      type: 'web',
      launch: null,
      detection: parsed.detection
    }
  }

  return {
    type: 'max',
    launch: parsed.launch,
    detection: parsed.detection
  }
}

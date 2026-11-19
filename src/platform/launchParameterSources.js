/**
 * Read launch parameters from the same browser-side sources used by the
 * official MAX and Telegram Bridges. Hash parsing understands both the raw
 * fragment form and Vue Router's `#/route?query` form.
 */

export const MAX_LAUNCH_KEYS = ['WebAppData', 'WebAppPlatform', 'WebAppVersion']
export const TELEGRAM_LAUNCH_KEYS = ['tgWebAppData', 'tgWebAppPlatform', 'tgWebAppVersion']

/**
 * @param {string|null|undefined} hash
 * @returns {URLSearchParams}
 */
export function parseLaunchHashParams(hash) {
  const fragment = String(hash || '').replace(/^#/, '')
  const queryIndex = fragment.indexOf('?')
  const query = queryIndex >= 0 ? fragment.slice(queryIndex + 1) : fragment
  return new URLSearchParams(query)
}

/** @returns {string} */
function readCurrentHash() {
  try {
    return typeof window !== 'undefined' && window.location
      ? String(window.location.hash || '')
      : ''
  } catch {
    return ''
  }
}

/**
 * MAX checks the initial navigation URL when the current hash no longer
 * contains its launch fields. The entry may be unavailable in older browsers.
 * @returns {string}
 */
function readNavigationHash() {
  try {
    const entries = window.performance?.getEntriesByType?.('navigation')
    const navigationUrl = entries?.[0]?.name
    if (typeof navigationUrl !== 'string' || !navigationUrl) return ''
    return new URL(navigationUrl, window.location?.href).hash
  } catch {
    return ''
  }
}

/**
 * @param {string} key
 * @returns {string|null}
 */
function readSessionValue(key) {
  try {
    return typeof window !== 'undefined'
      ? window.sessionStorage?.getItem(key) ?? null
      : null
  } catch {
    return null
  }
}

/**
 * MAX stores each launch parameter under its own sessionStorage key. For each
 * field, precedence matches the SDK: current hash, original navigation hash,
 * then sessionStorage. Empty hash values do not suppress a stored fallback.
 * Duplicate values in the selected hash source are retained so the parser can
 * reject them instead of silently selecting one.
 * @returns {string}
 */
export function getEffectiveMaxLaunchHash() {
  if (typeof window === 'undefined') return ''

  const sources = [
    parseLaunchHashParams(readCurrentHash()),
    parseLaunchHashParams(readNavigationHash())
  ]
  const selected = new URLSearchParams()

  for (const key of MAX_LAUNCH_KEYS) {
    let found = false
    let sawEmptyValue = false

    for (const source of sources) {
      const values = source.getAll(key)
      if (values.length === 0) continue

      if (values.length > 1) {
        for (const value of values) selected.append(key, value)
        found = true
        break
      }

      if (values[0]) {
        selected.set(key, values[0])
        found = true
        break
      }

      sawEmptyValue = true
    }

    if (!found) {
      const storedValue = readSessionValue(key)
      if (storedValue) {
        selected.set(key, storedValue)
        found = true
      }
    }

    // Preserve an otherwise-unresolved marker so the coordinator can report
    // an incomplete launch instead of silently treating it as ordinary Web.
    if (!found && sawEmptyValue) selected.set(key, '')
  }

  return `#${selected.toString()}`
}

/**
 * Telegram stores the initial parsed hash object as __telegram__initParams and
 * fills only fields that are absent from the current hash. That lets the
 * detector survive a router hash change and a subsequent page reload.
 * @returns {string}
 */
export function getEffectiveTelegramLaunchHash() {
  if (typeof window === 'undefined') return ''

  const current = parseLaunchHashParams(readCurrentHash())
  /** @type {Record<string, unknown>} */
  let stored = {}

  try {
    const rawStored = readSessionValue('__telegram__initParams')
    const parsed = rawStored ? JSON.parse(rawStored) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      stored = parsed
    }
  } catch {
    // Invalid or unavailable storage must not prevent ordinary Web startup.
  }

  const selected = new URLSearchParams()
  for (const key of TELEGRAM_LAUNCH_KEYS) {
    if (current.has(key)) {
      for (const value of current.getAll(key)) selected.append(key, value)
      continue
    }

    if (typeof stored[key] === 'string') {
      selected.set(key, stored[key])
    }
  }

  return `#${selected.toString()}`
}

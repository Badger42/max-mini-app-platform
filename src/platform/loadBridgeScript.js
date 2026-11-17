/** @type {Map<string, {url: string, promise: Promise<object>}>} */
const pendingLoads = new Map()

/** @type {WeakMap<HTMLScriptElement, 'loading'|'loaded'|'failed'|'timed-out'>} */
const scriptStates = new WeakMap()

/** @param {HTMLScriptElement} script */
function removeScript(script) {
  try {
    if (typeof script.remove === 'function') script.remove()
    else if (script.parentNode) script.parentNode.removeChild(script)
  } catch {
    // A second attempt is made on the next explicit load call.
  }
  return !script.parentNode
}

/** @param {HTMLScriptElement} script */
function hasFinishedLoading(script) {
  const readyState = /** @type {HTMLScriptElement & {readyState?: string}} */ (script).readyState
  return readyState === 'loaded' || readyState === 'complete'
}

/**
 * Load a browser SDK script and resolve the object created by the SDK.
 * Script lifecycle state is tracked separately from DOM presence so a
 * failed/timed-out element can never be mistaken for a live attempt.
 *
 * A foreign element with the expected id is observed rather than duplicated.
 * If its state is already terminal (where readyState is available), it is
 * replaced immediately. Otherwise the attempt is bounded by timeoutMs; after
 * timeout the element is known to be unusable and an explicit retry replaces it.
 *
 * @template {object} TBridge
 * @param {{url: string, scriptId: string, timeoutMs?: number, getBridge: () => TBridge|null|undefined, errorMessage: string}} options
 * @returns {Promise<TBridge>}
 */
export default function loadBridgeScript({
  url,
  scriptId,
  timeoutMs = 5000,
  getBridge,
  errorMessage
}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Platform SDKs can only be loaded in a browser'))
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new TypeError('timeoutMs must be a positive finite number'))
  }

  let existingBridge
  try {
    existingBridge = getBridge()
  } catch (error) {
    return Promise.reject(error)
  }
  if (existingBridge && typeof existingBridge === 'object') {
    return Promise.resolve(existingBridge)
  }

  let requestedUrl
  try {
    requestedUrl = new URL(url, document.baseURI).href
  } catch {
    return Promise.reject(new TypeError(`${errorMessage}: a valid script URL is required`))
  }
  if (new URL(requestedUrl).protocol !== 'https:') {
    return Promise.reject(new TypeError(`${errorMessage}: script URL must use HTTPS`))
  }

  const pending = pendingLoads.get(scriptId)
  if (pending) {
    if (pending.url !== requestedUrl) {
      return Promise.reject(new Error(
        `${errorMessage}: another URL is already loading with script id "${scriptId}"`
      ))
    }
    return /** @type {Promise<TBridge>} */ (pending.promise)
  }

  let script = /** @type {HTMLScriptElement|null} */ (document.getElementById(scriptId))
  if (script) {
    const existingSrc = script.src || (
      typeof script.getAttribute === 'function' ? script.getAttribute('src') : null
    )
    if (!existingSrc) {
      return Promise.reject(new Error(
        `${errorMessage}: an existing element with id "${scriptId}" has no script URL`
      ))
    }

    let existingUrl
    try {
      existingUrl = new URL(existingSrc, document.baseURI).href
    } catch {
      return Promise.reject(new Error(`${errorMessage}: an existing script has an invalid URL`))
    }

    if (existingUrl !== requestedUrl) {
      return Promise.reject(new Error(
        `${errorMessage}: an unrelated script already uses id "${scriptId}"`
      ))
    }

    const state = scriptStates.get(script)
    if (state === 'failed' || state === 'timed-out' || state === 'loaded' || hasFinishedLoading(script)) {
      if (!removeScript(script)) {
        return Promise.reject(new Error(`${errorMessage}: could not remove the previous script element`))
      }
      script = null
    }
  }

  const isNewScript = !script
  if (!script) {
    try {
      script = document.createElement('script')
      script.id = scriptId
      script.src = requestedUrl
      script.async = true
    } catch (error) {
      return Promise.reject(new Error(
        `${errorMessage}: could not create script element: ${String(error)}`
      ))
    }
  }

  /** @type {(value: TBridge) => void} */
  let resolveAttempt = () => {}
  /** @type {(reason?: unknown) => void} */
  let rejectAttempt = () => {}
  /** @type {Promise<TBridge>} */
  const promise = new Promise((resolve, reject) => {
    resolveAttempt = resolve
    rejectAttempt = reject
  })
  pendingLoads.set(scriptId, { url: requestedUrl, promise })
  scriptStates.set(script, 'loading')

  let settled = false
  /** @type {number|undefined} */
  let timeoutId

  const cleanup = () => {
    if (timeoutId !== undefined) {
      try { window.clearTimeout(timeoutId) } catch { /* Continue releasing listeners. */ }
      timeoutId = undefined
    }
    try { script.removeEventListener('load', onLoad) } catch { /* Best-effort listener cleanup. */ }
    try { script.removeEventListener('error', onError) } catch { /* Best-effort listener cleanup. */ }
  }

  /** @param {string} message @param {'failed'|'timed-out'} state */
  const fail = (message, state = 'failed') => {
    if (settled) return
    settled = true
    scriptStates.set(script, state)
    cleanup()
    removeScript(script)
    if (pendingLoads.get(scriptId)?.promise === promise) pendingLoads.delete(scriptId)
    rejectAttempt(new Error(message))
  }

  const onLoad = () => {
    if (settled) return

    let bridge
    try {
      bridge = getBridge()
    } catch (error) {
      fail(`${errorMessage}: could not read the bridge object: ${String(error)}`)
      return
    }
    if (!bridge || typeof bridge !== 'object') {
      fail(`${errorMessage}: script loaded but the bridge object was not created`)
      return
    }

    settled = true
    scriptStates.set(script, 'loaded')
    cleanup()
    if (pendingLoads.get(scriptId)?.promise === promise) pendingLoads.delete(scriptId)
    resolveAttempt(bridge)
  }

  const onError = () => fail(`${errorMessage}: failed to load ${url}`)

  try {
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    timeoutId = window.setTimeout(() => {
      fail(`${errorMessage}: timed out after ${timeoutMs} ms`, 'timed-out')
    }, timeoutMs)

    if (isNewScript) document.head.appendChild(script)
  } catch (error) {
    fail(`${errorMessage}: could not start script loading: ${String(error)}`)
  }

  return /** @type {Promise<TBridge>} */ (promise)
}

/** @type {Map<string, Promise<object>>} */
const pendingLoads = new Map()

/**
 * Load a browser SDK script and resolve the object created by the SDK.
 * A failed attempt is evicted from the in-flight map so a later call can retry.
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

  const existingBridge = getBridge()
  if (existingBridge && typeof existingBridge === 'object') {
    return Promise.resolve(existingBridge)
  }

  if (pendingLoads.has(scriptId)) {
    return /** @type {Promise<TBridge>} */ (pendingLoads.get(scriptId))
  }

  const promise = new Promise((resolve, reject) => {
    let script = /** @type {HTMLScriptElement|null} */ (document.getElementById(scriptId))
    const isNewScript = !script
    let settled = false
    /** @type {number|undefined} */
    let timeoutId

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = url
      script.async = true
    }

    const cleanup = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }

    /** @param {string} message */
    const fail = message => {
      if (settled) return
      settled = true
      cleanup()
      if (isNewScript && typeof script.remove === 'function') script.remove()
      reject(new Error(message))
    }

    const onLoad = () => {
      if (settled) return
      const bridge = getBridge()
      if (!bridge || typeof bridge !== 'object') {
        fail(`${errorMessage}: script loaded but the bridge object was not created`)
        return
      }

      settled = true
      cleanup()
      pendingLoads.delete(scriptId)
      resolve(bridge)
    }

    const onError = () => fail(`${errorMessage}: failed to load ${url}`)

    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    timeoutId = window.setTimeout(() => {
      fail(`${errorMessage}: timed out after ${timeoutMs} ms`)
    }, timeoutMs)

    if (isNewScript) document.head.appendChild(script)
  }).catch(error => {
    pendingLoads.delete(scriptId)
    throw error
  })

  pendingLoads.set(scriptId, promise)
  return /** @type {Promise<TBridge>} */ (promise)
}

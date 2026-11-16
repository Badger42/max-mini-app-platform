const pendingLoads = new Map()

/**
 * Load one SDK script and return the bridge object exposed by that SDK.
 * A failed attempt is evicted from the in-flight map so callers may retry.
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

  if (typeof getBridge !== 'function') {
    return Promise.reject(new TypeError('getBridge must be a function'))
  }

  const existingBridge = getBridge()
  if (existingBridge && typeof existingBridge === 'object') {
    return Promise.resolve(existingBridge)
  }

  if (pendingLoads.has(scriptId)) {
    return pendingLoads.get(scriptId)
  }

  const promise = new Promise((resolve, reject) => {
    let script = document.getElementById(scriptId)
    const isNewScript = !script
    let settled = false
    let timeoutId

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = url
      script.async = true
    }

    const cleanup = () => {
      clearTimeout(timeoutId)
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }

    const fail = message => {
      if (settled) return
      settled = true
      cleanup()
      if (isNewScript && typeof script.remove === 'function') {
        script.remove()
      }
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
      // Keep only in-flight work in the registry. The bridge is checked above
      // on subsequent calls, while a fresh runtime can still retry after reset.
      pendingLoads.delete(scriptId)
      resolve(bridge)
    }

    const onError = () => fail(`${errorMessage}: failed to load ${url}`)

    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)

    timeoutId = setTimeout(() => {
      fail(`${errorMessage}: timed out after ${timeoutMs} ms`)
    }, timeoutMs)

    if (isNewScript) {
      document.head.appendChild(script)
    }
  }).catch(error => {
    pendingLoads.delete(scriptId)
    throw error
  })

  pendingLoads.set(scriptId, promise)
  return promise
}

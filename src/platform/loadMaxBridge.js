const BRIDGE_URL = 'https://st.max.ru/js/max-web-app.js'
const BRIDGE_SCRIPT_ID = 'max-web-app-bridge'
const DEFAULT_TIMEOUT_MS = 5000

let bridgePromise = null

/**
 * Dynamically loads MAX Bridge. Call this only after detectMaxLaunch() returns
 * true. No static <script> tag is required in public/index.html.
 *
 * The rejected promise is cleared so an explicit later retry can be attempted.
 */
export default function loadMaxBridge({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('MAX Bridge can only be loaded in a browser'))
  }

  if (window.WebApp && typeof window.WebApp === 'object') {
    return Promise.resolve(window.WebApp)
  }

  if (bridgePromise) {
    return bridgePromise
  }

  bridgePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    let settled = false

    script.id = BRIDGE_SCRIPT_ID
    script.src = BRIDGE_URL
    script.async = true

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      script.onload = null
      script.onerror = null
    }

    const fail = (message) => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error(message))
    }

    const timeoutId = window.setTimeout(() => {
      fail(`MAX Bridge did not load within ${timeoutMs} ms`)
    }, timeoutMs)

    script.onload = () => {
      if (settled) return

      const webApp = window.WebApp
      if (!webApp || typeof webApp !== 'object') {
        fail('MAX Bridge script loaded, but window.WebApp was not created')
        return
      }

      settled = true
      cleanup()
      resolve(webApp)
    }

    script.onerror = () => {
      fail('Failed to load MAX Bridge from the CDN')
    }

    document.head.appendChild(script)
  }).catch((error) => {
    bridgePromise = null
    throw error
  })

  return bridgePromise
}

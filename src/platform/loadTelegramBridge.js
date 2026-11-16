const BRIDGE_URL = 'https://telegram.org/js/telegram-web-app.js?65'
const BRIDGE_SCRIPT_ID = 'telegram-web-app-bridge'
const DEFAULT_TIMEOUT_MS = 5000

let bridgePromise = null

/**
 * Dynamically loads the official Telegram Web Apps SDK.
 * Call this only after detectPlatform() returns "telegram".
 * No static SDK script is required in public/index.html.
 *
 * A rejected promise is cleared so an explicit later retry can be attempted.
 */
export default function loadTelegramBridge({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Telegram SDK can only be loaded in a browser'))
  }

  const existingWebApp = window.Telegram && window.Telegram.WebApp
  if (existingWebApp && typeof existingWebApp === 'object') {
    return Promise.resolve(existingWebApp)
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
      clearTimeout(timeoutId)
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

    const timeoutId = setTimeout(() => {
      fail(`Telegram SDK did not load within ${timeoutMs} ms`)
    }, timeoutMs)

    script.onload = () => {
      if (settled) return

      const webApp = window.Telegram && window.Telegram.WebApp
      if (!webApp || typeof webApp !== 'object') {
        fail('Telegram SDK loaded, but window.Telegram.WebApp was not created')
        return
      }

      settled = true
      cleanup()
      resolve(webApp)
    }

    script.onerror = () => {
      fail('Failed to load Telegram SDK from the CDN')
    }

    document.head.appendChild(script)
  }).catch((error) => {
    bridgePromise = null
    throw error
  })

  return bridgePromise
}

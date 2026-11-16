import loadBridgeScript from './loadBridgeScript.js'

const BRIDGE_URL = 'https://telegram.org/js/telegram-web-app.js?65'
const BRIDGE_SCRIPT_ID = 'telegram-web-app-bridge'
const DEFAULT_TIMEOUT_MS = 5000

/**
 * Legacy Telegram SDK loader retained for the preceding migration stage.
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<import('./platformTypes.js').TelegramBridge>}
 */
export default function loadTelegramBridge({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return loadBridgeScript({
    url: BRIDGE_URL,
    scriptId: BRIDGE_SCRIPT_ID,
    timeoutMs,
    getBridge: () => {
      const browserWindow = /** @type {Window & {Telegram?: {WebApp?: import('./platformTypes.js').TelegramBridge}}} */ (window)
      return browserWindow.Telegram?.WebApp
    },
    errorMessage: 'Telegram SDK'
  })
}

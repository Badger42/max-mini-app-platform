import loadBridgeScript from './loadBridgeScript.js'

const BRIDGE_URL = 'https://telegram.org/js/telegram-web-app.js?65'
const BRIDGE_SCRIPT_ID = 'telegram-web-app-bridge'
const DEFAULT_TIMEOUT_MS = 5000

/**
 * Dynamically load Telegram Web Apps SDK. Call only after Telegram launch
 * parameters were found. A rejected load may be retried explicitly.
 */
export default function loadTelegramBridge({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return loadBridgeScript({
    url: BRIDGE_URL,
    scriptId: BRIDGE_SCRIPT_ID,
    timeoutMs,
    getBridge: () => window.Telegram && window.Telegram.WebApp,
    errorMessage: 'Telegram SDK'
  })
}

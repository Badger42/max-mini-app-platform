import loadBridgeScript from './loadBridgeScript.js'

const BRIDGE_URL = 'https://st.max.ru/js/max-web-app.js'
const BRIDGE_SCRIPT_ID = 'max-web-app-bridge'
const DEFAULT_TIMEOUT_MS = 5000

/**
 * Dynamically load MAX Bridge. Call only after MAX launch parameters were found.
 * A rejected load may be retried explicitly; late load events cannot resolve
 * the already rejected attempt or switch an adapter selected by the bootstrap.
 */
export default function loadMaxBridge({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return loadBridgeScript({
    url: BRIDGE_URL,
    scriptId: BRIDGE_SCRIPT_ID,
    timeoutMs,
    getBridge: () => window.WebApp,
    errorMessage: 'MAX Bridge'
  })
}

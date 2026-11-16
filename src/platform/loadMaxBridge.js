import loadBridgeScript from './loadBridgeScript.js'

const BRIDGE_URL = 'https://st.max.ru/js/max-web-app.js'
const BRIDGE_SCRIPT_ID = 'max-web-app-bridge'
const DEFAULT_TIMEOUT_MS = 5000

/**
 * Dynamically load MAX Bridge. Call after MAX launch parameters were detected.
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<import('./platformTypes.js').MaxBridge>}
 */
export default function loadMaxBridge({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return loadBridgeScript({
    url: BRIDGE_URL,
    scriptId: BRIDGE_SCRIPT_ID,
    timeoutMs,
    getBridge: () => /** @type {Window & {WebApp?: import('./platformTypes.js').MaxBridge}} */ (window).WebApp,
    errorMessage: 'MAX Bridge'
  })
}

import createFallbackAdapter from './createFallbackAdapter.js'

/**
 * Backward-compatible MAX fallback adapter factory.
 * @param {Error|string|null} error
 * @param {import('./platformTypes.js').PlatformAdapterOptions} [options]
 * @returns {import('./platformTypes.js').PlatformAdapter}
 */
export default function createMaxFallbackAdapter(error, options = {}) {
  return createFallbackAdapter('max', error, options)
}

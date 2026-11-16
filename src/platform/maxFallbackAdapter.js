import createFallbackAdapter from './createFallbackAdapter.js'

/**
 * Backward-compatible MAX fallback adapter factory.
 */
export default function createMaxFallbackAdapter(error, options = {}) {
  return createFallbackAdapter('max', error, options)
}

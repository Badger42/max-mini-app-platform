import createMaxAdapter from './maxAdapter'
import createWebAdapter from './webAdapter'
import createMaxFallbackAdapter from './maxFallbackAdapter'

/** Selects the adapter once, before Vue is mounted. */
export default function createPlatform({
  environment,
  webApp = null,
  error = null,
  downloadOptions = {}
} = {}) {
  if (environment === 'max' && webApp) {
    return createMaxAdapter(webApp, { downloadOptions })
  }

  if (environment === 'max' || environment === 'max-fallback') {
    return createMaxFallbackAdapter(error, { downloadOptions })
  }

  return createWebAdapter({ downloadOptions })
}

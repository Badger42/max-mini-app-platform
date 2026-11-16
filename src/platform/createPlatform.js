import createMaxAdapter from './maxAdapter.js'
import createWebAdapter from './webAdapter.js'
import createMaxFallbackAdapter from './maxFallbackAdapter.js'
import createTelegramAdapter from './telegramAdapter.js'
import createTelegramFallbackAdapter from './telegramFallbackAdapter.js'

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

  if (environment === 'telegram' && webApp) {
    return createTelegramAdapter(webApp, { downloadOptions })
  }

  if (environment === 'telegram' || environment === 'telegram-fallback') {
    return createTelegramFallbackAdapter(error, { downloadOptions })
  }

  return createWebAdapter({ downloadOptions })
}

import detectMaxLaunch from './detectMaxLaunch.js'
import detectTelegramLaunch from './detectTelegramLaunch.js'

/**
 * Detects the launch environment before Vue Router is created/mounted.
 * Telegram and MAX use distinct launch parameter names in the URL fragment.
 * The result is only used to decide which SDK (if any) should be loaded.
 */
export default function detectPlatform() {
  if (detectTelegramLaunch()) {
    return 'telegram'
  }

  if (detectMaxLaunch()) {
    return 'max'
  }

  return 'web'
}

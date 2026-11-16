import detectMaxLaunch from './detectMaxLaunch.js'
import detectTelegramLaunch from './detectTelegramLaunch.js'

/**
 * Detects the launch environment before Vue Router is created/mounted.
 *
 * A conflicting set of MAX and Telegram launch markers is treated as ordinary
 * Web: loading either SDK in an ambiguous context is less safe than loading none.
 */
export default function detectPlatform() {
  const isMax = detectMaxLaunch()
  const isTelegram = detectTelegramLaunch()

  if (isMax && isTelegram) {
    return 'web'
  }

  if (isTelegram) {
    return 'telegram'
  }

  if (isMax) {
    return 'max'
  }

  return 'web'
}

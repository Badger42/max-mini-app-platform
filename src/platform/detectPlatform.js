import detectMaxLaunch from './detectMaxLaunch.js'
import detectTelegramLaunch from './detectTelegramLaunch.js'

/**
 * Detect the launch environment before Vue Router is created or mounted.
 * Telegram remains a legacy compatibility route until the previous stage is
 * completed; the target platform model is Web + MAX.
 * @returns {import('./platformTypes.js').LaunchContext}
 */
export default function detectPlatform() {
  const isMax = detectMaxLaunch()
  const isTelegram = detectTelegramLaunch()

  if (isMax && isTelegram) return 'web'
  if (isTelegram) return 'telegram'
  if (isMax) return 'max'
  return 'web'
}

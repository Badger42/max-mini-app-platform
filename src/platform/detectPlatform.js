import detectMaxLaunch from './detectMaxLaunch.js'
import detectTelegramLaunch from './detectTelegramLaunch.js'

/**
 * Legacy convenience detector returning only the protocol name. New bootstrap
 * code should use detectLaunchContext() to retain validation diagnostics.
 * @returns {import('./platformTypes.js').LaunchContextType}
 */
export default function detectPlatform() {
  const isMax = detectMaxLaunch()
  const isTelegram = detectTelegramLaunch()

  if (isMax && isTelegram) return 'web'
  if (isTelegram) return 'telegram'
  if (isMax) return 'max'
  return 'web'
}

const MAX_PLATFORMS = new Set(['ios', 'android', 'desktop', 'web'])
const MAX_LAUNCH_KEYS = ['WebAppData', 'WebAppPlatform', 'WebAppVersion']

/**
 * Parse MAX launch markers without retaining WebAppData.
 *
 * This is environment detection only. Launch data is never exposed to the
 * adapter, treated as identity, or used for authorization.
 */
export function parseMaxLaunchHash(hash) {
  const fragment = String(hash ?? '').replace(/^#/, '')
  const params = new URLSearchParams(fragment)
  const presentKeys = MAX_LAUNCH_KEYS.filter(key => params.has(key))

  if (presentKeys.length === 0) {
    return {
      launch: null,
      detection: { status: 'absent', reason: null }
    }
  }

  for (const key of presentKeys) {
    const values = params.getAll(key).map(value => value.trim())

    if (values.length > 1) {
      const hasConflictingValues = new Set(values).size > 1
      return {
        launch: null,
        detection: {
          status: hasConflictingValues ? 'conflicting' : 'invalid',
          reason: `${hasConflictingValues ? 'conflicting' : 'duplicate'}_parameter:${key}`
        }
      }
    }
  }

  const hasData = Boolean((params.get('WebAppData') || '').trim())
  const platformValue = params.has('WebAppPlatform')
    ? params.get('WebAppPlatform').trim()
    : null
  const versionValue = params.has('WebAppVersion')
    ? params.get('WebAppVersion').trim()
    : null

  if (platformValue !== null && !MAX_PLATFORMS.has(platformValue)) {
    return {
      launch: null,
      detection: { status: 'invalid', reason: 'unsupported_platform' }
    }
  }

  if (versionValue !== null && !versionValue) {
    return {
      launch: null,
      detection: { status: 'invalid', reason: 'empty_parameter:WebAppVersion' }
    }
  }

  // MAX launch data may be omitted by some entry points, but in that case the
  // platform and version markers must both be present and valid.
  if (!hasData && !(platformValue && versionValue)) {
    return {
      launch: null,
      detection: { status: 'invalid', reason: 'incomplete_launch_parameters' }
    }
  }

  return {
    launch: {
      platform: platformValue,
      version: versionValue
    },
    detection: { status: 'valid', reason: null }
  }
}

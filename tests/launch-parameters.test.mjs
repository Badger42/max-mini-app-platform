import test from 'node:test'
import assert from 'node:assert/strict'

import createPlatform from '../src/platform/createPlatform.js'

test('MAX start_param is exposed as a routing hint before Vue app creation', () => {
  const platform = createPlatform({
    bridgeType: 'max',
    bridge: {
      platform: 'android',
      version: '26.2.8',
      initDataUnsafe: {
        start_param: 'project-a',
        user: { id: 12345 }
      }
    }
  })

  assert.deepEqual(platform.launchParameters, { startParam: 'project-a' })
  assert.equal(Object.hasOwn(platform.launchParameters, 'user'), false)
})

test('Telegram start_param is normalized through the same platform contract', () => {
  const platform = createPlatform({
    bridgeType: 'telegram',
    bridge: {
      platform: 'ios',
      version: '9.1',
      initDataUnsafe: { start_param: 'project-b' }
    }
  })

  assert.deepEqual(platform.launchParameters, { startParam: 'project-b' })
})

test('missing or non-string start_param values normalize to null', () => {
  const missing = createPlatform({
    bridgeType: 'max',
    bridge: { platform: 'android', initDataUnsafe: {} }
  })
  const malformed = createPlatform({
    bridgeType: 'max',
    bridge: { platform: 'android', initDataUnsafe: { start_param: { value: 'unexpected' } } }
  })

  assert.deepEqual(missing.launchParameters, { startParam: null })
  assert.deepEqual(malformed.launchParameters, { startParam: null })
})

test('Web and host fallback adapters expose a stable empty launch-parameter shape', () => {
  const web = createPlatform()
  const fallback = createPlatform({
    bridgeType: 'max',
    bridgeError: new Error('SDK unavailable')
  })

  assert.deepEqual(web.launchParameters, { startParam: null })
  assert.deepEqual(fallback.launchParameters, { startParam: null })
})

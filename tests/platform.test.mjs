import test from 'node:test'
import assert from 'node:assert/strict'

import { parseMaxLaunchHash } from '../src/platform/detectMaxLaunch.js'
import detectLaunchContext from '../src/platform/detectLaunchContext.js'
import createPlatform from '../src/platform/createPlatform.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'
import createWebAdapter from '../src/platform/webAdapter.js'

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  })
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
}

const maxContext = {
  type: 'max',
  launch: { platform: 'android', version: '1.2.3' },
  detection: { status: 'valid', reason: null }
}

test('ordinary Web launch returns the complete absent Launch Context', () => {
  const restore = replaceGlobal('window', {
    location: { hash: '#/orders/42' },
    WebApp: { platform: 'android' }
  })

  try {
    assert.deepEqual(detectLaunchContext(), {
      type: 'web',
      launch: null,
      detection: { status: 'absent', reason: null }
    })
  } finally {
    restore()
  }
})

test('valid MAX launch preserves platform/version but never exposes WebAppData', () => {
  const parsed = parseMaxLaunchHash(
    '#WebAppData=private%3Dlaunch-secret&WebAppPlatform=ios&WebAppVersion=2.4'
  )

  assert.deepEqual(parsed, {
    launch: { platform: 'ios', version: '2.4' },
    detection: { status: 'valid', reason: null }
  })
  assert.equal(JSON.stringify(parsed).includes('private'), false)
  assert.equal(JSON.stringify(parsed).includes('launch-secret'), false)

  const restore = replaceGlobal('window', {
    location: {
      hash: '#WebAppData=private&WebAppPlatform=android&WebAppVersion=3.0'
    }
  })
  try {
    assert.deepEqual(detectLaunchContext(), {
      type: 'max',
      launch: { platform: 'android', version: '3.0' },
      detection: { status: 'valid', reason: null }
    })
  } finally {
    restore()
  }
})

test('MAX parser distinguishes absent, invalid, duplicate and conflicting markers', () => {
  assert.equal(parseMaxLaunchHash('#/home').detection.status, 'absent')

  const incomplete = parseMaxLaunchHash('#WebAppPlatform=ios')
  assert.deepEqual(incomplete.detection, {
    status: 'invalid',
    reason: 'incomplete_launch_parameters'
  })

  const duplicate = parseMaxLaunchHash(
    '#WebAppPlatform=ios&WebAppPlatform=ios&WebAppVersion=1.0'
  )
  assert.deepEqual(duplicate.detection, {
    status: 'invalid',
    reason: 'duplicate_parameter:WebAppPlatform'
  })

  const conflicting = parseMaxLaunchHash(
    '#WebAppPlatform=ios&WebAppPlatform=android&WebAppVersion=1.0'
  )
  assert.deepEqual(conflicting.detection, {
    status: 'conflicting',
    reason: 'conflicting_parameter:WebAppPlatform'
  })

  assert.equal(
    parseMaxLaunchHash('#WebAppPlatform=watch&WebAppVersion=1.0').detection.status,
    'invalid'
  )
})

test('invalid and conflicting launches fail closed to Web and retain diagnostics', () => {
  const restore = replaceGlobal('window', {
    location: { hash: '#WebAppPlatform=ios&WebAppPlatform=android&WebAppVersion=1.0' }
  })

  try {
    const context = detectLaunchContext()
    assert.equal(context.type, 'web')
    assert.equal(context.launch, null)
    assert.equal(context.detection.status, 'conflicting')
  } finally {
    restore()
  }
})

test('createPlatform selects Web from Launch Context and preserves diagnostics', () => {
  const web = createPlatform()
  assert.equal(web.bridgeType, null)
  assert.equal(web.bridgeAvailable, false)
  assert.equal(web.launchContext.type, 'web')

  const invalidWeb = createPlatform({
    launchContext: {
      type: 'web',
      launch: null,
      detection: { status: 'invalid', reason: 'duplicate_parameter:WebAppVersion' }
    }
  })
  assert.equal(invalidWeb.launchContext.detection.status, 'invalid')
})

test('createPlatform selects MAX adapter from Launch Context', () => {
  const bridge = { platform: 'android', version: '1.2.3' }
  const max = createPlatform({ launchContext: maxContext, bridge })

  assert.equal(max.bridgeType, 'max')
  assert.equal(max.bridgeAvailable, true)
  assert.equal(max.launchContext, maxContext)
  assert.equal(max.runtime.clientPlatform, 'android')
  assert.equal(max.runtime.clientVersion, '1.2.3')
})

test('MAX fallback retains Launch Context and Bridge error', async () => {
  const bridgeError = new Error('MAX CDN unavailable')
  const calls = []
  const fallback = createPlatform({
    launchContext: maxContext,
    bridgeError,
    services: {
      downloadFile(url, fileName, options) {
        calls.push({ url, fileName, options })
        return Promise.resolve(undefined)
      }
    }
  })

  assert.equal(fallback.bridgeType, 'max')
  assert.equal(fallback.bridgeAvailable, false)
  assert.equal(fallback.bridgeError, bridgeError)
  assert.equal(fallback.launchContext, maxContext)
  assert.equal(fallback.runtime.clientPlatform, 'android')
  assert.equal(fallback.runtime.clientVersion, '1.2.3')
  assert.equal(fallback.capabilities.backButton, false)
  assert.equal(fallback.capabilities.nativeDownload, false)

  assert.deepEqual(
    await fallback.downloadFile('/api/files/1', 'invoice.pdf'),
    { status: 'requested' }
  )
  assert.equal(calls[0].url, '/api/files/1')
})

test('Web adapter passes relative URLs and options unchanged to injected service', async () => {
  const received = []
  const service = (url, fileName, options) => {
    received.push({ url, fileName, options })
    return Promise.resolve({ data: 'service-result' })
  }
  const web = createWebAdapter({
    downloadOptions: { credentials: 'include', tenant: 'default' },
    services: { downloadFile: service }
  })

  const pending = web.downloadFile('/api/documents/42', 'document.pdf', {
    tenant: 'override'
  })
  assert.equal(received.length, 1, 'service is invoked synchronously')
  assert.deepEqual(received[0], {
    url: '/api/documents/42',
    fileName: 'document.pdf',
    options: { credentials: 'include', tenant: 'override' }
  })
  assert.deepEqual(await pending, { status: 'requested' })
})

test('MAX native download is invoked synchronously in the originating call', async () => {
  let inUserGesture = true
  let nativeCalls = 0
  const max = createMaxAdapter({
    platform: 'android',
    downloadFile(url, fileName) {
      assert.equal(inUserGesture, true)
      assert.equal(url, 'https://files.example.test/file.pdf')
      assert.equal(fileName, 'file.pdf')
      nativeCalls += 1
      return Promise.resolve({ status: 'downloading' })
    }
  })

  const pending = max.downloadFile('https://files.example.test/file.pdf', 'file.pdf')
  assert.equal(nativeCalls, 1)
  inUserGesture = false
  assert.deepEqual(await pending, {
    status: 'requested',
    platformStatus: 'downloading'
  })
})

test('MAX without native download delegates to injected service, not Blob fallback', async () => {
  let nativeCalls = 0
  const calls = []
  const max = createMaxAdapter({
    platform: 'web',
    downloadFile() { nativeCalls += 1 }
  }, {
    services: {
      downloadFile(url, fileName) {
        calls.push([url, fileName])
        return Promise.resolve()
      }
    }
  })

  assert.equal(max.capabilities.nativeDownload, false)
  assert.deepEqual(
    await max.downloadFile('/api/export/4', 'export.csv'),
    { status: 'requested' }
  )
  assert.deepEqual(calls, [['/api/export/4', 'export.csv']])
  assert.equal(nativeCalls, 0)
})

test('native MAX download rejects non-HTTPS URLs before calling the Bridge', async () => {
  let nativeCalls = 0
  const max = createMaxAdapter({
    platform: 'ios',
    downloadFile() { nativeCalls += 1 }
  })

  await assert.rejects(
    max.downloadFile('/api/file.pdf', 'file.pdf'),
    /absolute URL|HTTPS/
  )
  assert.equal(nativeCalls, 0)
})

test('download service synchronous exceptions and rejected Promises propagate', async () => {
  const syncError = new Error('sync service error')
  const rejectingError = new Error('async service error')
  const sync = createWebAdapter({
    services: { downloadFile() { throw syncError } }
  })
  const async = createWebAdapter({
    services: { downloadFile() { return Promise.reject(rejectingError) } }
  })

  await assert.rejects(sync.downloadFile('/api/a', 'a.pdf'), error => error === syncError)
  await assert.rejects(async.downloadFile('/api/b', 'b.pdf'), error => error === rejectingError)
})

test('download service can explicitly return a cancelled result', async () => {
  const web = createWebAdapter({
    services: { downloadFile: async () => ({ status: 'cancelled', internal: true }) }
  })
  assert.deepEqual(await web.downloadFile('/api/a', 'a.pdf'), { status: 'cancelled' })
})

test('download service rejects unknown resolved statuses', async () => {
  const web = createWebAdapter({
    services: { downloadFile: async () => ({ status: 'completed' }) }
  })
  await assert.rejects(web.downloadFile('/api/a', 'a.pdf'), /Unexpected download service result/)
})

test('factory validates service, Launch Context and migration contract', () => {
  assert.throws(() => createPlatform({ services: { downloadFile: true } }), /must be a function/)
  assert.throws(() => createPlatform({ bridgeType: 'max' }), /launchContext and bridgeError/)
  assert.throws(() => createPlatform({ launchContext: { type: 'other' } }), /web.*max/)
  assert.throws(() => createPlatform({
    launchContext: {
      type: 'max',
      launch: { platform: 'android', version: '1.0' },
      detection: { status: 'invalid', reason: 'duplicate' }
    }
  }), /valid launch metadata/)
})

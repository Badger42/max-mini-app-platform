import test from 'node:test'
import assert from 'node:assert/strict'

import createMaxAdapter from '../src/platform/maxAdapter.js'
import createWebAdapter from '../src/platform/webAdapter.js'
import {
  normalizeMaxDownloadResult,
  normalizeTelegramDownloadResult,
  normalizeMaxShareResult,
  normalizeMaxPreparedMessageResult,
  PlatformProtocolError,
  requireMaxDeepLink
} from '../src/platform/adapterUtils.js'

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

test('MAX download normalizer accepts only MAX documented statuses', () => {
  assert.deepEqual(
    normalizeMaxDownloadResult({ status: 'downloading' }),
    { status: 'requested', platformStatus: 'downloading' }
  )
  assert.deepEqual(
    normalizeMaxDownloadResult({ status: 'cancelled' }),
    { status: 'cancelled', platformStatus: 'cancelled' }
  )

  for (const invalid of [undefined, null, {}, { status: 'accepted' }, { status: 'completed' }, { status: 'error' }]) {
    assert.throws(() => normalizeMaxDownloadResult(invalid), PlatformProtocolError)
  }
})

test('Telegram download statuses are normalized separately from MAX', () => {
  assert.deepEqual(
    normalizeTelegramDownloadResult({ status: 'accepted' }),
    { status: 'requested', platformStatus: 'accepted' }
  )
  assert.deepEqual(
    normalizeTelegramDownloadResult({ status: 'cancelled' }),
    { status: 'cancelled', platformStatus: 'cancelled' }
  )
  assert.throws(
    () => normalizeTelegramDownloadResult({ status: 'downloading' }),
    PlatformProtocolError
  )
})

test('MAX sharing normalizers accept only shared/cancelled and keep operation-specific errors', () => {
  assert.deepEqual(normalizeMaxShareResult({ status: 'shared' }), { status: 'shared' })
  assert.deepEqual(normalizeMaxShareResult({ status: 'cancelled' }), { status: 'cancelled' })
  assert.deepEqual(normalizeMaxPreparedMessageResult({ status: 'shared' }), { status: 'shared' })
  assert.deepEqual(normalizeMaxPreparedMessageResult({ status: 'cancelled' }), { status: 'cancelled' })

  assert.throws(
    () => normalizeMaxShareResult({ status: 'opened' }),
    error => error instanceof PlatformProtocolError && error.operation === 'shareUrl'
  )
  assert.throws(
    () => normalizeMaxPreparedMessageResult(undefined),
    error => error instanceof PlatformProtocolError && error.operation === 'sharePreparedMessage'
  )
})

test('MAX deep-link validation uses an exact hostname match', () => {
  assert.equal(requireMaxDeepLink('https://max.ru/bot?startapp=order'), 'https://max.ru/bot?startapp=order')
  assert.throws(() => requireMaxDeepLink('https://max.ru.attacker.example/path'), TypeError)
  assert.throws(() => requireMaxDeepLink('https://www.max.ru/path'), TypeError)
  assert.throws(() => requireMaxDeepLink('https://evilmax.ru/path'), TypeError)
  assert.throws(() => requireMaxDeepLink('http://max.ru/path'), TypeError)
})

test('MAX openPlatformLink rejects external URLs while openExternalLink remains available', () => {
  const openedExternally = []
  const openedInMax = []
  const max = createMaxAdapter({
    openLink(url) { openedExternally.push(url) },
    openMaxLink(url) { openedInMax.push(url) }
  })

  assert.deepEqual(max.openPlatformLink('https://max.ru/bot'), { status: 'requested' })
  assert.throws(() => max.openPlatformLink('https://example.com'), TypeError)
  assert.deepEqual(max.openExternalLink('https://example.com'), { status: 'requested' })
  assert.deepEqual(openedInMax, ['https://max.ru/bot'])
  assert.deepEqual(openedExternally, ['https://example.com/'])
})

test('native MAX Promise operations preserve user activation and turn sync throws into rejection', async () => {
  const expectedError = new Error('native bridge failure')
  const calls = []
  const max = createMaxAdapter({
    platform: 'android',
    downloadFile() {
      calls.push('download')
      throw expectedError
    },
    shareMaxContent() {
      calls.push('share')
      throw expectedError
    }
  })

  const downloadPromise = max.downloadFile('https://files.example.com/a.pdf', 'a.pdf')
  assert.deepEqual(calls, ['download'])
  await assert.rejects(downloadPromise, error => error === expectedError)

  const sharePromise = max.shareUrl('https://example.com')
  assert.deepEqual(calls, ['download', 'share'])
  await assert.rejects(sharePromise, error => error === expectedError)

  const preparedPromise = max.sharePreparedMessage({ messageId: 'mid.123', chatType: 'DIALOG' })
  assert.deepEqual(calls, ['download', 'share', 'share'])
  await assert.rejects(preparedPromise, error => error === expectedError)
})

test('MAX async methods return rejected Promises for invalid inputs', async () => {
  const max = createMaxAdapter({ platform: 'android' })
  await assert.rejects(max.downloadFile('/relative', 'file.pdf'), TypeError)
  await assert.rejects(max.shareUrl('http://example.com'), TypeError)
  await assert.rejects(max.sharePreparedMessage({ messageId: 'mid.123', chatType: 'GROUP' }), TypeError)
})

test('Web Share AbortError maps to cancelled and other failures remain rejected', async () => {
  const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' })
  let restoreNavigator = replaceGlobal('navigator', { share: async () => { throw abortError } })
  try {
    const web = createWebAdapter()
    assert.deepEqual(await web.shareUrl('https://example.com'), { status: 'cancelled' })
  } finally {
    restoreNavigator()
  }

  const failure = new Error('share failed')
  restoreNavigator = replaceGlobal('navigator', { share: async () => { throw failure } })
  try {
    const web = createWebAdapter()
    await assert.rejects(web.shareUrl('https://example.com'), error => error === failure)
  } finally {
    restoreNavigator()
  }
})

test('Clipboard reports copied only after successful writeText and propagates failures', async () => {
  let completed = false
  let restoreNavigator = replaceGlobal('navigator', {
    clipboard: {
      async writeText(value) {
        assert.equal(value, 'Check this\nhttps://example.com/')
        await Promise.resolve()
        completed = true
      }
    }
  })

  try {
    const web = createWebAdapter()
    const result = await web.shareUrl('https://example.com', 'Check this')
    assert.equal(completed, true)
    assert.deepEqual(result, { status: 'copied' })
  } finally {
    restoreNavigator()
  }

  const failure = new Error('clipboard denied')
  restoreNavigator = replaceGlobal('navigator', {
    clipboard: { writeText: async () => { throw failure } }
  })
  try {
    const web = createWebAdapter()
    await assert.rejects(web.shareUrl('https://example.com'), error => error === failure)
  } finally {
    restoreNavigator()
  }
})

test('native and effective sharing capabilities are distinct', () => {
  const maxWithNativeShare = createMaxAdapter({ shareMaxContent: async () => ({ status: 'shared' }) })
  assert.equal(maxWithNativeShare.capabilities.nativeShareUrl, true)
  assert.equal(maxWithNativeShare.capabilities.shareUrl, true)

  const restoreNavigator = replaceGlobal('navigator', { share: async () => {} })
  try {
    const maxWithBrowserFallback = createMaxAdapter({})
    assert.equal(maxWithBrowserFallback.capabilities.nativeShareUrl, false)
    assert.equal(maxWithBrowserFallback.capabilities.shareUrl, true)
  } finally {
    restoreNavigator()
  }
})


test('captured MAX and Telegram SDK methods retain their receiver', async () => {
  const calls = []
  const maxBridge = {
    platform: 'android',
    downloadFile() {
      assert.equal(this, maxBridge)
      calls.push('max-download')
      return Promise.resolve({ status: 'downloading' })
    },
    openLink() {
      assert.equal(this, maxBridge)
      calls.push('max-open')
    },
    openMaxLink() {
      assert.equal(this, maxBridge)
      calls.push('max-platform-open')
    },
    shareMaxContent() {
      assert.equal(this, maxBridge)
      calls.push('max-share')
      return Promise.resolve({ status: 'shared' })
    }
  }
  const max = createMaxAdapter(maxBridge)
  await max.downloadFile('https://files.example.com/file.pdf', 'file.pdf')
  max.openExternalLink('https://example.com')
  max.openPlatformLink('https://max.ru/bot')
  await max.shareUrl('https://example.com')
  await max.sharePreparedMessage({ messageId: 'mid.123', chatType: 'DIALOG' })

  const telegramBridge = {
    version: '9.1',
    downloadFile(_params, callback) {
      assert.equal(this, telegramBridge)
      calls.push('telegram-download')
      callback(true)
    },
    openLink() {
      assert.equal(this, telegramBridge)
      calls.push('telegram-open')
    },
    openTelegramLink() {
      assert.equal(this, telegramBridge)
      calls.push('telegram-platform-open')
    },
    shareMessage(_id, callback) {
      assert.equal(this, telegramBridge)
      calls.push('telegram-share')
      callback(true)
    }
  }
  const { default: createTelegramAdapter } = await import('../src/platform/telegramAdapter.js')
  const telegram = createTelegramAdapter(telegramBridge)
  await telegram.downloadFile('https://files.example.com/file.pdf', 'file.pdf')
  telegram.openExternalLink('https://example.com')
  telegram.openPlatformLink('https://t.me/example')
  await telegram.shareUrl('https://example.com')
  await telegram.sharePreparedMessage({ messageId: 'prepared-id' })

  assert.deepEqual(calls, [
    'max-download', 'max-open', 'max-platform-open', 'max-share', 'max-share',
    'telegram-download', 'telegram-open', 'telegram-platform-open',
    'telegram-platform-open', 'telegram-share'
  ])
})

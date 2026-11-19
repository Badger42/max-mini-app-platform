import test from 'node:test'
import assert from 'node:assert/strict'

import { parseTelegramLaunchHash } from '../src/platform/detectTelegramLaunch.js'
import { parseMaxLaunchHash } from '../src/platform/detectMaxLaunch.js'
import detectPlatform from '../src/platform/detectPlatform.js'
import createPlatform from '../src/platform/createPlatform.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'
import createTelegramAdapter from '../src/platform/telegramAdapter.js'
import createWebAdapter from '../src/platform/webAdapter.js'

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
}

test('launch parsers recognize Telegram and MAX without exposing launch data', () => {
  const telegram = parseTelegramLaunchHash(
    '#tgWebAppData=user%3Dexample&tgWebAppPlatform=ios&tgWebAppVersion=9.1'
  )
  assert.equal(telegram.isTelegramLaunch, true)
  assert.equal(telegram.platform, 'ios')
  assert.equal(telegram.version, '9.1')
  assert.equal(Object.hasOwn(telegram, 'initData'), false)

  const max = parseMaxLaunchHash('#WebAppData=payload&WebAppPlatform=android&WebAppVersion=1.2')
  assert.equal(max.isMaxLaunch, true)
  assert.equal(max.platform, 'android')
})

test('launch parsers reject duplicate protocol keys', () => {
  assert.equal(
    parseTelegramLaunchHash('#tgWebAppPlatform=ios&tgWebAppPlatform=android&tgWebAppVersion=9.1').invalid,
    true
  )
  assert.equal(
    parseMaxLaunchHash('#WebAppData=a&WebAppData=b&WebAppPlatform=ios&WebAppVersion=1.2').invalid,
    true
  )
})

test('detectPlatform selects Telegram, MAX and Web; ambiguous markers fail closed', () => {
  const restore = replaceGlobal('window', { location: { hash: '#tgWebAppPlatform=android&tgWebAppVersion=9.1' } })
  try {
    assert.equal(detectPlatform(), 'telegram')
    globalThis.window.location.hash = '#WebAppPlatform=ios&WebAppVersion=1.2'
    assert.equal(detectPlatform(), 'max')
    globalThis.window.location.hash = '#/orders/42'
    assert.equal(detectPlatform(), 'web')
    globalThis.window.location.hash = '#WebAppData=max&WebAppPlatform=ios&WebAppVersion=1.0&tgWebAppData=tg&tgWebAppPlatform=ios&tgWebAppVersion=9.1'
    assert.equal(detectPlatform(), 'web')
  } finally {
    restore()
  }
})

test('createPlatform creates first-class Web, MAX and Telegram adapters', () => {
  assert.equal(createPlatform().bridgeType, null)

  const max = createPlatform({ bridgeType: 'max', bridge: { platform: 'android' } })
  assert.equal(max.bridgeType, 'max')
  assert.equal(max.bridgeAvailable, true)

  const telegram = createPlatform({ bridgeType: 'telegram', bridge: { platform: 'ios', version: '9.1' } })
  assert.equal(telegram.bridgeType, 'telegram')
  assert.equal(telegram.bridgeAvailable, true)
  assert.equal(telegram.runtime.clientPlatform, 'ios')

  const telegramFallback = createPlatform({ bridgeType: 'telegram', error: new Error('CDN offline') })
  assert.equal(telegramFallback.bridgeType, 'telegram')
  assert.equal(telegramFallback.bridgeAvailable, false)
  assert.equal(telegramFallback.bridgeError.message, 'CDN offline')
})

test('all three platforms expose the same public method and capability keys', () => {
  const adapters = [
    createWebAdapter(),
    createMaxAdapter({}),
    createTelegramAdapter({ version: '9.1' }),
    createPlatform({ bridgeType: 'max', error: 'offline' }),
    createPlatform({ bridgeType: 'telegram', error: 'offline' })
  ]
  const methods = [
    'downloadFile', 'openExternalLink', 'openPlatformLink', 'shareUrl',
    'sharePreparedMessage', 'enableClosingConfirmation', 'disableClosingConfirmation', 'ready'
  ]
  const capabilities = [
    'nativeDownload', 'backButton', 'nativeExternalLinks', 'nativePlatformLinks',
    'closingConfirmation', 'nativeShareUrl', 'shareUrl', 'sharePreparedMessage'
  ]

  for (const adapter of adapters) {
    for (const name of methods) assert.equal(typeof adapter[name], 'function', name)
    for (const name of capabilities) assert.equal(typeof adapter.capabilities[name], 'boolean', name)
    assert.equal(typeof adapter.backButton.show, 'function')
    assert.equal(typeof adapter.backButton.hide, 'function')
    assert.equal(typeof adapter.backButton.onClick, 'function')
  }
})

test('Telegram download maps its callback statuses independently from MAX', async () => {
  let resolveCallback
  const telegram = createTelegramAdapter({
    version: '9.1',
    downloadFile(params, callback) {
      assert.deepEqual(params, { url: 'https://files.example.com/a.pdf', file_name: 'a.pdf' })
      resolveCallback = callback
    }
  })
  const pending = telegram.downloadFile('https://files.example.com/a.pdf', 'a.pdf')
  resolveCallback(true)
  assert.deepEqual(await pending, { status: 'requested', platformStatus: 'accepted' })

  const cancelledTelegram = createTelegramAdapter({
    version: '9.1',
    downloadFile(_params, callback) { callback(false) }
  })
  assert.deepEqual(
    await cancelledTelegram.downloadFile('https://files.example.com/a.pdf', 'a.pdf'),
    { status: 'cancelled', platformStatus: 'cancelled' }
  )
})

test('Telegram prepared-message sharing requires a supported version and a prepared ID', async () => {
  let receivedId
  const telegram = createTelegramAdapter({
    version: '9.1',
    shareMessage(messageId, callback) {
      receivedId = messageId
      callback(true)
    }
  })
  assert.deepEqual(await telegram.sharePreparedMessage({ messageId: 'prepared-inline-id' }), { status: 'shared' })
  assert.equal(receivedId, 'prepared-inline-id')

  const oldTelegram = createTelegramAdapter({ version: '7.10', shareMessage() {} })
  assert.equal(oldTelegram.capabilities.sharePreparedMessage, false)
  await assert.rejects(oldTelegram.sharePreparedMessage({ messageId: 'prepared-id' }), /not available in this client version/)
})

test('Telegram URL share uses the official share URL composer', async () => {
  let openedUrl
  const telegram = createTelegramAdapter({
    platform: 'ios', version: '9.1',
    openTelegramLink(url) { openedUrl = url }
  })
  assert.deepEqual(await telegram.shareUrl('https://example.com/page', 'hello'), { status: 'opened' })
  const url = new URL(openedUrl)
  assert.equal(url.origin + url.pathname, 'https://t.me/share/url')
  assert.equal(url.searchParams.get('url'), 'https://example.com/page')
  assert.equal(url.searchParams.get('text'), 'hello')
})


test('Telegram parser supports Vue Router path-and-query hash fragments', () => {
  const parsed = parseTelegramLaunchHash(
    '#/orders/42?tgWebAppData=user%3Dexample&tgWebAppPlatform=ios&tgWebAppVersion=9.1'
  )
  assert.equal(parsed.isTelegramLaunch, true)
  assert.equal(parsed.platform, 'ios')
  assert.equal(parsed.version, '9.1')
})

test('launch context restores MAX parameters from sessionStorage after hash routing', async () => {
  const storage = new Map([
    ['WebAppData', 'saved-init-data'],
    ['WebAppPlatform', 'android'],
    ['WebAppVersion', '1.2']
  ])
  const restore = replaceGlobal('window', {
    location: { hash: '#/orders/42', href: 'https://app.example/#/orders/42' },
    sessionStorage: { getItem: key => storage.get(key) ?? null }
  })

  try {
    const { default: detectLaunchContext } = await import('../src/platform/detectLaunchContext.js')
    const context = detectLaunchContext()
    assert.equal(context.type, 'max')
    assert.deepEqual(context.launch, { platform: 'android', version: '1.2' })
  } finally {
    restore()
  }
})

test('launch context restores MAX parameters from the original navigation URL', async () => {
  const restore = replaceGlobal('window', {
    location: { hash: '#/orders/42', href: 'https://app.example/#/orders/42' },
    performance: {
      getEntriesByType: type => type === 'navigation'
        ? [{ name: 'https://app.example/#WebAppData=launch&WebAppPlatform=ios&WebAppVersion=1.3' }]
        : []
    },
    sessionStorage: { getItem: () => null }
  })

  try {
    const { default: detectLaunchContext } = await import('../src/platform/detectLaunchContext.js')
    const context = detectLaunchContext()
    assert.equal(context.type, 'max')
    assert.deepEqual(context.launch, { platform: 'ios', version: '1.3' })
  } finally {
    restore()
  }
})

test('launch context merges Telegram route hash with persisted initParams', async () => {
  const stored = JSON.stringify({
    tgWebAppData: 'user%3Dexample',
    tgWebAppVersion: '9.1'
  })
  const restore = replaceGlobal('window', {
    location: {
      hash: '#/orders/42?tgWebAppPlatform=ios',
      href: 'https://app.example/#/orders/42?tgWebAppPlatform=ios'
    },
    sessionStorage: {
      getItem: key => key === '__telegram__initParams' ? stored : null
    }
  })

  try {
    const { default: detectLaunchContext } = await import('../src/platform/detectLaunchContext.js')
    const context = detectLaunchContext()
    assert.equal(context.type, 'telegram')
    assert.deepEqual(context.launch, { platform: 'ios', version: '9.1' })
    assert.equal(detectPlatform(), 'telegram')
  } finally {
    restore()
  }
})

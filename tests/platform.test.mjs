import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseTelegramLaunchHash } from '../src/platform/detectTelegramLaunch.js'
import detectPlatform from '../src/platform/detectPlatform.js'
import createPlatform from '../src/platform/createPlatform.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'
import createTelegramAdapter from '../src/platform/telegramAdapter.js'
import createWebAdapter from '../src/platform/webAdapter.js'
import createMaxFallbackAdapter from '../src/platform/maxFallbackAdapter.js'
import createTelegramFallbackAdapter from '../src/platform/telegramFallbackAdapter.js'

test('detects Telegram launch parameters without reading user data', () => {
  const result = parseTelegramLaunchHash(
    '#tgWebAppData=user%3Dfake&tgWebAppPlatform=ios&tgWebAppVersion=9.1'
  )

  assert.equal(result.isTelegramLaunch, true)
  assert.equal(result.platform, 'ios')
  assert.equal(result.version, '9.1')
  assert.equal(Object.hasOwn(result, 'initData'), false)
})

test('does not classify ordinary hashes as Telegram', () => {
  assert.equal(parseTelegramLaunchHash('#/orders/42').isTelegramLaunch, false)
  assert.equal(parseTelegramLaunchHash('#tgWebAppStartParam=order').isTelegramLaunch, false)
})

test('detectPlatform detects Telegram, MAX and ordinary Web', () => {
  const originalWindow = globalThis.window

  try {
    globalThis.window = { location: { hash: '#tgWebAppPlatform=android&tgWebAppVersion=9.1' } }
    assert.equal(detectPlatform(), 'telegram')

    globalThis.window = { location: { hash: '#WebAppPlatform=ios&WebAppVersion=1.2' } }
    assert.equal(detectPlatform(), 'max')

    globalThis.window = { location: { hash: '#/orders/42' } }
    assert.equal(detectPlatform(), 'web')
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('createPlatform selects Web, MAX, and Telegram from bridgeType', () => {
  const web = createPlatform()
  assert.equal(web.bridgeType, null)
  assert.equal(web.bridgeAvailable, false)

  const maxBridge = {
    platform: 'android',
    version: '1.2',
    openMaxLink() {}
  }
  const max = createPlatform({ bridgeType: 'max', bridge: maxBridge })
  assert.equal(max.bridgeType, 'max')
  assert.equal(max.bridgeAvailable, true)
  assert.equal(Object.hasOwn(max, 'isMax'), false)
  assert.equal(Object.hasOwn(max, 'isTelegram'), false)

  const telegramBridge = { platform: 'ios', version: '9.1' }
  const telegram = createPlatform({ bridgeType: 'telegram', bridge: telegramBridge })
  assert.equal(telegram.bridgeType, 'telegram')
  assert.equal(telegram.bridgeAvailable, true)
  assert.equal(Object.hasOwn(telegram, 'isTelegram'), false)
})

test('fallback adapters preserve bridgeType but report bridgeAvailable false', () => {
  const maxFallback = createPlatform({
    bridgeType: 'max',
    error: new Error('MAX CDN unavailable')
  })
  const telegramFallback = createPlatform({
    bridgeType: 'telegram',
    error: new Error('Telegram CDN unavailable')
  })

  assert.equal(maxFallback.bridgeType, 'max')
  assert.equal(maxFallback.bridgeAvailable, false)
  assert.equal(telegramFallback.bridgeType, 'telegram')
  assert.equal(telegramFallback.bridgeAvailable, false)
  assert.equal(maxFallback.capabilities.backButton, false)
  assert.equal(telegramFallback.capabilities.nativePlatformLinks, false)
})

test('all adapters expose the same common public method and capability shape', () => {
  const max = createMaxAdapter({
    platform: 'ios',
    version: '1.0',
    BackButton: {}
  })
  const telegram = createTelegramAdapter({
    platform: 'ios',
    version: '9.1',
    BackButton: {}
  })
  const web = createWebAdapter()
  const maxFallback = createMaxFallbackAdapter(new Error('offline'))
  const telegramFallback = createTelegramFallbackAdapter(new Error('offline'))

  const methodNames = [
    'downloadFile',
    'openExternalLink',
    'openPlatformLink',
    'shareUrl',
    'sharePreparedMessage',
    'enableClosingConfirmation',
    'disableClosingConfirmation',
    'ready'
  ]
  const capabilityNames = [
    'nativeDownload',
    'backButton',
    'nativeExternalLinks',
    'nativePlatformLinks',
    'closingConfirmation',
    'shareUrl',
    'sharePreparedMessage'
  ]

  for (const adapter of [max, telegram, web, maxFallback, telegramFallback]) {
    for (const name of methodNames) {
      assert.equal(typeof adapter[name], 'function', `${name} must exist`)
    }
    for (const name of capabilityNames) {
      assert.equal(typeof adapter.capabilities[name], 'boolean', `${name} must be boolean`)
    }
    assert.equal(typeof adapter.backButton.show, 'function')
    assert.equal(typeof adapter.backButton.hide, 'function')
    assert.equal(typeof adapter.backButton.onClick, 'function')
    assert.equal(Object.hasOwn(adapter, 'isMax'), false)
    assert.equal(Object.hasOwn(adapter, 'isTelegram'), false)
    assert.equal(Object.hasOwn(adapter, 'environment'), false)
  }
})

test('openPlatformLink delegates to the correct native platform method', () => {
  let maxOpened
  let telegramOpened

  const max = createMaxAdapter({
    openMaxLink(url) { maxOpened = url }
  })
  const telegram = createTelegramAdapter({
    version: '9.1',
    openTelegramLink(url) { telegramOpened = url }
  })

  max.openPlatformLink('https://max.ru/example')
  telegram.openPlatformLink('https://t.me/example')

  assert.equal(maxOpened, 'https://max.ru/example')
  assert.equal(telegramOpened, 'https://t.me/example')
  assert.equal(max.capabilities.nativePlatformLinks, true)
  assert.equal(telegram.capabilities.nativePlatformLinks, true)
  assert.equal('openMaxLink' in max, false)
  assert.equal('openTelegramLink' in telegram, false)
})

test('BackButton helper normalizes subscription and makes unsubscribe idempotent', () => {
  let handler
  let removed = 0
  const adapter = createMaxAdapter({
    BackButton: {
      show() {},
      hide() {},
      onClick(callback) { handler = callback },
      offClick(callback) {
        assert.equal(callback, handler)
        removed += 1
      }
    }
  })

  let called = 0
  const unsubscribe = adapter.backButton.onClick(() => { called += 1 })
  handler()
  unsubscribe()
  unsubscribe()

  assert.equal(called, 1)
  assert.equal(removed, 1)
  assert.equal(adapter.capabilities.backButton, true)
})

test('closing confirmation helper exposes the same API for MAX and Telegram', () => {
  const maxCalls = []
  const telegramCalls = []

  const max = createMaxAdapter({
    enableClosingConfirmation() { maxCalls.push('enable') },
    disableClosingConfirmation() { maxCalls.push('disable') }
  })
  const telegram = createTelegramAdapter({
    version: '9.1',
    enableClosingConfirmation() { telegramCalls.push('enable') },
    disableClosingConfirmation() { telegramCalls.push('disable') }
  })

  max.enableClosingConfirmation()
  max.disableClosingConfirmation()
  telegram.enableClosingConfirmation()
  telegram.disableClosingConfirmation()

  assert.deepEqual(maxCalls, ['enable', 'disable'])
  assert.deepEqual(telegramCalls, ['enable', 'disable'])
  assert.equal(max.capabilities.closingConfirmation, true)
  assert.equal(telegram.capabilities.closingConfirmation, true)
})

test('Telegram downloadFile uses Telegram parameter names and normalizes callback', async () => {
  let receivedParams
  const telegram = createTelegramAdapter({
    platform: 'android',
    version: '9.1',
    downloadFile(params, callback) {
      receivedParams = params
      callback(true)
    }
  })

  const result = await telegram.downloadFile('https://files.example.com/a.pdf', 'a.pdf')

  assert.deepEqual(receivedParams, {
    url: 'https://files.example.com/a.pdf',
    file_name: 'a.pdf'
  })
  assert.deepEqual(result, { status: 'requested', platformStatus: 'accepted' })
})

test('Telegram Bot API 8.0 media methods are disabled on older clients', async () => {
  const telegram = createTelegramAdapter({
    platform: 'ios',
    version: '7.10',
    downloadFile() {},
    shareMessage() {}
  })

  assert.equal(telegram.capabilities.nativeDownload, false)
  assert.equal(telegram.capabilities.sharePreparedMessage, false)
  await assert.rejects(
    telegram.sharePreparedMessage({ messageId: 'prepared-id' }),
    /not available in this client version/
  )
})

test('Telegram prepared-message sharing uses shareMessage callback', async () => {
  let receivedId
  const telegram = createTelegramAdapter({
    platform: 'ios',
    version: '9.1',
    shareMessage(messageId, callback) {
      receivedId = messageId
      callback(true)
    }
  })

  const result = await telegram.sharePreparedMessage({
    messageId: 'prepared-inline-message-id'
  })

  assert.equal(receivedId, 'prepared-inline-message-id')
  assert.deepEqual(result, { status: 'shared' })
})

test('Telegram URL sharing opens the official share URL', async () => {
  let openedUrl
  const telegram = createTelegramAdapter({
    platform: 'web',
    version: '9.1',
    openTelegramLink(url) { openedUrl = url }
  })

  const result = await telegram.shareUrl(
    'https://files.example.com/doc.pdf',
    'My document'
  )

  const parsed = new URL(openedUrl)
  assert.equal(parsed.origin + parsed.pathname, 'https://t.me/share/url')
  assert.equal(parsed.searchParams.get('url'), 'https://files.example.com/doc.pdf')
  assert.equal(parsed.searchParams.get('text'), 'My document')
  assert.deepEqual(result, { status: 'opened' })
})

test('MAX prepared-message sharing keeps MAX mid and chatType semantics', async () => {
  let receivedParams
  const max = createMaxAdapter({
    platform: 'android',
    version: '1.2',
    shareMaxContent(params) {
      receivedParams = params
      return Promise.resolve({ status: 'shared' })
    }
  })

  const result = await max.sharePreparedMessage({
    messageId: 'mid.from.max.bot.api',
    chatType: 'DIALOG'
  })

  assert.deepEqual(receivedParams, {
    mid: 'mid.from.max.bot.api',
    chatType: 'DIALOG'
  })
  assert.deepEqual(result, { status: 'shared' })
})

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseTelegramLaunchHash } from '../src/platform/detectTelegramLaunch.js'
import detectPlatform from '../src/platform/detectPlatform.js'
import createPlatform from '../src/platform/createPlatform.js'
import createTelegramAdapter from '../src/platform/telegramAdapter.js'

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

test('detectPlatform prefers Telegram launch markers and otherwise preserves MAX detection', () => {
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

test('detectTelegramLaunch also recognizes an SDK already supplied by the host', async () => {
  const originalWindow = globalThis.window
  try {
    globalThis.window = { Telegram: { WebApp: {} } }
    const { default: detectTelegramLaunch } = await import('../src/platform/detectTelegramLaunch.js')
    assert.equal(detectTelegramLaunch(), true)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('createPlatform selects Telegram and Telegram fallback adapters', () => {
  const fakeWebApp = {
    platform: 'ios',
    version: '9.1',
    BackButton: {
      show() {}, hide() {}, onClick() {}, offClick() {}
    }
  }

  const telegram = createPlatform({ environment: 'telegram', webApp: fakeWebApp })
  assert.equal(telegram.environment, 'telegram')
  assert.equal(telegram.isTelegram, true)

  const fallback = createPlatform({
    environment: 'telegram-fallback',
    error: new Error('network unavailable')
  })
  assert.equal(fallback.environment, 'telegram-fallback')
  assert.equal(fallback.isTelegram, true)
  assert.equal(fallback.bridgeAvailable, false)
  assert.equal(fallback.capabilities.backButton, false)
})

test('Telegram downloadFile uses Telegram parameter names and normalizes callback', async () => {
  let receivedParams
  const webApp = {
    platform: 'android',
    version: '9.1',
    downloadFile(params, callback) {
      receivedParams = params
      callback(true)
    }
  }

  const adapter = createTelegramAdapter(webApp)
  const result = await adapter.downloadFile('https://files.example.com/a.pdf', 'a.pdf')

  assert.deepEqual(receivedParams, {
    url: 'https://files.example.com/a.pdf',
    file_name: 'a.pdf'
  })
  assert.deepEqual(result, { status: 'accepted' })
})

test('Telegram Bot API 8.0 media methods are disabled on older clients', async () => {
  const webApp = {
    platform: 'ios',
    version: '7.10',
    downloadFile() {},
    shareMessage() {}
  }

  const adapter = createTelegramAdapter(webApp)
  assert.equal(adapter.capabilities.nativeDownload, false)
  assert.equal(adapter.capabilities.sharePreparedMessage, false)
  await assert.rejects(
    adapter.sharePreparedMessage({ messageId: 'prepared-id' }),
    /not available in this client version/
  )
})

test('Telegram prepared-message sharing uses shareMessage callback', async () => {
  let receivedId
  const webApp = {
    platform: 'ios',
    version: '9.1',
    shareMessage(messageId, callback) {
      receivedId = messageId
      callback(true)
    }
  }

  const adapter = createTelegramAdapter(webApp)
  const result = await adapter.sharePreparedMessage({ messageId: 'prepared-inline-message-id' })

  assert.equal(receivedId, 'prepared-inline-message-id')
  assert.deepEqual(result, { status: 'shared' })
})

test('Telegram URL sharing opens the official share URL', async () => {
  let openedUrl
  const webApp = {
    platform: 'web',
    version: '9.1',
    openTelegramLink(url) { openedUrl = url }
  }

  const adapter = createTelegramAdapter(webApp)
  const result = await adapter.shareUrl('https://files.example.com/doc.pdf', 'My document')

  const parsed = new URL(openedUrl)
  assert.equal(parsed.origin + parsed.pathname, 'https://t.me/share/url')
  assert.equal(parsed.searchParams.get('url'), 'https://files.example.com/doc.pdf')
  assert.equal(parsed.searchParams.get('text'), 'My document')
  assert.deepEqual(result, { status: 'opened' })
})

test('loadTelegramBridge injects the SDK dynamically and resolves the WebApp object', async () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  let injectedScript
  const fakeWebApp = { platform: 'web', version: '9.1' }

  try {
    globalThis.window = {}
    globalThis.document = {
      createElement() {
        return {
          remove() { this.removed = true },
          onload: null,
          onerror: null
        }
      },
      head: {
        appendChild(script) {
          injectedScript = script
          globalThis.window.Telegram = { WebApp: fakeWebApp }
          script.onload()
        }
      }
    }

    const { default: loadTelegramBridge } = await import('../src/platform/loadTelegramBridge.js')
    const result = await loadTelegramBridge({ timeoutMs: 100 })

    assert.equal(result, fakeWebApp)
    assert.equal(injectedScript.src, 'https://telegram.org/js/telegram-web-app.js?65')
    assert.equal(injectedScript.async, true)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow

    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})

test('MAX prepared-message sharing keeps MAX mid and chatType semantics', async () => {
  let receivedParams
  const fakeMaxWebApp = {
    platform: 'android',
    version: '1.2',
    shareMaxContent(params) {
      receivedParams = params
      return Promise.resolve({ status: 'shared' })
    }
  }

  const platform = createPlatform({ environment: 'max', webApp: fakeMaxWebApp })
  const result = await platform.sharePreparedMessage({
    messageId: 'mid.from.max.bot.api',
    chatType: 'DIALOG'
  })

  assert.deepEqual(receivedParams, {
    mid: 'mid.from.max.bot.api',
    chatType: 'DIALOG'
  })
  assert.deepEqual(result, { status: 'shared' })
})

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseMaxLaunchHash } from '../src/platform/detectMaxLaunch.js'
import { parseTelegramLaunchHash } from '../src/platform/detectTelegramLaunch.js'
import detectPlatform from '../src/platform/detectPlatform.js'
import createPlatform from '../src/platform/createPlatform.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'
import createTelegramAdapter from '../src/platform/telegramAdapter.js'
import createWebAdapter from '../src/platform/webAdapter.js'
import bindBackButton from '../src/platform/bindBackButton.js'
import { openInBrowser, requireHttpsUrl } from '../src/platform/adapterUtils.js'

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

test('HTTPS validation is consistent and rejects credentials', () => {
  assert.equal(
    requireHttpsUrl('https://example.com/file.pdf', 'downloadFile'),
    'https://example.com/file.pdf'
  )

  for (const url of [
    'http://example.com/file.pdf',
    '/relative/file.pdf',
    'javascript:alert(1)',
    'https://user:secret@example.com/file.pdf',
    ''
  ]) {
    assert.throws(() => requireHttpsUrl(url, 'downloadFile'), TypeError)
  }
})

test('openInBrowser does not mistake noopener null for failure', () => {
  let received
  const restore = replaceGlobal('window', {
    open(...args) {
      received = args
      return null
    }
  })

  try {
    assert.deepEqual(openInBrowser('https://example.com'), { status: 'requested' })
    assert.deepEqual(received, [
      'https://example.com',
      '_blank',
      'noopener,noreferrer'
    ])
  } finally {
    restore()
  }
})

test('Web adapter validates URLs just like native adapters', () => {
  const restore = replaceGlobal('window', {
    open() { return null }
  })

  try {
    const web = createWebAdapter()
    assert.deepEqual(
      web.openExternalLink('https://example.com'),
      { status: 'requested' }
    )
    assert.throws(() => web.openExternalLink('http://example.com'), TypeError)
    assert.throws(() => web.openPlatformLink('/relative'), TypeError)
  } finally {
    restore()
  }
})

test('MAX launch detection rejects duplicate protocol values', () => {
  const valid = parseMaxLaunchHash(
    '#WebAppData=abc&WebAppPlatform=ios&WebAppVersion=1.2'
  )
  assert.equal(valid.isMaxLaunch, true)
  assert.equal(valid.platform, 'ios')

  const duplicate = parseMaxLaunchHash(
    '#WebAppData=abc&WebAppData=other&WebAppPlatform=ios&WebAppVersion=1.2'
  )
  assert.equal(duplicate.isMaxLaunch, false)
  assert.equal(duplicate.invalid, true)

  assert.equal(parseMaxLaunchHash('#/orders/5').isMaxLaunch, false)
})

test('Telegram launch detection rejects duplicate protocol values', () => {
  const valid = parseTelegramLaunchHash(
    '#tgWebAppData=query_id%3Dabc&tgWebAppPlatform=ios&tgWebAppVersion=9.1'
  )
  assert.equal(valid.isTelegramLaunch, true)

  const duplicate = parseTelegramLaunchHash(
    '#tgWebAppPlatform=ios&tgWebAppPlatform=android&tgWebAppVersion=9.1'
  )
  assert.equal(duplicate.isTelegramLaunch, false)
  assert.equal(duplicate.invalid, true)

  assert.equal(
    parseTelegramLaunchHash('#tgWebAppStartParam=order-1').isTelegramLaunch,
    false
  )
})

test('SDK globals alone do not identify a host', () => {
  const restore = replaceGlobal('window', {
    WebApp: {},
    Telegram: { WebApp: {} },
    location: { hash: '#/app/page' }
  })

  try {
    assert.equal(detectPlatform(), 'web')
  } finally {
    restore()
  }
})

test('conflicting MAX and Telegram markers fail closed to Web', () => {
  const restore = replaceGlobal('window', {
    location: {
      hash: '#WebAppData=abc&WebAppPlatform=ios&WebAppVersion=1.0' +
        '&tgWebAppData=xyz&tgWebAppPlatform=ios&tgWebAppVersion=9.1'
    }
  })

  try {
    assert.equal(detectPlatform(), 'web')
  } finally {
    restore()
  }
})

test('MAX runtime has explicit field names and keeps deprecated aliases', () => {
  const max = createMaxAdapter({
    platform: 'android',
    version: '1.3',
    deviceName: 'Phone'
  })

  assert.equal(max.runtime.clientPlatform, 'android')
  assert.equal(max.runtime.clientVersion, '1.3')
  assert.equal(max.runtime.platform, 'android')
  assert.equal(max.runtime.version, '1.3')
})

test('capability shareUrl represents effective sharing, not only SDK presence', () => {
  const restore = replaceGlobal('window', { open() {} })

  try {
    const telegram = createTelegramAdapter({
      version: '9.1'
    })

    assert.equal(telegram.capabilities.shareUrl, true)
    assert.equal(telegram.capabilities.nativePlatformLinks, false)
  } finally {
    restore()
  }
})

test('MAX download status is normalized without claiming completion', async () => {
  const max = createMaxAdapter({
    downloadFile() {
      return Promise.resolve({ status: 'downloading' })
    }
  })

  assert.deepEqual(
    await max.downloadFile('https://files.example.com/file.pdf', 'file.pdf'),
    { status: 'requested', platformStatus: 'downloading' }
  )
})

test('Telegram accepted download is normalized as requested, not completed', async () => {
  const telegram = createTelegramAdapter({
    version: '9.1',
    downloadFile(_params, callback) {
      callback(true)
    }
  })

  assert.deepEqual(
    await telegram.downloadFile('https://files.example.com/file.pdf', 'file.pdf'),
    { status: 'requested', platformStatus: 'accepted' }
  )
})

test('unsupported MAX shareUrl uses the Web fallback when available', async () => {
  const restoreNavigator = replaceGlobal('navigator', {
    share: async () => {},
    userAgent: 'test'
  })

  try {
    const max = createMaxAdapter({})
    assert.equal(max.capabilities.shareUrl, true)
    assert.deepEqual(
      await max.shareUrl('https://example.com'),
      { status: 'shared' }
    )
  } finally {
    restoreNavigator()
  }
})

test('BackButton waits for modal close and prevents concurrent close handlers', async () => {
  let nativeHandler
  let removed = 0
  let showCount = 0
  let hideCount = 0
  let modalOpen = true
  let closeCount = 0
  let afterEachHandler
  let modalChanged
  let unsubscribeModal = 0

  const platform = {
    backButton: {
      supported: true,
      show() { showCount += 1 },
      hide() { hideCount += 1 },
      onClick(handler) {
        nativeHandler = handler
        return () => { removed += 1 }
      }
    }
  }

  const router = {
    back() {},
    afterEach(handler) {
      afterEachHandler = handler
      return () => { afterEachHandler = null }
    }
  }

  const binding = bindBackButton({
    platform,
    router,
    hasOpenModal: () => modalOpen,
    closeTopModal: async () => {
      closeCount += 1
      await Promise.resolve()
      modalOpen = false
    },
    canGoBack: () => false,
    subscribeModalChanges(handler) {
      modalChanged = handler
      return () => { unsubscribeModal += 1 }
    }
  })

  assert.ok(showCount > 0)

  const first = nativeHandler()
  const second = nativeHandler()
  await Promise.all([first, second])

  assert.equal(closeCount, 1)
  assert.ok(hideCount > 0)

  modalOpen = true
  modalChanged()
  assert.ok(showCount > 1)

  binding.dispose()
  binding.dispose()

  assert.equal(removed, 1)
  assert.equal(unsubscribeModal, 1)
  assert.equal(afterEachHandler, null)
})

test('BackButton locks repeated router-back requests until navigation settles', async () => {
  let nativeHandler
  let afterEachHandler
  let backCount = 0
  let showCount = 0
  let hideCount = 0

  const binding = bindBackButton({
    platform: {
      backButton: {
        supported: true,
        show() { showCount += 1 },
        hide() { hideCount += 1 },
        onClick(handler) {
          nativeHandler = handler
          return () => {}
        }
      }
    },
    router: {
      back() { backCount += 1 },
      afterEach(handler) {
        afterEachHandler = handler
        return () => { afterEachHandler = null }
      },
      onError() {
        return () => {}
      }
    },
    hasOpenModal: () => false,
    closeTopModal: () => {},
    canGoBack: () => true,
    navigationUnlockTimeoutMs: 1000
  })

  await nativeHandler()
  await nativeHandler()

  assert.equal(backCount, 1)

  afterEachHandler()
  await nativeHandler()
  assert.equal(backCount, 2)

  binding.dispose()
})

test('BackButton handler reports close failures and remains usable', async () => {
  let nativeHandler
  let reported = 0
  let closed = false

  const binding = bindBackButton({
    platform: {
      backButton: {
        supported: true,
        show() {},
        hide() {},
        onClick(handler) {
          nativeHandler = handler
          return () => {}
        }
      }
    },
    router: {
      back() {},
      afterEach() { return () => {} }
    },
    hasOpenModal: () => !closed,
    closeTopModal: async () => {
      if (!closed) throw new Error('close failed')
    },
    canGoBack: () => false,
    onError() { reported += 1 }
  })

  await nativeHandler()
  assert.equal(reported, 1)

  closed = true
  await nativeHandler()
  binding.dispose()
})

class FakeScript {
  constructor() {
    this.listeners = new Map()
    this.removed = false
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set()
    handlers.add(handler)
    this.listeners.set(type, handlers)
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler)
  }

  emit(type) {
    for (const handler of this.listeners.get(type) || []) {
      handler()
    }
  }

  remove() {
    this.removed = true
  }
}

function installFakeBrowser(onAppend) {
  const scripts = new Map()
  const document = {
    createElement() {
      return new FakeScript()
    },
    getElementById(id) {
      return scripts.get(id) || null
    },
    head: {
      appendChild(script) {
        scripts.set(script.id, script)
        script.remove = () => {
          script.removed = true
          scripts.delete(script.id)
        }
        if (onAppend) onAppend(script)
      }
    }
  }
  const window = {
    setTimeout,
    clearTimeout
  }
  const restoreWindow = replaceGlobal('window', window)
  const restoreDocument = replaceGlobal('document', document)

  return {
    window,
    document,
    scripts,
    restore() {
      restoreDocument()
      restoreWindow()
    }
  }
}

test('MAX Bridge loader shares in-flight work and resolves the global bridge', async () => {
  const browser = installFakeBrowser(script => {
    browser.window.WebApp = { platform: 'android' }
    queueMicrotask(() => script.emit('load'))
  })
  const loadMaxBridge = (await import('../src/platform/loadMaxBridge.js?success-case')).default

  try {
    const first = loadMaxBridge({ timeoutMs: 100 })
    const second = loadMaxBridge({ timeoutMs: 100 })

    const [firstBridge, secondBridge] = await Promise.all([first, second])
    assert.deepEqual(firstBridge, { platform: 'android' })
    assert.deepEqual(secondBridge, { platform: 'android' })
    assert.equal(browser.scripts.size, 1)
  } finally {
    browser.restore()
  }
})

test('Telegram SDK loader resolves only after Telegram.WebApp exists', async () => {
  const browser = installFakeBrowser(script => {
    browser.window.Telegram = { WebApp: { platform: 'ios' } }
    queueMicrotask(() => script.emit('load'))
  })
  const loadTelegramBridge = (
    await import('../src/platform/loadTelegramBridge.js?telegram-success-case')
  ).default

  try {
    assert.deepEqual(
      await loadTelegramBridge({ timeoutMs: 100 }),
      { platform: 'ios' }
    )
  } finally {
    browser.restore()
  }
})

test('Bridge loader timeout rejects and a later explicit call can retry', async () => {
  let appendCount = 0
  let browser
  browser = installFakeBrowser(script => {
    appendCount += 1
    if (appendCount === 2) {
      browser.window.WebApp = { platform: 'desktop' }
      queueMicrotask(() => script.emit('load'))
    }
  })
  const loadMaxBridge = (
    await import('../src/platform/loadMaxBridge.js?retry-case')
  ).default

  try {
    await assert.rejects(
      loadMaxBridge({ timeoutMs: 5 }),
      /timed out/
    )

    const bridge = await loadMaxBridge({ timeoutMs: 100 })
    assert.deepEqual(bridge, { platform: 'desktop' })
    assert.equal(appendCount, 2)
  } finally {
    browser.restore()
  }
})

test('late Bridge load event cannot resolve a timed-out load', async () => {
  let script
  const browser = installFakeBrowser(created => {
    script = created
  })
  const loadMaxBridge = (
    await import('../src/platform/loadMaxBridge.js?late-load-case')
  ).default

  try {
    await assert.rejects(loadMaxBridge({ timeoutMs: 5 }), /timed out/)
    script.emit('load')
    assert.equal(browser.window.WebApp, undefined)
  } finally {
    browser.restore()
  }
})

test('all adapters expose the same method and capability keys', () => {
  const adapters = [
    createWebAdapter(),
    createMaxAdapter({}),
    createTelegramAdapter({ version: '9.1' }),
    createPlatform({ bridgeType: 'max', error: 'offline' }),
    createPlatform({ bridgeType: 'telegram', error: 'offline' })
  ]

  const methods = [
    'downloadFile',
    'openExternalLink',
    'openPlatformLink',
    'shareUrl',
    'sharePreparedMessage',
    'enableClosingConfirmation',
    'disableClosingConfirmation',
    'ready'
  ]
  const capabilities = [
    'nativeDownload',
    'backButton',
    'nativeExternalLinks',
    'nativePlatformLinks',
    'closingConfirmation',
    'shareUrl',
    'sharePreparedMessage'
  ]

  for (const adapter of adapters) {
    for (const method of methods) {
      assert.equal(typeof adapter[method], 'function', method)
    }

    for (const capability of capabilities) {
      assert.equal(typeof adapter.capabilities[capability], 'boolean', capability)
    }

    assert.ok(adapter.runtime)
    assert.equal(typeof adapter.bridgeAvailable, 'boolean')
  }
})

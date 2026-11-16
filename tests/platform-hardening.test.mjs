import test from 'node:test'
import assert from 'node:assert/strict'

import { parseMaxLaunchHash } from '../src/platform/detectMaxLaunch.js'
import detectLaunchContext from '../src/platform/detectLaunchContext.js'
import createPlatform from '../src/platform/createPlatform.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'
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

test('HTTPS validation rejects non-HTTPS, relative and credential-bearing URLs', () => {
  assert.equal(requireHttpsUrl('https://example.test/file.pdf'), 'https://example.test/file.pdf')
  for (const url of [
    'http://example.test/file.pdf',
    '/relative/file.pdf',
    'javascript:alert(1)',
    'https://user:secret@example.test/file.pdf',
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
    assert.deepEqual(openInBrowser('https://example.test'), { status: 'requested' })
    assert.deepEqual(received, [
      'https://example.test',
      '_blank',
      'noopener,noreferrer'
    ])
  } finally {
    restore()
  }
})

test('Web link operations keep HTTPS validation', () => {
  const restore = replaceGlobal('window', { open() { return null } })
  try {
    const web = createWebAdapter()
    assert.deepEqual(web.openExternalLink('https://example.test'), { status: 'requested' })
    assert.throws(() => web.openExternalLink('http://example.test'), TypeError)
    assert.throws(() => web.openPlatformLink('/relative'), TypeError)
  } finally {
    restore()
  }
})

test('SDK globals and User-Agent do not identify a MAX launch', () => {
  const restore = replaceGlobal('window', {
    WebApp: { platform: 'android' },
    location: { hash: '#/app/page' }
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

test('MAX parser retains no launch payload, including in malformed cases', () => {
  const result = parseMaxLaunchHash(
    '#WebAppData=do-not-copy-this&WebAppPlatform=android&WebAppVersion=1.0'
  )
  assert.equal(result.detection.status, 'valid')
  assert.equal(JSON.stringify(result).includes('do-not-copy-this'), false)
})

test('BackButton closes the top modal first and prevents concurrent close handlers', async () => {
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
  await Promise.all([nativeHandler(), nativeHandler()])
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
  const binding = bindBackButton({
    platform: {
      backButton: {
        supported: true,
        show() {},
        hide() {},
        onClick(handler) { nativeHandler = handler; return () => {} }
      }
    },
    router: {
      back() { backCount += 1 },
      afterEach(handler) { afterEachHandler = handler; return () => { afterEachHandler = null } },
      onError() { return () => {} }
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
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler) }
  emit(type) {
    for (const handler of this.listeners.get(type) || []) handler()
  }
  remove() { this.removed = true }
}

function installFakeBrowser(onAppend) {
  const scripts = new Map()
  const document = {
    createElement() { return new FakeScript() },
    getElementById(id) { return scripts.get(id) || null },
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
  const window = { setTimeout, clearTimeout }
  const restoreWindow = replaceGlobal('window', window)
  const restoreDocument = replaceGlobal('document', document)
  return {
    window,
    scripts,
    restore() {
      restoreDocument()
      restoreWindow()
    }
  }
}

test('MAX Bridge loader shares in-flight work and resolves the global bridge', async () => {
  let browser
  browser = installFakeBrowser(script => {
    browser.window.WebApp = { platform: 'android' }
    queueMicrotask(() => script.emit('load'))
  })
  const loadMaxBridge = (await import('../src/platform/loadMaxBridge.js?success-case')).default
  try {
    const [first, second] = await Promise.all([
      loadMaxBridge({ timeoutMs: 100 }),
      loadMaxBridge({ timeoutMs: 100 })
    ])
    assert.deepEqual(first, { platform: 'android' })
    assert.deepEqual(second, { platform: 'android' })
    assert.equal(browser.scripts.size, 1)
  } finally {
    browser.restore()
  }
})

test('MAX Bridge timeout rejects and a later explicit call can retry', async () => {
  let appendCount = 0
  let browser
  browser = installFakeBrowser(script => {
    appendCount += 1
    if (appendCount === 2) {
      browser.window.WebApp = { platform: 'desktop' }
      queueMicrotask(() => script.emit('load'))
    }
  })
  const loadMaxBridge = (await import('../src/platform/loadMaxBridge.js?retry-case')).default
  try {
    await assert.rejects(loadMaxBridge({ timeoutMs: 5 }), /timed out/)
    assert.deepEqual(await loadMaxBridge({ timeoutMs: 100 }), { platform: 'desktop' })
    assert.equal(appendCount, 2)
  } finally {
    browser.restore()
  }
})

test('late MAX Bridge load event cannot resolve a timed-out load', async () => {
  let script
  const browser = installFakeBrowser(created => { script = created })
  const loadMaxBridge = (await import('../src/platform/loadMaxBridge.js?late-case')).default
  try {
    await assert.rejects(loadMaxBridge({ timeoutMs: 5 }), /timed out/)
    script.emit('load')
    assert.equal(browser.window.WebApp, undefined)
  } finally {
    browser.restore()
  }
})

test('all adapters expose one common Web + MAX contract', () => {
  const adapters = [
    createWebAdapter(),
    createMaxAdapter({}),
    createPlatform(),
    createPlatform({
      launchContext: {
        type: 'max',
        launch: { platform: 'ios', version: '1.0' },
        detection: { status: 'valid', reason: null }
      },
      bridgeError: new Error('offline')
    })
  ]
  const methods = [
    'downloadFile', 'openExternalLink', 'openPlatformLink', 'shareUrl',
    'sharePreparedMessage', 'enableClosingConfirmation',
    'disableClosingConfirmation', 'ready'
  ]
  const capabilities = [
    'nativeDownload', 'backButton', 'nativeExternalLinks',
    'nativePlatformLinks', 'closingConfirmation', 'shareUrl',
    'sharePreparedMessage'
  ]

  for (const adapter of adapters) {
    for (const method of methods) assert.equal(typeof adapter[method], 'function', method)
    for (const capability of capabilities) {
      assert.equal(typeof adapter.capabilities[capability], 'boolean', capability)
    }
    assert.ok(adapter.runtime)
    assert.ok(adapter.launchContext)
    assert.equal(typeof adapter.bridgeAvailable, 'boolean')
  }
})

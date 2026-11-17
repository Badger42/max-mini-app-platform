import test from 'node:test'
import assert from 'node:assert/strict'

import loadBridgeScript from '../src/platform/loadBridgeScript.js'
import bindBackButton from '../src/platform/bindBackButton.js'
import downloadBlob from '../src/platform/downloadBlob.js'
import createPlatform from '../src/platform/createPlatform.js'
import detectLaunchContext from '../src/platform/detectLaunchContext.js'

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
}

class FakeScript {
  constructor() {
    this.listeners = new Map()
    this.removed = false
    this.readyState = ''
    this.parentNode = null
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set()
    handlers.add(handler)
    this.listeners.set(type, handlers)
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler) }
  emit(type) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler()
  }
}

function installFakeBrowser(onAppend) {
  const scripts = new Map()
  const document = {
    baseURI: 'https://app.example/',
    createElement() { return new FakeScript() },
    getElementById(id) { return scripts.get(id) || null },
    head: {
      appendChild(script) {
        scripts.set(script.id, script)
        script.parentNode = this
        script.remove = () => {
          script.removed = true
          script.parentNode = null
          scripts.delete(script.id)
        }
        onAppend?.(script)
        return script
      },
      removeChild(script) {
        script.removed = true
        script.parentNode = null
        scripts.delete(script.id)
      }
    }
  }
  const window = { setTimeout, clearTimeout }
  const restoreWindow = replaceGlobal('window', window)
  const restoreDocument = replaceGlobal('document', document)
  return {
    window,
    document,
    scripts,
    restore() { restoreDocument(); restoreWindow() }
  }
}

function createBackButtonHarness({ supported = true } = {}) {
  const handlers = new Set()
  const calls = { show: 0, hide: 0, subscribe: 0, unsubscribe: 0 }
  const backButton = {
    supported,
    show() { calls.show += 1 },
    hide() { calls.hide += 1 },
    onClick(handler) {
      calls.subscribe += 1
      handlers.add(handler)
      return () => {
        calls.unsubscribe += 1
        handlers.delete(handler)
      }
    }
  }
  return {
    platform: { backButton },
    handlers,
    calls,
    trigger() { return Promise.all([...handlers].map(handler => handler())) }
  }
}

function installDownloadBrowser(options = {}) {
  const scheduled = []
  const {
    fetchImpl = async () => ({ ok: true, type: 'basic', status: 200, blob: async () => ({ data: true }) }),
    createUrl = () => 'blob:test',
    createElementImpl,
    appendImpl,
    clickImpl,
    removeImpl,
    setTimeoutImpl = (callback, delay) => {
      scheduled.push({ callback, delay })
      return scheduled.length
    }
  } = options
  const state = { anchors: [], removed: 0, revoked: [], fetchOptions: null }
  const anchor = {
    style: {},
    parentNode: null,
    click() { clickImpl?.() },
    remove() {
      if (removeImpl) removeImpl(this)
      else if (this.parentNode) this.parentNode.removeChild(this)
    }
  }
  const body = {
    appendChild(element) {
      element.parentNode = this
      state.anchors.push(element)
      appendImpl?.(element)
      return element
    },
    removeChild(element) {
      state.removed += 1
      element.parentNode = null
      state.anchors = state.anchors.filter(item => item !== element)
    }
  }
  const restoreDocument = replaceGlobal('document', {
    body,
    createElement() {
      if (createElementImpl) return createElementImpl()
      return anchor
    }
  })
  const restoreFetch = replaceGlobal('fetch', async (...args) => {
    state.fetchOptions = args[1]
    return fetchImpl(...args)
  })
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  URL.createObjectURL = createUrl
  URL.revokeObjectURL = value => state.revoked.push(value)
  const restoreWindow = replaceGlobal('window', { setTimeout: setTimeoutImpl })

  return {
    state,
    scheduled,
    document: { body },
    restore() {
      restoreWindow()
      restoreFetch()
      restoreDocument()
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  }
}

test('Bridge loader reuses an existing in-flight script and deduplicates Promise callers', async () => {
  let appended = 0
  let browser
  browser = installFakeBrowser(() => { appended += 1 })
  try {
    const first = loadBridgeScript({
      url: 'https://cdn.example/sdk.js',
      scriptId: 'existing-inflight',
      timeoutMs: 100,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    const second = loadBridgeScript({
      url: 'https://cdn.example/sdk.js',
      scriptId: 'existing-inflight',
      timeoutMs: 100,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    assert.strictEqual(first, second)
    assert.equal(appended, 1)
    const script = browser.scripts.get('existing-inflight')
    browser.window.TestBridge = { ready: true }
    script.emit('load')
    assert.deepEqual(await first, { ready: true })
    assert.equal(script.listeners.get('load').size, 0)
    assert.equal(script.listeners.get('error').size, 0)
  } finally {
    browser.restore()
  }
})

test('Bridge loader replaces an existing script known to have completed without a bridge', async () => {
  let appended = 0
  let browser
  browser = installFakeBrowser(script => {
    appended += 1
    browser.window.TestBridge = { attempt: appended }
    queueMicrotask(() => script.emit('load'))
  })
  const oldScript = new FakeScript()
  oldScript.id = 'completed-without-bridge'
  oldScript.src = 'https://cdn.example/sdk.js'
  oldScript.readyState = 'complete'
  oldScript.parentNode = browser.document.head
  oldScript.remove = () => { oldScript.removed = true; oldScript.parentNode = null }
  browser.scripts.set(oldScript.id, oldScript)

  try {
    const bridge = await loadBridgeScript({
      url: oldScript.src,
      scriptId: oldScript.id,
      timeoutMs: 100,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    assert.equal(oldScript.removed, true)
    assert.equal(appended, 1)
    assert.deepEqual(bridge, { attempt: 1 })
  } finally {
    browser.restore()
  }
})

test('Bridge loader removes an existing script that emits error and retries explicitly', async () => {
  let appended = 0
  let browser
  browser = installFakeBrowser(script => {
    appended += 1
    browser.window.TestBridge = { attempt: appended }
    queueMicrotask(() => script.emit('load'))
  })
  const oldScript = new FakeScript()
  oldScript.id = 'existing-script-error'
  oldScript.src = 'https://cdn.example/sdk.js'
  oldScript.parentNode = browser.document.head
  oldScript.remove = () => {
    oldScript.removed = true
    oldScript.parentNode = null
    browser.scripts.delete(oldScript.id)
  }
  browser.scripts.set(oldScript.id, oldScript)

  try {
    const failedAttempt = loadBridgeScript({
      url: oldScript.src,
      scriptId: oldScript.id,
      timeoutMs: 100,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    oldScript.emit('error')
    await assert.rejects(failedAttempt, /failed to load/)
    assert.equal(oldScript.removed, true)
    assert.equal(oldScript.listeners.get('error').size, 0)

    const bridge = await loadBridgeScript({
      url: oldScript.src,
      scriptId: oldScript.id,
      timeoutMs: 100,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    assert.deepEqual(bridge, { attempt: 1 })
    assert.equal(appended, 1)
  } finally {
    browser.restore()
  }
})

test('Bridge loader times out on an unknown foreign script instead of assuming it loaded', async () => {
  let appended = 0
  let browser
  browser = installFakeBrowser(script => {
    appended += 1
    browser.window.TestBridge = { attempt: appended }
    queueMicrotask(() => script.emit('load'))
  })
  const unknownScript = new FakeScript()
  unknownScript.id = 'unknown-foreign-script'
  unknownScript.src = 'https://cdn.example/sdk.js'
  unknownScript.parentNode = browser.document.head
  unknownScript.remove = () => {
    unknownScript.removed = true
    unknownScript.parentNode = null
    browser.scripts.delete(unknownScript.id)
  }
  browser.scripts.set(unknownScript.id, unknownScript)

  try {
    await assert.rejects(loadBridgeScript({
      url: unknownScript.src,
      scriptId: unknownScript.id,
      timeoutMs: 5,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    }), /timed out/)
    assert.equal(unknownScript.removed, true)

    const bridge = await loadBridgeScript({
      url: unknownScript.src,
      scriptId: unknownScript.id,
      timeoutMs: 100,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    assert.deepEqual(bridge, { attempt: 1 })
    assert.equal(appended, 1)
  } finally {
    browser.restore()
  }
})

test('Bridge loader removes timed-out script and explicit retry creates a fresh attempt', async () => {
  const scripts = []
  let appended = 0
  let browser
  browser = installFakeBrowser(script => {
    appended += 1
    scripts.push(script)
    if (appended === 2) {
      browser.window.TestBridge = { attempt: 2 }
      queueMicrotask(() => script.emit('load'))
    }
  })
  try {
    await assert.rejects(loadBridgeScript({
      url: 'https://cdn.example/sdk.js',
      scriptId: 'retry-case',
      timeoutMs: 5,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    }), /timed out/)

    scripts[0].emit('load')
    assert.equal(scripts[0].listeners.get('load').size, 0)
    const bridge = await loadBridgeScript({
      url: 'https://cdn.example/sdk.js',
      scriptId: 'retry-case',
      timeoutMs: 100,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    assert.deepEqual(bridge, { attempt: 2 })
    assert.equal(appended, 2)
  } finally {
    browser.restore()
  }
})

test('Bridge loader resolves an already available global bridge without injecting a script', async () => {
  const browser = installFakeBrowser()
  browser.window.TestBridge = { loaded: true }
  try {
    const bridge = await loadBridgeScript({
      url: 'https://cdn.example/sdk.js',
      scriptId: 'already-loaded',
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    assert.deepEqual(bridge, { loaded: true })
    assert.equal(browser.scripts.size, 0)
  } finally {
    browser.restore()
  }
})

test('Bridge loader rejects a different URL while the same script id is in flight', async () => {
  let appended = 0
  let browser
  browser = installFakeBrowser(() => { appended += 1 })
  try {
    const first = loadBridgeScript({
      url: 'https://cdn.example/first-sdk.js',
      scriptId: 'same-id-different-url',
      timeoutMs: 100,
      getBridge: () => undefined,
      errorMessage: 'Test Bridge'
    })
    const conflicting = loadBridgeScript({
      url: 'https://cdn.example/second-sdk.js',
      scriptId: 'same-id-different-url',
      timeoutMs: 100,
      getBridge: () => undefined,
      errorMessage: 'Test Bridge'
    })

    await assert.rejects(conflicting, /another URL is already loading/)
    assert.equal(appended, 1)
    browser.scripts.get('same-id-different-url').emit('error')
    await assert.rejects(first, /failed to load/)
  } finally {
    browser.restore()
  }
})

test('Bridge loader returns an existing global bridge without touching a matching DOM script', async () => {
  const browser = installFakeBrowser()
  const script = new FakeScript()
  script.id = 'bridge-already-global'
  script.src = 'https://cdn.example/sdk.js'
  script.parentNode = browser.document.head
  script.remove = () => { script.removed = true; script.parentNode = null }
  browser.scripts.set(script.id, script)
  browser.window.TestBridge = { loaded: true }

  try {
    const bridge = await loadBridgeScript({
      url: script.src,
      scriptId: script.id,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    })
    assert.deepEqual(bridge, { loaded: true })
    assert.equal(script.removed, false)
    assert.strictEqual(browser.scripts.get(script.id), script)
  } finally {
    browser.restore()
  }
})

test('Bridge loader leaves an unrelated same-id element untouched', async t => {
  await t.test('element has a different source URL', async () => {
    const browser = installFakeBrowser()
    const unrelated = new FakeScript()
    unrelated.id = 'shared-script-id'
    unrelated.src = 'https://cdn.example/another-sdk.js'
    unrelated.parentNode = browser.document.head
    unrelated.remove = () => { unrelated.removed = true; unrelated.parentNode = null }
    browser.scripts.set(unrelated.id, unrelated)

    try {
      await assert.rejects(loadBridgeScript({
        url: 'https://cdn.example/expected-sdk.js',
        scriptId: unrelated.id,
        getBridge: () => undefined,
        errorMessage: 'Test Bridge'
      }), /unrelated script already uses id/)
      assert.equal(unrelated.removed, false)
      assert.equal(unrelated.listeners.size, 0)
    } finally {
      browser.restore()
    }
  })

  await t.test('element has no source URL', async () => {
    const browser = installFakeBrowser()
    const inlineScript = new FakeScript()
    inlineScript.id = 'inline-script-id'
    inlineScript.parentNode = browser.document.head
    inlineScript.remove = () => { inlineScript.removed = true; inlineScript.parentNode = null }
    browser.scripts.set(inlineScript.id, inlineScript)

    try {
      await assert.rejects(loadBridgeScript({
        url: 'https://cdn.example/expected-sdk.js',
        scriptId: inlineScript.id,
        getBridge: () => undefined,
        errorMessage: 'Test Bridge'
      }), /has no script URL/)
      assert.equal(inlineScript.removed, false)
      assert.equal(inlineScript.listeners.size, 0)
    } finally {
      browser.restore()
    }
  })
})

test('Bridge loader does not infer success from a foreign script load event fired before listeners', async () => {
  const browser = installFakeBrowser()
  const script = new FakeScript()
  script.id = 'foreign-load-already-fired'
  script.src = 'https://cdn.example/sdk.js'
  script.parentNode = browser.document.head
  script.remove = () => {
    script.removed = true
    script.parentNode = null
    browser.scripts.delete(script.id)
  }
  browser.scripts.set(script.id, script)
  script.emit('load')

  try {
    await assert.rejects(loadBridgeScript({
      url: script.src,
      scriptId: script.id,
      timeoutMs: 5,
      getBridge: () => browser.window.TestBridge,
      errorMessage: 'Test Bridge'
    }), /timed out/)
    assert.equal(script.removed, true)
    assert.equal(script.listeners.get('load').size, 0)
    assert.equal(script.listeners.get('error').size, 0)
  } finally {
    browser.restore()
  }
})

test('Bridge loader cleans listeners and retry state when appending the script throws', async () => {
  let failedScript
  const browser = installFakeBrowser(script => {
    failedScript = script
    throw new Error('CSP append denied')
  })

  try {
    await assert.rejects(loadBridgeScript({
      url: 'https://cdn.example/sdk.js',
      scriptId: 'append-failure',
      timeoutMs: 100,
      getBridge: () => undefined,
      errorMessage: 'Test Bridge'
    }), /could not start script loading.*CSP append denied/)
    assert.equal(failedScript.removed, true)
    assert.equal(failedScript.listeners.get('load').size, 0)
    assert.equal(failedScript.listeners.get('error').size, 0)
  } finally {
    browser.restore()
  }
})

test('BackButton unlocks on afterEach, router error, thrown/rejected navigation and fallback timeout', async () => {
  let nativeHandler
  let afterEachHandler
  let routerErrorHandler
  let backCalls = 0
  const platform = createBackButtonHarness()
  const router = {
    back() {
      backCalls += 1
      if (backCalls === 1) throw new Error('sync failure')
      if (backCalls === 2) return Promise.reject(new Error('async failure'))
    },
    afterEach(handler) { afterEachHandler = handler; return () => {} },
    onError(handler) { routerErrorHandler = handler; return () => {} }
  }
  const errors = []
  const binding = bindBackButton({
    platform: platform.platform,
    router,
    hasOpenModal: () => false,
    closeTopModal() {},
    canGoBack: () => true,
    navigationUnlockTimeoutMs: 20,
    onError: error => errors.push(error.message)
  })
  nativeHandler = [...platform.handlers][0]

  await nativeHandler()
  assert.equal(platform.calls.show > 0, true)
  assert.deepEqual(errors, ['sync failure'])

  await nativeHandler()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(errors, ['sync failure', 'async failure'])

  await nativeHandler()
  routerErrorHandler(new Error('router error'))
  await new Promise(resolve => setTimeout(resolve, 0))
  await nativeHandler()
  afterEachHandler()
  await new Promise(resolve => setTimeout(resolve, 0))

  await nativeHandler()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(backCalls, 5)
  binding.dispose()
})

test('BackButton ignores rapid re-entry and async modal close after dispose', async () => {
  const platform = createBackButtonHarness()
  let resolveModal
  let modalCloses = 0
  const binding = bindBackButton({
    platform: platform.platform,
    router: { back() {}, afterEach() { return () => {} } },
    hasOpenModal: () => true,
    closeTopModal() {
      modalCloses += 1
      return new Promise(resolve => { resolveModal = resolve })
    },
    canGoBack: () => false
  })

  const handler = [...platform.handlers][0]
  const first = handler()
  await handler()
  assert.equal(modalCloses, 1)
  const hideCountAtDispose = platform.calls.hide
  binding.dispose()
  resolveModal()
  await first
  assert.equal(platform.calls.hide, hideCountAtDispose + 1)
  assert.equal(platform.calls.show, 1)
})

test('BackButton re-initialization replaces the previous native handler', () => {
  const platform = createBackButtonHarness()
  const options = {
    platform: platform.platform,
    router: { back() {}, afterEach() { return () => {} } },
    hasOpenModal: () => false,
    closeTopModal() {},
    canGoBack: () => false
  }
  const first = bindBackButton(options)
  const second = bindBackButton(options)
  assert.equal(platform.handlers.size, 1)
  assert.equal(platform.calls.unsubscribe, 1)
  first.dispose()
  assert.equal(platform.handlers.size, 1)
  second.dispose()
  assert.equal(platform.handlers.size, 0)
})

test('BackButton reinitialization replaces the native handler for the same router across adapter instances', () => {
  const firstPlatform = createBackButtonHarness()
  const secondPlatform = createBackButtonHarness()
  const router = { back() {}, afterEach() { return () => {} } }
  const options = platform => ({
    platform: platform.platform,
    router,
    hasOpenModal: () => false,
    closeTopModal() {},
    canGoBack: () => false
  })

  const first = bindBackButton(options(firstPlatform))
  const second = bindBackButton(options(secondPlatform))
  assert.equal(firstPlatform.handlers.size, 0)
  assert.equal(secondPlatform.handlers.size, 1)
  first.dispose()
  assert.equal(secondPlatform.handlers.size, 1)
  second.dispose()
  assert.equal(secondPlatform.handlers.size, 0)
})

test('BackButton releases the modal handler after an asynchronous close rejection', async () => {
  const platform = createBackButtonHarness()
  const errors = []
  let closeCalls = 0
  const binding = bindBackButton({
    platform: platform.platform,
    router: { back() {}, afterEach() { return () => {} } },
    hasOpenModal: () => true,
    closeTopModal() {
      closeCalls += 1
      return Promise.reject(new Error('async modal close failed'))
    },
    canGoBack: () => false,
    onError: error => errors.push(error.message)
  })

  const handler = [...platform.handlers][0]
  await handler()
  await handler()
  assert.equal(closeCalls, 2)
  assert.deepEqual(errors, ['async modal close failed', 'async modal close failed'])
  binding.dispose()
})

test('BackButton releases a lock when modal close throws and can be pressed again', async () => {
  const platform = createBackButtonHarness()
  let closeCalls = 0
  const errors = []
  const binding = bindBackButton({
    platform: platform.platform,
    router: { back() {}, afterEach() { return () => {} } },
    hasOpenModal: () => true,
    closeTopModal() {
      closeCalls += 1
      throw new Error('modal close failed')
    },
    canGoBack: () => false,
    onError: error => errors.push(error.message)
  })

  const handler = [...platform.handlers][0]
  await handler()
  await handler()
  assert.equal(closeCalls, 2)
  assert.deepEqual(errors, ['modal close failed', 'modal close failed'])
  binding.dispose()
})

test('BackButton disposal prevents late navigation callbacks and clears pending timer', async () => {
  const platform = createBackButtonHarness()
  let afterEachHandler
  let routerErrorHandler
  let rejectNavigation
  const binding = bindBackButton({
    platform: platform.platform,
    router: {
      back() { return new Promise((_resolve, reject) => { rejectNavigation = reject }) },
      afterEach(handler) { afterEachHandler = handler; return () => {} },
      onError(handler) { routerErrorHandler = handler; return () => {} }
    },
    hasOpenModal: () => false,
    closeTopModal() {},
    canGoBack: () => true,
    navigationUnlockTimeoutMs: 1000
  })

  const handler = [...platform.handlers][0]
  await handler()
  const hideCountBeforeDispose = platform.calls.hide
  const showCountBeforeDispose = platform.calls.show
  binding.dispose()
  const hideCountAfterDispose = platform.calls.hide
  rejectNavigation(new Error('late navigation rejection'))
  afterEachHandler()
  routerErrorHandler(new Error('late router error'))
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(platform.calls.hide, hideCountAfterDispose)
  assert.equal(platform.calls.show, showCountBeforeDispose)
  assert.equal(platform.calls.hide, hideCountBeforeDispose + 1)
})

test('BackButton does not call native methods or subscribe when unsupported', () => {
  const platform = createBackButtonHarness({ supported: false })
  const binding = bindBackButton({
    platform: platform.platform,
    router: { back() {}, afterEach() { return () => {} } },
    hasOpenModal: () => true,
    closeTopModal() {},
    canGoBack: () => true
  })
  binding.refresh()
  binding.dispose()
  assert.equal(platform.calls.show, 0)
  assert.equal(platform.calls.hide, 0)
  assert.equal(platform.calls.subscribe, 0)
})

test('downloadBlob passes credentials and revokes URL after the documented success delay', async () => {
  const browser = installDownloadBrowser()
  try {
    const result = await downloadBlob('https://files.example.com/a.pdf', 'a.pdf', {
      credentials: 'include'
    })
    assert.deepEqual(result, { status: 'requested' })
    assert.deepEqual(browser.state.fetchOptions, { credentials: 'include' })
    assert.equal(browser.state.removed, 1)
    assert.deepEqual(browser.state.revoked, [])
    assert.equal(browser.scheduled[0].delay, 30000)
    browser.scheduled[0].callback()
    assert.deepEqual(browser.state.revoked, ['blob:test'])
  } finally {
    browser.restore()
  }
})

test('downloadBlob rejects HTTP, opaque and Fetch failures before creating a URL', async t => {
  const cases = [
    { label: 'HTTP', fetchImpl: async () => ({ ok: false, status: 503, type: 'basic' }), expected: /HTTP 503/ },
    { label: 'opaque', fetchImpl: async () => ({ ok: false, status: 0, type: 'opaque' }), expected: /opaque.*CORS/ },
    { label: 'Fetch', fetchImpl: async () => { throw new TypeError('network error') }, expected: /network and.*CORS/ }
  ]
  for (const item of cases) {
    await t.test(item.label, async () => {
      const browser = installDownloadBrowser({ fetchImpl: item.fetchImpl })
      try {
        await assert.rejects(downloadBlob('https://files.example.com/a.pdf', 'a.pdf'), item.expected)
        assert.deepEqual(browser.state.revoked, [])
      } finally {
        browser.restore()
      }
    })
  }
})

test('downloadBlob revokes URL and removes anchor when click fails', async () => {
  const browser = installDownloadBrowser({ clickImpl() { throw new Error('click failed') } })
  try {
    await assert.rejects(downloadBlob('https://files.example.com/a.pdf', 'a.pdf'), /click failed/)
    assert.equal(browser.state.removed, 1)
    assert.deepEqual(browser.state.revoked, ['blob:test'])
    assert.equal(browser.scheduled.length, 0)
  } finally {
    browser.restore()
  }
})

test('downloadBlob revokes URL when anchor insertion or object URL creation fails', async t => {
  await t.test('appendChild throws after attaching the anchor', async () => {
    const browser = installDownloadBrowser({ appendImpl() { throw new Error('append failed') } })
    try {
      await assert.rejects(downloadBlob('https://files.example.com/a.pdf', 'a.pdf'), /append failed/)
      assert.equal(browser.state.removed, 1)
      assert.deepEqual(browser.state.revoked, ['blob:test'])
    } finally {
      browser.restore()
    }
  })
  await t.test('createObjectURL throws before anchor creation', async () => {
    const browser = installDownloadBrowser({ createUrl() { throw new Error('create URL failed') } })
    try {
      await assert.rejects(downloadBlob('https://files.example.com/a.pdf', 'a.pdf'), /create URL failed/)
      assert.equal(browser.state.anchors.length, 0)
      assert.deepEqual(browser.state.revoked, [])
    } finally {
      browser.restore()
    }
  })
  await t.test('createElement throws after URL allocation and still revokes the URL', async () => {
    const browser = installDownloadBrowser({ createElementImpl() { throw new Error('create anchor failed') } })
    try {
      await assert.rejects(downloadBlob('https://files.example.com/a.pdf', 'a.pdf'), /create anchor failed/)
      assert.deepEqual(browser.state.revoked, ['blob:test'])
    } finally {
      browser.restore()
    }
  })
})

test('downloadBlob falls back to anchor.remove when parent removal throws', async () => {
  let removalAttempts = 0
  let browser
  browser = installDownloadBrowser({
    removeImpl(anchor) {
      anchor.parentNode = null
      browser.state.anchors = []
    }
  })
  const originalRemoveChild = browser.document.body.removeChild
  browser.document.body.removeChild = element => {
    removalAttempts += 1
    if (removalAttempts === 1) throw new Error('removeChild failed')
    originalRemoveChild.call(browser.document.body, element)
  }

  try {
    assert.deepEqual(
      await downloadBlob('https://files.example.com/a.pdf', 'a.pdf'),
      { status: 'requested' }
    )
    assert.equal(removalAttempts, 1)
    assert.deepEqual(browser.state.anchors, [])
    assert.equal(browser.scheduled.length, 1)
  } finally {
    browser.restore()
  }
})

test('downloadBlob immediately revokes URL if revoke scheduling throws', async () => {
  const browser = installDownloadBrowser({ setTimeoutImpl() { throw new Error('timer failed') } })
  try {
    await assert.rejects(downloadBlob('https://files.example.com/a.pdf', 'a.pdf'), /timer failed/)
    assert.equal(browser.state.removed, 1)
    assert.deepEqual(browser.state.revoked, ['blob:test'])
  } finally {
    browser.restore()
  }
})

test('Launch Context selects separate MAX/Telegram parsers and preserves diagnostics in fallback', async () => {
  const restoreWindow = replaceGlobal('window', {
    location: { hash: '#WebAppData=secret&WebAppPlatform=ios&WebAppVersion=1.0' }
  })
  try {
    const maxContext = detectLaunchContext()
    assert.deepEqual(maxContext, {
      type: 'max',
      launch: { platform: 'ios', version: '1.0' },
      detection: { status: 'valid', reason: null }
    })
    assert.equal(JSON.stringify(maxContext).includes('secret'), false)

    globalThis.window.location.hash = '#tgWebAppData=private&tgWebAppPlatform=android&tgWebAppVersion=9.1'
    const telegramContext = detectLaunchContext()
    assert.equal(telegramContext.type, 'telegram')
    globalThis.window.location.hash = '#WebAppPlatform=ios&WebAppVersion=1.0&tgWebAppPlatform=android&tgWebAppVersion=9.1'
    assert.equal(detectLaunchContext().detection.status, 'conflicting')
    globalThis.window.location.hash = '#WebAppPlatform=ios'
    assert.equal(detectLaunchContext().detection.status, 'invalid')

    const bridgeError = new Error('CDN offline')
    const fallback = createPlatform({ launchContext: maxContext, bridgeError })
    assert.strictEqual(fallback.launchContext, maxContext)
    assert.strictEqual(fallback.bridgeError, bridgeError)
    for (const capability of [
      'nativeDownload',
      'backButton',
      'nativeExternalLinks',
      'nativePlatformLinks',
      'closingConfirmation',
      'nativeShareUrl',
      'sharePreparedMessage'
    ]) {
      assert.equal(fallback.capabilities[capability], false, capability)
    }

    const telegramCalls = []
    const telegramFallback = createPlatform({
      launchContext: telegramContext,
      bridgeError,
      services: {
        downloadFile(url, fileName) {
          telegramCalls.push({ url, fileName })
        }
      }
    })
    assert.strictEqual(telegramFallback.launchContext, telegramContext)
    assert.strictEqual(telegramFallback.bridgeError, bridgeError)
    assert.equal(telegramFallback.capabilities.nativeDownload, false)
    assert.deepEqual(
      await telegramFallback.downloadFile('/api/telegram-export', 'telegram.csv'),
      { status: 'requested' }
    )
    assert.deepEqual(telegramCalls, [{ url: '/api/telegram-export', fileName: 'telegram.csv' }])
  } finally {
    restoreWindow()
  }
})

test('MAX browser fallback uses injected download service exactly once and never calls native SDK', async () => {
  const calls = []
  let nativeCalls = 0
  const max = createPlatform({
    bridgeType: 'max',
    bridge: {
      platform: 'web',
      downloadFile() { nativeCalls += 1 }
    },
    services: {
      downloadFile(url, fileName, options) {
        calls.push({ url, fileName, options })
        return Promise.resolve()
      }
    },
    downloadOptions: { credentials: 'include', tenant: 'default' }
  })

  const result = await max.downloadFile('/api/export/1', 'export.csv', { tenant: 'override' })
  assert.deepEqual(result, { status: 'requested' })
  assert.deepEqual(calls, [{
    url: '/api/export/1',
    fileName: 'export.csv',
    options: { credentials: 'include', tenant: 'override' }
  }])
  assert.equal(nativeCalls, 0)
  assert.equal(max.capabilities.nativeDownload, false)
})

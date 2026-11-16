import test from 'node:test'
import assert from 'node:assert/strict'

import { requireHttpsUrl, openInBrowser } from '../src/platform/adapterUtils.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'
import createTelegramAdapter from '../src/platform/telegramAdapter.js'
import loadTelegramBridge from '../src/platform/loadTelegramBridge.js'

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
}

test('HTTPS URL validation rejects non-HTTPS, relative and credential-bearing URLs', () => {
  assert.equal(requireHttpsUrl('https://example.com/a'), 'https://example.com/a')
  for (const url of ['http://example.com', '/relative', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    assert.throws(() => requireHttpsUrl(url), TypeError)
  }
})

test('window.open null is still treated as a requested action with noopener', () => {
  let args
  const restore = replaceGlobal('window', { open(...values) { args = values; return null } })
  try {
    assert.deepEqual(openInBrowser('https://example.com'), { status: 'requested' })
    assert.deepEqual(args, ['https://example.com', '_blank', 'noopener,noreferrer'])
  } finally {
    restore()
  }
})

test('Telegram and MAX SDK methods preserve their bridge receiver', async () => {
  const seen = []
  const telegramBridge = {
    version: '9.1',
    openLink() { assert.equal(this, telegramBridge); seen.push('tg-external') },
    openTelegramLink() { assert.equal(this, telegramBridge); seen.push('tg-platform') },
    shareMessage(_id, callback) { assert.equal(this, telegramBridge); seen.push('tg-message'); callback(true) },
    downloadFile(_params, callback) { assert.equal(this, telegramBridge); seen.push('tg-download'); callback(true) }
  }
  const telegram = createTelegramAdapter(telegramBridge)
  telegram.openExternalLink('https://example.com')
  telegram.openPlatformLink('https://t.me/example')
  await telegram.sharePreparedMessage({ messageId: 'prepared-id' })
  await telegram.downloadFile('https://files.example.com/a.pdf', 'a.pdf')

  const maxBridge = {
    platform: 'android',
    openLink() { assert.equal(this, maxBridge); seen.push('max-external') },
    openMaxLink() { assert.equal(this, maxBridge); seen.push('max-platform') },
    shareMaxContent() { assert.equal(this, maxBridge); seen.push('max-share'); return Promise.resolve({ status: 'shared' }) }
  }
  const max = createMaxAdapter(maxBridge)
  max.openExternalLink('https://example.com')
  max.openPlatformLink('https://max.ru/example')
  await max.shareUrl('https://example.com')

  assert.deepEqual(seen, [
    'tg-external', 'tg-platform', 'tg-message', 'tg-download',
    'max-external', 'max-platform', 'max-share'
  ])
})

test('Telegram share composer synchronously rejects native bridge exceptions', async () => {
  const expected = new Error('Telegram bridge failed')
  const telegram = createTelegramAdapter({
    version: '9.1',
    openTelegramLink() { throw expected }
  })
  await assert.rejects(telegram.shareUrl('https://example.com'), error => error === expected)
})

test('MAX deep-link API cannot be used for unrelated hostnames', () => {
  const max = createMaxAdapter({ openMaxLink() {} })
  for (const url of ['https://example.com', 'https://max.ru.attacker.example', 'https://www.max.ru']) {
    assert.throws(() => max.openPlatformLink(url), TypeError)
  }
})


class FakeScript {
  constructor() { this.listeners = new Map(); this.removed = false }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set()
    handlers.add(handler)
    this.listeners.set(type, handlers)
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler) }
  emit(type) { for (const handler of this.listeners.get(type) || []) handler() }
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
        script.remove = () => { script.removed = true; scripts.delete(script.id) }
        onAppend?.(script)
      }
    }
  }
  const window = { setTimeout, clearTimeout }
  const restoreWindow = replaceGlobal('window', window)
  const restoreDocument = replaceGlobal('document', document)
  return {
    window, document, scripts,
    restore() { restoreDocument(); restoreWindow() }
  }
}

test('Telegram Bridge loader injects one SDK script and waits for Telegram.WebApp', async () => {
  let appendCount = 0
  let browser
  browser = installFakeBrowser(script => {
    appendCount += 1
    browser.window.Telegram = { WebApp: { platform: 'ios', version: '9.1' } }
    queueMicrotask(() => script.emit('load'))
  })

  try {
    const first = loadTelegramBridge({ timeoutMs: 100 })
    const second = loadTelegramBridge({ timeoutMs: 100 })
    const [one, two] = await Promise.all([first, second])
    assert.deepEqual(one, { platform: 'ios', version: '9.1' })
    assert.deepEqual(two, { platform: 'ios', version: '9.1' })
    assert.equal(appendCount, 1)
    assert.equal([...browser.scripts.values()][0].src, 'https://telegram.org/js/telegram-web-app.js?65')
  } finally {
    browser.restore()
  }
})

test('Telegram Bridge loader can retry after timeout and ignores the late failed attempt', async () => {
  let appendCount = 0
  let browser
  let scripts = []
  browser = installFakeBrowser(script => {
    appendCount += 1
    scripts.push(script)
    if (appendCount === 2) {
      browser.window.Telegram = { WebApp: { platform: 'android' } }
      queueMicrotask(() => script.emit('load'))
    }
  })

  try {
    await assert.rejects(loadTelegramBridge({ timeoutMs: 5 }), /timed out/)
    scripts[0].emit('load')
    assert.equal(browser.window.Telegram, undefined)

    const bridge = await loadTelegramBridge({ timeoutMs: 100 })
    assert.deepEqual(bridge, { platform: 'android' })
    assert.equal(appendCount, 2)
  } finally {
    browser.restore()
  }
})

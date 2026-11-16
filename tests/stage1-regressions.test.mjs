import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createBackButton,
  normalizeDownloadResult,
  normalizeShareResult
} from '../src/platform/adapterUtils.js'
import bindBackButton from '../src/platform/bindBackButton.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'
import createTelegramAdapter from '../src/platform/telegramAdapter.js'

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

test('BackButton does not call partial native APIs when capability is unavailable', () => {
  let calls = 0
  const backButton = createBackButton({
    show() { calls += 1 },
    hide() { calls += 1 },
    onClick() {}
    // offClick is required for a complete, safely disposable subscription.
  })

  assert.equal(backButton.supported, false)
  backButton.show()
  backButton.hide()
  backButton.onClick(() => {})()
  assert.equal(calls, 0)
})

test('BackButton unlocks after router.back throws synchronously', async () => {
  let nativeHandler
  let backCalls = 0
  let reportedErrors = 0

  const platform = {
    backButton: {
      supported: true,
      show() {},
      hide() {},
      onClick(handler) {
        nativeHandler = handler
        return () => {}
      }
    }
  }

  const router = {
    back() {
      backCalls += 1
      if (backCalls === 1) throw new Error('history is unavailable')
    },
    afterEach() { return () => {} },
    onError() { return () => {} }
  }

  const binding = bindBackButton({
    platform,
    router,
    hasOpenModal: () => false,
    closeTopModal: () => {},
    canGoBack: () => true,
    navigationUnlockTimeoutMs: 10000,
    onError() { reportedErrors += 1 }
  })

  await nativeHandler()
  assert.equal(backCalls, 1)
  assert.equal(reportedErrors, 1)

  // A second tap must be processed rather than being blocked by stale state.
  await nativeHandler()
  assert.equal(backCalls, 2)

  binding.dispose()
})

test('download result normalizer accepts only documented successful/cancelled states', () => {
  assert.deepEqual(
    normalizeDownloadResult({ status: 'downloading' }),
    { status: 'requested', platformStatus: 'downloading' }
  )
  assert.deepEqual(
    normalizeDownloadResult({ status: 'accepted' }),
    { status: 'requested', platformStatus: 'accepted' }
  )
  assert.deepEqual(
    normalizeDownloadResult({ status: 'cancelled' }),
    { status: 'cancelled', platformStatus: 'cancelled' }
  )

  assert.throws(() => normalizeDownloadResult(undefined), /missing status/)
  assert.throws(() => normalizeDownloadResult({ status: 'error' }), /error/)
  assert.throws(() => normalizeDownloadResult({ status: 'completed' }), /completed/)
})

test('share result normalizer rejects unknown and missing SDK statuses', () => {
  assert.deepEqual(normalizeShareResult({ status: 'shared' }), { status: 'shared' })
  assert.deepEqual(normalizeShareResult({ status: 'cancelled' }), { status: 'cancelled' })
  assert.throws(() => normalizeShareResult(undefined), /missing status/)
  assert.throws(() => normalizeShareResult({ status: 'error' }), /error/)
  assert.throws(() => normalizeShareResult({ status: 'requested' }), /requested/)
})

test('MAX platform=web does not report or invoke native file download', async () => {
  let nativeCalls = 0
  const restoreFetch = replaceGlobal('fetch', async () => ({ ok: false, status: 503 }))
  const restoreDocument = replaceGlobal('document', { body: {} })

  try {
    const max = createMaxAdapter({
      platform: 'web',
      downloadFile() { nativeCalls += 1 }
    })

    assert.equal(max.capabilities.nativeDownload, false)
    await assert.rejects(
      max.downloadFile('https://files.example.com/file.pdf', 'file.pdf'),
      /HTTP 503/
    )
    assert.equal(nativeCalls, 0)
  } finally {
    restoreDocument()
    restoreFetch()
  }
})

test('MAX Promise-based SDK operations reject when native methods throw synchronously', async () => {
  const expectedError = new Error('native bridge failed')
  const max = createMaxAdapter({
    platform: 'android',
    downloadFile() { throw expectedError },
    shareMaxContent() { throw expectedError }
  })

  await assert.rejects(
    max.downloadFile('https://files.example.com/file.pdf', 'file.pdf'),
    error => error === expectedError
  )
  await assert.rejects(
    max.shareUrl('https://example.com'),
    error => error === expectedError
  )
  await assert.rejects(
    max.sharePreparedMessage({ messageId: 'mid.123', chatType: 'DIALOG' }),
    error => error === expectedError
  )
})

test('Telegram URL share rejects when the native method throws synchronously', async () => {
  const expectedError = new Error('telegram bridge failed')
  const telegram = createTelegramAdapter({
    platform: 'ios',
    version: '9.1',
    openTelegramLink() { throw expectedError }
  })

  await assert.rejects(
    telegram.shareUrl('https://example.com'),
    error => error === expectedError
  )
})

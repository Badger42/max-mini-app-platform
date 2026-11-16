import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createBackButton,
  normalizeDownloadResult,
  normalizeShareResult
} from '../src/platform/adapterUtils.js'
import bindBackButton from '../src/platform/bindBackButton.js'
import createMaxAdapter from '../src/platform/maxAdapter.js'

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
  await nativeHandler()
  assert.equal(backCalls, 2)
  binding.dispose()
})

test('MAX download result normalizer accepts only documented statuses', () => {
  assert.deepEqual(
    normalizeDownloadResult({ status: 'downloading' }),
    { status: 'requested', platformStatus: 'downloading' }
  )
  assert.deepEqual(
    normalizeDownloadResult({ status: 'cancelled' }),
    { status: 'cancelled', platformStatus: 'cancelled' }
  )
  assert.throws(() => normalizeDownloadResult(undefined), /missing status/)
  assert.throws(() => normalizeDownloadResult({ status: 'accepted' }), /accepted/)
  assert.throws(() => normalizeDownloadResult({ status: 'completed' }), /completed/)
})

test('share result normalizer rejects unknown and missing SDK statuses', () => {
  assert.deepEqual(normalizeShareResult({ status: 'shared' }), { status: 'shared' })
  assert.deepEqual(normalizeShareResult({ status: 'cancelled' }), { status: 'cancelled' })
  assert.throws(() => normalizeShareResult(undefined), /missing status/)
  assert.throws(() => normalizeShareResult({ status: 'error' }), /error/)
})

test('MAX platform=web does not advertise or invoke native file download', async () => {
  let nativeCalls = 0
  let serviceCalls = 0
  const max = createMaxAdapter({
    platform: 'web',
    downloadFile() { nativeCalls += 1 }
  }, {
    services: {
      downloadFile: async () => { serviceCalls += 1 }
    }
  })

  assert.equal(max.capabilities.nativeDownload, false)
  await max.downloadFile('/api/export', 'export.pdf')
  assert.equal(nativeCalls, 0)
  assert.equal(serviceCalls, 1)
})

test('MAX without native download keeps the standalone Fetch/Blob fallback', async () => {
  let nativeCalls = 0
  const restoreFetch = replaceGlobal('fetch', async () => ({ ok: false, status: 503 }))
  const restoreDocument = replaceGlobal('document', { body: {} })

  try {
    const max = createMaxAdapter({
      platform: 'web',
      downloadFile() { nativeCalls += 1 }
    })

    await assert.rejects(
      max.downloadFile('https://files.example.test/file.pdf', 'file.pdf'),
      /HTTP 503/
    )
    assert.equal(max.capabilities.nativeDownload, false)
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
    max.downloadFile('https://files.example.test/file.pdf', 'file.pdf'),
    error => error === expectedError
  )
  await assert.rejects(
    max.shareUrl('https://example.test'),
    error => error === expectedError
  )
  await assert.rejects(
    max.sharePreparedMessage({ messageId: 'mid.123', chatType: 'DIALOG' }),
    error => error === expectedError
  )
})

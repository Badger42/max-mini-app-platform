import test from 'node:test'
import assert from 'node:assert/strict'

import bindBackButton from '../src/platform/bindBackButton.js'

test('a platform BackButton service has at most one active binding across Routers', () => {
  const handlers = new Set()
  const platform = {
    backButton: {
      supported: true,
      show() {},
      hide() {},
      onClick(handler) {
        handlers.add(handler)
        return () => handlers.delete(handler)
      }
    }
  }
  const createRouter = () => ({
    back() {},
    afterEach() { return () => {} }
  })
  const options = router => ({
    platform,
    router,
    hasOpenModal: () => false,
    closeTopModal() {},
    canGoBack: () => false
  })

  const first = bindBackButton(options(createRouter()))
  assert.equal(handlers.size, 1)

  const second = bindBackButton(options(createRouter()))
  assert.equal(handlers.size, 1)

  // Disposing the replaced binding must not remove the active replacement.
  first.dispose()
  assert.equal(handlers.size, 1)

  second.dispose()
  assert.equal(handlers.size, 0)
})

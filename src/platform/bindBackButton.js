/** @type {WeakMap<object, {dispose: () => void}>} */
const activeBindingsByRouter = new WeakMap()
const activeBindingsByBackButton = new WeakMap()

/**
 * @typedef {Object} BackButtonRouter
 * @property {() => void|Promise<void>} back
 * @property {(handler: (...args: unknown[]) => void) => (() => void)|void} afterEach
 * @property {(handler: (error: unknown) => void) => (() => void)|void} [onError]
 */

/**
 * @typedef {Object} BindBackButtonOptions
 * @property {Pick<import('./platformTypes.js').PlatformAdapter, 'backButton'>} platform
 * @property {BackButtonRouter} router
 * @property {() => boolean} hasOpenModal
 * @property {() => void|Promise<void>} closeTopModal
 * @property {() => boolean} canGoBack
 * @property {(handler: () => void) => (() => void)|void} [subscribeModalChanges]
 * @property {number} [navigationUnlockTimeoutMs]
 * @property {(error: unknown) => void} [onError]
 */

/**
 * Connect the single native BackButton subscription to a modal manager and
 * Router. A second binding for the same native BackButton replaces the first.
 * The helper deliberately knows nothing about a specific modal library.
 *
 * @param {BindBackButtonOptions} options
 * @returns {{refresh: () => void, dispose: () => void}}
 */
export default function bindBackButton({
  platform,
  router,
  hasOpenModal,
  closeTopModal,
  canGoBack,
  subscribeModalChanges,
  navigationUnlockTimeoutMs = 10000,
  onError = error => {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[platform] BackButton handler failed:', error)
    }
  }
}) {
  if (!platform || !platform.backButton || !router ||
      (typeof router !== 'object' && typeof router !== 'function') ||
      typeof router.back !== 'function' ||
      typeof router.afterEach !== 'function' ||
      typeof hasOpenModal !== 'function' ||
      typeof closeTopModal !== 'function' ||
      typeof canGoBack !== 'function') {
    throw new TypeError('platform, router and modal/navigation callbacks are required')
  }

  if (!Number.isFinite(navigationUnlockTimeoutMs) || navigationUnlockTimeoutMs < 0) {
    throw new TypeError('navigationUnlockTimeoutMs must be a non-negative finite number')
  }

  const backButton = platform.backButton
  activeBindingsByRouter.get(router)?.dispose()
  activeBindingsByBackButton.get(backButton)?.dispose()

  if (!backButton.supported) {
    return { refresh() {}, dispose() {} }
  }

  let disposed = false
  let handlingBack = false
  let navigationPending = false
  /** @type {ReturnType<typeof setTimeout>|null} */
  let navigationTimer = null
  /** @type {Array<() => void>} */
  const unsubscribers = []

  /** @param {unknown} error */
  const reportError = error => {
    if (disposed) return
    try {
      onError(error)
    } catch {
      // An application error reporter must not break the BackButton lifecycle.
    }
  }

  const refresh = () => {
    if (disposed || !backButton.supported) return
    try {
      if (hasOpenModal() || canGoBack()) backButton.show()
      else backButton.hide()
    } catch (error) {
      reportError(error)
    }
  }

  const releaseNavigation = () => {
    if (disposed) return
    navigationPending = false
    if (navigationTimer !== null) {
      clearTimeout(navigationTimer)
      navigationTimer = null
    }
    refresh()
  }

  const handleBack = async () => {
    if (disposed || handlingBack || navigationPending) return
    handlingBack = true

    try {
      if (hasOpenModal()) {
        await closeTopModal()
        return
      }

      if (canGoBack()) {
        navigationPending = true
        try {
          navigationTimer = setTimeout(releaseNavigation, navigationUnlockTimeoutMs)
        } catch (error) {
          releaseNavigation()
          throw error
        }

        try {
          const navigation = router.back()
          if (navigation && typeof navigation.then === 'function') {
            Promise.resolve(navigation).catch(error => {
              if (disposed) return
              releaseNavigation()
              reportError(error)
            })
          }
        } catch (error) {
          releaseNavigation()
          throw error
        }
        return
      }

      backButton.hide()
    } catch (error) {
      reportError(error)
    } finally {
      handlingBack = false
      if (!disposed && !navigationPending) refresh()
    }
  }

  /** @param {unknown} unsubscribe */
  const addUnsubscriber = unsubscribe => {
    if (typeof unsubscribe === 'function') {
      unsubscribers.push(/** @type {() => void} */ (unsubscribe))
    }
  }

  try {
    addUnsubscriber(backButton.onClick(handleBack))
    addUnsubscriber(router.afterEach(releaseNavigation))
    if (typeof router.onError === 'function') {
      addUnsubscriber(router.onError(releaseNavigation))
    }
    if (typeof subscribeModalChanges === 'function') {
      addUnsubscriber(subscribeModalChanges(refresh))
    }
  } catch (error) {
    for (const unsubscribe of unsubscribers.splice(0)) {
      try { unsubscribe() } catch { /* Continue cleaning up partial registration. */ }
    }
    reportError(error)
    throw error
  }

  /** @type {{dispose: () => void}|undefined} */
  let binding
  const dispose = () => {
    if (disposed) return
    disposed = true

    if (navigationTimer !== null) {
      clearTimeout(navigationTimer)
      navigationTimer = null
    }

    for (const unsubscribe of unsubscribers.splice(0)) {
      try { unsubscribe() } catch { /* All remaining subscriptions must still be released. */ }
    }

    if (backButton.supported) {
      try { backButton.hide() } catch { /* Disposal must remain idempotent. */ }
    }

    if (activeBindingsByRouter.get(router) === binding) {
      activeBindingsByRouter.delete(router)
    }
    if (activeBindingsByBackButton.get(backButton) === binding) {
      activeBindingsByBackButton.delete(backButton)
    }
  }

  binding = { dispose }
  activeBindingsByRouter.set(router, binding)
  activeBindingsByBackButton.set(backButton, binding)
  refresh()

  return { refresh, dispose }
}

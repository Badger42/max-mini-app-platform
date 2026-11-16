/**
 * @typedef {Object} BackButtonRouter
 * @property {() => void} back
 * @property {(handler: () => void) => (() => void)|void} afterEach
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
 * Connect one native BackButton subscription to the application's modal manager
 * and Vue Router. The helper does not depend on a specific modal library.
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
      typeof hasOpenModal !== 'function' ||
      typeof closeTopModal !== 'function' ||
      typeof canGoBack !== 'function') {
    throw new TypeError('platform, router and modal/navigation callbacks are required')
  }

  let disposed = false
  let handlingBack = false
  let navigationPending = false
  /** @type {number|null} */
  let navigationTimer = null

  const refresh = () => {
    if (disposed || !platform.backButton.supported) return
    if (hasOpenModal() || canGoBack()) platform.backButton.show()
    else platform.backButton.hide()
  }

  const releaseNavigation = () => {
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
        navigationTimer = setTimeout(releaseNavigation, navigationUnlockTimeoutMs)
        try {
          router.back()
        } catch (error) {
          releaseNavigation()
          throw error
        }
        return
      }

      platform.backButton.hide()
    } catch (error) {
      onError(error)
    } finally {
      handlingBack = false
      if (!navigationPending) refresh()
    }
  }

  const unsubscribeBack = platform.backButton.onClick(handleBack)
  const unsubscribeRoute = router.afterEach(releaseNavigation)
  const unsubscribeRouterError = typeof router.onError === 'function'
    ? router.onError(releaseNavigation)
    : null
  const unsubscribeModal = typeof subscribeModalChanges === 'function'
    ? subscribeModalChanges(refresh)
    : null

  refresh()

  return {
    refresh,
    dispose() {
      if (disposed) return
      disposed = true
      if (typeof unsubscribeBack === 'function') unsubscribeBack()
      if (typeof unsubscribeRoute === 'function') unsubscribeRoute()
      if (typeof unsubscribeRouterError === 'function') unsubscribeRouterError()
      if (typeof unsubscribeModal === 'function') unsubscribeModal()
      if (navigationTimer !== null) {
        clearTimeout(navigationTimer)
        navigationTimer = null
      }
      platform.backButton.hide()
    }
  }
}

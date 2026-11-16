/**
 * Connect one native BackButton subscription to the application's modal manager
 * and Vue Router. The helper knows nothing about a particular modal library.
 *
 * `subscribeModalChanges` is optional. When supplied, it should return an
 * unsubscribe function and notify the helper after modal state changes.
 * Otherwise call refresh() after opening/closing a modal.
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
  let navigationTimer = null

  const releaseNavigation = () => {
    navigationPending = false
    if (navigationTimer !== null) {
      clearTimeout(navigationTimer)
      navigationTimer = null
    }
    refresh()
  }

  const refresh = () => {
    if (disposed || !platform.backButton.supported) return

    if (hasOpenModal() || canGoBack()) {
      platform.backButton.show()
    } else {
      platform.backButton.hide()
    }
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
        // Start the safety timer before invoking the router so a synchronous
        // exception cannot leave navigationPending locked without a timer.
        navigationTimer = setTimeout(releaseNavigation, navigationUnlockTimeoutMs)

        try {
          router.back()
        } catch (error) {
          releaseNavigation()
          throw error
        }

        // Vue Router's back() returns void. afterEach/onError release the lock;
        // the timeout is a safety net if the history traversal has no result.
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

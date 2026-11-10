/**
 * Optional helper for wiring MAX BackButton to an existing modal manager and
 * Vue Router. The caller supplies modal-manager-specific functions.
 *
 * Call returned refresh() after a modal opens/closes. Router navigation is
 * observed automatically through router.afterEach().
 */
export default function bindBackButton({
  platform,
  router,
  hasOpenModal,
  closeTopModal,
  canGoBack
}) {
  if (!platform || !router || typeof hasOpenModal !== 'function' ||
      typeof closeTopModal !== 'function' || typeof canGoBack !== 'function') {
    throw new TypeError('platform, router and modal/navigation callbacks are required')
  }

  const refresh = () => {
    if (hasOpenModal() || canGoBack()) {
      platform.backButton.show()
    } else {
      platform.backButton.hide()
    }
  }

  const handleBack = () => {
    if (hasOpenModal()) {
      closeTopModal()
      refresh()
      return
    }

    if (canGoBack()) {
      router.back()
    } else {
      platform.backButton.hide()
    }
  }

  const unsubscribeBack = platform.backButton.onClick(handleBack)
  const unsubscribeRoute = router.afterEach(refresh)

  refresh()

  return {
    refresh,
    dispose() {
      unsubscribeBack()
      if (typeof unsubscribeRoute === 'function') {
        unsubscribeRoute()
      }
      platform.backButton.hide()
    }
  }
}

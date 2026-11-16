import bindBackButton from '../src/platform/bindBackButton.js'

/**
 * Connect one platform BackButton handler to the consuming app's existing
 * modal manager and Router. The integration deliberately assumes no specific
 * modal library or navigation-history implementation.
 */
export default function setupBackButtonIntegration({
  platform,
  router,
  modalManager,
  navigationHistory
}) {
  return bindBackButton({
    platform,
    router,
    hasOpenModal: () => modalManager.hasOpenModal(),
    closeTopModal: () => modalManager.closeTopModal(),
    canGoBack: () => navigationHistory.canGoBack()
  })
}

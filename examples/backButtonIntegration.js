import bindBackButton from '../src/platform/bindBackButton'

/**
 * Call this from your app's setup code, passing your real modal manager and
 * route-history API. The names below are intentionally generic; they are not
 * built-in Vue APIs.
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

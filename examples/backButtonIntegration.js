import bindBackButton from '../src/platform/bindBackButton.js'

/**
 * @param {{
 *   platform: import('../src/platform/platformTypes.js').PlatformAdapter,
 *   router: import('../src/platform/bindBackButton.js').BackButtonRouter,
 *   modalManager: {hasOpenModal: () => boolean, closeTopModal: () => void|Promise<void>},
 *   navigationHistory: {canGoBack: () => boolean}
 * }} options
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

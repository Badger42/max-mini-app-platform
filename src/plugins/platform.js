/** @typedef {{config: {globalProperties: Record<string, unknown>}}} VueAppLike */

/**
 * Vue 3 plugin exposing the adapter through Options API as `this.$platform`.
 */
export default {
  /**
   * @param {VueAppLike} app
   * @param {import('../platform/platformTypes.js').PlatformAdapter} platform
   */
  install(app, platform) {
    if (!platform) {
      throw new TypeError('Platform adapter is required')
    }

    app.config.globalProperties.$platform = platform
  }
}

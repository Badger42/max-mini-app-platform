/** Vue 3 plugin for Options API components: this.$platform */
export default {
  install(app, platform) {
    if (!platform) {
      throw new TypeError('Platform adapter is required')
    }

    app.config.globalProperties.$platform = platform
  }
}

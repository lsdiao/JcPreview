const config = require('./config.js')

App({
  globalData: {
    config,
    openid: '',
    member: null, // { level, code, nickname, avatar, status }
    isAdmin: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[臻瓷汇] 请使用 2.2.3 及以上基础库以使用云开发能力')
      return
    }
    const opts = { traceUser: true }
    if (config.envId) opts.env = config.envId
    wx.cloud.init(opts)
  },

  onShow() {},

  onError(err) {
    console.error('[臻瓷汇] 运行异常：', err)
  }
})
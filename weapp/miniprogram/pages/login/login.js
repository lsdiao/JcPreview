const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    agreed: false,
    loading: false,
    showPrivacy: false
  },

  /** 勾选/取消隐私协议 */
  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  /** 显示隐私协议 */
  showPrivacy() {
    this.setData({ showPrivacy: true })
  },

  /** 关闭隐私协议并自动勾选 */
  hidePrivacy() {
    this.setData({ showPrivacy: true })
    // 阅读完协议后自动勾选
    this.setData({ showPrivacy: false, agreed: true })
  },

  /**
   * 获取手机号并登录
   * 用户点击「微信手机号一键登录」按钮后触发
   */
  onGetPhone(e) {
    if (this.data.loading) return
    if (!this.data.agreed) {
      api.toast('请先阅读并同意用户隐私协议')
      return
    }

    const detail = e.detail || {}
    console.log('[login] 手机号授权返回：', detail)

    // 用户拒绝授权
    if (detail.errMsg && detail.errMsg.indexOf('deny') >= 0) {
      api.toast('已取消授权')
      return
    }

    const code = detail.code
    if (!code) {
      console.error('[login] 未获取到 code，detail =', detail)
      api.toast('获取手机号失败，请重试')
      return
    }

    this.setData({ loading: true })
    api.call('member.loginByPhone', { code })
      .then(data => {
        // 登录成功，清除缓存并刷新
        api.clearMe()
        const app = getApp()
        if (app && data) {
          app.globalData.openid = data.openid || ''
          app.globalData.member = data.member || null
          app.globalData.isAdmin = !!data.isAdmin
        }
        api.toast('登录成功')
        // 延迟一下再返回，让用户看到成功提示
        setTimeout(() => {
          wx.navigateBack({
            fail: () => {
              wx.switchTab({ url: '/pages/mine/mine' })
            }
          })
        }, 600)
      })
      .catch(err => {
        api.toast(err.message || '登录失败')
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  },

  /** 跳过手机号，直接登录（开发测试兜底） */
  skipLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })
    api.call('member.skipLogin')
      .then(data => {
        api.clearMe()
        const app = getApp()
        if (app && data) {
          app.globalData.openid = data.openid || ''
          app.globalData.member = data.member || null
          app.globalData.isAdmin = !!data.isAdmin
        }
        api.toast('登录成功')
        setTimeout(() => {
          wx.navigateBack({
            fail: () => {
              wx.switchTab({ url: '/pages/mine/mine' })
            }
          })
        }, 400)
      })
      .catch(err => {
        api.toast(err.message || '登录失败')
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  }
})

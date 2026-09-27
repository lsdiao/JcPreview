const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    items: [],
    loading: true,
    consultant: null,
    showConsultant: false
  },

  onLoad(options) {
    this.load()
    this.loadConsultant()
    // 处理扫码进入的邀请码参数（小程序码 scene）
    this.handleInviteScene(options)
  },

  onShow() {
    // 管理端编辑内容后返回，静默刷新
    if (!this.data.loading) this.load(true)
    this.loadConsultant()
  },

  /** 处理扫码进入的邀请码 scene 参数 */
  handleInviteScene(options) {
    const scene = options && options.scene
    if (!scene) return
    // scene 格式：invite=XXXXXX
    const decoded = decodeURIComponent(scene)
    const match = decoded.match(/invite=([A-Z0-9]+)/i)
    if (match && match[1]) {
      const code = match[1].toUpperCase()
      // 跳到「我的」页面，并携带邀请码
      wx.showModal({
        title: '邀请码',
        content: '检测到邀请码：' + code + '\n是否前往开通会员？',
        confirmText: '去开通',
        cancelText: '稍后',
        success: r => {
          if (r.confirm) {
            wx.switchTab({
              url: '/pages/mine/mine'
            })
            // 存在全局，mine 页面会读取
            const app = getApp()
            if (app) app.globalData.inviteCode = code
          }
        }
      })
    }
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  load(silent) {
    if (!silent) this.setData({ loading: true })
    return api.call('content.list')
      .then(items => {
        this.setData({ items: items || [], loading: false })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  openContent(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find(x => x._id === id)
    if (!item) return
    wx.navigateTo({
      url: `/pages/content-detail/content-detail?id=${id}&type=${item.type}`
    })
  },

  loadConsultant() {
    return api.call('config.getConsultant')
      .then(data => {
        if (data && data.qrcode) {
          this.setData({ consultant: data })
        }
      })
      .catch(() => {})
  },

  showConsultant() {
    this.setData({ showConsultant: true })
  },

  hideConsultant() {
    this.setData({ showConsultant: false })
  },

  previewConsultantQrcode() {
    if (!this.data.consultant || !this.data.consultant.qrcode) return
    wx.previewImage({
      urls: [this.data.consultant.qrcode],
      current: this.data.consultant.qrcode
    })
  },

  onShareAppMessage() {
    return {
      title: config.brand.name + ' · ' + config.brand.slogan,
      path: '/pages/home/home'
    }
  }
})
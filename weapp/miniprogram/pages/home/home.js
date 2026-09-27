const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    items: [],
    loading: true
  },

  onLoad() {
    this.load()
  },

  onShow() {
    // 管理端编辑内容后返回，静默刷新
    if (!this.data.loading) this.load(true)
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

  onShareAppMessage() {
    return {
      title: config.brand.name + ' · ' + config.brand.slogan,
      path: '/pages/home/home'
    }
  }
})
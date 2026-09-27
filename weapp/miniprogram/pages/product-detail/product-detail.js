const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    loading: true,
    item: null,
    needMember: false,
    levelText: '',
    current: 1
  },

  onLoad(options) {
    this.id = options.id
    this.load()
  },

  load() {
    return api.getMe()
      .then(me => {
        const m = me.member
        if (!m) {
          this.setData({ loading: false, needMember: true })
          return null
        }
        this.setData({ levelText: config.levels[m.level] })
        return api.call('product.list').then(res => {
          const item = ((res && res.items) || []).find(x => x._id === this.id) || null
          this.setData({ item, loading: false })
          if (item) wx.setNavigationBarTitle({ title: item.name })
        })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  onSwiper(e) {
    this.setData({ current: e.detail.current + 1 })
  },

  preview(e) {
    const item = this.data.item
    if (!item || !item.images.length) return
    wx.previewImage({
      current: item.images[e.currentTarget.dataset.index],
      urls: item.images
    })
  },

  copyNo() {
    const item = this.data.item
    if (item) api.copy(item.no)
  },

  goActivate() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onShareAppMessage() {
    const item = this.data.item || {}
    return {
      title: item.name || config.brand.name + ' · 产品库',
      path: '/pages/home/home',
      imageUrl: (item.images && item.images[0]) || ''
    }
  }
})
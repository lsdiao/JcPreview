const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    loading: true,
    isMember: false,
    levelText: '',
    no: '',
    searching: false,
    searched: false,
    result: null,
    errMsg: '',
    needMember: false
  },

  onLoad() {
    this.load()
  },

  onShow() {
    if (this.loaded) this.load(true)
  },

  load(silent) {
    if (!silent) this.setData({ loading: true })
    return api.getMe()
      .then(me => {
        const m = me.member
        this.loaded = true
        this.setData({
          isMember: !!m,
          needMember: !m,
          levelText: m ? config.levels[m.level] : '',
          loading: false
        })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  onInput(e) {
    this.setData({ no: String(e.detail.value || '').trim().toUpperCase() })
  },

  search() {
    if (this.data.searching) return
    const no = String(this.data.no || '').trim()
    if (!no) { api.toast('请输入产品编号'); return }

    this.setData({ searching: true, errMsg: '' })
    api.call('product.byNo', { no })
      .then(res => {
        this.setData({
          searching: false,
          searched: true,
          result: res.product,
          errMsg: '',
          levelText: config.levels[res.level]
        })
      })
      .catch(err => {
        this.setData({
          searching: false,
          searched: true,
          result: null,
          errMsg: err.message
        })
      })
  },

  openDetail() {
    const r = this.data.result
    if (r) wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + r._id })
  },

  goActivate() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onShareAppMessage() {
    return {
      title: config.brand.name + ' · 会员查价',
      path: '/pages/home/home'
    }
  }
})
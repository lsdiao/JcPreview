const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    levels: config.levels,
    loading: true,
    list: []
  },

  onLoad() {
    this.load()
  },

  onShow() {
    if (this.loaded) this.load(true)
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  load(silent) {
    if (!silent) this.setData({ loading: true })
    return api.call('vote.list')
      .then(list => {
        const rows = (list || []).map(v => {
          const total = (v.counts || []).reduce((a, b) => a + Number(b || 0), 0)
          v.total = total
          v.hasVoted = v.myOption !== null && v.myOption !== undefined
          v.myText = v.hasVoted ? (v.options || [])[v.myOption] : ''
          return v
        })
        this.loaded = true
        this.setData({ list: rows, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  open(e) {
    wx.navigateTo({ url: '/pages/vote-detail/vote-detail?id=' + e.currentTarget.dataset.id })
  },

  onShareAppMessage() {
    return {
      title: config.brand.name + ' · 新品投票',
      path: '/pages/home/home'
    }
  }
})
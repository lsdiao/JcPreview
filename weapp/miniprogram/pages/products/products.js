const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    levels: config.levels,
    loading: true,
    isMember: false,
    level: -1,
    levelText: '',
    items: [],
    list: [],
    apps: [],
    cats: ['全部'],
    cat: '全部',
    kw: ''
  },

  onLoad() {
    this.load()
    this.loadApps()
  },

  onShow() {
    // 开通会员后回到本页需要重新拉取价格
    if (this.loaded) this.load(true)
  },

  onPullDownRefresh() {
    Promise.all([this.load(true), this.loadApps()]).then(() => wx.stopPullDownRefresh())
  },

  load(silent) {
    if (!silent) this.setData({ loading: true })
    return api.getMe()
      .then(me => {
        const m = me.member
        this.setData({ isMember: !!m, levelText: m ? config.levels[m.level] : '' })
        if (!m) {
          this.loaded = true
          this.setData({ loading: false, items: [], list: [] })
          return null
        }
        return api.call('product.list').then(res => {
          const items = (res && res.items) || []
          const cats = ['全部']
          items.forEach(p => {
            if (p.cat && cats.indexOf(p.cat) < 0) cats.push(p.cat)
          })
          this.loaded = true
          this.setData({ items, cats, level: res.level, loading: false })
          this.applyFilter()
        })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  loadApps() {
    return api.call('app.list')
      .then(apps => this.setData({ apps: apps || [] }))
      .catch(() => {})
  },

  applyFilter() {
    const cat = this.data.cat
    const k = String(this.data.kw || '').trim().toUpperCase()
    const list = this.data.items.filter(p => {
      if (cat !== '全部' && p.cat !== cat) return false
      if (!k) return true
      return String(p.no || '').toUpperCase().indexOf(k) >= 0 ||
        String(p.name || '').indexOf(k) >= 0 ||
        String(p.brand || '').indexOf(k) >= 0
    })
    this.setData({ list })
  },

  onCat(e) {
    this.setData({ cat: e.currentTarget.dataset.cat })
    this.applyFilter()
  },

  onKw(e) {
    this.setData({ kw: e.detail.value })
    this.applyFilter()
  },

  openProduct(e) {
    wx.navigateTo({
      url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id
    })
  },

  openApp(e) {
    const d = e.currentTarget.dataset
    if (!d.appid) { api.toast('该品牌未配置 AppID'); return }
    wx.navigateToMiniProgram({
      appId: d.appid,
      path: d.path || '',
      fail: err => {
        console.error('[navigateToMiniProgram] 失败：', err)
        api.toast('打开「' + d.name + '」失败，请检查 AppID 与关联小程序设置')
      }
    })
  },

  goActivate() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onShareAppMessage() {
    return {
      title: config.brand.name + ' · 授权产品库',
      path: '/pages/home/home'
    }
  }
})
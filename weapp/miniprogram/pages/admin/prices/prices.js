const api = require('../../../utils/api.js')
const config = require('../../../config.js')

Page({
  data: {
    levelsShort: config.levelsShort,
    loading: true,
    list: [],
    kw: ''
  },

  onShow() {
    this.load()
  },

  load(silent) {
    if (!silent) this.setData({ loading: true })
    return api.call('product.adminList')
      .then(list => {
        const rows = (list || []).map(p => {
          const prices = (p.prices || [0, 0, 0]).slice(0, 3)
          while (prices.length < 3) prices.push(0)
          return Object.assign({}, p, {
            editPrices: prices.map(v => String(v)),
            offText: p.off ? '已下架' : '上架中'
          })
        })
        this.setData({ list: rows, loading: false })
        this.applyFilter()
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  applyFilter() {
    const k = String(this.data.kw || '').trim().toUpperCase()
    const rows = this.data.list.map((p, i) => Object.assign({ _i: i }, p))
    const view = !k ? rows : rows.filter(p =>
      String(p.no || '').toUpperCase().indexOf(k) >= 0 ||
      String(p.name || '').indexOf(k) >= 0 ||
      String(p.brand || '').indexOf(k) >= 0
    )
    this.setData({ view })
  },

  onKw(e) {
    this.setData({ kw: e.detail.value })
    this.applyFilter()
  },

  /* ---------------- 行内价格 ---------------- */

  onPriceInput(e) {
    const i = Number(e.currentTarget.dataset.i)
    const j = Number(e.currentTarget.dataset.j)
    this.setData({ ['list[' + i + '].editPrices[' + j + ']']: e.detail.value })
    this.applyFilter()
  },

  saveOne(e) {
    const i = Number(e.currentTarget.dataset.i)
    const p = this.data.list[i]
    api.call('product.savePrices', { list: [{ _id: p._id, prices: p.editPrices }] })
      .then(() => api.toast('已保存 ' + p.no))
      .catch(err => api.toast(err.message))
  },

  saveAll() {
    const list = this.data.list.map(p => ({ _id: p._id, prices: p.editPrices }))
    if (!list.length) { api.toast('暂无产品'); return }
    api.call('product.savePrices', { list })
      .then(res => {
        api.toast('已保存 ' + res.count + ' 个产品价格')
        return this.load(true)
      })
      .catch(err => api.toast(err.message))
  },

  toggleItem(e) {
    const id = e.currentTarget.dataset.id
    api.call('product.toggle', { id })
      .then(res => {
        api.toast(res.off ? '已下架' : '已上架')
        return this.load(true)
      })
      .catch(err => api.toast(err.message))
  },

  removeItem(e) {
    const id = e.currentTarget.dataset.id
    const no = e.currentTarget.dataset.no
    wx.showModal({
      title: '删除产品',
      content: '确认删除「' + no + '」？删除后会员不可见，且不可恢复。',
      confirmText: '删除',
      confirmColor: '#e0684f',
      success: r => {
        if (!r.confirm) return
        api.call('product.remove', { id })
          .then(() => {
            api.toast('已删除')
            return this.load(true)
          })
          .catch(err => api.toast(err.message))
      }
    })
  },

  /* ---------------- 跳转编辑页 ---------------- */

  openNew() {
    wx.navigateTo({ url: '/pages/admin/product-edit/product-edit' })
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/admin/product-edit/product-edit?id=' + id })
  }
})

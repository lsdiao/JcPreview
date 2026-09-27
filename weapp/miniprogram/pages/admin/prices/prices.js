const api = require('../../../utils/api.js')
const config = require('../../../config.js')

const EMPTY_FORM = {
  _id: '',
  no: '',
  brand: '',
  name: '',
  spec: '',
  cat: '',
  unit: '元/片',
  desc: '',
  images: [],
  prices: [0, 0, 0],
  off: false
}

Page({
  data: {
    levelsShort: config.levelsShort,
    loading: true,
    list: [],
    cats: [],
    kw: '',
    formOpen: false,
    form: Object.assign({}, EMPTY_FORM),
    saving: false,
    uploading: false
  },

  onShow() {
    this.load()
  },

  load(silent) {
    if (!silent) this.setData({ loading: true })
    return api.call('product.adminList')
      .then(list => {
        const cats = []
        const rows = (list || []).map(p => {
          if (p.cat && cats.indexOf(p.cat) < 0) cats.push(p.cat)
          const prices = (p.prices || [0, 0, 0]).slice(0, 3)
          while (prices.length < 3) prices.push(0)
          return Object.assign({}, p, {
            editPrices: prices.map(v => String(v)),
            offText: p.off ? '已下架' : '上架中'
          })
        })
        this.setData({ list: rows, cats, loading: false })
        this.applyFilter()
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  applyFilter() {
    // 过滤仅影响展示，操作仍按下标定位原始 list
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

  /* ---------------- 产品资料表单 ---------------- */

  openNew() {
    this.setData({ formOpen: true, form: Object.assign({}, EMPTY_FORM, { images: [], prices: [0, 0, 0] }) })
  },

  openEdit(e) {
    const i = Number(e.currentTarget.dataset.i)
    const p = this.data.list[i]
    if (!p) return
    this.setData({
      formOpen: true,
      form: {
        _id: p._id,
        no: p.no || '',
        brand: p.brand || '',
        name: p.name || '',
        spec: p.spec || '',
        cat: p.cat || '',
        unit: p.unit || '元/片',
        desc: p.desc || '',
        images: (p.images || []).slice(),
        prices: (p.prices || [0, 0, 0]).slice(0, 3),
        off: !!p.off
      }
    })
  },

  closeForm() {
    this.setData({ formOpen: false })
  },

  onField(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value })
  },

  onPrice(e) {
    this.setData({ ['form.prices[' + e.currentTarget.dataset.j + ']']: e.detail.value })
  },

  onOff(e) {
    this.setData({ 'form.off': e.detail.value })
  },

  pickCat(e) {
    this.setData({ 'form.cat': e.currentTarget.dataset.cat })
  },

  addImages() {
    if (this.data.uploading) return
    const left = 9 - this.data.form.images.length
    if (left <= 0) { api.toast('最多 9 张'); return }
    this.setData({ uploading: true })
    api.chooseImages(left)
      .then(files => {
        this.setData({ uploading: false })
        if (files && files.length) {
          this.setData({ 'form.images': this.data.form.images.concat(files) })
        }
      })
      .catch(err => {
        this.setData({ uploading: false })
        api.toast(err.message)
      })
  },

  removeImage(e) {
    const i = Number(e.currentTarget.dataset.index)
    const images = this.data.form.images.slice()
    images.splice(i, 1)
    this.setData({ 'form.images': images })
  },

  previewImage(e) {
    const images = this.data.form.images
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },

  save() {
    if (this.data.saving) return
    const f = this.data.form
    if (!String(f.no || '').trim()) { api.toast('请填写产品编号'); return }
    if (!String(f.name || '').trim()) { api.toast('请填写产品名称'); return }

    this.setData({ saving: true })
    api.call('product.save', { data: f })
      .then(() => {
        this.setData({ saving: false, formOpen: false })
        api.toast('已保存')
        return this.load(true)
      })
      .catch(err => {
        this.setData({ saving: false })
        api.toast(err.message)
      })
  }
})
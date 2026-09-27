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
  sort: 0,
  off: false
}

Page({
  data: {
    levelsShort: config.levelsShort,
    loading: true,
    saving: false,
    uploading: false,
    form: Object.assign({}, EMPTY_FORM),
    isEdit: false,
    cats: []
  },

  onLoad(options) {
    const id = options.id || ''
    if (id) {
      // 编辑模式：加载产品详情
      this.setData({ isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑产品' })
      this.loadProduct(id)
    } else {
      // 新增模式
      wx.setNavigationBarTitle({ title: '新增产品' })
      this.setData({
        loading: false,
        form: Object.assign({}, EMPTY_FORM, { images: [], prices: [0, 0, 0] })
      })
    }
  },

  loadProduct(id) {
    api.call('product.detail', { id })
      .then(p => {
        if (!p) {
          api.toast('产品不存在')
          setTimeout(() => wx.navigateBack(), 1000)
          return
        }
        const prices = (p.prices || [0, 0, 0]).slice(0, 3)
        while (prices.length < 3) prices.push(0)
        this.setData({
        loading: false,
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
          prices: prices,
          sort: typeof p.sort === 'number' ? p.sort : 0,
          off: !!p.off
        }
      })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
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
        this.setData({ saving: false })
        api.toast('已保存')
        setTimeout(() => wx.navigateBack(), 500)
      })
      .catch(err => {
        this.setData({ saving: false })
        api.toast(err.message)
      })
  },

  onBack() {
    wx.navigateBack()
  }
})

const api = require('../../../utils/api.js')
const config = require('../../../config.js')

Page({
  data: {
    brand: config.brand,
    loading: true,
    list: [],
    // 创建表单
    formOpen: false,
    saving: false,
    uploading: false,
    title: '',
    intro: '',
    images: [],
    options: ['', ''],
    deadline: '',
    // 明细
    detailId: '',
    records: []
  },

  onShow() {
    this.load()
  },

  load(silent) {
    if (!silent) this.setData({ loading: true })
    return api.call('vote.list')
      .then(list => {
        const rows = (list || []).map(v => {
          const total = (v.counts || []).reduce((a, b) => a + Number(b || 0), 0)
          const opts = (v.options || []).map((text, i) => ({
            text,
            count: Number((v.counts || [])[i] || 0),
            percent: api.percent((v.counts || [])[i] || 0, total)
          }))
          return Object.assign({}, v, { total, opts, createdText: api.fmtTime(v.createdAt) })
        })
        this.setData({ list: rows, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  /* ---------------- 创建 ---------------- */

  openForm() {
    this.setData({ formOpen: true, title: '', intro: '', images: [], options: ['', ''], deadline: '' })
  },

  closeForm() {
    this.setData({ formOpen: false })
  },

  onField(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onDeadline(e) {
    this.setData({ deadline: e.detail.value })
  },

  clearDeadline() {
    this.setData({ deadline: '' })
  },

  onOption(e) {
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ ['options[' + i + ']']: e.detail.value })
  },

  addOption() {
    if (this.data.options.length >= 4) { api.toast('最多 4 个选项'); return }
    this.setData({ options: this.data.options.concat(['']) })
  },

  removeOption(e) {
    if (this.data.options.length <= 2) { api.toast('至少保留 2 个选项'); return }
    const i = Number(e.currentTarget.dataset.index)
    const options = this.data.options.slice()
    options.splice(i, 1)
    this.setData({ options })
  },

  addImages() {
    if (this.data.uploading) return
    const left = 6 - this.data.images.length
    if (left <= 0) { api.toast('最多 6 张'); return }
    this.setData({ uploading: true })
    api.chooseImages(left)
      .then(files => {
        this.setData({ uploading: false })
        if (files && files.length) this.setData({ images: this.data.images.concat(files) })
      })
      .catch(err => {
        this.setData({ uploading: false })
        api.toast(err.message)
      })
  },

  removeImage(e) {
    const i = Number(e.currentTarget.dataset.index)
    const images = this.data.images.slice()
    images.splice(i, 1)
    this.setData({ images })
  },

  create() {
    if (this.data.saving) return
    const title = String(this.data.title || '').trim()
    const options = this.data.options.map(s => String(s).trim()).filter(Boolean)
    if (!title) { api.toast('请填写投票标题'); return }
    if (options.length < 2) { api.toast('至少需要 2 个选项'); return }

    this.setData({ saving: true })
    api.call('vote.create', {
      data: {
        title,
        intro: this.data.intro,
        images: this.data.images,
        options,
        deadline: this.data.deadline
      }
    })
      .then(() => {
        this.setData({ saving: false, formOpen: false })
        api.toast('投票已发布')
        return this.load(true)
      })
      .catch(err => {
        this.setData({ saving: false })
        api.toast(err.message)
      })
  },

  /* ---------------- 列表操作 ---------------- */

  close(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提前截止',
      content: '截止后会员不能再投票，结果继续可见。确认？',
      confirmText: '截止',
      success: r => {
        if (!r.confirm) return
        api.call('vote.close', { id })
          .then(() => {
            api.toast('已截止')
            return this.load(true)
          })
          .catch(err => api.toast(err.message))
      }
    })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除投票',
      content: '删除后投票与结果不可恢复，确认？',
      confirmText: '删除',
      confirmColor: '#e0684f',
      success: r => {
        if (!r.confirm) return
        api.call('vote.remove', { id })
          .then(() => {
            api.toast('已删除')
            return this.load(true)
          })
          .catch(err => api.toast(err.message))
      }
    })
  },

  toggleRecords(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.detailId === id) {
      this.setData({ detailId: '', records: [] })
      return
    }
    const v = this.data.list.find(x => x._id === id)
    api.call('vote.records', { id })
      .then(records => {
        const rows = (records || []).map(r => ({
          optionText: (v && v.options ? v.options[r.option] : '') || '—',
          time: api.fmtTime(r.createdAt)
        }))
        this.setData({ detailId: id, records: rows })
      })
      .catch(err => api.toast(err.message))
  }
})
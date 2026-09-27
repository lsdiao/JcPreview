const api = require('../../../utils/api.js')
const config = require('../../../config.js')

/** 表单空模板 */
const EMPTY = {
  _id: '',
  type: 'video',
  title: '',
  cover: '',
  summary: '',
  duration: '',
  source: '视频号',
  feedId: '',
  finderUserName: '',
  feedToken: '',
  images: [],
  body: '',
  pinned: false,
  status: 'on',
  sort: 0
}

Page({
  data: {
    brand: config.brand,
    loading: true,
    list: [],
    showForm: false,
    saving: false,
    uploading: false,
    form: Object.assign({}, EMPTY),
    bodyText: ''
  },

  onShow() {
    this.load()
  },

  load() {
    return api.call('content.list', { admin: true })
      .then(list => this.setData({ list: list || [], loading: false }))
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  /* ---------------- 表单 ---------------- */

  openNew(e) {
    const type = e.currentTarget.dataset.type === 'article' ? 'article' : 'video'
    // 新内容排在非置顶内容的最前面
    const sorts = this.data.list
      .filter(x => !x.pinned)
      .map(x => (typeof x.sort === 'number' ? x.sort : 0))
    const base = sorts.length ? Math.min.apply(null, sorts) : 1
    this.setData({
      showForm: true,
      saving: false,
      bodyText: '',
      form: Object.assign({}, EMPTY, {
        type,
        source: type === 'video' ? '视频号' : config.brand.name,
        sort: base - 1
      })
    })
  },

  openEdit(e) {
    const item = this.data.list.find(x => x._id === e.currentTarget.dataset.id)
    if (!item) return
    this.setData({
      showForm: true,
      saving: false,
      bodyText: item.body || '',
      form: {
        _id: item._id,
        type: item.type,
        title: item.title || '',
        cover: item.cover || '',
        summary: item.summary || '',
        duration: item.duration || '',
        source: item.source || '',
        feedId: item.feedId || '',
        finderUserName: item.finderUserName || '',
        feedToken: item.feedToken || '',
        images: (item.images || []).slice(),
        body: item.body || '',
        pinned: !!item.pinned,
        status: item.status === 'off' ? 'off' : 'on',
        sort: typeof item.sort === 'number' ? item.sort : 0
      }
    })
  },

  closeForm() {
    this.setData({ showForm: false })
  },

  setType(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.type })
  },

  onField(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value })
  },

  onBody(e) {
    this.setData({ bodyText: e.detail.value, 'form.body': e.detail.value })
  },

  onPinned(e) {
    this.setData({ 'form.pinned': e.detail.value })
  },

  onStatus(e) {
    this.setData({ 'form.status': e.detail.value ? 'on' : 'off' })
  },

  pickCover() {
    if (this.data.uploading) return
    this.setData({ uploading: true })
    api.chooseImages(1)
      .then(files => {
        this.setData({ uploading: false })
        if (files && files.length) this.setData({ 'form.cover': files[0] })
      })
      .catch(err => {
        this.setData({ uploading: false })
        api.toast(err.message)
      })
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
    if (!String(f.title || '').trim()) { api.toast('请填写标题'); return }
    if (f.type === 'video' && !String(f.feedId || '').trim()) {
      api.toast('视频内容需填写视频号 feedId')
      return
    }
    if (f.type === 'article' && !f.images.length && !String(f.body || '').trim()) {
      api.toast('图文内容需上传配图或填写正文')
      return
    }

    this.setData({ saving: true })
    api.call('content.save', { data: f })
      .then(() => {
        this.setData({ saving: false, showForm: false })
        api.toast('已保存')
        return this.load()
      })
      .catch(err => {
        this.setData({ saving: false })
        api.toast(err.message)
      })
  },

  /* ---------------- 列表操作 ---------------- */

  /** 用完整字段回写（云函数会忽略多余字段） */
  patch(item, changes) {
    return api.call('content.save', { data: Object.assign({}, item, changes) })
  },

  togglePin(e) {
    const item = this.data.list.find(x => x._id === e.currentTarget.dataset.id)
    if (!item) return
    this.patch(item, { pinned: !item.pinned })
      .then(() => this.load())
      .catch(err => api.toast(err.message))
  },

  toggleStatus(e) {
    const item = this.data.list.find(x => x._id === e.currentTarget.dataset.id)
    if (!item) return
    this.patch(item, { status: item.status === 'off' ? 'on' : 'off' })
      .then(() => this.load())
      .catch(err => api.toast(err.message))
  },

  move(e) {
    const dir = Number(e.currentTarget.dataset.dir)
    const id = e.currentTarget.dataset.id
    const list = this.data.list.slice()
    const i = list.findIndex(x => x._id === id)
    const j = i + dir
    if (i < 0) return
    if (j < 0 || j >= list.length) {
      api.toast(dir < 0 ? '已经在最前面' : '已经在最后面')
      return
    }
    const a = list[i]
    const b = list[j]
    if (!!a.pinned !== !!b.pinned) {
      api.toast('置顶内容固定在首位，请先取消置顶再排序')
      return
    }
    const sa = typeof a.sort === 'number' ? a.sort : 0
    const sb = typeof b.sort === 'number' ? b.sort : 0
    const step = dir < 0 ? 1 : -1
    let na = sb
    let nb = sa
    if (na === nb) nb = sb + step

    Promise.all([
      this.patch(a, { sort: na }),
      this.patch(b, { sort: nb })
    ])
      .then(() => this.load())
      .catch(err => api.toast(err.message))
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除内容',
      content: '删除后不可恢复，确认删除？',
      confirmText: '删除',
      confirmColor: '#e0684f',
      success: r => {
        if (!r.confirm) return
        api.call('content.remove', { id })
          .then(() => {
            api.toast('已删除')
            return this.load()
          })
          .catch(err => api.toast(err.message))
      }
    })
  }
})
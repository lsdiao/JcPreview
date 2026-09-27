const api = require('../../../utils/api.js')

Page({
  data: {
    loading: true,
    list: [],
    name: '',
    appid: '',
    path: '',
    logo: '',
    saving: false,
    uploading: false
  },

  onShow() {
    this.load()
  },

  load() {
    return api.call('app.list')
      .then(list => this.setData({ list: list || [], loading: false }))
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  onField(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  pickLogo() {
    if (this.data.uploading) return
    this.setData({ uploading: true })
    api.chooseImages(1)
      .then(files => {
        this.setData({ uploading: false })
        if (files && files.length) this.setData({ logo: files[0] })
      })
      .catch(err => {
        this.setData({ uploading: false })
        api.toast(err.message)
      })
  },

  add() {
    if (this.data.saving) return
    if (!String(this.data.name || '').trim()) { api.toast('请填写小程序名称'); return }
    if (!String(this.data.appid || '').trim()) { api.toast('请填写小程序 AppID'); return }

    this.setData({ saving: true })
    api.call('app.add', {
      name: this.data.name,
      appid: this.data.appid.trim(),
      path: this.data.path.trim(),
      logo: this.data.logo
    })
      .then(() => {
        this.setData({ saving: false, name: '', appid: '', path: '', logo: '' })
        api.toast('已添加')
        return this.load()
      })
      .catch(err => {
        this.setData({ saving: false })
        api.toast(err.message)
      })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    wx.showModal({
      title: '移除入口',
      content: '确认移除「' + name + '」的跳转入口？',
      confirmText: '移除',
      confirmColor: '#e0684f',
      success: r => {
        if (!r.confirm) return
        api.call('app.remove', { id })
          .then(() => {
            api.toast('已移除')
            return this.load()
          })
          .catch(err => api.toast(err.message))
      }
    })
  },

  copyAppid(e) {
    api.copy(e.currentTarget.dataset.appid)
  }
})
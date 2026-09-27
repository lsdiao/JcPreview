const api = require('../../../utils/api.js')

Page({
  data: {
    loading: true,
    saving: false,
    title: '专属顾问',
    name: '',
    qrcode: ''
  },

  onLoad() {
    this.load()
  },

  load() {
    return api.call('config.getConsultant')
      .then(data => {
        this.setData({
          title: data.title || '专属顾问',
          name: data.name || '',
          qrcode: data.qrcode || '',
          loading: false
        })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  /** 选择二维码图片 */
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFile = res.tempFiles[0]
        if (!tempFile) return
        // 上传到云存储
        api.uploadOne(tempFile.tempFilePath)
          .then(fileID => {
            this.setData({ qrcode: fileID })
            api.toast('上传成功')
          })
          .catch(err => api.toast(err.message))
      }
    })
  },

  save() {
    if (this.data.saving) return
    if (!this.data.qrcode) { api.toast('请上传顾问二维码'); return }

    this.setData({ saving: true })
    api.call('config.saveConsultant', {
      title: this.data.title,
      name: this.data.name,
      qrcode: this.data.qrcode
    })
      .then(() => {
        api.toast('保存成功')
        setTimeout(() => wx.navigateBack(), 500)
      })
      .catch(err => {
        api.toast(err.message)
      })
      .finally(() => {
        this.setData({ saving: false })
      })
  }
})

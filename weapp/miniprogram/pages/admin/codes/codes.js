const api = require('../../../utils/api.js')
const config = require('../../../config.js')

Page({
  data: {
    levels: config.levels,
    loading: true,
    list: [],
    stat: { total: 0, unused: 0, used: 0 },
    levelIndex: 0,
    remark: '',
    expireDays: '',
    creating: false,
    showQrcode: false,
    qrcodeLoading: false,
    qrcodeImg: '',
    qrcodeCode: '',
    qrcodeLevel: '',
    qrcodeErr: ''
  },

  onShow() {
    this.load()
  },

  load() {
    return api.call('code.list')
      .then(list => {
        const rows = (list || []).map(c => Object.assign({}, c, {
          levelText: config.levels[c.level] || '—',
          statusText: c.status === 'used' ? '已使用' : (c.status === 'void' ? '已作废' : '未使用'),
          createdText: api.fmtTime(c.createdAt),
          usedText: api.fmtTime(c.usedAt),
          expireText: c.expireAt ? api.fmtDate(c.expireAt) + ' 到期' : '长期有效'
        }))
        const stat = {
          total: rows.length,
          unused: rows.filter(r => r.status === 'unused').length,
          used: rows.filter(r => r.status === 'used').length
        }
        this.setData({ list: rows, stat, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  onLevel(e) {
    this.setData({ levelIndex: Number(e.detail.value) })
  },

  onRemark(e) {
    this.setData({ remark: e.detail.value })
  },

  onExpire(e) {
    this.setData({ expireDays: e.detail.value })
  },

  create() {
    if (this.data.creating) return
    this.setData({ creating: true })
    api.call('code.create', {
      level: this.data.levelIndex,
      remark: this.data.remark,
      expireDays: this.data.expireDays ? Number(this.data.expireDays) : 0
    })
      .then(res => {
        this.setData({ creating: false, remark: '', expireDays: '' })
        wx.showModal({
          title: '邀请码已生成',
          content: '邀请码：' + res.code + '\n等级：' + config.levels[this.data.levelIndex] + '\n一码一会员，请单独发给客户',
          confirmText: '复制',
          cancelText: '知道了',
          success: r => {
            if (r.confirm) api.copy(res.code)
          }
        })
        return this.load()
      })
      .catch(err => {
        this.setData({ creating: false })
        api.toast(err.message)
      })
  },

  copy(e) {
    const text = e.currentTarget.dataset.code || e.currentTarget.dataset.text
    api.copy(text)
  },

  /** 显示邀请码二维码 */
  showQrcode(e) {
    const id = e.currentTarget.dataset.id
    const code = e.currentTarget.dataset.code
    const item = this.data.list.find(x => x._id === id)
    const levelText = item ? item.levelText : ''

    this.setData({
      showQrcode: true,
      qrcodeLoading: true,
      qrcodeImg: '',
      qrcodeCode: code,
      qrcodeLevel: levelText,
      qrcodeErr: ''
    })

    api.call('code.qrcode', { id })
      .then(res => {
        this.setData({ qrcodeLoading: false, qrcodeImg: res.fileID })
      })
      .catch(err => {
        this.setData({
          qrcodeLoading: false,
          qrcodeImg: '',
          qrcodeErr: err.message || '生成失败'
        })
      })
  },

  hideQrcode() {
    this.setData({ showQrcode: false })
  },

  previewQrcode() {
    if (!this.data.qrcodeImg) return
    wx.previewImage({
      urls: [this.data.qrcodeImg],
      current: this.data.qrcodeImg
    })
  },

  voidCode(e) {
    const id = e.currentTarget.dataset.id
    const code = e.currentTarget.dataset.code
    wx.showModal({
      title: '作废邀请码',
      content: '作废后「' + code + '」不可再用于开通会员，确认？',
      confirmText: '作废',
      confirmColor: '#e0684f',
      success: r => {
        if (!r.confirm) return
        api.call('code.void', { id })
          .then(() => {
            api.toast('已作废')
            return this.load()
          })
          .catch(err => api.toast(err.message))
      }
    })
  }
})
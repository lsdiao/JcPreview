const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    levels: config.levels,
    me: null,
    loading: true,
    isMember: false,
    levelText: '',
    nickname: '',
    avatar: '',
    code: '',
    submitting: false
  },

  onShow() {
    this.load()
  },

  load(force) {
    return api.getMe(force)
      .then(me => {
        const m = me.member
        this.setData({
          me,
          loading: false,
          isMember: !!m,
          levelText: m ? config.levels[m.level] : '',
          nickname: (m && m.nickname) || this.data.nickname,
          avatar: (m && m.avatar) || this.data.avatar
        })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  onChooseAvatar(e) {
    const url = (e.detail && e.detail.avatarUrl) || ''
    if (!url) return
    // 先本地预览，再上传到云存储（临时路径不能直接存库）
    this.setData({ avatar: url })
    api.uploadOne(url)
      .then(fileID => this.setData({ avatar: fileID }))
      .catch(err => api.toast(err.message))
  },

  onNickInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onCodeInput(e) {
    this.setData({ code: String(e.detail.value || '').trim().toUpperCase() })
  },

  activate() {
    if (this.data.submitting) return
    const code = String(this.data.code || '').trim()
    if (!code) { api.toast('请输入邀请码'); return }

    this.setData({ submitting: true })
    api.call('member.activate', {
      code,
      nickname: this.data.nickname,
      avatar: this.data.avatar
    })
      .then(() => {
        api.clearMe()
        return this.load(true)
      })
      .then(() => {
        this.setData({ submitting: false })
        wx.showModal({
          title: '开通成功',
          content: '已绑定「' + this.data.levelText + '」，去产品库看看？',
          confirmText: '去产品库',
          cancelText: '稍后',
          success: r => {
            if (r.confirm) wx.switchTab({ url: '/pages/products/products' })
          }
        })
      })
      .catch(err => {
        this.setData({ submitting: false })
        api.toast(err.message)
      })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index/index' })
  },

  contact() {
    api.copy(config.brand.serviceWx, false)
    api.toast('客服微信已复制：' + config.brand.serviceWx)
  },

  copyOpenid() {
    const openid = (this.data.me && this.data.me.openid) || ''
    if (!openid) { api.toast('openid 获取中，请稍后'); return }
    api.copy(openid)
  },

  onShareAppMessage() {
    return {
      title: config.brand.name + ' · ' + config.brand.slogan,
      path: '/pages/home/home'
    }
  }
})
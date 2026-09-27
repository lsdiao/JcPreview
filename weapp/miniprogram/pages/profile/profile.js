const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    levels: config.levels,
    loading: true,
    saving: false,
    member: null,
    openid: '',
    nickname: '',
    avatar: '',
    phone: '',
    levelText: ''
  },

  onLoad() {
    this.load()
  },

  load() {
    return api.getMe()
      .then(me => {
        const m = me.member || {}
        const isActive = m.status === 'active'
        this.setData({
          member: m,
          openid: me.openid || '',
          nickname: m.nickname || '',
          avatar: m.avatar || '',
          phone: m.phone || '',
          levelText: isActive ? config.levels[m.level] : '',
          loading: false
        })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  /** 选择头像 */
  onChooseAvatar(e) {
    const url = (e.detail && e.detail.avatarUrl) || ''
    if (!url) return
    this.setData({ avatar: url })
    // 上传到云存储
    api.uploadOne(url)
      .then(fileID => this.setData({ avatar: fileID }))
      .catch(err => api.toast(err.message))
  },

  /** 输入昵称 */
  onNickInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  /** 输入手机号 */
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  /** 保存 */
  save() {
    if (this.data.saving) return
    const nickname = String(this.data.nickname || '').trim()
    const avatar = this.data.avatar || ''
    const phone = String(this.data.phone || '').trim()

    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      api.toast('请输入正确的手机号')
      return
    }

    this.setData({ saving: true })
    api.call('member.updateProfile', { nickname, avatar, phone })
      .then(member => {
        // 清除缓存，重新拉取
        api.clearMe()
        const app = getApp()
        if (app) {
          app.globalData.member = member || null
        }
        api.toast('保存成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 600)
      })
      .catch(err => {
        api.toast(err.message || '保存失败')
      })
      .finally(() => {
        this.setData({ saving: false })
      })
  }
})

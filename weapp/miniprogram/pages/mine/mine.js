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
    submitting: false,
    consultant: null,
    showConsultant: false
  },

  onShow() {
    this.load()
    this.loadConsultant()
  },

  load(force) {
    return api.getMe(force)
      .then(me => {
        const m = me.member
        this.setData({
          me,
          loading: false,
          isMember: !!(m && m.status === 'active'),
          levelText: m && m.status === 'active' ? config.levels[m.level] : '',
          nickname: (m && m.nickname) || this.data.nickname,
          avatar: (m && m.avatar) || this.data.avatar
        })
        // 检查全局是否有待填入的邀请码（扫码进入时带来的）
        const app = getApp()
        if (app && app.globalData && app.globalData.inviteCode && !m) {
          const inviteCode = app.globalData.inviteCode
          app.globalData.inviteCode = ''
          this.setData({ code: inviteCode })
          api.toast('已自动填入邀请码：' + inviteCode)
        }
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

  /** 扫一扫识别邀请码 */
  scanCode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode'],
      success: res => {
        const result = res.result || ''
        // 尝试从结果中提取邀请码（支持纯码和 inv=XXX 格式）
        let code = ''
        const match = result.match(/invite=([A-Z0-9]+)/i)
        if (match && match[1]) {
          code = match[1].toUpperCase()
        } else {
          // 纯文本，直接当邀请码用
          code = result.trim().toUpperCase()
        }
        if (code) {
          this.setData({ code })
          api.toast('已识别邀请码：' + code)
        } else {
          api.toast('未识别到有效邀请码')
        }
      },
      fail: () => {
        // 用户取消不提示
      }
    })
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

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  goBindPhone() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  loadConsultant() {
    return api.call('config.getConsultant')
      .then(data => {
        if (data && data.qrcode) {
          this.setData({ consultant: data })
        }
      })
      .catch(() => {})
  },

  showConsultant() {
    this.setData({ showConsultant: true })
  },

  hideConsultant() {
    this.setData({ showConsultant: false })
  },

  previewConsultantQrcode() {
    if (!this.data.consultant || !this.data.consultant.qrcode) return
    wx.previewImage({
      urls: [this.data.consultant.qrcode],
      current: this.data.consultant.qrcode
    })
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
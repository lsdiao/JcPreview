const api = require('../../utils/api.js')
const config = require('../../config.js')

Page({
  data: {
    brand: config.brand,
    loading: true,
    vote: null,
    opts: [],
    total: 0,
    picking: -1,
    submitting: false,
    hasVoted: false,
    isMember: true,
    current: 1
  },

  onLoad(options) {
    this.id = options.id
    this.load()
    api.getMe()
      .then(me => this.setData({ isMember: !!(me && me.member) }))
      .catch(() => {})
  },

  load() {
    return api.call('vote.detail', { id: this.id })
      .then(v => {
        this.apply(v)
        this.setData({ loading: false })
        wx.setNavigationBarTitle({ title: '新品投票' })
      })
      .catch(err => {
        this.setData({ loading: false })
        api.toast(err.message)
      })
  },

  /** 把云端返回的选项 → 带占比的展示结构 */
  apply(v) {
    const counts = v.counts || []
    const total = counts.reduce((a, b) => a + Number(b || 0), 0)
    const opts = (v.options || []).map((text, i) => ({
      text,
      count: Number(counts[i] || 0),
      percent: api.percent(counts[i] || 0, total)
    }))
    const hasVoted = v.myOption !== null && v.myOption !== undefined
    this.setData({ vote: v, opts, total, hasVoted, picking: hasVoted ? -1 : this.data.picking })
  },

  onSwiper(e) {
    this.setData({ current: e.detail.current + 1 })
  },

  pick(e) {
    const v = this.data.vote
    if (!v || !v.doing || this.data.hasVoted) return
    this.setData({ picking: Number(e.currentTarget.dataset.index) })
  },

  submit() {
    const v = this.data.vote
    if (!v) return
    if (!v.doing) { api.toast('投票已结束'); return }
    if (this.data.hasVoted) { api.toast('你已投过票，每人限投一票'); return }
    if (this.data.picking < 0) { api.toast('请先选择一个选项'); return }
    if (this.data.submitting) return

    this.setData({ submitting: true })
    api.call('vote.submit', { id: this.id, option: this.data.picking })
      .then(fresh => {
        this.setData({ submitting: false })
        this.apply(fresh)
        api.toast('投票成功，感谢参与')
      })
      .catch(err => {
        this.setData({ submitting: false })
        if (err.code === 'NEED_MEMBER') {
          wx.showModal({
            title: '仅限会员投票',
            content: '请输入邀请码开通会员后参与投票',
            confirmText: '去开通',
            cancelText: '稍后',
            success: r => {
              if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
            }
          })
          return
        }
        api.toast(err.message)
        if (err.code === 'VOTED') this.load()
      })
  },

  goActivate() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onShareAppMessage() {
    const v = this.data.vote || {}
    return {
      title: v.title || config.brand.name + ' · 新品投票',
      path: '/pages/vote-detail/vote-detail?id=' + this.id,
      imageUrl: (v.images && v.images[0]) || ''
    }
  },

  onShareTimeline() {
    const v = this.data.vote || {}
    return {
      title: v.title || config.brand.name + ' · 新品投票',
      query: 'id=' + this.id,
      imageUrl: (v.images && v.images[0]) || ''
    }
  }
})
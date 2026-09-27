const api = require('../../../utils/api.js')

Page({
  data: {
    openid: '',
    cells: [
      { key: 'contents', name: '内容管理', desc: '发布视频 / 图文 · 置顶 · 排序 · 上下架', icon: 'cuIcon-formfill', wide: true },
      { key: 'codes', name: '邀请码管理', desc: '生成 · 追溯 · 作废', icon: 'cuIcon-ticket', wide: false },
      { key: 'prices', name: '价格设置', desc: '三档会员价 · 上下架', icon: 'cuIcon-tag', wide: false },
      { key: 'votes', name: '投票管理', desc: '发起 · 截止 · 结果', icon: 'cuIcon-roundcheck', wide: false },
      { key: 'apps', name: '关联小程序', desc: '增减品牌直达入口', icon: 'cuIcon-apps', wide: false }
    ]
  },

  onShow() {
    api.getMe()
      .then(me => {
        // 非管理员不放行（真正的权限校验在云函数侧）
        if (!me.isAdmin) {
          api.toast('仅管理员可进入')
          wx.navigateBack({
            fail: () => wx.switchTab({ url: '/pages/mine/mine' })
          })
          return
        }
        this.setData({ openid: me.openid })
      })
      .catch(() => {})
  },

  open(e) {
    const key = e.currentTarget.dataset.key
    wx.navigateTo({ url: `/pages/admin/${key}/${key}` })
  }
})
/**
 * 云函数调用封装 + 全局会员状态缓存
 * 所有数据读写都通过云函数 api 统一入口完成，前端不直连数据库，
 * 保证「接口不返回非本等级价格」的保密要求。
 */

/**
 * 调用云函数 api
 * @param {string} action  动作名，如 'product.list'
 * @param {object} data    参数
 * @returns {Promise<any>} 成功时 resolve 业务数据，失败时 reject Error
 */
function call(action, data) {
  const payload = Object.assign({ action }, data || {})
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'api',
      data: payload,
      success: res => {
        const r = (res && res.result) || {}
        if (r.ok) {
          resolve(r.data)
          return
        }
        const err = new Error(r.msg || '请求失败')
        err.code = r.code || 'ERROR'
        reject(err)
      },
      fail: err => {
        console.error('[api] 调用云函数失败：', action, err)
        const e = new Error('云函数未部署或网络异常，请检查云开发配置')
        e.code = 'CLOUD_FAIL'
        reject(e)
      }
    })
  })
}

/* ---------- 当前登录用户 / 会员信息（带缓存） ---------- */
let me = null
let mePromise = null

/**
 * 获取当前用户信息：{ openid, member, isAdmin, levels }
 * @param {boolean} force 是否强制刷新
 */
function getMe(force) {
  if (!force && me) return Promise.resolve(me)
  if (!force && mePromise) return mePromise
  mePromise = call('member.me')
    .then(data => {
      me = data
      const app = getApp()
      if (app) {
        app.globalData.openid = data.openid
        app.globalData.member = data.member
        app.globalData.isAdmin = data.isAdmin
      }
      return me
    })
    .catch(err => {
      mePromise = null
      throw err
    })
  return mePromise
}

/** 清除缓存（开通会员、切换身份后调用） */
function clearMe() {
  me = null
  mePromise = null
}

/** 当前会员等级，非会员返回 -1 */
function level() {
  return me && me.member && me.member.status === 'active' ? me.member.level : -1
}

/* ---------- 通用工具 ---------- */

/** 轻提示 */
function toast(title, icon) {
  wx.showToast({ title: title, icon: icon || 'none', duration: 2000 })
}

/** 复制到剪贴板 */
function copy(text, tip) {
  wx.setClipboardData({
    data: text,
    success: () => {
      if (tip !== false) toast('已复制：' + text)
    }
  })
}

/** 上传单个文件到云存储，resolve fileID */
function uploadOne(filePath) {
  const m = /\.(\w+)$/.exec(filePath)
  const ext = m ? m[1] : 'png'
  const cloudPath = 'uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: res => resolve(res.fileID),
      fail: err => {
        console.error('[api] 上传失败：', err)
        reject(new Error('图片上传失败，请检查云存储权限'))
      }
    })
  })
}

/** 选择图片并上传到云存储，resolve fileID 数组 */
function chooseImages(count) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: count || 9,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const files = (res.tempFiles || []).map(f => f.tempFilePath)
        if (!files.length) { resolve([]); return }
        Promise.all(files.map(uploadOne)).then(resolve).catch(reject)
      },
      fail: err => {
        // 用户取消不算错误
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) { resolve(null); return }
        reject(err)
      }
    })
  })
}

/** 需要管理员权限时统一拦截 */
function needAdmin(isAdmin) {
  if (isAdmin) return true
  toast('仅管理员可进入')
  return false
}

/** 时间格式化：2026-09-24 10:00 */
function fmtTime(ts) {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 日期格式化：2026-09-30 */
function fmtDate(ts) {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 投票占比：1 位小数，避免出现 0% */
function percent(count, total) {
  if (!total) return 0
  return Math.round((count / total) * 1000) / 10
}

module.exports = {
  call,
  getMe,
  clearMe,
  level,
  toast,
  copy,
  uploadOne,
  chooseImages,
  needAdmin,
  fmtTime,
  fmtDate,
  percent
}
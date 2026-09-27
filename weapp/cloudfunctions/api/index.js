/**
 * 臻瓷汇 · 统一数据接口云函数
 *
 * 设计原则：
 * 1. 前端不直连数据库，所有读写经由本函数；
 * 2. 价格接口只返回「当前登录会员等级」对应的价格，不返回其他等级价格，防止被批量抓取；
 * 3. 管理类 action 统一校验 admins 集合中的 openid。
 *
 * 数据库集合：
 *   admins        管理员白名单            { openid, name, createdAt }
 *   members       会员                    { openid, nickname, avatar, level, status, code, createdAt }
 *   invite_codes  邀请码（一码一会员）     { code, level, remark, status, usedBy, usedByOpenid, usedAt, createdAt }
 *   contents      首页内容（视频/图文）    { type, title, cover, feedId, finderUserName, feedToken, duration, images, body, summary, pinned, sort, status }
 *   products      产品与分等级价格         { no, brand, name, spec, cat, unit, prices[3], desc, images, off, sort }
 *   mini_apps     关联的品牌官方小程序     { name, appid, path, logo, sort }
 *   votes         投票                    { title, intro, images, options[], counts[], voted, deadline, deadlineText, doing }
 *   vote_records  投票记录（每人一票）     _id = `${voteId}_${openid}`
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const C = {
  admins: 'admins',
  members: 'members',
  codes: 'invite_codes',
  contents: 'contents',
  products: 'products',
  apps: 'mini_apps',
  votes: 'votes',
  records: 'vote_records',
  configs: 'configs'
}

const ok = data => ({ ok: true, data: data === undefined ? null : data })
const fail = (code, msg) => ({ ok: false, code, msg })

/* ============================================================
   权限
   ============================================================ */
// 内置默认管理员 openid，无需写入数据库也拥有管理员权限
const DEFAULT_ADMINS = ['o9T9t3UgiMMJYa0cSzcMmBLR0ppM']

async function isAdmin(openid) {
  // 内置默认管理员直接放行
  if (DEFAULT_ADMINS.includes(openid)) return true

  const admins = db.collection(C.admins)
  const res = await admins.where({ openid }).count()
  if (res.total > 0) return true

  // 首次部署引导：管理员表为空时，第一个访问的用户自动成为管理员
  // 部署完成后请到云开发控制台 admins 集合核对，必要时删除该记录
  const all = await admins.count()
  if (all.total === 0) {
    await admins.add({ data: { openid, name: '首位管理员', createdAt: db.serverDate() } })
    console.log('[api] 已将首位访问用户设为管理员 openid =', openid)
    return true
  }
  return false
}

async function requireAdmin(openid) {
  const pass = await isAdmin(openid)
  if (!pass) throw Object.assign(new Error('仅管理员可操作'), { bizCode: 'NO_PERMISSION' })
}

/* ============================================================
   会员
   ============================================================ */
async function getMember(openid) {
  const res = await db.collection(C.members).where({ openid }).limit(1).get()
  return res.data[0] || null
}

/** 只暴露前端需要的字段，避免泄露内部信息 */
function publicMember(m) {
  if (!m) return null
  return {
    level: m.level,
    code: m.code,
    nickname: m.nickname || '',
    avatar: m.avatar || '',
    phone: m.phone || '',
    status: m.status || 'active',
    createdAt: m.createdAt
  }
}

async function memberMe(openid) {
  let member = await getMember(openid)
  // 首次访问：自动创建一条 pending 记录，用 openid 标识用户
  if (!member) {
    const now = db.serverDate()
    try {
      await db.collection(C.members).add({
        data: {
          openid,
          phone: '',
          nickname: '',
          avatar: '',
          level: -1,
          status: 'pending',
          code: '',
          createdAt: now,
          updatedAt: now
        }
      })
      member = await getMember(openid)
    } catch (e) {
      console.warn('[api] 自动创建会员记录失败：', e)
    }
  }
  const admin = await isAdmin(openid)
  // 管理员默认开通核心会员（最高等级）
  if (admin && (!member || member.status !== 'active')) {
    const now = db.serverDate()
    const adminData = {
      level: 2,
      status: 'active',
      code: 'ADMIN-' + openid.slice(-6).toUpperCase(),
      updatedAt: now
    }
    if (member) {
      await db.collection(C.members).doc(member._id).update({ data: adminData })
    } else {
      await db.collection(C.members).add({
        data: Object.assign({
          openid,
          phone: '',
          nickname: '',
          avatar: '',
          createdAt: now
        }, adminData)
      })
    }
    member = await getMember(openid)
    console.log('[api] 管理员已自动开通核心会员 openid =', openid)
  }
  return { openid, member: publicMember(member), isAdmin: admin }
}

/**
 * 手机号一键登录
 * 前端通过 button open-type="getPhoneNumber" 获取 code，传到云函数换取手机号
 */
async function memberLoginByPhone(openid, event) {
  const code = event.code || ''
  if (!code) return fail('CODE_EMPTY', '缺少手机号授权码')

  try {
    console.log('[api] 手机号登录，code =', code)
    const res = await cloud.openapi.phonenumber.getPhoneNumber({ code })
    console.log('[api] 手机号登录返回：', JSON.stringify(res))

    // 检查 errcode
    if (res && res.errcode && res.errcode !== 0) {
      return fail('PHONE_ERROR', '手机号获取失败：' + (res.errmsg || '错误码 ' + res.errcode))
    }

    const phoneInfo = res && res.phone_info
    if (!phoneInfo || !phoneInfo.phoneNumber) {
      return fail('PHONE_FAIL', '手机号获取失败，请重试')
    }
    const phone = phoneInfo.phoneNumber

    const exist = await getMember(openid)
    const now = db.serverDate()

    if (exist) {
      // 已有会员记录，更新手机号
      await db.collection(C.members).doc(exist._id).update({
        data: { phone, updatedAt: now }
      })
    } else {
      // 新用户，创建基础记录（未开通会员，level 待定，status 用 pending 表示已登录但未开通会员）
      await db.collection(C.members).add({
        data: {
          openid,
          phone,
          nickname: '',
          avatar: '',
          level: -1,
          status: 'pending',
          code: '',
          createdAt: now,
          updatedAt: now
        }
      })
    }

    const member = await getMember(openid)
    const admin = await isAdmin(openid)
    return ok({ openid, member: publicMember(member), isAdmin: admin })
  } catch (err) {
    console.error('[api] 手机号登录失败：', err)
    return fail('PHONE_ERROR', '手机号登录失败：' + (err.errMsg || err.message || '未知错误'))
  }
}

/**
 * 跳过手机号，直接用 openid 登录（开发测试 / 兜底用）
 * 没有手机号也能登录，member 状态为 pending（未开通会员）
 */
async function memberSkipLogin(openid) {
  const exist = await getMember(openid)
  if (!exist) {
    const now = db.serverDate()
    await db.collection(C.members).add({
      data: {
        openid,
        phone: '',
        nickname: '',
        avatar: '',
        level: -1,
        status: 'pending',
        code: '',
        createdAt: now,
        updatedAt: now
      }
    })
  }
  const member = await getMember(openid)
  const admin = await isAdmin(openid)
  return ok({ openid, member: publicMember(member), isAdmin: admin })
}

/**
 * 更新会员资料（昵称、头像、手机号）
 */
async function memberUpdateProfile(openid, event) {
  const member = await getMember(openid)
  if (!member) return fail('NOT_FOUND', '会员记录不存在')

  const data = { updatedAt: db.serverDate() }
  if (event.nickname !== undefined) data.nickname = String(event.nickname || '').trim()
  if (event.avatar !== undefined) data.avatar = String(event.avatar || '').trim()
  if (event.phone !== undefined) {
    const phone = String(event.phone || '').trim()
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return fail('PHONE_INVALID', '请输入正确的手机号')
    }
    data.phone = phone
  }

  await db.collection(C.members).doc(member._id).update({ data })
  const updated = await getMember(openid)
  return ok(publicMember(updated))
}

async function memberActivate(openid, event) {
  const code = String(event.code || '').trim().toUpperCase()
  if (!code) return fail('CODE_EMPTY', '请输入邀请码')

  const exist = await getMember(openid)
  if (exist && exist.status === 'active') return fail('ALREADY_MEMBER', '你已是会员，无需重复开通')

  const res = await db.collection(C.codes).where({ code }).limit(1).get()
  const item = res.data[0]
  if (!item) return fail('CODE_NOT_FOUND', '邀请码不存在，请核对后重试')
  if (item.status === 'void') return fail('CODE_VOID', '该邀请码已作废')
  if (item.status === 'used') return fail('CODE_USED', '该邀请码已被使用 · 一码一会员')
  if (item.expireAt && new Date(item.expireAt).getTime() < Date.now()) {
    return fail('CODE_EXPIRED', '该邀请码已过期')
  }

  const now = db.serverDate()
  // 条件更新：只有仍为 unused 时才标记，避免并发下同一码被开通两次
  const upd = await db.collection(C.codes)
    .where({ _id: item._id, status: 'unused' })
    .update({
      data: {
        status: 'used',
        usedBy: event.nickname || '会员',
        usedByOpenid: openid,
        usedAt: now,
        updatedAt: now
      }
    })
  if (upd.stats.updated === 0) return fail('CODE_USED', '该邀请码已被使用 · 一码一会员')

  const memberData = {
    openid,
    nickname: event.nickname || '',
    avatar: event.avatar || '',
    level: item.level,
    status: 'active',
    code: item.code,
    codeId: item._id,
    createdAt: now,
    updatedAt: now
  }
  if (exist) {
    await db.collection(C.members).doc(exist._id).update({ data: memberData })
  } else {
    await db.collection(C.members).add({ data: memberData })
  }

  return ok({ level: item.level, code: item.code })
}

/* ============================================================
   邀请码
   ============================================================ */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

async function codeList(openid) {
  await requireAdmin(openid)
  const res = await db.collection(C.codes).orderBy('createdAt', 'desc').limit(200).get()
  return res.data
}

async function codeCreate(openid, event) {
  await requireAdmin(openid)
  const level = Number(event.level)
  if (![0, 1, 2].includes(level)) return fail('BAD_LEVEL', '等级不合法')

  let code = ''
  for (let i = 0; i < 10; i++) {
    code = Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    const dup = await db.collection(C.codes).where({ code }).count()
    if (dup.total === 0) break
  }

  const data = {
    code,
    level,
    remark: (event.remark || '').trim(),
    status: 'unused',
    usedBy: '',
    usedByOpenid: '',
    usedAt: null,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
  if (event.expireDays) {
    data.expireAt = new Date(Date.now() + Number(event.expireDays) * 86400000)
  }
  const res = await db.collection(C.codes).add({ data })
  return ok({ _id: res._id, code })
}

async function codeVoid(openid, event) {
  await requireAdmin(openid)
  await db.collection(C.codes).doc(event.id).update({
    data: { status: 'void', updatedAt: db.serverDate() }
  })
  return ok()
}

/**
 * 生成邀请码的小程序码
 * 扫码后打开小程序并带入邀请码，可直接开通
 */
async function codeQrcode(openid, event) {
  await requireAdmin(openid)
  const codeId = event.id || ''
  if (!codeId) return fail('ID_EMPTY', '缺少邀请码 ID')

  // 先查邀请码是否存在
  const codeRes = await db.collection(C.codes).doc(codeId).get()
  if (!codeRes.data) return fail('NOT_FOUND', '邀请码不存在')
  const code = codeRes.data.code

  try {
    // 调用微信接口生成小程序码（无数量限制版本）
    // scene 里放邀请码，页面路径为首页
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: 'invite=' + code,
      page: 'pages/home/home',
      width: 280,
      autoColor: false,
      lineColor: { r: 201, g: 162, b: 107 },
      isHyaline: false
    })

    // 上传到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: 'qrcodes/' + code + '.png',
      fileContent: result.buffer
    })

    return ok({ fileID: uploadRes.fileID, code })
  } catch (err) {
    console.error('[api] 生成小程序码失败：', err)
    // 失败时返回错误信息，前端可以降级显示邀请码文本
    return fail('QR_FAIL', '小程序码生成失败：' + (err.errMsg || err.message || '未知错误'))
  }
}

/* ============================================================
   配置（顾问二维码等）
   ============================================================ */
async function configGetConsultant() {
  try {
    const res = await db.collection(C.configs).where({ key: 'consultant' }).limit(1).get()
    const item = res.data[0]
    return item ? item.value : { qrcode: '', name: '', title: '专属顾问' }
  } catch (e) {
    // 集合不存在时返回默认值
    return { qrcode: '', name: '', title: '专属顾问' }
  }
}

async function configSaveConsultant(openid, event) {
  await requireAdmin(openid)
  const value = {
    qrcode: String(event.qrcode || '').trim(),
    name: String(event.name || '').trim(),
    title: String(event.title || '专属顾问').trim()
  }
  try {
    const exist = await db.collection(C.configs).where({ key: 'consultant' }).limit(1).get()
    if (exist.data.length) {
      await db.collection(C.configs).doc(exist.data[0]._id).update({
        data: { value, updatedAt: db.serverDate() }
      })
    } else {
      await db.collection(C.configs).add({
        data: { key: 'consultant', value, createdAt: db.serverDate(), updatedAt: db.serverDate() }
      })
    }
  } catch (e) {
    // 集合不存在时，先创建第一条记录（云开发会自动创建集合）
    await db.collection(C.configs).add({
      data: { key: 'consultant', value, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    })
  }
  return ok(value)
}

/* ============================================================
   关联小程序
   ============================================================ */
async function appList() {
  const res = await db.collection(C.apps).orderBy('sort', 'asc').limit(50).get()
  return res.data
}

async function appAdd(openid, event) {
  await requireAdmin(openid)
  const name = (event.name || '').trim()
  if (!name) return fail('NAME_EMPTY', '请填写小程序名称')
  const data = {
    name,
    appid: (event.appid || '').trim(),
    path: (event.path || '').trim(),
    logo: (event.logo || '').trim(),
    sort: Date.now(),
    createdAt: db.serverDate()
  }
  await db.collection(C.apps).add({ data })
  return ok()
}

async function appRemove(openid, event) {
  await requireAdmin(openid)
  await db.collection(C.apps).doc(event.id).remove()
  return ok()
}

/* ============================================================
   产品与价格
   ============================================================ */
/** 会员视角：只带自己等级的价格 */
function memberProduct(p, lv) {
  return {
    _id: p._id,
    no: p.no,
    brand: p.brand,
    name: p.name,
    spec: p.spec,
    cat: p.cat,
    unit: p.unit,
    desc: p.desc,
    images: p.images || [],
    off: !!p.off,
    price: lv >= 0 && p.prices ? p.prices[lv] : null
  }
}

async function productList(openid, event) {
  const member = await getMember(openid)
  const lv = member && member.status !== 'disabled' ? member.level : -1
  const where = event.includeOff ? {} : { off: _.neq(true) }
  const res = await db.collection(C.products).where(where).orderBy('sort', 'desc').limit(200).get()
  return { items: res.data.map(p => memberProduct(p, lv)), level: lv }
}

async function productByNo(openid, event) {
  const no = String(event.no || '').trim().toUpperCase()
  if (!no) return fail('NO_EMPTY', '请输入产品编号')
  const member = await getMember(openid)
  const lv = member && member.status !== 'disabled' ? member.level : -1
  if (lv < 0) return fail('NEED_MEMBER', '请先开通会员')

  const res = await db.collection(C.products).where({ no }).limit(1).get()
  const p = res.data[0]
  if (!p) return fail('NOT_FOUND', '未找到该产品，请核对编号')
  if (p.off) return fail('OFF_SHELF', '该产品已下架')
  return { product: memberProduct(p, lv), level: lv }
}

async function productAdminList(openid) {
  await requireAdmin(openid)
  const res = await db.collection(C.products).orderBy('sort', 'desc').limit(200).get()
  return res.data
}

/**
 * 产品详情（管理员）
 */
async function productDetail(openid, event) {
  await requireAdmin(openid)
  if (!event.id) return fail('ID_EMPTY', '缺少产品 ID')
  const res = await db.collection(C.products).doc(event.id).get()
  return res.data || null
}

async function productSave(openid, event) {
  await requireAdmin(openid)
  const d = event.data || {}
  const no = String(d.no || '').trim().toUpperCase()
  if (!no) return fail('NO_EMPTY', '请填写产品编号')

  const dup = await db.collection(C.products).where({ no }).get()
  const conflict = dup.data.some(x => x._id !== d._id)
  if (conflict) return fail('NO_DUP', '产品编号已存在：' + no)

  const prices = (d.prices || [0, 0, 0]).map(v => Number(v) || 0)
  const data = {
    no,
    brand: d.brand || '',
    name: d.name || '',
    spec: d.spec || '',
    cat: d.cat || '',
    unit: d.unit || '元/片',
    desc: d.desc || '',
    images: d.images || [],
    prices,
    off: !!d.off,
    sort: typeof d.sort === 'number' ? d.sort : Date.now(),
    updatedAt: db.serverDate()
  }

  if (d._id) {
    await db.collection(C.products).doc(d._id).update({ data })
    return ok({ _id: d._id })
  }
  data.createdAt = db.serverDate()
  const res = await db.collection(C.products).add({ data })
  return ok({ _id: res._id })
}

async function productRemove(openid, event) {
  await requireAdmin(openid)
  await db.collection(C.products).doc(event.id).remove()
  return ok()
}

async function productToggle(openid, event) {
  await requireAdmin(openid)
  const res = await db.collection(C.products).doc(event.id).get()
  await db.collection(C.products).doc(event.id).update({
    data: { off: !res.data.off, updatedAt: db.serverDate() }
  })
  return ok({ off: !res.data.off })
}

async function productSavePrices(openid, event) {
  await requireAdmin(openid)
  const list = event.list || []
  await Promise.all(list.map(item => {
    const prices = (item.prices || []).map(v => Number(v) || 0)
    return db.collection(C.products).doc(item._id).update({
      data: { prices, updatedAt: db.serverDate() }
    })
  }))
  return ok({ count: list.length })
}

/* ============================================================
   首页内容（视频 / 图文）
   ============================================================ */
function publicContent(c) {
  return {
    _id: c._id,
    type: c.type,
    title: c.title,
    cover: c.cover,
    summary: c.summary || '',
    duration: c.duration || '',
    source: c.source || '视频号',
    pinned: !!c.pinned,
    sort: c.sort || 0,
    status: c.status || 'on',
    // 视频号播放参数
    feedId: c.feedId || '',
    finderUserName: c.finderUserName || '',
    feedToken: c.feedToken || '',
    images: c.images || [],
    body: c.body || '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }
}

async function contentList(openid, event) {
  const admin = event.admin ? await isAdmin(openid) : false
  const where = admin ? {} : { status: _.neq('off') }
  // 单字段排序 + 内存排序，避免依赖组合索引
  const res = await db.collection(C.contents)
    .where(where)
    .orderBy('sort', 'asc')
    .limit(100)
    .get()
  const rows = res.data.slice().sort((a, b) => {
    const pa = a.pinned ? 0 : 1
    const pb = b.pinned ? 0 : 1
    if (pa !== pb) return pa - pb
    return (a.sort || 0) - (b.sort || 0)
  })
  return rows.map(publicContent)
}

async function contentSave(openid, event) {
  await requireAdmin(openid)
  const d = event.data || {}
  if (!d.title) return fail('TITLE_EMPTY', '请填写标题')
  if (d.type === 'video' && !d.feedId) return fail('FEED_EMPTY', '视频内容需填写视频号 feedId')
  if (d.type === 'article' && !(d.images || []).length && !d.body) {
    return fail('ARTICLE_EMPTY', '图文内容需上传图片或填写正文')
  }

  const data = {
    type: d.type === 'article' ? 'article' : 'video',
    title: d.title,
    cover: d.cover || (d.images && d.images[0]) || '',
    summary: d.summary || '',
    duration: d.duration || '',
    source: d.source || '视频号',
    feedId: d.feedId || '',
    finderUserName: d.finderUserName || '',
    feedToken: d.feedToken || '',
    images: d.images || [],
    body: d.body || '',
    pinned: !!d.pinned,
    sort: typeof d.sort === 'number' ? d.sort : Date.now(),
    status: d.status === 'off' ? 'off' : 'on',
    updatedAt: db.serverDate()
  }

  if (d._id) {
    await db.collection(C.contents).doc(d._id).update({ data })
    return ok({ _id: d._id })
  }
  data.createdAt = db.serverDate()
  const res = await db.collection(C.contents).add({ data })
  return ok({ _id: res._id })
}

async function contentRemove(openid, event) {
  await requireAdmin(openid)
  await db.collection(C.contents).doc(event.id).remove()
  return ok()
}

/* ============================================================
   投票
   ============================================================ */
async function myVoteMap(openid, voteIds) {
  if (!voteIds.length) return {}
  const res = await db.collection(C.records)
    .where({ openid, voteId: _.in(voteIds) })
    .limit(200)
    .get()
  const map = {}
  res.data.forEach(r => { map[r.voteId] = r.option })
  return map
}

function publicVote(v, myOption) {
  return {
    _id: v._id,
    title: v.title,
    intro: v.intro,
    images: v.images || [],
    options: v.options || [],
    counts: v.counts || [],
    voted: v.voted || 0,
    deadline: v.deadline || '',
    deadlineText: v.deadlineText || '',
    doing: !!v.doing,
    myOption: myOption === undefined ? null : myOption
  }
}

async function voteList(openid) {
  const res = await db.collection(C.votes).orderBy('createdAt', 'desc').limit(50).get()
  const map = await myVoteMap(openid, res.data.map(v => v._id))
  return res.data.map(v => publicVote(v, map[v._id]))
}

async function voteDetail(openid, event) {
  const res = await db.collection(C.votes).doc(event.id).get()
  const rec = await db.collection(C.records).where({ openid, voteId: event.id }).limit(1).get()
  const myOption = rec.data.length ? rec.data[0].option : undefined
  return publicVote(res.data, myOption)
}

async function voteSubmit(openid, event) {
  const member = await getMember(openid)
  if (!member || member.status !== 'active') return fail('NEED_MEMBER', '投票仅限会员，请输入邀请码开通')

  const option = Number(event.option)
  const vRes = await db.collection(C.votes).doc(event.id).get()
  const v = vRes.data
  if (!v.doing) return fail('VOTE_CLOSED', '投票已结束')
  if (!(option >= 0 && option < (v.options || []).length)) return fail('BAD_OPTION', '选项不合法')

  // 用 _id = voteId_openid 保证「每人一票」在并发下也成立
  const recId = `${event.id}_${openid}`
  try {
    await db.collection(C.records).add({
      data: { _id: recId, voteId: event.id, openid, option, createdAt: db.serverDate() }
    })
  } catch (e) {
    return fail('VOTED', '你已投过票，每人限投一票')
  }

  const inc = {}
  inc.voted = _.inc(1)
  inc[`counts.${option}`] = _.inc(1)
  await db.collection(C.votes).doc(event.id).update({ data: inc })

  const fresh = await db.collection(C.votes).doc(event.id).get()
  return publicVote(fresh.data, option)
}

async function voteCreate(openid, event) {
  await requireAdmin(openid)
  const d = event.data || {}
  const options = (d.options || []).map(o => String(o).trim()).filter(Boolean)
  if (!d.title) return fail('TITLE_EMPTY', '请填写投票标题')
  if (options.length < 2) return fail('OPTION_FEW', '至少需要 2 个选项')

  const data = {
    title: d.title,
    intro: d.intro || '新品意向征集中，欢迎投票。',
    images: d.images || [],
    options,
    counts: options.map(() => 0),
    voted: 0,
    deadline: d.deadline || '',
    deadlineText: d.deadline ? `截止 ${d.deadline} 23:59` : '长期有效',
    doing: true,
    createdAt: db.serverDate()
  }
  const res = await db.collection(C.votes).add({ data })
  return ok({ _id: res._id })
}

async function voteClose(openid, event) {
  await requireAdmin(openid)
  const today = new Date()
  const p = n => String(n).padStart(2, '0')
  await db.collection(C.votes).doc(event.id).update({
    data: {
      doing: false,
      deadlineText: `已于 ${today.getFullYear()}/${p(today.getMonth() + 1)}/${p(today.getDate())} 提前截止`
    }
  })
  return ok()
}

async function voteRemove(openid, event) {
  await requireAdmin(openid)
  await db.collection(C.votes).doc(event.id).remove()
  return ok()
}

/** 投票明细：谁投了什么（仅管理员） */
async function voteRecords(openid, event) {
  await requireAdmin(openid)
  const res = await db.collection(C.records)
    .where({ voteId: event.id })
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get()
  return res.data
}

/* ============================================================
   路由
   ============================================================ */
const ROUTES = {
  'member.me': (openid) => memberMe(openid),
  'member.loginByPhone': memberLoginByPhone,
  'member.skipLogin': (openid) => memberSkipLogin(openid),
  'member.updateProfile': memberUpdateProfile,
  'member.activate': memberActivate,

  'code.list': codeList,
  'code.create': codeCreate,
  'code.void': codeVoid,
  'code.qrcode': codeQrcode,

  'app.list': (openid) => appList(),
  'app.add': appAdd,
  'app.remove': appRemove,

  'config.getConsultant': () => configGetConsultant(),
  'config.saveConsultant': configSaveConsultant,

  'product.list': productList,
  'product.byNo': productByNo,
  'product.adminList': productAdminList,
  'product.detail': productDetail,
  'product.save': productSave,
  'product.remove': productRemove,
  'product.toggle': productToggle,
  'product.savePrices': productSavePrices,

  'content.list': contentList,
  'content.save': contentSave,
  'content.remove': contentRemove,

  'vote.list': (openid) => voteList(openid),
  'vote.detail': voteDetail,
  'vote.submit': voteSubmit,
  'vote.create': voteCreate,
  'vote.close': voteClose,
  'vote.remove': voteRemove,
  'vote.records': voteRecords
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event && event.action
  const handler = ROUTES[action]
  if (!handler) return fail('NO_ACTION', '未知的 action：' + action)

  try {
    const result = await handler(OPENID, event)
    // 路由函数直接 return ok()/fail() 的，原样返回
    if (result && typeof result === 'object' && typeof result.ok === 'boolean') return result
    return ok(result)
  } catch (err) {
    console.error('[api] action 执行失败：', action, err)
    if (err && err.bizCode) return fail(err.bizCode, err.message)
    return fail('EXCEPTION', err && err.message ? err.message : '服务异常')
  }
}
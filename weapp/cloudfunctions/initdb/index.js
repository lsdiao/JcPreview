/**
 * 一键初始化数据库
 * 首次部署时在云开发控制台「云函数 → initdb → 测试」里执行一次（无需参数）。
 *
 * 行为：
 *   1. 创建全部集合（已存在则跳过）；
 *   2. 空集合写入演示数据，已有数据的集合默认不动；
 *   3. 传 { reset: true } 可清空「产品 / 内容 / 投票 / 关联小程序」并重新写入演示数据
 *      （会员、邀请码、投票记录不会被清空，避免误删真实数据）
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const COLLECTIONS = [
  'admins',
  'members',
  'invite_codes',
  'contents',
  'products',
  'mini_apps',
  'votes',
  'vote_records'
]

/** 演示图片：部署时建议替换为云存储 fileID 或你自己的图床地址 */
const IMG = (prompt, size) =>
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent(prompt) +
  '&image_size=' +
  (size || 'square')

const SEED = {
  products: [
    {
      no: 'A-8001', brand: '马可波罗', name: '通体大理石瓷砖', spec: '800×800mm', cat: '大理石纹',
      unit: '元/片', prices: [58, 49, 42], off: false, sort: 1,
      desc: '通体坯体，表里如一，可深加工拉槽倒角。一石多面随机纹理，客厅地砖主推款。整箱 3 片，约 0.64㎡/片。',
      images: [IMG('polished marble look porcelain tile with white grey veining on luxury living room floor, interior photography, elegant')]
    },
    {
      no: 'A-8002', brand: '东鹏', name: '柔光肌肤砖', spec: '600×1200mm', cat: '柔光素色',
      unit: '元/片', prices: [88, 76, 66], off: false, sort: 2,
      desc: '25° 柔光面，触感细腻不反光，奶油风/侘寂风适配，墙地通用。抗污釉面，好打理。',
      images: [IMG('soft matte beige porcelain tiles on modern bathroom wall and floor, warm cozy light, minimalist interior photography')]
    },
    {
      no: 'A-8003', brand: '诺贝尔', name: '瓷抛砖 · 鱼肚白', spec: '750×1500mm', cat: '大理石纹',
      unit: '元/片', prices: [128, 112, 98], off: false, sort: 3,
      desc: '鱼肚白经典纹路，瓷抛工艺高耐磨，大规格留缝少，客餐厅通铺显大。',
      images: [IMG('large format statuario white porcelain slab tiles in elegant bright living room, luxury interior photography')]
    },
    {
      no: 'B-9001', brand: '蒙娜丽莎', name: '连纹岩板大板', spec: '900×1800mm', cat: '岩板大板',
      unit: '元/片', prices: [268, 238, 208], off: false, sort: 4,
      desc: '连纹设计可无限拼接，电视背景墙首选。岩板材质耐高温抗刮擦，可上墙可铺地。',
      images: [IMG('large format grey marble sintered stone slab wall in modern luxury living room with tv, interior photography')]
    },
    {
      no: 'B-9002', brand: '冠珠', name: '微水泥仿古砖', spec: '600×600mm', cat: '仿古木纹',
      unit: '元/片', prices: [42, 36, 31], off: false, sort: 5,
      desc: '微水泥质感，工业风/极简风通用，防滑 R10，厨卫阳台均可铺。',
      images: [IMG('cement look grey porcelain tiles in industrial minimalist bathroom, concrete texture, interior photography')]
    },
    {
      no: 'B-9003', brand: '欧神诺', name: '北欧木纹砖', spec: '200×1200mm', cat: '仿古木纹',
      unit: '元/片', prices: [35, 30, 26], off: false, sort: 6,
      desc: '橡木纹理逼真，脚感温润，卧室书房适用，防水防潮不怕地暖。',
      images: [IMG('wood look porcelain plank tiles floor in cozy scandinavian bedroom, natural oak texture, warm light, interior photography')]
    },
    {
      no: 'A-8099', brand: '工程尾货', name: '旧款抛光砖', spec: '600×600mm', cat: '大理石纹',
      unit: '元/片', prices: [28, 24, 20], off: true, sort: 99,
      desc: '已停产下架，仅作演示下架状态使用。',
      images: []
    }
  ],

  contents: [
    {
      type: 'video', pinned: true, sort: 1, status: 'on',
      title: '3 分钟了解这个小程序：查价、选砖、新品投票',
      cover: IMG('elegant tile showroom interior with large porcelain tile displays on walls, warm spot lighting, luxury retail space, photorealistic', 'landscape_16_9'),
      summary: '固定置顶的介绍视频，引用自视频号「臻瓷汇」。',
      duration: '03:12', source: '视频号',
      // 【配置】视频号助手 → 动态管理 复制 feedId；首页 复制 finderUserName
      feedId: '', finderUserName: '', feedToken: '',
      images: [], body: ''
    },
    {
      type: 'video', pinned: false, sort: 2, status: 'on',
      title: '展厅实拍：750×1500 大板通铺效果',
      cover: IMG('spacious living room with large format marble look porcelain tiles floor, modern luxury interior, natural light, photorealistic', 'landscape_16_9'),
      summary: '大板通铺的留缝与整体观感实拍。',
      duration: '01:48', source: '视频号',
      feedId: '', finderUserName: '', feedToken: '',
      images: [], body: ''
    },
    {
      type: 'article', pinned: false, sort: 3, status: 'on',
      title: '选砖指南：柔光砖美缝配色怎么选',
      cover: IMG('professional tiler installing large beige porcelain floor tiles in bright modern room, close up detail, photorealistic', 'landscape_16_9'),
      summary: '同色系美缝显大，跳色美缝显个性，附 3 组实拍对比。',
      source: '臻瓷汇',
      images: [
        IMG('beige porcelain floor tiles with matching grout lines in bright living room, close up detail, interior photography', 'landscape_16_9'),
        IMG('light grey porcelain tiles with contrasting dark grout in modern bathroom, interior photography', 'landscape_16_9')
      ],
      body: '柔光砖的质感靠光泽，配色靠美缝。\n\n一、同色系美缝：整体感最强，空间显大，适合奶油风、侘寂风。\n\n二、浅砖深缝：勾出砖的轮廓，适合复古、法式。\n\n三、深砖浅缝：慎用，容易显脏。\n\n选色建议拿实物小样在自然光下对比，瓷砖店灯光会影响判断。',
      feedId: '', finderUserName: '', feedToken: ''
    },
    {
      type: 'article', pinned: false, sort: 4, status: 'on',
      title: '仓库直拍：瓷砖打包发货与破损补发流程',
      cover: IMG('warehouse with stacks of porcelain tile boxes on wooden pallets, worker packing, dramatic daylight, photorealistic', 'landscape_16_9'),
      summary: '木托 + 护角 + 缠绕膜，破损补发怎么走流程。',
      source: '臻瓷汇',
      images: [
        IMG('warehouse with stacks of porcelain tile boxes on wooden pallets, worker packing, dramatic daylight, photorealistic', 'landscape_16_9')
      ],
      body: '发货前逐箱抽检，木托加固、四角护角、整体缠绕膜。\n\n到货请当面清点并拍照留存，破损件 48 小时内反馈即可补发。',
      feedId: '', finderUserName: '', feedToken: ''
    }
  ],

  mini_apps: [
    { name: '马可波罗瓷砖官方', appid: 'wx8f3a1c92e6b40001', path: '', logo: '', sort: 1 },
    { name: '东鹏瓷砖官方商城', appid: 'wx8f3a1c92e6b40002', path: '', logo: '', sort: 2 },
    { name: '诺贝尔瓷砖', appid: 'wx8f3a1c92e6b40003', path: '', logo: '', sort: 3 },
    { name: '蒙娜丽莎官方', appid: 'wx8f3a1c92e6b40004', path: '', logo: '', sort: 4 }
  ],

  invite_codes: [
    { code: 'PT8A0001', level: 0, remark: '演示邀请码 · 普通会员', status: 'unused', usedBy: '', usedByOpenid: '', usedAt: null },
    { code: 'GJ8B0002', level: 1, remark: '演示邀请码 · 高级会员', status: 'unused', usedBy: '', usedByOpenid: '', usedAt: null },
    { code: 'HX8C0003', level: 2, remark: '演示邀请码 · 核心会员', status: 'unused', usedBy: '', usedByOpenid: '', usedAt: null }
  ],

  votes: [
    {
      title: '新品「柔光微水泥瓷砖」是否上架？',
      intro: '750×1500mm 柔光微水泥砖，侘寂风/奶油风适配，预计普通会员价 ¥98/片起，上市前想听听大家的拿货意向。',
      images: [IMG('micro cement texture large porcelain tiles in minimalist warm bathroom, soft neutral tones, interior design photography', 'landscape_16_9')],
      options: ['会上架，期待', '观望，看价格再定', '不感兴趣'],
      counts: [39, 33, 14], voted: 86,
      deadline: '', deadlineText: '截止 9 月 30 日 23:59', doing: true
    },
    {
      title: '新品「900×1800 连纹岩板」上架意向',
      intro: '连纹岩板大板，电视背景墙方向。投票已结束，结果供选品参考。',
      images: [IMG('seamless bookmatched marble sintered stone slab wall in luxury hotel lobby, elegant interior photography', 'landscape_16_9')],
      options: ['会上架，期待', '观望，看价格再定', '不感兴趣'],
      counts: [72, 38, 14], voted: 124,
      deadline: '', deadlineText: '已于 9 月 15 日截止', doing: false
    }
  ]
}

/** 需要 reset 时才会清空的集合（不动会员与邀请码） */
const RESETTABLE = ['products', 'contents', 'mini_apps', 'votes']

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
    return 'created'
  } catch (e) {
    // -501001 / 已经存在
    return 'exists'
  }
}

async function isEmpty(name) {
  const res = await db.collection(name).count()
  return res.total === 0
}

async function clear(name) {
  // 云开发单次最多删 1000 条，循环删除
  for (let i = 0; i < 20; i++) {
    const res = await db.collection(name).limit(100).get()
    if (!res.data.length) break
    await Promise.all(res.data.map(d => db.collection(name).doc(d._id).remove()))
  }
}

exports.main = async (event) => {
  const reset = !!(event && event.reset)
  const log = []

  for (const name of COLLECTIONS) {
    log.push(`${name}: ${await ensureCollection(name)}`)
  }

  if (reset) {
    for (const name of RESETTABLE) {
      await clear(name)
      log.push(`${name}: 已清空`)
    }
  }

  for (const name of Object.keys(SEED)) {
    if (!(await isEmpty(name))) {
      log.push(`${name}: 已有数据，跳过`)
      continue
    }
    const now = db.serverDate()
    const rows = SEED[name].map(row => Object.assign({ createdAt: now, updatedAt: now }, row))
    for (const row of rows) {
      await db.collection(name).add({ data: row })
    }
    log.push(`${name}: 写入 ${rows.length} 条`)
  }

  return {
    ok: true,
    reset,
    detail: log,
    tip: reset ? '已重置演示数据（会员与邀请码保留）' : '初始化完成，重复执行不会覆盖已有数据'
  }
}
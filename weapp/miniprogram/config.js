/**
 * 全局配置 —— 部署前请按说明修改
 * 详细步骤见项目根目录《配置说明.md》
 */
module.exports = {
  // 云开发环境 ID，例如 'zhenci-tile-3g8xxxxx'。
  // 留空则使用小程序默认环境（只有一个环境时可用）。
  envId: '',

  // 品牌信息
  brand: {
    name: '臻瓷汇',
    en: 'INVITATION ONLY',
    slogan: '邀请制会员服务',
    serviceWx: 'zhenci-kefu', // 客服微信号
    version: 'v1.0.0'
  },

  // 会员等级名称，下标即 level，与云数据库 member.level / invite_codes.level 对应
  levels: ['普通会员', '高级会员', '核心会员'],
  levelsShort: ['普通', '高级', '核心'],

  // 首页内容类型
  contentType: {
    video: '视频',
    article: '图文'
  }
}
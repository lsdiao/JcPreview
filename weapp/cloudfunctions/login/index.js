/**
 * 获取 openid 云函数
 * 说明：项目主流程使用 api 云函数内的 cloud.getWXContext() 获取 openid，
 * 此函数保留用于调试、以及在需要单独取 openid 时调用。
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  }
}
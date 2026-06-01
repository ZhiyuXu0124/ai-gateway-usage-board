// 本机端到端测试 sendDailyReport（零副作用）
// - 拦截 webhook：不真正发卡片到群，但打印卡片摘要供检查
// - 多维表格：走真实写入以验证「人员」字段，记录 record_id，跑完即删
import 'dotenv/config'
import { setupNewApiRoutes } from '../server/newapi.js'
import { setupFeishuNotify } from '../server/feishu-notify.js'

const TEST_DATE = process.argv[2] || '2026-05-31'

// 凭据从 .env 读取（FEISHU_APP_ID / FEISHU_APP_SECRET /
// FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID）
const APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN
const TABLE_ID = process.env.FEISHU_BITABLE_TABLE_ID

if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET || !APP_TOKEN || !TABLE_ID) {
  console.error('缺少飞书多维表格配置，请在 .env 中设置 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID')
  process.exit(1)
}

// ---- 拦截 fetch ----
const realFetch = globalThis.fetch
const createdRecordIds = []
let capturedCard = null

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url)

  // webhook：假装成功，捕获卡片
  if (u.includes('/bot/v2/hook/')) {
    try { capturedCard = JSON.parse(opts.body) } catch {}
    console.log('🔕 [拦截] webhook 卡片发送（未真正推送到群）')
    return new Response(JSON.stringify({ code: 0, msg: 'success(intercepted)' }), { status: 200 })
  }

  // 多维表格写入：真实调用，记录 record_id 以便清理
  const resp = await realFetch(url, opts)
  if (u.includes('/records/batch_create')) {
    const clone = resp.clone()
    const data = await clone.json()
    const recs = data?.data?.records || []
    for (const r of recs) if (r.record_id) createdRecordIds.push(r.record_id)
  }
  return resp
}

// stub app（newapi 只调用 app.get / app.use 注册路由，测试不需要 HTTP）
const noopApp = { get() {}, post() {}, put() {}, delete() {}, use() {} }

const deps = setupNewApiRoutes(noopApp)
const { sendDailyReport } = setupFeishuNotify(deps)

console.log(`\n===== 测试 sendDailyReport(${TEST_DATE}) =====\n`)
const result = await sendDailyReport(TEST_DATE)

console.log('\n===== 返回结果 =====')
console.log(JSON.stringify(result, null, 2))

// 输出捕获到的卡片里的 @ 提及与令牌数
if (capturedCard) {
  const cardStr = JSON.stringify(capturedCard)
  const ats = [...cardStr.matchAll(/<at user_id="(ou_[a-z0-9]+)">([^<]+)<\/at>/g)].map(m => m[2])
  console.log('\n===== 卡片检查 =====')
  console.log('卡片字节数:', cardStr.length)
  console.log('@提及人员:', ats.length ? ats.join(', ') : '(无)')
}

// 清理测试写入的多维表格记录
if (createdRecordIds.length) {
  console.log(`\n===== 清理 ${createdRecordIds.length} 条测试记录 =====`)
  const token = await (async () => {
    const r = await realFetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: process.env.FEISHU_APP_ID, app_secret: process.env.FEISHU_APP_SECRET })
    })
    return (await r.json()).tenant_access_token
  })()
  const dr = await realFetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/batch_delete`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: createdRecordIds }) }
  )
  const dd = await dr.json()
  console.log(dd.code === 0 ? '🧹 已删除全部测试记录' : '⚠️ 删除失败: ' + JSON.stringify(dd))
}

process.exit(0)

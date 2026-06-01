// 手动补录工具：把指定日期范围的超额人员填入飞书多维表格
// （不发群卡片，使用情况说明列留空由人工填写）
//
// 用法:
//   node scripts/fill-range.mjs <开始日期> <结束日期> [--dry-run]
//   node scripts/fill-range.mjs 2026-05-26 2026-05-31            # 正式写入（含端点）
//   node scripts/fill-range.mjs 2026-05-26 2026-05-31 --dry-run  # 仅预览不写入
//
// 凭据从 .env 读取（FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BITABLE_APP_TOKEN /
// FEISHU_BITABLE_TABLE_ID）。写入完全可回滚：成功后输出全部 record_id，
// 必要时用 batch_delete 撤销。
//
// 注意：该应用仅有写权限、无读权限，无法预查表中是否已有同日旧记录，
// 重复执行同一区间会产生重复行。请按需执行。
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { setupNewApiRoutes } from '../server/newapi.js'

const START = process.argv[2]
const END = process.argv[3]
const DRY_RUN = process.argv.includes('--dry-run')
if (!START || !END) {
  console.error('用法: node scripts/fill-range.mjs <开始日期> <结束日期> [--dry-run]')
  process.exit(1)
}

const APP_ID = process.env.FEISHU_APP_ID
const APP_SECRET = process.env.FEISHU_APP_SECRET
const APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN
const TABLE_ID = process.env.FEISHU_BITABLE_TABLE_ID
const DATE_FIELD = process.env.FEISHU_BITABLE_DATE_FIELD || '时间'
const PERSON_FIELD = process.env.FEISHU_BITABLE_PERSON_FIELD || '人员'
const COST_FIELD = process.env.FEISHU_BITABLE_COST_FIELD || '今日消耗'
if (!APP_ID || !APP_SECRET || !APP_TOKEN || !TABLE_ID) {
  console.error('缺少飞书多维表格配置，请在 .env 中设置 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID')
  process.exit(1)
}

const openIdMap = JSON.parse(readFileSync(new URL('../server/feishu-user-openids.json', import.meta.url)))
const noopApp = { get() {}, post() {}, put() {}, delete() {}, use() {} }
const { pgPool, calculateCostCNY, refreshPricingConfig } = setupNewApiRoutes(noopApp)
await refreshPricingConfig(pgPool)

const groups = (process.env.FEISHU_REPORT_GROUPS || 'IT,AI_Team').split(',').map(s => s.trim()).filter(Boolean)
const threshold = Number(process.env.FEISHU_ALERT_THRESHOLD) || 100
const gf = groups.length ? `AND l."group" IN (${groups.map((_, i) => `$${i + 3}`).join(',')})` : ''

// 枚举日期范围（含端点）
const dates = []
for (let d = new Date(`${START}T00:00:00+08:00`); d <= new Date(`${END}T00:00:00+08:00`); d.setDate(d.getDate() + 1)) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
  dates.push(`${y}-${m}-${dd}`)
}

async function overTokensOf(date) {
  const dayStart = Math.floor(new Date(`${date}T00:00:00+08:00`).getTime() / 1000)
  const dayEnd = dayStart + 86400
  const r = await pgPool.query(`
    SELECT l.token_id,
      COALESCE(NULLIF(MAX(t.name), ''), NULLIF(MAX(l.token_name), ''), 'Token #' || l.token_id::text) token_name,
      l.model_name, SUM(l.prompt_tokens) p, SUM(l.completion_tokens) c
    FROM logs l LEFT JOIN tokens t ON t.id = l.token_id
    WHERE l.type=2 AND l.token_id IS NOT NULL AND l.created_at>=$1 AND l.created_at<$2 ${gf}
    GROUP BY l.token_id, l.model_name`, [dayStart, dayEnd, ...groups])
  const tk = {}
  for (const row of r.rows) {
    const cost = calculateCostCNY(row.model_name, Number(row.p), Number(row.c))
    tk[row.token_id] ??= { name: row.token_name, cost: 0 }
    tk[row.token_id].cost += cost
  }
  return Object.values(tk).filter(t => t.cost >= threshold).sort((a, b) => b.cost - a.cost)
}

// 收集全部待写入记录
const allRecords = []
console.log(`\n===== 待写入预览（${START} ~ ${END}）=====`)
for (const date of dates) {
  const over = await overTokensOf(date)
  const dateMs = new Date(`${date}T00:00:00+08:00`).getTime()
  console.log(`\n[${date}] 超额 ${over.length} 人`)
  for (const t of over) {
    const oid = openIdMap[t.name]
    const fields = { [DATE_FIELD]: dateMs, [COST_FIELD]: Number(t.cost.toFixed(2)) }
    if (oid) fields[PERSON_FIELD] = [{ id: oid }]
    console.log(`  ${t.name.padEnd(8)} ¥${t.cost.toFixed(2)}  人员=${oid ? '✅' : '❌缺open_id'}`)
    allRecords.push({ date, name: t.name, oid, fields })
  }
}
await pgPool.end()

const missing = allRecords.filter(r => !r.oid)
console.log(`\n合计 ${allRecords.length} 条；缺 open_id: ${missing.length ? missing.map(m => m.name).join(',') : '无'}`)

if (DRY_RUN) { console.log('\n[dry-run] 未写入。'); process.exit(0) }

const tr = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
})
const token = (await tr.json()).tenant_access_token

const cr = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/batch_create`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ records: allRecords.map(r => ({ fields: r.fields })) })
})
const cd = await cr.json()
if (cd.code !== 0) { console.error('❌ 写入失败:', JSON.stringify(cd)); process.exit(1) }

const ids = (cd.data.records || []).map(x => x.record_id)
console.log(`\n✅ 写入成功，共 ${ids.length} 条`)
console.log('record_ids:', JSON.stringify(ids))
process.exit(0)

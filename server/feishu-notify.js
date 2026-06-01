import { EXCHANGE_RATE } from './newapi.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 静态姓名→open_id 映射：运行时 search/v1/user API 需要 user_access_token，
// 且应用缺少 contact 读权限，故改用预生成的静态映射文件（随镜像打包）。
let staticOpenIdMap = {}
try {
  staticOpenIdMap = JSON.parse(readFileSync(join(__dirname, 'feishu-user-openids.json'), 'utf-8'))
} catch (err) {
  console.warn('feishu-user-openids.json load failed:', err.message)
}

const MAX_TOKENS_IN_CARD = 10
const MAX_MODELS_PER_TOKEN = 5
const MAX_BITABLE_BATCH = 500
const FEISHU_RETRYABLE_CODES = new Set([11232])

let tenantTokenCache = {
  value: '',
  expiresAt: 0
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

function parseUserMapping() {
  const raw = process.env.FEISHU_USER_MAPPING
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch (err) {
    console.warn('FEISHU_USER_MAPPING parse failed:', err.message)
  }

  return {}
}

function buildMentionLine(tokens) {
  if (!tokens || tokens.length === 0) return ''

  const mentions = tokens
    .map((t) => {
      const mappedId = resolveUserOpenId(t.tokenName)
      if (mappedId) {
        return `<at user_id="${mappedId}">${t.tokenName}</at>`
      }
      return `@${t.tokenName}`
    })
    .join(' ')

  return mentions
}

function getTokenDisplayExpr(logAlias = 'l', tokenAlias = 't') {
  return `COALESCE(NULLIF(MAX(${tokenAlias}.name), ''), NULLIF(MAX(${logAlias}.token_name), ''), 'Token #' || ${logAlias}.token_id::text)`
}

function hasBitableConfig() {
  return Boolean(
    process.env.FEISHU_APP_ID &&
    process.env.FEISHU_APP_SECRET &&
    process.env.FEISHU_BITABLE_APP_TOKEN &&
    process.env.FEISHU_BITABLE_TABLE_ID
  )
}

async function getTenantAccessToken() {
  if (tenantTokenCache.value && Date.now() < tenantTokenCache.expiresAt) {
    return tenantTokenCache.value
  }

  const appId = process.env.FEISHU_APP_ID
  const appSecret = process.env.FEISHU_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET')
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    }),
    signal: AbortSignal.timeout(10000)
  })

  const data = await response.json()
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Fetch tenant token failed: ${data.msg || 'unknown error'}`)
  }

  const expireSeconds = Number(data.expire || 7200)
  tenantTokenCache = {
    value: data.tenant_access_token,
    expiresAt: Date.now() + Math.max(300, expireSeconds - 300) * 1000
  }

  return tenantTokenCache.value
}

const userOpenIdCache = new Map()

// 解析姓名对应的 open_id：优先用 FEISHU_USER_MAPPING 环境变量覆盖，
// 其次用静态映射文件（feishu-user-openids.json）。未命中返回 null（不缓存，
// 以便运行时通过配置页热更新 FEISHU_USER_MAPPING 后即时生效）。
function resolveUserOpenId(name) {
  if (userOpenIdCache.has(name)) return userOpenIdCache.get(name)

  const envMap = parseUserMapping()
  const openId = envMap[name] || staticOpenIdMap[name] || null

  // 仅缓存命中结果；null 不缓存，避免配置更新后仍返回旧的未命中。
  if (openId) userOpenIdCache.set(name, openId)
  return openId
}

async function writeBitableRecords(dateStr, tokens) {
  if (!hasBitableConfig() || !tokens || tokens.length === 0) {
    return { success: false, skipped: true, reason: 'missing config or empty tokens' }
  }

  const token = await getTenantAccessToken()
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID

  const dateField = process.env.FEISHU_BITABLE_DATE_FIELD || '时间'
  const personField = process.env.FEISHU_BITABLE_PERSON_FIELD || '人员'
  const costField = process.env.FEISHU_BITABLE_COST_FIELD || '今日消耗'

  const dateMs = new Date(dateStr + 'T00:00:00+08:00').getTime()

  const records = []
  const unmapped = []
  for (const t of tokens) {
    const fields = {
      [dateField]: dateMs,
      [costField]: Number(t.totalCostCNY.toFixed(2))
    }
    const openId = resolveUserOpenId(t.tokenName)
    if (openId) {
      fields[personField] = [{ id: openId }]
    } else {
      unmapped.push(t.tokenName)
    }
    records.push({ fields })
  }

  if (unmapped.length > 0) {
    console.warn(`多维表格写入：${unmapped.length} 个令牌无 open_id 映射，人员字段留空: ${unmapped.join(', ')}`)
  }

  let created = 0
  for (let i = 0; i < records.length; i += MAX_BITABLE_BATCH) {
    const chunk = records.slice(i, i + MAX_BITABLE_BATCH)
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records: chunk }),
        signal: AbortSignal.timeout(10000)
      }
    )

    const data = await resp.json()
    if (data.code !== 0) {
      throw new Error(`Bitable batch_create failed: ${data.msg || data.code}`)
    }

    created += chunk.length
  }

  return { success: true, created }
}

// 构建超额提醒私信卡片（与已验证文案一致）：姓名 + 日期 + 消耗金额 + 表格按钮。
function buildOverageDmCard(name, dateStr, costCNY, tableUrl) {
  const elements = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**${name}** 你好：\n你 **${dateStr}** 的 API 消耗为 **¥${costCNY.toFixed(2)}**，已超过报备阈值。\n请前往下方多维表格补充「使用情况说明」。`
      }
    }
  ]
  if (tableUrl) {
    elements.push({
      tag: 'action',
      actions: [
        { tag: 'button', text: { tag: 'plain_text', content: '前往填写' }, type: 'primary', url: tableUrl }
      ]
    })
  }
  return {
    config: { wide_screen_mode: true },
    header: { template: 'orange', title: { tag: 'plain_text', content: '⚠️ API 消耗超额提醒' } },
    elements
  }
}

// 给当天超额且有 open_id 映射的同事单独发飞书卡片私信，提示去多维表格补充说明。
// 由 FEISHU_NOTIFY_OVERAGE_DM=1 控制开关（默认关，避免误打扰）；发送失败不阻断主流程。
async function sendOverageDirectMessages(dateStr, tokens) {
  if (String(process.env.FEISHU_NOTIFY_OVERAGE_DM || '').trim() !== '1') {
    return { success: false, skipped: true, reason: 'FEISHU_NOTIFY_OVERAGE_DM != 1' }
  }
  if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
    return { success: false, skipped: true, reason: 'missing app credentials' }
  }
  if (!tokens || tokens.length === 0) {
    return { success: false, skipped: true, reason: 'empty tokens' }
  }

  const tableUrl = process.env.FEISHU_BITABLE_URL
    || (process.env.FEISHU_BITABLE_APP_TOKEN && process.env.FEISHU_BITABLE_TABLE_ID
      ? `https://feishu.cn/base/${process.env.FEISHU_BITABLE_APP_TOKEN}?table=${process.env.FEISHU_BITABLE_TABLE_ID}`
      : '')

  const token = await getTenantAccessToken()
  let sent = 0
  const failed = []
  const skipped = []

  for (const t of tokens) {
    const openId = resolveUserOpenId(t.tokenName)
    if (!openId) {
      skipped.push(t.tokenName)
      continue
    }

    const card = buildOverageDmCard(t.tokenName, dateStr, t.totalCostCNY, tableUrl)
    try {
      const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receive_id: openId, msg_type: 'interactive', content: JSON.stringify(card) }),
        signal: AbortSignal.timeout(10000)
      })
      const data = await resp.json()
      if (data.code === 0) {
        sent += 1
      } else {
        failed.push(`${t.tokenName}(${data.code})`)
      }
    } catch (err) {
      failed.push(`${t.tokenName}(${err.message})`)
    }
  }

  if (skipped.length > 0) {
    console.warn(`超额私信：${skipped.length} 人无 open_id 映射，已跳过: ${skipped.join(', ')}`)
  }
  if (failed.length > 0) {
    console.warn(`超额私信：${failed.length} 条发送失败: ${failed.join(', ')}`)
  }
  console.log(`超额私信：成功发送 ${sent} 条`)

  return { success: true, sent, failed: failed.length, skipped: skipped.length }
}

function getTodayRange() {
  const now = new Date()
  const offset = 8 * 60
  const local = new Date(now.getTime() + (offset + now.getTimezoneOffset()) * 60000)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const d = String(local.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`
  const dayStart = Math.floor(new Date(`${dateStr}T00:00:00+08:00`).getTime() / 1000)
  const dayEnd = dayStart + 86400
  return { dateStr, dayStart, dayEnd }
}

async function getUserActivity(pgPool, calculateCostCNY, dayStart, dayEnd, groups = []) {
  const groupFilter = groups.length > 0
    ? `AND l."group" IN (${groups.map((_, i) => `$${i + 3}`).join(',')})`
    : ''
  const queryParams = [dayStart, dayEnd, ...groups]

  const todayResult = await pgPool.query(`
    SELECT
      l.token_id,
      ${getTokenDisplayExpr()} as token_name,
      l.model_name,
      SUM(l.prompt_tokens) as p_tokens,
      SUM(l.completion_tokens) as c_tokens,
      COUNT(*) as cnt
    FROM logs l
    LEFT JOIN tokens t ON t.id = l.token_id
    WHERE l.type = 2
      AND l.token_id IS NOT NULL
      AND l.created_at >= $1
      AND l.created_at < $2
      ${groupFilter}
    GROUP BY l.token_id, l.model_name
  `, queryParams)

  const historyFilter = groups.length > 0
    ? `AND "group" IN (${groups.map((_, i) => `$${i + 2}`).join(',')})`
    : ''

  const historyResult = await pgPool.query(`
    SELECT DISTINCT token_id
    FROM logs
    WHERE type = 2
      AND token_id IS NOT NULL
      AND created_at < $1
      ${historyFilter}
  `, [dayStart, ...groups])

  const historySet = new Set(historyResult.rows.map(r => Number(r.token_id)))
  
  const userMap = {}
  for (const r of todayResult.rows) {
    const p = Number(r.p_tokens)
    const c = Number(r.c_tokens)
    const count = Number(r.cnt)
    const costCNY = calculateCostCNY(r.model_name, p, c)

    const tokenId = Number(r.token_id)

    if (!userMap[tokenId]) {
      userMap[tokenId] = {
        tokenId,
        tokenName: r.token_name,
        totalCostCNY: 0,
        totalTokens: 0,
        totalRequests: 0,
        models: new Set()
      }
    }

    const u = userMap[tokenId]
    u.totalCostCNY += costCNY
    u.totalTokens += (p + c)
    u.totalRequests += count
    u.models.add(r.model_name)
  }

  const allUsers = Object.values(userMap)
  
  // 区分新人和老用户
  const newUsers = allUsers.filter(u => !historySet.has(u.tokenId))
  const oldUsers = allUsers.filter(u => historySet.has(u.tokenId))
  
  // 按消耗排序
  newUsers.sort((a, b) => b.totalCostCNY - a.totalCostCNY)
  oldUsers.sort((a, b) => b.totalCostCNY - a.totalCostCNY)

  return { newUsers, oldUsers, totalUsers: allUsers.length }
}

function formatUserList(users, isNew = false) {
  if (users.length === 0) return ''
  
  const badge = isNew ? '🌟 **NEW** ' : '👤 '
  const lines = users.map(u => {
    const models = [...u.models].slice(0, 3).join(', ')
    const moreModels = u.models.size > 3 ? ` (+${u.models.size - 3})` : ''
    return `${badge}${u.tokenName} · ¥${u.totalCostCNY.toFixed(2)} · ${formatNumber(u.totalTokens)} tokens · ${models}${moreModels}`
  })
  
  return lines.join('\n')
}

function buildCard(dateStr, tokens, summary, threshold, userActivity) {
  const header = {
    title: { tag: 'plain_text', content: `📊 API 消耗日报 — ${dateStr}` },
    template: 'blue'
  }

  const elements = []

  elements.push({
    tag: 'markdown',
    content: `**今日总览**\n👥 活跃令牌 **${summary.totalUsers}** 个 | 📡 调用 **${formatNumber(summary.totalRequests)}** 次 | 🔤 Tokens **${formatNumber(summary.totalTokens)}** | 💰 总消耗 **¥${summary.totalCostCNY.toFixed(2)}**`
  })
  elements.push({ tag: 'hr' })

  // 用户活跃度板块
  if (userActivity) {
    const { newUsers, oldUsers, totalUsers } = userActivity
    
    if (newUsers.length > 0) {
      elements.push({
        tag: 'markdown',
        content: `### 🎉 欢迎新人上线（${newUsers.length}人）`
      })
      elements.push({
        tag: 'markdown',
        content: formatUserList(newUsers, true)
      })
      elements.push({ tag: 'hr' })
    }

    if (oldUsers.length > 0) {
      elements.push({
        tag: 'markdown',
        content: `### 👥 老用户活跃（${oldUsers.length}人）`
      })
      elements.push({
        tag: 'markdown',
        content: formatUserList(oldUsers, false)
      })
      elements.push({ tag: 'hr' })
    }
  }

  if (tokens.length > 0) {
    elements.push({
      tag: 'markdown',
      content: `**消耗超过 ¥${threshold} 的令牌（共 ${tokens.length} 个）**`
    })

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const displayModels = token.models.slice(0, MAX_MODELS_PER_TOKEN)
      const modelLines = displayModels.map(m => `  · ${m.modelName} — ${formatNumber(m.tokens)} tokens / ${m.requests}次 / ¥${m.costCNY.toFixed(2)}`)
      if (token.models.length > MAX_MODELS_PER_TOKEN) {
        modelLines.push(`  · ...及其他 ${token.models.length - MAX_MODELS_PER_TOKEN} 个模型`)
      }

      elements.push({
        tag: 'markdown',
        content: `**Top ${i + 1} · ${token.tokenName}** — ¥${token.totalCostCNY.toFixed(2)}\n调用 ${token.totalRequests} 次 | Tokens ${formatNumber(token.totalTokens)}\n${modelLines.join('\n')}`
      })
      if (i < tokens.length - 1) {
        elements.push({ tag: 'hr' })
      }
    }
  } else {
    elements.push({
      tag: 'markdown',
      content: `**今日无消耗超过 ¥${threshold} 的令牌**`
    })
  }

  return {
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      config: { wide_screen_mode: true },
      header,
      body: { elements }
    }
  }
}

async function postToFeishu(webhookUrl, payload) {
  const maxAttempts = Math.max(1, Number(process.env.FEISHU_RETRY_MAX_ATTEMPTS || '4'))
  const baseDelayMs = Math.max(1000, Number(process.env.FEISHU_RETRY_DELAY_MS || '30000'))

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      })
      const data = await resp.json()

      if (data.code === 0) {
        console.log(`飞书通知发送成功 (attempt ${attempt}/${maxAttempts})`)
        return { success: true, attempts: attempt }
      }

      const isRetryable = FEISHU_RETRYABLE_CODES.has(Number(data.code)) || resp.status === 429
      const canRetry = isRetryable && attempt < maxAttempts
      console.error(`飞书通知发送失败 (attempt ${attempt}/${maxAttempts}):`, data.code, data.msg)

      if (!canRetry) {
        return { success: false, error: `Feishu API error: ${data.code} ${data.msg}`, attempts: attempt }
      }

      const delay = baseDelayMs * attempt
      console.warn(`飞书通知触发频控，${delay}ms 后重试...`)
      await sleep(delay)
    } catch (err) {
      const canRetry = attempt < maxAttempts
      console.error(`飞书通知网络错误 (attempt ${attempt}/${maxAttempts}):`, err.message)

      if (!canRetry) {
        return { success: false, error: err.message, attempts: attempt }
      }

      const delay = baseDelayMs * attempt
      console.warn(`飞书通知网络异常，${delay}ms 后重试...`)
      await sleep(delay)
    }
  }

  return { success: false, error: 'Feishu notification retry exhausted', attempts: maxAttempts }
}

export function setupFeishuNotify({ pgPool, calculateCostCNY, refreshPricingConfig }) {
  const getThreshold = () => Number(process.env.FEISHU_ALERT_THRESHOLD) || 100
  const isFeishuDisabled = () => String(process.env.FEISHU_DISABLED || '').trim() === '1'
  const getReportGroups = () => (process.env.FEISHU_REPORT_GROUPS || 'IT,AI_Team').split(',').map(s => s.trim()).filter(Boolean)

  async function sendDailyReport(overrideDate) {
    if (isFeishuDisabled()) {
      return { success: false, reason: 'FEISHU_DISABLED=1' }
    }

    const webhookUrl = process.env.FEISHU_WEBHOOK_URL
    const threshold = getThreshold()

    if (!webhookUrl) {
      return { success: false, reason: 'FEISHU_WEBHOOK_URL not configured' }
    }

    let dateStr, dayStart, dayEnd
    if (overrideDate) {
      dateStr = overrideDate
      dayStart = Math.floor(new Date(`${overrideDate}T00:00:00+08:00`).getTime() / 1000)
      dayEnd = dayStart + 86400
    } else {
      ({ dateStr, dayStart, dayEnd } = getTodayRange())
    }
    console.log(`飞书日报查询: ${dateStr} (${dayStart} - ${dayEnd}), 阈值: ¥${threshold}`)

    try {
      await refreshPricingConfig(pgPool)

      const groups = getReportGroups()
      const userActivity = await getUserActivity(pgPool, calculateCostCNY, dayStart, dayEnd, groups)

      const groupFilter = groups.length > 0
        ? `AND l."group" IN (${groups.map((_, i) => `$${i + 3}`).join(',')})`
        : ''

      const result = await pgPool.query(`
        SELECT l.token_id,
          ${getTokenDisplayExpr()} as token_name,
          l.model_name,
          SUM(l.prompt_tokens) as p_tokens,
          SUM(l.completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs l
        LEFT JOIN tokens t ON t.id = l.token_id
        WHERE l.type = 2
          AND l.token_id IS NOT NULL
          AND l.created_at >= $1
          AND l.created_at < $2
          ${groupFilter}
        GROUP BY l.token_id, l.model_name
      `, [dayStart, dayEnd, ...groups])

      const tokenMap = {}
      for (const r of result.rows) {
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        const costCNY = calculateCostCNY(r.model_name, p, c)

        const tokenId = Number(r.token_id)

        if (!tokenMap[tokenId]) {
          tokenMap[tokenId] = {
            tokenId,
            tokenName: r.token_name,
            totalCostCNY: 0,
            totalTokens: 0,
            totalRequests: 0,
            models: []
          }
        }

        const t = tokenMap[tokenId]
        t.totalCostCNY += costCNY
        t.totalTokens += (p + c)
        t.totalRequests += count
        t.models.push({
          modelName: r.model_name,
          tokens: p + c,
          promptTokens: p,
          completionTokens: c,
          requests: count,
          costCNY
        })
      }

      const allTokens = Object.values(tokenMap)
      const summary = {
        totalUsers: allTokens.length,
        totalRequests: allTokens.reduce((s, t) => s + t.totalRequests, 0),
        totalTokens: allTokens.reduce((s, t) => s + t.totalTokens, 0),
        totalCostCNY: allTokens.reduce((s, t) => s + t.totalCostCNY, 0)
      }

      const filtered = allTokens
        .filter(t => t.totalCostCNY >= threshold)
        .sort((a, b) => b.totalCostCNY - a.totalCostCNY)
        .slice(0, MAX_TOKENS_IN_CARD)

      for (const t of filtered) {
        t.models.sort((a, b) => b.costCNY - a.costCNY)
      }

      const payload = buildCard(dateStr, filtered, summary, threshold, userActivity)

      // Check payload size (20KB limit for custom bot)
      const payloadStr = JSON.stringify(payload)
      if (payloadStr.length > 19000) {
        const truncated = filtered.slice(0, Math.max(5, Math.floor(filtered.length / 2)))
        const truncatedPayload = buildCard(dateStr, truncated, summary, threshold, userActivity)
        console.log(`卡片过大 (${payloadStr.length} bytes)，截断到 ${truncated.length} 个令牌`)
        const sendResult = await postToFeishu(webhookUrl, truncatedPayload)

        let bitableResult = { success: false, skipped: true, reason: 'notification failed or disabled' }
        let dmResult = { success: false, skipped: true, reason: 'notification failed or disabled' }
        if (sendResult.success) {
          try {
            bitableResult = await writeBitableRecords(dateStr, truncated)
          } catch (bitableErr) {
            bitableResult = { success: false, error: bitableErr.message }
          }
          try {
            dmResult = await sendOverageDirectMessages(dateStr, truncated)
          } catch (dmErr) {
            dmResult = { success: false, error: dmErr.message }
          }
        }

        return {
          ...sendResult,
          date: dateStr,
          tokensReported: truncated.length,
          truncated: true,
          bitable: bitableResult,
          dm: dmResult
        }
      }

      const sendResult = await postToFeishu(webhookUrl, payload)
      let bitableResult = { success: false, skipped: true, reason: 'notification failed or disabled' }
      let dmResult = { success: false, skipped: true, reason: 'notification failed or disabled' }
      if (sendResult.success) {
        try {
          bitableResult = await writeBitableRecords(dateStr, filtered)
        } catch (bitableErr) {
          bitableResult = { success: false, error: bitableErr.message }
        }
        try {
          dmResult = await sendOverageDirectMessages(dateStr, filtered)
        } catch (dmErr) {
          dmResult = { success: false, error: dmErr.message }
        }
      }

      return {
        ...sendResult,
        date: dateStr,
        tokensReported: filtered.length,
        bitable: bitableResult,
        dm: dmResult
      }

    } catch (err) {
      console.error('飞书日报查询失败:', err.message)
      return { success: false, error: err.message, date: dateStr }
    }
  }

  return { sendDailyReport }
}

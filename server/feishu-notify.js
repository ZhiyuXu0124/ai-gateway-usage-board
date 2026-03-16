import { EXCHANGE_RATE } from './newapi.js'

const MAX_TOKENS_IN_CARD = 20
const MAX_MODELS_PER_TOKEN = 10
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

function buildMentionLine(tokens, userMapping) {
  if (!tokens || tokens.length === 0) return ''

  const mentions = tokens
    .map((t) => {
      const mappedId = userMapping[t.tokenName]
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

async function writeBitableRecords(dateStr, tokens) {
  if (!hasBitableConfig() || !tokens || tokens.length === 0) {
    return { success: false, skipped: true, reason: 'missing config or empty tokens' }
  }

  const token = await getTenantAccessToken()
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID

  const dateField = process.env.FEISHU_BITABLE_DATE_FIELD || '时间'
  const personField = process.env.FEISHU_BITABLE_PERSON_FIELD || '人员'
  const costField = process.env.FEISHU_BITABLE_COST_FIELD || '消耗金额'
  const remarkField = process.env.FEISHU_BITABLE_REMARK_FIELD || '超额报备'

  const dateMs = new Date(dateStr + 'T00:00:00+08:00').getTime()
  const records = tokens.map((t) => ({
    fields: {
      [dateField]: dateMs,
      [personField]: t.tokenName,
      [costField]: Number(t.totalCostCNY.toFixed(4)),
      [remarkField]: ''
    }
  }))

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

async function getUserActivity(pgPool, calculateCost, dayStart, dayEnd) {
  // 获取今日活跃用户详情
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
    GROUP BY l.token_id, l.model_name
  `, [dayStart, dayEnd])

  // 获取历史用户（今日之前有过记录的用户）
  const historyResult = await pgPool.query(`
    SELECT DISTINCT token_id
    FROM logs
    WHERE type = 2 
      AND token_id IS NOT NULL
      AND created_at < $1
  `, [dayStart])

  const historySet = new Set(historyResult.rows.map(r => Number(r.token_id)))
  
  const userMap = {}
  for (const r of todayResult.rows) {
    const p = Number(r.p_tokens)
    const c = Number(r.c_tokens)
    const count = Number(r.cnt)
    const costUSD = calculateCost(r.model_name, p, c, count)
    const costCNY = costUSD * EXCHANGE_RATE

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

function buildCard(dateStr, tokens, summary, threshold, userActivity, userMapping) {
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

  if (tokens.length > 0) {
    const mentionLine = buildMentionLine(tokens, userMapping)
    if (mentionLine) {
      elements.push({
        tag: 'markdown',
        content: `### ⚠️ 超预算提醒\n${mentionLine}\n请关注当日消耗并在「超额报备」中补充说明。`
      })
      elements.push({ tag: 'hr' })
    }
  }

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
      let modelTable = '| 模型 | Tokens | 调用 | 费用(¥) |\n|---|---|---|---|\n'
      const displayModels = token.models.slice(0, MAX_MODELS_PER_TOKEN)
      for (const m of displayModels) {
        modelTable += `| ${m.modelName} | ${formatNumber(m.tokens)} | ${m.requests} | ${m.costCNY.toFixed(2)} |\n`
      }
      if (token.models.length > MAX_MODELS_PER_TOKEN) {
        const remaining = token.models.length - MAX_MODELS_PER_TOKEN
        modelTable += `| ...及其他 ${remaining} 个模型 | | | |\n`
      }

      elements.push({
        tag: 'markdown',
        content: `**Top ${i + 1} · ${token.tokenName}** — ¥${token.totalCostCNY.toFixed(2)}\n调用 ${token.totalRequests} 次 | Tokens ${formatNumber(token.totalTokens)}\n\n${modelTable}`
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

export function setupFeishuNotify({ pgPool, calculateCost, refreshPricingConfig }) {
  const getThreshold = () => Number(process.env.FEISHU_ALERT_THRESHOLD) || 100

  async function sendDailyReport(overrideDate) {
    const webhookUrl = process.env.FEISHU_WEBHOOK_URL
    const threshold = getThreshold()
    const userMapping = parseUserMapping()

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

      const userActivity = await getUserActivity(pgPool, calculateCost, dayStart, dayEnd)

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
        GROUP BY l.token_id, l.model_name
      `, [dayStart, dayEnd])

      const tokenMap = {}
      for (const r of result.rows) {
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        const costUSD = calculateCost(r.model_name, p, c, count)
        const costCNY = costUSD * EXCHANGE_RATE

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

      const payload = buildCard(dateStr, filtered, summary, threshold, userActivity, userMapping)

      // Check payload size (20KB limit for custom bot)
      const payloadStr = JSON.stringify(payload)
      if (payloadStr.length > 19000) {
        const truncated = filtered.slice(0, Math.max(5, Math.floor(filtered.length / 2)))
        const truncatedPayload = buildCard(dateStr, truncated, summary, threshold, userActivity, userMapping)
        console.log(`卡片过大 (${payloadStr.length} bytes)，截断到 ${truncated.length} 个令牌`)
        const sendResult = await postToFeishu(webhookUrl, truncatedPayload)

        let bitableResult = { success: false, skipped: true, reason: 'notification failed or disabled' }
        if (sendResult.success) {
          try {
            bitableResult = await writeBitableRecords(dateStr, truncated)
          } catch (bitableErr) {
            bitableResult = { success: false, error: bitableErr.message }
          }
        }

        return {
          ...sendResult,
          date: dateStr,
          tokensReported: truncated.length,
          truncated: true,
          bitable: bitableResult
        }
      }

      const sendResult = await postToFeishu(webhookUrl, payload)
      let bitableResult = { success: false, skipped: true, reason: 'notification failed or disabled' }
      if (sendResult.success) {
        try {
          bitableResult = await writeBitableRecords(dateStr, filtered)
        } catch (bitableErr) {
          bitableResult = { success: false, error: bitableErr.message }
        }
      }

      return {
        ...sendResult,
        date: dateStr,
        tokensReported: filtered.length,
        bitable: bitableResult
      }

    } catch (err) {
      console.error('飞书日报查询失败:', err.message)
      return { success: false, error: err.message, date: dateStr }
    }
  }

  return { sendDailyReport }
}

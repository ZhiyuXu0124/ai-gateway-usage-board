import { EXCHANGE_RATE } from './newapi.js'

const MAX_TOKENS_IN_CARD = 20
const MAX_MODELS_PER_TOKEN = 10

function formatNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
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
      token_name,
      model_name,
      SUM(prompt_tokens) as p_tokens,
      SUM(completion_tokens) as c_tokens,
      COUNT(*) as cnt
    FROM logs
    WHERE type = 2
      AND created_at >= $1
      AND created_at < $2
      AND token_name != ''
    GROUP BY token_name, model_name
  `, [dayStart, dayEnd])

  // 获取历史用户（今日之前有过记录的用户）
  const historyResult = await pgPool.query(`
    SELECT DISTINCT token_name
    FROM logs
    WHERE type = 2 
      AND created_at < $1
      AND token_name != ''
  `, [dayStart])

  const historySet = new Set(historyResult.rows.map(r => r.token_name))
  
  // 按 token_name 聚合今日数据
  const userMap = {}
  for (const r of todayResult.rows) {
    const p = Number(r.p_tokens)
    const c = Number(r.c_tokens)
    const count = Number(r.cnt)
    const costUSD = calculateCost(r.model_name, p, c, count)
    const costCNY = costUSD * EXCHANGE_RATE

    if (!userMap[r.token_name]) {
      userMap[r.token_name] = {
        tokenName: r.token_name,
        totalCostCNY: 0,
        totalTokens: 0,
        totalRequests: 0,
        models: new Set()
      }
    }

    const u = userMap[r.token_name]
    u.totalCostCNY += costCNY
    u.totalTokens += (p + c)
    u.totalRequests += count
    u.models.add(r.model_name)
  }

  const allUsers = Object.values(userMap)
  
  // 区分新人和老用户
  const newUsers = allUsers.filter(u => !historySet.has(u.tokenName))
  const oldUsers = allUsers.filter(u => historySet.has(u.tokenName))
  
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
  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    })
    const data = await resp.json()
    if (data.code === 0) {
      console.log('飞书通知发送成功')
      return { success: true }
    } else {
      console.error('飞书通知发送失败:', data.code, data.msg)
      return { success: false, error: `Feishu API error: ${data.code} ${data.msg}` }
    }
  } catch (err) {
    console.error('飞书通知网络错误:', err.message)
    return { success: false, error: err.message }
  }
}

export function setupFeishuNotify({ pgPool, calculateCost, refreshPricingConfig }) {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL
  const threshold = Number(process.env.FEISHU_ALERT_THRESHOLD) || 150

  async function sendDailyReport(overrideDate) {
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

      // 获取用户活跃度数据
      const userActivity = await getUserActivity(pgPool, calculateCost, dayStart, dayEnd)

      const result = await pgPool.query(`
        SELECT token_name, model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs
        WHERE type = 2
          AND created_at >= $1
          AND created_at < $2
          AND token_name != ''
        GROUP BY token_name, model_name
      `, [dayStart, dayEnd])

      const tokenMap = {}
      for (const r of result.rows) {
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        const costUSD = calculateCost(r.model_name, p, c, count)
        const costCNY = costUSD * EXCHANGE_RATE

        if (!tokenMap[r.token_name]) {
          tokenMap[r.token_name] = {
            tokenName: r.token_name,
            totalCostCNY: 0,
            totalTokens: 0,
            totalRequests: 0,
            models: []
          }
        }

        const t = tokenMap[r.token_name]
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
        return { ...sendResult, date: dateStr, tokensReported: truncated.length, truncated: true }
      }

      const sendResult = await postToFeishu(webhookUrl, payload)
      return { ...sendResult, date: dateStr, tokensReported: filtered.length }

    } catch (err) {
      console.error('飞书日报查询失败:', err.message)
      return { success: false, error: err.message, date: dateStr }
    }
  }

  return { sendDailyReport }
}

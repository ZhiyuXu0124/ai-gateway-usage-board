import pg from 'pg'

const { Pool } = pg

let pricingConfig = {
  modelRatio: {},
  completionRatio: {},
  modelPrice: {},
  updatedAt: 0
}

const CACHE_TTL = 5 * 60 * 1000
const LEADERBOARD_CACHE_TTL = 30 * 1000
const leaderboardCache = new Map()

function setLeaderboardCache(key, data) {
  if (leaderboardCache.size > 200) {
    leaderboardCache.clear()
  }

  leaderboardCache.set(key, {
    data,
    updatedAt: Date.now()
  })
}

const BASE_PRICE_PER_TOKEN = 0.002 / 1000
export const EXCHANGE_RATE = 7.2

export function setupNewApiRoutes(app) {
  const pgPool = new Pool({
    host: process.env.NEWAPI_DB_HOST || 'localhost',
    port: parseInt(process.env.NEWAPI_DB_PORT || '5432'),
    user: process.env.NEWAPI_DB_USER,
    password: process.env.NEWAPI_DB_PASSWORD,
    database: process.env.NEWAPI_DB_NAME,
    max: 10,
    idleTimeoutMillis: 30000
  })

  pgPool.connect()
    .then(client => {
      console.log('NewAPI PostgreSQL connected successfully')
      client.release()
      refreshPricingConfig(pgPool)
    })
    .catch(err => {
      console.error('NewAPI PostgreSQL connection failed:', err.message)
    })

  async function refreshPricingConfig(pool) {
    if (Date.now() - pricingConfig.updatedAt < CACHE_TTL) return

    try {
      const res = await pool.query(`
        SELECT key, value 
        FROM options 
        WHERE key IN ('ModelRatio', 'CompletionRatio', 'ModelPrice')
      `)
      
      const newConfig = {
        modelRatio: {},
        completionRatio: {},
        modelPrice: {},
        updatedAt: Date.now()
      }

      res.rows.forEach(row => {
        try {
          const val = JSON.parse(row.value)
          if (row.key === 'ModelRatio') newConfig.modelRatio = val
          if (row.key === 'CompletionRatio') newConfig.completionRatio = val
          if (row.key === 'ModelPrice') newConfig.modelPrice = val
        } catch (e) {
          console.error(`Failed to parse option ${row.key}`, e)
        }
      })

      pricingConfig = newConfig
      console.log('Pricing config refreshed')
    } catch (err) {
      console.error('Failed to refresh pricing config:', err)
    }
  }

  function calculateCost(modelName, promptTokens, completionTokens, count = 1) {
    if (!modelName) return 0
    
    if (pricingConfig.modelPrice[modelName] !== undefined) {
      return pricingConfig.modelPrice[modelName] * count
    }

    const ratio = pricingConfig.modelRatio[modelName] ?? 30
    const completionRatio = pricingConfig.completionRatio[modelName] ?? 1

    const inputCost = promptTokens * ratio * BASE_PRICE_PER_TOKEN
    const outputCost = completionTokens * ratio * completionRatio * BASE_PRICE_PER_TOKEN
    
    return inputCost + outputCost
  }

  const ensurePricing = async (req, res, next) => {
    await refreshPricingConfig(pgPool)
    next()
  }

  app.use('/api/newapi', ensurePricing)

  async function resolveUserFilter(query) {
    const { token_name, token } = query

    if (token_name) {
      return {
        whereExpr: 'token_name = $1',
        params: [token_name],
        displayName: token_name,
        tokenId: null
      }
    }

    if (!token) {
      return null
    }

    const candidates = [token]
    if (token.startsWith('sk-') && token.length > 3) {
      candidates.push(token.slice(3))
    }

    let tokenRow = null
    for (const candidate of candidates) {
      const res = await pgPool.query(
        'SELECT id, key FROM tokens WHERE "key" = $1 LIMIT 1',
        [candidate]
      )
      if (res.rows.length > 0) {
        tokenRow = res.rows[0]
        break
      }
    }

    if (!tokenRow) {
      return null
    }

    const nameRes = await pgPool.query(
      `SELECT token_name
       FROM logs
       WHERE type = 2 AND token_id = $1 AND token_name != ''
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenRow.id]
    )

    const displayName = nameRes.rows[0]?.token_name || `token-${tokenRow.id}`

    return {
      whereExpr: 'token_id = $1',
      params: [tokenRow.id],
      displayName,
      tokenId: tokenRow.id
    }
  }

  app.get('/api/newapi/overview', async (req, res) => {
    try {
      const result = await pgPool.query(`
        SELECT 
          model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE type = 2
        GROUP BY model_name
      `)

      let totalCostUSD = 0
      let totalTokens = 0
      let totalPromptTokens = 0
      let totalCompletionTokens = 0
      let totalRequests = 0

      result.rows.forEach(r => {
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        
        totalCostUSD += calculateCost(r.model_name, p, c, count)
        totalTokens += (p + c)
        totalPromptTokens += p
        totalCompletionTokens += c
        totalRequests += count
      })

      res.json({
        totalCost: totalCostUSD,
        totalCostCNY: totalCostUSD * EXCHANGE_RATE,
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalRequests
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/daily-overview', async (req, res) => {
    try {
      const { date } = req.query
      if (!date) return res.status(400).json({ error: 'Missing date param' })

      const dayStart = Math.floor(new Date(date + 'T00:00:00+08:00').getTime() / 1000)
      const dayEnd = dayStart + 86400

      const result = await pgPool.query(`
        SELECT 
          model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE type = 2 
          AND created_at >= $1 
          AND created_at < $2
        GROUP BY model_name
      `, [dayStart, dayEnd])

      let totalCostUSD = 0
      let totalTokens = 0
      let totalPromptTokens = 0
      let totalCompletionTokens = 0
      let totalRequests = 0

      result.rows.forEach(r => {
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        
        totalCostUSD += calculateCost(r.model_name, p, c, count)
        totalTokens += (p + c)
        totalPromptTokens += p
        totalCompletionTokens += c
        totalRequests += count
      })

      res.json({
        date,
        totalCost: totalCostUSD,
        totalCostCNY: totalCostUSD * EXCHANGE_RATE,
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalRequests
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/leaderboard', async (req, res) => {
    try {
      const { date, type = 'cost', limit = '20' } = req.query
      const limitNum = Math.min(parseInt(limit) || 20, 100)
      const cacheKey = `${date || 'all'}|${type}|${limitNum}`
      const cacheHit = leaderboardCache.get(cacheKey)

      if (cacheHit && Date.now() - cacheHit.updatedAt < LEADERBOARD_CACHE_TTL) {
        return res.json(cacheHit.data)
      }

      if (type === 'tokens' || type === 'requests') {
        const params = []
        let whereClause = "type = 2 AND token_name != ''"

        if (date) {
          const dayStart = Math.floor(new Date(date + 'T00:00:00+08:00').getTime() / 1000)
          const dayEnd = dayStart + 86400
          params.push(dayStart, dayEnd)
          whereClause += ` AND created_at >= $1 AND created_at < $2`
        }

        const orderExpr = type === 'tokens' ? 'total_tokens' : 'total_requests'
        const limitPlaceholder = `$${params.length + 1}`
        params.push(limitNum)

        const result = await pgPool.query(`
          SELECT
            token_name,
            SUM(prompt_tokens + completion_tokens) as total_tokens,
            COUNT(*) as total_requests
          FROM logs
          WHERE ${whereClause}
          GROUP BY token_name
          ORDER BY ${orderExpr} DESC
          LIMIT ${limitPlaceholder}
        `, params)

        const rows = result.rows.map((row, idx) => ({
          tokenName: row.token_name,
          totalCost: 0,
          totalCostCNY: 0,
          totalTokens: Number(row.total_tokens),
          totalRequests: Number(row.total_requests),
          rank: idx + 1
        }))

        setLeaderboardCache(cacheKey, rows)

        return res.json(rows)
      }

      let query, params
      if (date) {
        const dayStart = Math.floor(new Date(date + 'T00:00:00+08:00').getTime() / 1000)
        const dayEnd = dayStart + 86400
        query = `
          SELECT 
            token_name,
            model_name,
            SUM(prompt_tokens) as p_tokens,
            SUM(completion_tokens) as c_tokens,
            COUNT(*) as cnt
          FROM logs 
          WHERE type = 2 
            AND token_name != '' 
            AND created_at >= $1 
            AND created_at < $2
          GROUP BY token_name, model_name
        `
        params = [dayStart, dayEnd]
      } else {
        query = `
          SELECT 
            token_name,
            model_name,
            SUM(prompt_tokens) as p_tokens,
            SUM(completion_tokens) as c_tokens,
            COUNT(*) as cnt
          FROM logs 
          WHERE type = 2 AND token_name != ''
          GROUP BY token_name, model_name
        `
        params = []
      }

      const result = await pgPool.query(query, params)
      
      const userMap = {}
      
      result.rows.forEach(r => {
        if (!userMap[r.token_name]) {
          userMap[r.token_name] = {
            tokenName: r.token_name,
            totalCost: 0,
            totalTokens: 0,
            totalRequests: 0
          }
        }
        
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        const cost = calculateCost(r.model_name, p, c, count)
        
        userMap[r.token_name].totalCost += cost
        userMap[r.token_name].totalTokens += (p + c)
        userMap[r.token_name].totalRequests += count
      })

      let sorted = Object.values(userMap)
      
      if (type === 'tokens') {
        sorted.sort((a, b) => b.totalTokens - a.totalTokens)
      } else if (type === 'requests') {
        sorted.sort((a, b) => b.totalRequests - a.totalRequests)
      } else {
        sorted.sort((a, b) => b.totalCost - a.totalCost)
      }

      const topN = sorted.slice(0, limitNum).map((item, idx) => ({
        ...item,
        rank: idx + 1,
        totalCostCNY: item.totalCost * EXCHANGE_RATE
      }))

      setLeaderboardCache(cacheKey, topN)

      res.json(topN)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/trend', async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days) || 30, 90)
      const startTs = Math.floor(Date.now() / 1000) - days * 86400

      const result = await pgPool.query(`
        SELECT 
          TO_CHAR(TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') as date,
          model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE type = 2 AND created_at >= $1
        GROUP BY date, model_name
        ORDER BY date
      `, [startTs])

      const dateMap = {}
      
      result.rows.forEach(r => {
        if (!dateMap[r.date]) {
          dateMap[r.date] = {
            date: r.date,
            totalCost: 0,
            totalTokens: 0,
            totalRequests: 0,
            models: [] 
          }
        }
        
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        const cost = calculateCost(r.model_name, p, c, count)
        
        dateMap[r.date].totalCost += cost
        dateMap[r.date].totalTokens += (p + c)
        dateMap[r.date].totalRequests += count
        
        dateMap[r.date].models.push({
          modelName: r.model_name,
          costCNY: cost * EXCHANGE_RATE,
          tokens: p + c,
          requests: count
        })
      })

      const sortedTrend = Object.values(dateMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(item => ({
          ...item,
          totalCostCNY: item.totalCost * EXCHANGE_RATE
        }))

      res.json(sortedTrend)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/model-distribution', async (req, res) => {
    try {
      const { date } = req.query
      let query, params

      if (date) {
        const dayStart = Math.floor(new Date(date + 'T00:00:00+08:00').getTime() / 1000)
        const dayEnd = dayStart + 86400
        query = `
          SELECT 
            model_name,
            SUM(prompt_tokens) as p_tokens,
            SUM(completion_tokens) as c_tokens,
            COUNT(*) as cnt
          FROM logs 
          WHERE type = 2 
            AND created_at >= $1 
            AND created_at < $2
          GROUP BY model_name
        `
        params = [dayStart, dayEnd]
      } else {
        query = `
          SELECT 
            model_name,
            SUM(prompt_tokens) as p_tokens,
            SUM(completion_tokens) as c_tokens,
            COUNT(*) as cnt
          FROM logs 
          WHERE type = 2
          GROUP BY model_name
        `
        params = []
      }

      const result = await pgPool.query(query, params)
      
      let allModels = result.rows.map(r => {
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        const cost = calculateCost(r.model_name, p, c, count)
        const tokens = p + c
        
        return {
          modelName: r.model_name,
          totalCost: cost,
          totalCostCNY: cost * EXCHANGE_RATE,
          totalTokens: tokens,
          totalRequests: count
        }
      })

      const totalCostAll = allModels.reduce((sum, m) => sum + m.totalCost, 0)
      
      allModels = allModels.map(m => ({
        ...m,
        percentage: totalCostAll > 0 ? (m.totalCost / totalCostAll * 100) : 0
      }))

      allModels.sort((a, b) => b.totalCost - a.totalCost)
      
      res.json(allModels.slice(0, 20))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/available-dates', async (req, res) => {
    try {
      const result = await pgPool.query(`
        SELECT DISTINCT 
          TO_CHAR(TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') as date
        FROM logs 
        WHERE type = 2
        ORDER BY date DESC
      `)
      res.json(result.rows.map(r => r.date))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/user-trend', async (req, res) => {
    try {
      const { days } = req.query
      const userFilter = await resolveUserFilter(req.query)
      if (!userFilter) return res.status(400).json({ error: 'Missing or invalid token/token_name' })
      
      let whereClause = `type = 2 AND ${userFilter.whereExpr}`
      const params = [...userFilter.params]
      
      if (days) {
        const daysNum = Math.min(parseInt(days) || 30, 365)
        const startTs = Math.floor(Date.now() / 1000) - daysNum * 86400
        whereClause += ` AND created_at >= $${params.length + 1}`
        params.push(startTs)
      }

      const result = await pgPool.query(`
        SELECT 
          TO_CHAR(TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') as date,
          model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE ${whereClause}
        GROUP BY date, model_name
        ORDER BY date
      `, params)

      const dateMap = {}
      
      result.rows.forEach(r => {
        if (!dateMap[r.date]) {
          dateMap[r.date] = {
            date: r.date,
            totalCost: 0,
            totalTokens: 0,
            totalRequests: 0,
            models: [] 
          }
        }
        
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const count = Number(r.cnt)
        const cost = calculateCost(r.model_name, p, c, count)
        
        dateMap[r.date].totalCost += cost
        dateMap[r.date].totalTokens += (p + c)
        dateMap[r.date].totalRequests += count
        
        dateMap[r.date].models.push({
          modelName: r.model_name,
          costCNY: cost * EXCHANGE_RATE,
          tokens: p + c,
          requests: count
        })
      })

      const sortedTrend = Object.values(dateMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(item => ({
          ...item,
          totalCostCNY: item.totalCost * EXCHANGE_RATE
        }))

      res.json(sortedTrend)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/user-overview', async (req, res) => {
    try {
      const userFilter = await resolveUserFilter(req.query)
      if (!userFilter) return res.status(400).json({ error: 'Missing or invalid token/token_name' })

      const result = await pgPool.query(`
        SELECT 
          model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE type = 2 AND ${userFilter.whereExpr}
        GROUP BY model_name
      `, userFilter.params)

      let totalCostUSD = 0, totalTokens = 0, totalPromptTokens = 0, totalCompletionTokens = 0, totalRequests = 0

      result.rows.forEach(r => {
        const p = Number(r.p_tokens), c = Number(r.c_tokens), count = Number(r.cnt)
        totalCostUSD += calculateCost(r.model_name, p, c, count)
        totalTokens += (p + c)
        totalPromptTokens += p
        totalCompletionTokens += c
        totalRequests += count
      })

      res.json({
        tokenName: userFilter.displayName,
        totalCost: totalCostUSD,
        totalCostCNY: totalCostUSD * EXCHANGE_RATE,
        totalTokens, totalPromptTokens, totalCompletionTokens, totalRequests
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/user-daily-overview', async (req, res) => {
    try {
      const { date } = req.query
      const userFilter = await resolveUserFilter(req.query)
      if (!userFilter || !date) return res.status(400).json({ error: 'Missing or invalid token/token_name/date' })

      const dayStart = Math.floor(new Date(date + 'T00:00:00+08:00').getTime() / 1000)
      const dayEnd = dayStart + 86400

      const result = await pgPool.query(`
        SELECT 
          model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE type = 2 AND ${userFilter.whereExpr} AND created_at >= $2 AND created_at < $3
        GROUP BY model_name
      `, [userFilter.params[0], dayStart, dayEnd])

      let totalCostUSD = 0, totalTokens = 0, totalPromptTokens = 0, totalCompletionTokens = 0, totalRequests = 0
      const models = []

      result.rows.forEach(r => {
        const p = Number(r.p_tokens), c = Number(r.c_tokens), count = Number(r.cnt)
        const cost = calculateCost(r.model_name, p, c, count)
        totalCostUSD += cost
        totalTokens += (p + c)
        totalPromptTokens += p
        totalCompletionTokens += c
        totalRequests += count
        models.push({ modelName: r.model_name, costCNY: cost * EXCHANGE_RATE, tokens: p + c, requests: count })
      })

      res.json({
        tokenName: userFilter.displayName,
        date, totalCost: totalCostUSD, totalCostCNY: totalCostUSD * EXCHANGE_RATE,
        totalTokens, totalPromptTokens, totalCompletionTokens, totalRequests,
        models: models.sort((a, b) => b.costCNY - a.costCNY)
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/user-hourly', async (req, res) => {
    try {
      const { date } = req.query
      const userFilter = await resolveUserFilter(req.query)
      if (!userFilter || !date) return res.status(400).json({ error: 'Missing or invalid token/token_name/date' })

      const dayStart = Math.floor(new Date(date + 'T00:00:00+08:00').getTime() / 1000)
      const dayEnd = dayStart + 86400

      const result = await pgPool.query(`
        SELECT 
          EXTRACT(HOUR FROM TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai')::int as hour,
          model_name,
          SUM(prompt_tokens + completion_tokens) as total_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE type = 2 AND ${userFilter.whereExpr} AND created_at >= $2 AND created_at < $3
        GROUP BY hour, model_name
        ORDER BY hour
      `, [userFilter.params[0], dayStart, dayEnd])

      const hourMap = {}
      const modelSet = new Set()
      result.rows.forEach(r => {
        const h = r.hour
        if (!hourMap[h]) hourMap[h] = { hour: `${String(h).padStart(2, '0')}:00` }
        hourMap[h][r.model_name] = Number(r.total_tokens)
        modelSet.add(r.model_name)
      })

      const chartData = []
      for (let h = 0; h < 24; h++) {
        chartData.push(hourMap[h] || { hour: `${String(h).padStart(2, '0')}:00` })
      }

      const topModels = [...modelSet]
        .map(m => ({ name: m, total: chartData.reduce((s, d) => s + (d[m] || 0), 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map(m => m.name)

      res.json({ chartData, topModels })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/tokens', async (req, res) => {
    try {
      const result = await pgPool.query(`
        SELECT DISTINCT token_name 
        FROM logs 
        WHERE type = 2 AND token_name != '' 
        ORDER BY token_name
      `)
      res.json(result.rows.map(r => r.token_name))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/newapi/verify-token', async (req, res) => {
    try {
      const userFilter = await resolveUserFilter(req.query)
      if (!userFilter) {
        return res.status(400).json({ error: 'Missing or invalid token/token_name' })
      }

      const result = await pgPool.query(`
        SELECT 1
        FROM logs
        WHERE type = 2 AND ${userFilter.whereExpr}
        LIMIT 1
      `, userFilter.params)

      res.json({
        valid: true,
        hasUsage: result.rows.length > 0,
        tokenName: userFilter.displayName,
        tokenId: userFilter.tokenId
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ============================================================
  // GET /api/newapi/model-trend?start=YYYY-MM-DD&end=YYYY-MM-DD&granularity=hour|day|week|month
  // Model distribution with time granularity for stacked bar chart
  // ============================================================
  app.get('/api/newapi/model-trend', async (req, res) => {
    try {
      const { start, end, granularity = 'day' } = req.query
      
      if (!start || !end) {
        return res.status(400).json({ error: 'Missing start or end date param' })
      }

      const dayStart = Math.floor(new Date(start + 'T00:00:00+08:00').getTime() / 1000)
      const dayEnd = Math.floor(new Date(end + 'T23:59:59+08:00').getTime() / 1000)

      let timeBucketExpr
      switch (granularity) {
        case 'hour':
          timeBucketExpr = `TO_CHAR(TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:00')`
          break
        case 'week':
          timeBucketExpr = `TO_CHAR(date_trunc('week', TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai'), 'YYYY-MM-DD')`
          break
        case 'month':
          timeBucketExpr = `TO_CHAR(date_trunc('month', TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai'), 'YYYY-MM')`
          break
        default: // day
          timeBucketExpr = `TO_CHAR(TO_TIMESTAMP(created_at) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`
      }

      const result = await pgPool.query(`
        SELECT 
          ${timeBucketExpr} as time_bucket,
          model_name,
          SUM(prompt_tokens) as p_tokens,
          SUM(completion_tokens) as c_tokens,
          COUNT(*) as cnt
        FROM logs 
        WHERE type = 2 
          AND created_at >= $1 
          AND created_at < $2
        GROUP BY time_bucket, model_name
        ORDER BY time_bucket
      `, [dayStart, dayEnd])

      // Aggregate by time bucket
      const timeMap = {}
      const modelSet = new Set()
      
      result.rows.forEach(r => {
        const bucket = r.time_bucket
        if (!timeMap[bucket]) {
          timeMap[bucket] = { bucket, models: {} }
        }
        
        const p = Number(r.p_tokens)
        const c = Number(r.c_tokens)
        const tokens = p + c
        
        timeMap[bucket].models[r.model_name] = tokens
        modelSet.add(r.model_name)
      })

      const sortedBuckets = Object.values(timeMap).sort((a, b) => a.bucket.localeCompare(b.bucket))
      const topModels = [...modelSet]
        .map(name => {
          const total = result.rows
            .filter(r => r.model_name === name)
            .reduce((sum, r) => sum + Number(r.p_tokens) + Number(r.c_tokens), 0)
          return { name, total }
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 8) // Top 8 models for stacked bar
        .map(m => m.name)

      // Build chart data
      const chartData = sortedBuckets.map(bucket => {
        const row = { bucket: bucket.bucket }
        topModels.forEach(model => {
          row[model] = bucket.models[model] || 0
        })
        return row
      })

      // Pie chart data (total by model)
      const pieData = [...modelSet]
        .map(name => {
          const totalTokens = result.rows
            .filter(r => r.model_name === name)
            .reduce((sum, r) => sum + Number(r.p_tokens) + Number(r.c_tokens), 0)
          const totalRequests = result.rows
            .filter(r => r.model_name === name)
            .reduce((sum, r) => sum + Number(r.cnt), 0)
          return { name, value: totalRequests, tokens: totalTokens }
        })
        .sort((a, b) => b.value - a.value)

      res.json({
        chartData,
        topModels,
        pieData,
        granularity
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return { pgPool, calculateCost, refreshPricingConfig }
}

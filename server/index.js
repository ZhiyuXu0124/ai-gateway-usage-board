import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mysql from 'mysql2/promise'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { setupNewApiRoutes } from './newapi.js'
import cron from 'node-cron'
import { setupFeishuNotify } from './feishu-notify.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PRICES_FILE = path.join(__dirname, 'model-prices.json')

const app = express()
app.use(cors())
app.use(express.json())

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
})

let channelMap = {}

async function loadChannels() {
  try {
    const [rows] = await pool.query('SELECT id, name FROM channels')
    channelMap = Object.fromEntries(rows.map(r => [r.id, r.name]))
    console.log(`Loaded ${rows.length} channels`)
  } catch (err) {
    console.warn('Failed to load channels:', err.message)
  }
}

async function testConnection() {
  try {
    const conn = await pool.getConnection()
    console.log('MySQL connected successfully')
    conn.release()
    await loadChannels()
  } catch (err) {
    console.error('MySQL connection failed:', err.message)
    process.exit(1)
  }
}

app.get('/api/tokens', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT token_name FROM logs WHERE token_name != "" ORDER BY token_name'
    )
    res.json(rows.map(r => r.token_name))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/stats', async (req, res) => {
  const { token, start, end } = req.query
  
  if (!token || !start || !end) {
    return res.status(400).json({ error: 'Missing required params: token, start, end' })
  }

  const startTs = Math.floor(new Date(start).getTime() / 1000)
  const endTs = Math.floor(new Date(end).getTime() / 1000)

  try {
    const [rows] = await pool.query(`
      SELECT 
        model_name,
        channel_id,
        COUNT(*) as request_count,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens
      FROM logs 
      WHERE token_name = ? 
        AND type = 2 
        AND created_at >= ? 
        AND created_at <= ?
      GROUP BY model_name, channel_id
      ORDER BY (total_prompt_tokens + total_completion_tokens) DESC
    `, [token, startTs, endTs])

    const summary = {
      totalRequests: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0
    }

    const models = rows.map(r => {
      const promptTokens = Number(r.total_prompt_tokens)
      const completionTokens = Number(r.total_completion_tokens)
      const totalTokens = promptTokens + completionTokens
      
      summary.totalRequests += Number(r.request_count)
      summary.totalPromptTokens += promptTokens
      summary.totalCompletionTokens += completionTokens
      summary.totalTokens += totalTokens

      return {
        modelName: r.model_name,
        channelId: r.channel_id,
        channelName: channelMap[r.channel_id] || `Channel ${r.channel_id}`,
        requestCount: Number(r.request_count),
        promptTokens,
        completionTokens,
        totalTokens
      }
    })

    res.json({ models, summary })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/trend', async (req, res) => {
  const { token, start, end } = req.query
  
  if (!token || !start || !end) {
    return res.status(400).json({ error: 'Missing required params' })
  }

  const startTs = Math.floor(new Date(start).getTime() / 1000)
  const endTs = Math.floor(new Date(end).getTime() / 1000)

  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE(FROM_UNIXTIME(created_at)) as date,
        model_name,
        COUNT(*) as request_count,
        SUM(prompt_tokens + completion_tokens) as total_tokens
      FROM logs 
      WHERE token_name = ? 
        AND type = 2 
        AND created_at >= ? 
        AND created_at <= ?
      GROUP BY date, model_name
      ORDER BY date
    `, [token, startTs, endTs])

    res.json(rows.map(r => {
      const d = new Date(r.date)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return {
        date: dateStr,
        modelName: r.model_name,
        requestCount: Number(r.request_count),
        totalTokens: Number(r.total_tokens)
      }
    }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/models', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, models FROM channels WHERE status = 1')
    
    const modelSet = new Map()
    for (const row of rows) {
      if (!row.models) continue
      const modelList = row.models.split(',').map(m => m.trim()).filter(Boolean)
      for (const model of modelList) {
        if (!modelSet.has(model)) {
          modelSet.set(model, { channels: [], channelNames: [] })
        }
        const entry = modelSet.get(model)
        if (!entry.channels.includes(row.id)) {
          entry.channels.push(row.id)
          entry.channelNames.push(row.name)
        }
      }
    }
    
    // 从 prices.json 读取已配置的模型
    let prices = {}
    try {
      const priceData = await fs.readFile(PRICES_FILE, 'utf8')
      prices = JSON.parse(priceData)
    } catch (e) {
      // prices.json 可能不存在
    }
    
    // 添加已配置但不在任何渠道中的模型
    for (const modelName of Object.keys(prices)) {
      if (!modelSet.has(modelName)) {
        modelSet.set(modelName, { channels: [], channelNames: ['自定义'] })
      }
    }
    
    const models = Array.from(modelSet.entries()).map(([name, data]) => ({
      modelName: name,
      channelIds: data.channels,
      channelNames: data.channelNames
    })).sort((a, b) => a.modelName.localeCompare(b.modelName))
    
    res.json(models)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/prices', async (req, res) => {
  try {
    const data = await fs.readFile(PRICES_FILE, 'utf8')
    res.json(JSON.parse(data))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/prices', async (req, res) => {
  try {
    const { modelName, input, output } = req.body
    if (!modelName) return res.status(400).json({ error: 'Missing modelName' })
    
    const data = await fs.readFile(PRICES_FILE, 'utf8')
    const prices = JSON.parse(data)
    
    prices[modelName] = { input: Number(input), output: Number(output) }
    
    await fs.writeFile(PRICES_FILE, JSON.stringify(prices, null, 2), 'utf8')
    res.json({ success: true, prices })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/prices/remote', async (req, res) => {
  try {
    const response = await fetch('https://models.dev/api.json')
    const data = await response.json()
    
    const remotePrices = {}
    for (const [providerId, provider] of Object.entries(data)) {
      if (provider.models) {
        for (const [modelId, model] of Object.entries(provider.models)) {
          if (model.cost && (model.cost.input !== undefined || model.cost.output !== undefined)) {
            remotePrices[modelId] = {
              input: model.cost.input || 0,
              output: model.cost.output || 0
            }
          }
        }
      }
    }
    res.json(remotePrices)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/prices/sync', async (req, res) => {
  try {
    let remotePrices = req.body
    const data = await fs.readFile(PRICES_FILE, 'utf8')
    const localPrices = JSON.parse(data)
    
    const conflicts = []
    const newModels = []
    
    if (Array.isArray(remotePrices)) {
      for (const item of remotePrices) {
        const model = item.modelName
        const price = { input: item.input, output: item.output }
        let localKey = Object.keys(localPrices).find(k => k.toLowerCase() === model.toLowerCase())
        
        if (localKey) {
          const local = localPrices[localKey]
          if (local.input !== price.input || local.output !== price.output) {
            conflicts.push({ model: localKey, local, remote: price })
          }
        } else {
          newModels.push({ model, price })
        }
      }
    } else {
      for (const [model, price] of Object.entries(remotePrices)) {
        let localKey = Object.keys(localPrices).find(k => k.toLowerCase() === model.toLowerCase())
        
        if (localKey) {
          const local = localPrices[localKey]
          if (local.input !== price.input || local.output !== price.output) {
            conflicts.push({ model: localKey, local, remote: price })
          }
        } else {
          newModels.push({ model, price })
        }
      }
    }
    
    res.json({ conflicts, newModels })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/prices/bulk', async (req, res) => {
  try {
    const updates = req.body // { 'model': { input, output }, ... }
    const data = await fs.readFile(PRICES_FILE, 'utf8')
    const prices = JSON.parse(data)
    
    for (const [model, price] of Object.entries(updates)) {
      prices[model] = { input: Number(price.input), output: Number(price.output) }
    }
    
    await fs.writeFile(PRICES_FILE, JSON.stringify(prices, null, 2), 'utf8')
    res.json({ success: true, prices })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3001
testConnection().then(() => {
  const newApiDeps = setupNewApiRoutes(app)

  const webhookUrl = process.env.FEISHU_WEBHOOK_URL
  if (webhookUrl) {
    const { sendDailyReport } = setupFeishuNotify(newApiDeps)

    cron.schedule('0 17 * * *', async () => {
      console.log('Feishu cron triggered:', new Date().toISOString())
      await sendDailyReport()
    }, { timezone: 'Asia/Shanghai' })

    console.log('Feishu cron job scheduled: 0 17 * * * (Asia/Shanghai)')

    app.get('/api/newapi/test-notify', async (req, res) => {
      try {
        const result = await sendDailyReport(req.query.date)
        res.json(result)
      } catch (err) {
        res.status(500).json({ error: err.message })
      }
    })
  } else {
    console.log('Feishu notification disabled: FEISHU_WEBHOOK_URL not set')
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`)
  })
})

import { useState, useEffect, useMemo, useRef } from 'react'
import dayjs from 'dayjs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import PriceConfig from './PriceConfig'
import { getDisplayName } from './model-name-map'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6']

const DATE_RANGES = [
  { label: '今日', key: 'today' },
  { label: '本周', key: 'week' },
  { label: '近7天', key: 'last7' },
  { label: '近31天', key: 'last31' },
  { label: '自定义', key: 'custom' }
]

function getDateRange(key) {
  const now = dayjs()
  switch (key) {
    case 'today':
      return { start: now.startOf('day'), end: now.endOf('day') }
    case 'week':
      return { start: now.startOf('week'), end: now.endOf('day') }
    case 'last7':
      return { start: now.subtract(6, 'day').startOf('day'), end: now.endOf('day') }
    case 'last31':
      return { start: now.subtract(30, 'day').startOf('day'), end: now.endOf('day') }
    default:
      return { start: now.startOf('day'), end: now.endOf('day') }
  }
}

function formatTokens(tokens) {
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(2) + 'M'
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K'
  return tokens.toString()
}

function TokenAutocomplete({ tokens, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const ref = useRef(null)

  const filtered = useMemo(() => {
    if (!inputValue) return tokens.slice(0, 20)
    return tokens.filter(t => t.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 20)
  }, [tokens, inputValue])

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="搜索令牌..."
        className="border rounded-md px-3 py-2 w-[240px]"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {filtered.map(t => (
            <div
              key={t}
              onClick={() => {
                onChange(t)
                setInputValue(t)
                setIsOpen(false)
              }}
              className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${t === value ? 'bg-blue-100' : ''}`}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('dashboard') // 'dashboard' | 'prices'
  const [modelPrices, setModelPrices] = useState({})
  
  const [tokens, setTokens] = useState([])
  const [selectedToken, setSelectedToken] = useState('')
  const [rangeKey, setRangeKey] = useState('today')
  const [customStart, setCustomStart] = useState(dayjs().format('YYYY-MM-DD'))
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'))
  const [stats, setStats] = useState(null)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAllModels, setShowAllModels] = useState(false)

  // Fetch prices on mount
  const fetchPrices = () => {
    fetch('/api/prices')
      .then(r => r.json())
      .then(setModelPrices)
      .catch(e => console.error('Failed to load prices', e))
  }

  useEffect(() => {
    fetchPrices()
    fetch('/api/tokens')
      .then(r => r.json())
      .then(data => {
        setTokens(data)
        if (data.length > 0) setSelectedToken(data[0])
      })
      .catch(e => setError('Failed to load tokens: ' + e.message))
  }, [])

  // Helper functions using state
  const findPrice = (modelName) => {
    const lower = modelName.toLowerCase()
    // Exact match first
    if (modelPrices[modelName]) return modelPrices[modelName]
    if (modelPrices[lower]) return modelPrices[lower]
    
    // Fuzzy match
    for (const [key, price] of Object.entries(modelPrices)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower.split('/').pop())) {
        return price
      }
    }
    return null
  }

  const calculateCost = (model) => {
    const price = findPrice(model.modelName)
    if (!price) return null
    return (model.promptTokens * price.input + model.completionTokens * price.output) / 1000000
  }

  useEffect(() => {
    if (!selectedToken) return
    
    let start, end
    if (rangeKey === 'custom') {
      start = dayjs(customStart).startOf('day')
      end = dayjs(customEnd).endOf('day')
    } else {
      const range = getDateRange(rangeKey)
      start = range.start
      end = range.end
    }

    setLoading(true)
    setError('')

    const params = new URLSearchParams({
      token: selectedToken,
      start: start.toISOString(),
      end: end.toISOString()
    })

    Promise.all([
      fetch(`/api/stats?${params}`).then(r => r.json()),
      fetch(`/api/trend?${params}`).then(r => r.json())
    ])
      .then(([statsData, trendData]) => {
        setStats(statsData)
        setTrend(trendData)
      })
      .catch(e => setError('Failed to load data: ' + e.message))
      .finally(() => setLoading(false))
  }, [selectedToken, rangeKey, customStart, customEnd])

  const allModels = useMemo(() => {
    if (!trend.length) return []
    return [...new Set(trend.map(t => t.modelName))]
  }, [trend])

  const stackedTrendData = useMemo(() => {
    if (!trend.length) return []
    const dateMap = {}
    trend.forEach(item => {
      if (!dateMap[item.date]) {
        dateMap[item.date] = { date: item.date }
      }
      dateMap[item.date][item.modelName] = (dateMap[item.date][item.modelName] || 0) + item.requestCount
    })
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  }, [trend])

  const pieData = useMemo(() => {
    if (!stats?.models) return { visible: [], hidden: [] }
    const total = stats.summary.totalTokens
    const sorted = [...stats.models].sort((a, b) => b.totalTokens - a.totalTokens)
    
    const modelAgg = {}
    sorted.forEach(m => {
      if (!modelAgg[m.modelName]) {
        modelAgg[m.modelName] = { modelName: m.modelName, totalTokens: 0 }
      }
      modelAgg[m.modelName].totalTokens += m.totalTokens
    })
    
    const aggList = Object.values(modelAgg).sort((a, b) => b.totalTokens - a.totalTokens)
    const visible = []
    const hidden = []
    
    aggList.forEach(m => {
      const percent = m.totalTokens / total
      if (percent >= 0.02 || visible.length < 5) {
        visible.push(m)
      } else {
        hidden.push(m)
      }
    })
    
    if (hidden.length > 0) {
      const otherTotal = hidden.reduce((sum, m) => sum + m.totalTokens, 0)
      visible.push({ modelName: `其他 (${hidden.length}个)`, totalTokens: otherTotal, isOther: true })
    }
    
    return { visible, hidden }
  }, [stats])

  const modelsWithMissingPrice = useMemo(() => {
    if (!stats?.models) return []
    return stats.models.filter(m => !findPrice(m.modelName))
  }, [stats, modelPrices])

  const isSkewed = useMemo(() => {
    if (!pieData.visible.length || !stats) return false
    const maxPercent = pieData.visible[0].totalTokens / stats.summary.totalTokens
    return maxPercent > 0.9
  }, [pieData, stats])

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">OneAPI 使用量看板</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setView('dashboard')}
              className={`px-4 py-2 rounded-md ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              看板
            </button>
            <button
              onClick={() => setView('prices')}
              className={`px-4 py-2 rounded-md ${view === 'prices' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              价格配置
            </button>
          </div>
        </div>

        {view === 'prices' ? (
          <PriceConfig prices={modelPrices} onUpdate={fetchPrices} />
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">令牌</label>
                  <TokenAutocomplete tokens={tokens} value={selectedToken} onChange={setSelectedToken} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">时间范围</label>
                  <div className="flex gap-1">
                    {DATE_RANGES.map(r => (
                      <button
                        key={r.key}
                        onClick={() => setRangeKey(r.key)}
                        className={`px-3 py-2 rounded-md text-sm ${
                          rangeKey === r.key
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {rangeKey === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={e => setCustomStart(e.target.value)}
                        className="border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={e => setCustomEnd(e.target.value)}
                        className="border rounded-md px-3 py-2"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>
            )}

            {loading && (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            )}

            {!loading && stats && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">总请求数</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.summary.totalRequests.toLocaleString()}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">总 Tokens</div>
                    <div className="text-2xl font-bold text-green-600">{formatTokens(stats.summary.totalTokens)}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Prompt Tokens</div>
                    <div className="text-2xl font-bold text-amber-600">{formatTokens(stats.summary.totalPromptTokens)}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Completion Tokens</div>
                    <div className="text-2xl font-bold text-purple-600">{formatTokens(stats.summary.totalCompletionTokens)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white rounded-lg shadow p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">模型分布（Tokens）</h2>
                      </div>
                      
                      <div className="space-y-3 pr-2 max-h-[400px] overflow-y-auto">
                        {pieData.visible.map((m, idx) => {
                          const percent = (m.totalTokens / stats.summary.totalTokens) * 100
                          return (
                            <div key={m.modelName}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium truncate" title={m.modelName}>{getDisplayName(m.modelName).split('/').pop()}</span>
                                <span className="text-gray-600">{percent.toFixed(1)}%</span>
                              </div>
                              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-500" 
                                  style={{ 
                                    width: `${percent}%`,
                                    backgroundColor: COLORS[idx % COLORS.length] 
                                  }} 
                                />
                              </div>
                              <div className="text-xs text-gray-400 text-right mt-0.5">{formatTokens(m.totalTokens)}</div>
                            </div>
                          )
                        })}
                      </div>

                      {pieData.hidden.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <div className="text-sm font-medium text-gray-600 mb-2">其他模型明细：</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {pieData.hidden.map(m => (
                              <div key={m.modelName} className="flex justify-between">
                                <span className="text-gray-600 truncate" title={m.modelName}>{getDisplayName(m.modelName).split('/').pop()}</span>
                                <span className="text-gray-800 ml-2">{formatTokens(m.totalTokens)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-lg font-semibold mb-4">每日趋势（按模型）</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stackedTrendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={d => d.slice(5)} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {allModels.slice(0, 8).map((model, idx) => (
                          <Bar 
                            key={model} 
                            dataKey={model} 
                            stackId="a" 
                            fill={COLORS[idx % COLORS.length]} 
                            name={getDisplayName(model).split('/').pop()} 
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">模型明细</h2>
                    {modelsWithMissingPrice.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                          ⚠️ {modelsWithMissingPrice.length} 个模型无价格数据
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-2 px-3">模型</th>
                          <th className="text-left py-2 px-3">渠道</th>
                          <th className="text-right py-2 px-3">请求数</th>
                          <th className="text-right py-2 px-3">总 Tokens</th>
                          <th className="text-right py-2 px-3">Prompt</th>
                          <th className="text-right py-2 px-3">Completion</th>
                          <th className="text-right py-2 px-3">预估费用</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.models.map((model, idx) => {
                          const cost = calculateCost(model)
                          return (
                              <tr key={`${model.modelName}-${model.channelId}`} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                  />
                                  {getDisplayName(model.modelName)}
                                </td>
                              <td className="py-2 px-3 text-gray-600">{model.channelName}</td>
                              <td className="text-right py-2 px-3">{model.requestCount.toLocaleString()}</td>
                              <td className="text-right py-2 px-3 font-medium">{formatTokens(model.totalTokens)}</td>
                              <td className="text-right py-2 px-3 text-gray-600">{formatTokens(model.promptTokens)}</td>
                              <td className="text-right py-2 px-3 text-gray-600">{formatTokens(model.completionTokens)}</td>
                              <td className="text-right py-2 px-3">
                                {cost !== null ? (
                                  <span className="text-green-600">${cost.toFixed(4)}</span>
                                ) : (
                                  <span className="text-gray-400" title="无价格数据">-</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
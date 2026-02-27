import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { fetchJson } from './api-client'

const PERSONAL_TOKEN_KEY = 'personal_query_token'

function formatCost(val) {
  const num = Number(val || 0)
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(num)
}

function formatNumber(num) {
  if (!num) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}

function formatTokens(num) {
  const n = Number(num || 0)
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function TokenInputView({ onVerified }) {
  const [tokenInput, setTokenInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const token = tokenInput.trim()
    if (!token) {
      setError('请输入 Token')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchJson(`/api/newapi/verify-token?token=${encodeURIComponent(token)}`)
      if (!result.valid) {
        setError('Token 校验失败，请检查后重试')
        return
      }
      onVerified(token)
    } catch (err) {
      setError('校验失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-gray-900/70 backdrop-blur-xl p-8 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
        <h1 className="text-2xl font-bold text-white mb-2">个人用量查询</h1>
        <p className="text-sm text-gray-400 mb-6">请输入你的个人 Token，校验通过后进入个人详情页。</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">个人 Token</label>
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              placeholder="请输入 sk- 开头 Token"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? '校验中...' : '进入个人详情'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PersonalDetailView({ tokenKey, onBack }) {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [overview, setOverview] = useState({ totalCostCNY: 0, totalTokens: 0, totalRequests: 0 })
  const [daily, setDaily] = useState({ totalCostCNY: 0, totalTokens: 0, totalRequests: 0, models: [] })
  const [trend, setTrend] = useState([])

  useEffect(() => {
    const controller = new AbortController()

    const loadData = async () => {
      setLoading(true)
      setError('')
      try {
        const encodedToken = encodeURIComponent(tokenKey)

        const [verify, allStats, dayStats, trendRows] = await Promise.all([
          fetchJson(`/api/newapi/verify-token?token=${encodedToken}`, { signal: controller.signal }),
          fetchJson(`/api/newapi/user-overview?token=${encodedToken}`, { signal: controller.signal }),
          fetchJson(`/api/newapi/user-daily-overview?token=${encodedToken}&date=${selectedDate}`, { signal: controller.signal }),
          fetchJson(`/api/newapi/user-trend?token=${encodedToken}&days=30`, { signal: controller.signal })
        ])

        if (controller.signal.aborted) return

        if (!verify.valid) {
          setError('Token 无效或不存在')
          return
        }

        setDisplayName(verify.tokenName || allStats.tokenName || tokenKey)

        setOverview({
          totalCostCNY: allStats.totalCostCNY || 0,
          totalTokens: allStats.totalTokens || 0,
          totalRequests: allStats.totalRequests || 0
        })

        setDaily({
          totalCostCNY: dayStats.totalCostCNY || 0,
          totalTokens: dayStats.totalTokens || 0,
          totalRequests: dayStats.totalRequests || 0,
          models: (dayStats.models || []).sort((a, b) => b.costCNY - a.costCNY)
        })

        setTrend((trendRows || []).slice(-10).reverse())
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('加载失败: ' + err.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => controller.abort()
  }, [tokenKey, selectedDate])

  const titleDate = useMemo(() => {
    return selectedDate === dayjs().format('YYYY-MM-DD') ? '今日' : selectedDate
  }, [selectedDate])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">个人详情</h1>
            <p className="text-sm text-gray-400 mt-1">令牌标识: <span className="font-mono text-cyan-400">{displayName || tokenKey}</span></p>
          </div>
          <button onClick={onBack} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
            返回 Token 输入页
          </button>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-gray-900/60 p-4 flex items-center gap-3">
          <label className="text-sm text-gray-400">选择日期</label>
          <input
            type="date"
            value={selectedDate}
            max={dayjs().format('YYYY-MM-DD')}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm"
          />
          <span className="text-xs text-gray-500">当前查看: {titleDate}</span>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-500/20 bg-gray-900/60 p-5">
            <p className="text-xs text-gray-400">累计消耗</p>
            <p className="text-xl font-bold text-emerald-400 mt-2">{formatCost(overview.totalCostCNY)}</p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-gray-900/60 p-5">
            <p className="text-xs text-gray-400">累计 Tokens</p>
            <p className="text-xl font-bold text-purple-400 mt-2">{formatTokens(overview.totalTokens)}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-gray-900/60 p-5">
            <p className="text-xs text-gray-400">累计调用次数</p>
            <p className="text-xl font-bold text-cyan-400 mt-2">{formatNumber(overview.totalRequests)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-cyan-500/20 bg-gray-900/60 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">{titleDate} 模型明细</h2>
            {loading ? (
              <p className="text-sm text-gray-400">加载中...</p>
            ) : daily.models && daily.models.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {daily.models.map((m, idx) => (
                  <div key={idx} className="rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 font-mono truncate" title={m.modelName}>{m.modelName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Tokens: {formatTokens(m.tokens)} · 请求: {formatNumber(m.requests)}</p>
                    </div>
                    <p className="text-sm text-cyan-300 font-mono ml-3">{formatCost(m.costCNY)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">该日期暂无记录</p>
            )}
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-gray-900/60 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">近 10 天趋势</h2>
            {trend.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {trend.map((d, idx) => (
                  <div key={idx} className="rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-300">{d.date}</p>
                      <p className="text-xs text-gray-500">Tokens: {formatTokens(d.totalTokens)} · 请求: {formatNumber(d.totalRequests)}</p>
                    </div>
                    <p className="text-sm text-emerald-300 font-mono">{formatCost(d.totalCostCNY)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">暂无趋势数据</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PersonalTokenPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isDetailRoute = location.pathname === '/personal/detail'
  const [verifiedToken, setVerifiedToken] = useState(() => sessionStorage.getItem(PERSONAL_TOKEN_KEY) || '')

  useEffect(() => {
    if (isDetailRoute && !verifiedToken) {
      navigate('/personal', { replace: true })
    }
  }, [isDetailRoute, verifiedToken, navigate])

  const handleVerified = (token) => {
    sessionStorage.setItem(PERSONAL_TOKEN_KEY, token)
    setVerifiedToken(token)
    navigate('/personal/detail', { replace: true })
  }

  const handleBack = () => {
    sessionStorage.removeItem(PERSONAL_TOKEN_KEY)
    setVerifiedToken('')
    navigate('/personal', { replace: true })
  }

  if (!isDetailRoute) {
    return <TokenInputView onVerified={handleVerified} />
  }

  return <PersonalDetailView tokenKey={verifiedToken} onBack={handleBack} />
}

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { fetchJson } from './api-client'
import { TokenDetailView } from './NewApiDashboard.jsx'

const PERSONAL_TOKEN_KEY = 'personal_query_token'
const PERSONAL_TOKEN_META_KEY = 'personal_query_token_meta'

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
      onVerified(token, { tokenId: result.tokenId, tokenName: result.tokenName || token })
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

export default function PersonalTokenPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isDetailRoute = location.pathname === '/personal/detail'
  const [verifiedToken, setVerifiedToken] = useState(() => sessionStorage.getItem(PERSONAL_TOKEN_KEY) || '')
  const [tokenMeta, setTokenMeta] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PERSONAL_TOKEN_META_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (!isDetailRoute || !verifiedToken || tokenMeta?.tokenId) {
      return
    }

    let cancelled = false

    fetchJson(`/api/newapi/verify-token?token=${encodeURIComponent(verifiedToken)}`)
      .then((result) => {
        if (cancelled || !result.valid) return
        const nextMeta = { tokenId: result.tokenId, tokenName: result.tokenName || verifiedToken }
        setTokenMeta(nextMeta)
        sessionStorage.setItem(PERSONAL_TOKEN_META_KEY, JSON.stringify(nextMeta))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [isDetailRoute, tokenMeta?.tokenId, verifiedToken])

  useEffect(() => {
    if (isDetailRoute && !verifiedToken) {
      navigate('/personal', { replace: true })
    }
  }, [isDetailRoute, verifiedToken, navigate])

  const handleVerified = (token, meta) => {
    sessionStorage.setItem(PERSONAL_TOKEN_KEY, token)
    sessionStorage.setItem(PERSONAL_TOKEN_META_KEY, JSON.stringify(meta))
    setVerifiedToken(token)
    setTokenMeta(meta)
    navigate('/personal/detail', { replace: true })
  }

  const handleBack = () => {
    sessionStorage.removeItem(PERSONAL_TOKEN_KEY)
    sessionStorage.removeItem(PERSONAL_TOKEN_META_KEY)
    setVerifiedToken('')
    setTokenMeta(null)
    navigate('/personal', { replace: true })
  }

  if (!isDetailRoute) {
    return <TokenInputView onVerified={handleVerified} />
  }

  if (!tokenMeta?.tokenId) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-300 font-sans selection:bg-cyan-500/30 pb-12 pt-20 px-6 max-w-7xl mx-auto flex items-center justify-center">
        <p className="text-sm text-gray-400">正在加载令牌详情...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-sans selection:bg-cyan-500/30 pb-12 pt-20 px-6 max-w-7xl mx-auto">
      <TokenDetailView tokenId={tokenMeta.tokenId} tokenName={tokenMeta.tokenName || verifiedToken} onBack={handleBack} />
    </div>
  )
}

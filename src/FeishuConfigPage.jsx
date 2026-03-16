import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from './api-client'

const FIELD_GROUPS = [
  {
    title: '机器人与阈值',
    fields: [
      { key: 'FEISHU_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
      { key: 'FEISHU_ALERT_THRESHOLD', label: '超预算阈值(元)', placeholder: '100' },
      { key: 'FEISHU_RETRY_MAX_ATTEMPTS', label: '重试次数', placeholder: '4' },
      { key: 'FEISHU_RETRY_DELAY_MS', label: '重试间隔(ms)', placeholder: '30000' }
    ]
  },
  {
    title: '@用户映射',
    fields: [
      { key: 'FEISHU_USER_MAPPING', label: 'Token名称到open_id映射(JSON)', placeholder: '{"张三":"ou_xxx"}' }
    ]
  },
  {
    title: '多维表格写入',
    fields: [
      { key: 'FEISHU_APP_ID', label: 'App ID', placeholder: 'cli_xxx' },
      { key: 'FEISHU_APP_SECRET', label: 'App Secret', placeholder: 'your_feishu_app_secret', secret: true },
      { key: 'FEISHU_BITABLE_APP_TOKEN', label: 'Bitable App Token', placeholder: 'app_xxx' },
      { key: 'FEISHU_BITABLE_TABLE_ID', label: 'Bitable Table ID', placeholder: 'tbl_xxx' },
      { key: 'FEISHU_BITABLE_DATE_FIELD', label: '日期字段名', placeholder: '时间' },
      { key: 'FEISHU_BITABLE_PERSON_FIELD', label: '人员字段名', placeholder: '人员' },
      { key: 'FEISHU_BITABLE_COST_FIELD', label: '金额字段名', placeholder: '消耗金额' },
      { key: 'FEISHU_BITABLE_REMARK_FIELD', label: '报备字段名', placeholder: '超额报备' }
    ]
  }
]

const ALL_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key))

export default function FeishuConfigPage() {
  const [form, setForm] = useState(() => Object.fromEntries(ALL_KEYS.map((k) => [k, ''])))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadConfig = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchJson('/api/newapi/feishu-config', { signal: controller.signal })
        if (controller.signal.aborted) return
        setForm((prev) => ({ ...prev, ...data }))
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('加载配置失败: ' + err.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadConfig()
    return () => controller.abort()
  }, [])

  const canTest = useMemo(() => Boolean(form.FEISHU_WEBHOOK_URL), [form.FEISHU_WEBHOOK_URL])

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (form.FEISHU_USER_MAPPING) {
        JSON.parse(form.FEISHU_USER_MAPPING)
      }

      await fetchJson('/api/newapi/feishu-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      setMessage('保存成功，配置已即时生效（无需重启服务）')
    } catch (err) {
      setError('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setError('')
    setMessage('')
    setTestResult(null)
    try {
      const result = await fetchJson('/api/newapi/test-notify')
      setTestResult(result)
      if (result.success) {
        setMessage('测试推送成功')
      } else {
        setError(`测试推送未成功: ${result.reason || result.error || 'unknown'}`)
      }
    } catch (err) {
      setError('测试失败: ' + err.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-xl border border-emerald-500/20 bg-gray-900/60 p-6">
          <h1 className="text-2xl font-bold text-white">飞书在线配置</h1>
          <p className="text-sm text-gray-400 mt-2">用于配置日报推送、@提醒和多维表格写入。保存后即时生效，并持久化到服务端配置文件。</p>
          <p className="text-xs text-amber-300 mt-3">提示：当前页面未加鉴权，仅建议在内网开发环境使用。</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 text-sm text-gray-400">加载中...</div>
        ) : (
          FIELD_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">{group.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.fields.map((field) => (
                  <div key={field.key} className={field.key === 'FEISHU_USER_MAPPING' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm text-gray-400 mb-2">{field.label}</label>
                    {field.key === 'FEISHU_USER_MAPPING' ? (
                      <textarea
                        value={form[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 font-mono"
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        type={field.secret ? 'password' : 'text'}
                        value={form[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {error && <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}
        {message && <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-sm text-emerald-300">{message}</div>}

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || loading || !canTest}
            className="rounded-lg border border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 disabled:opacity-40 px-4 py-2 text-sm font-medium"
          >
            {testing ? '测试中...' : '发送测试推送'}
          </button>
          {!canTest && <span className="text-xs text-gray-500 self-center">需先填写 Webhook URL 才能测试</span>}
        </div>

        {testResult && (
          <div className="rounded-xl border border-cyan-500/20 bg-gray-900/50 p-6">
            <h3 className="text-sm font-semibold text-white mb-2">测试结果</h3>
            <pre className="text-xs text-gray-300 overflow-x-auto">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

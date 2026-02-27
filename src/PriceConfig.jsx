import { useState, useEffect } from 'react'
import { getDisplayName, normalizeModelName } from './model-name-map'
import { fetchJson } from './api-client'

export default function PriceConfig({ prices, onUpdate }) {
  const [usedModels, setUsedModels] = useState([])
  const [modelNameMap, setModelNameMap] = useState({}) // 存储 displayName -> originalName 映射
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newModel, setNewModel] = useState({ name: '', input: '', output: '' })

  useEffect(() => {
    loadUsedModels()
  }, [])

  const loadUsedModels = async () => {
    setLoading(true)
    try {
      const models = await fetchJson('/api/models')
      
      // 构建显示名称映射
      const nameMap = {}
      
      setUsedModels(models.map(m => {
        const displayName = getDisplayName(m.modelName)
        // 如果显示名称与原始名称不同，建立映射
        if (displayName !== m.modelName) {
          nameMap[displayName] = m.modelName
        }
        return {
          modelName: m.modelName,
          displayName: displayName,
          channels: m.channelNames || [],
          totalTokens: 0,
          requestCount: 0
        }
      }).sort((a, b) => a.displayName.localeCompare(b.displayName)))
      
      setModelNameMap(nameMap)
    } catch (e) {
      console.error('Failed to load models:', e)
    } finally {
      setLoading(false)
    }
  }

  const getPrice = (originalName, displayName) => {
    // 优先查找显示名称
    if (displayName && prices[displayName]) return prices[displayName]
    // 其次查找原始名称
    if (prices[originalName]) return prices[originalName]
    // 不区分大小写匹配
    const key = Object.keys(prices).find(k => k.toLowerCase() === (displayName || originalName).toLowerCase())
    return key ? prices[key] : null
  }

  // 保存价格时使用的模型名称（优先使用原始ID，除非是自定义模型）
  const getSaveName = (originalName, displayName) => {
    // 如果是火山引擎特殊ID，使用原始名称
    if (originalName !== displayName) {
      return originalName
    }
    return displayName || originalName
  }

  const handleSave = async (originalName, displayName, input, output) => {
    const saveName = getSaveName(originalName, displayName)
    try {
      await fetchJson('/api/prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName: saveName, input, output })
      })
      onUpdate()
    } catch (e) {
      alert('保存错误: ' + e.message)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const remotePrices = await fetchJson('/api/prices/remote')
      
      if (remotePrices.error) {
        throw new Error(remotePrices.error)
      }

      const relevantRemote = {}
      
      for (const model of usedModels) {
        const nameToMatch = model.displayName || model.modelName
        const lowerModel = nameToMatch.toLowerCase()
        for (const [remoteModel, price] of Object.entries(remotePrices)) {
          if (remoteModel.toLowerCase() === lowerModel || 
              remoteModel.toLowerCase().includes(lowerModel) ||
              lowerModel.includes(remoteModel.toLowerCase())) {
            relevantRemote[model.modelName] = { 
              remoteModel, 
              displayName: model.displayName,
              originalName: model.modelName,
              ...price 
            }
            break
          }
        }
      }

      const conflicts = []
      const newPrices = []
      
      for (const model of usedModels) {
        const remoteInfo = relevantRemote[model.modelName]
        if (!remoteInfo) continue
        
        const local = getPrice(model.modelName, model.displayName)
        if (local) {
          if (local.input !== remoteInfo.input || local.output !== remoteInfo.output) {
            conflicts.push({
              model: model.displayName || model.modelName,
              originalName: model.modelName,
              local,
              remote: { input: remoteInfo.input, output: remoteInfo.output },
              remoteModel: remoteInfo.remoteModel
            })
          }
        } else {
          newPrices.push({
            model: model.displayName || model.modelName,
            originalName: model.modelName,
            price: { input: remoteInfo.input, output: remoteInfo.output },
            remoteModel: remoteInfo.remoteModel
          })
        }
      }

      const notFound = usedModels
        .filter(m => !relevantRemote[m.modelName] && !getPrice(m.modelName, m.displayName))
        .map(m => m.displayName || m.modelName)
      
      setSyncResult({ conflicts, newPrices, notFound })
      
    } catch (e) {
      alert('同步失败: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  const applySync = async (selection) => {
    try {
      const updates = {}
      selection.forEach(item => {
        // 优先使用原始名称保存
        const saveName = item.originalName || item.model
        updates[saveName] = { input: item.input, output: item.output }
      })
      
      await fetchJson('/api/prices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      setSyncResult(null)
      onUpdate()
      alert('同步完成')
    } catch (e) {
      alert('应用同步失败')
    }
  }

  const handleAddModel = async () => {
    if (!newModel.name.trim()) {
      alert('请输入模型名称')
      return
    }
    // 自定义模型直接使用输入的名称作为 key
    await handleSave(newModel.name.trim(), newModel.name.trim(), newModel.input || 0, newModel.output || 0)
    setNewModel({ name: '', input: '', output: '' })
    setShowAddModal(false)
  }

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-6">加载中...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">模型价格配置</h2>
          <p className="text-sm text-gray-500 mt-1">
            显示您 OneAPI 平台配置的 {usedModels.length} 个模型
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + 添加模型
          </button>
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? '同步中...' : '从 models.dev 同步价格'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-3">模型名称</th>
              <th className="p-3">使用渠道</th>
              <th className="p-3">输入价格 ($/1M)</th>
              <th className="p-3">输出价格 ($/1M)</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {usedModels.map((m) => (
              <PriceRow 
                key={m.modelName} 
                model={m} 
                price={getPrice(m.modelName, m.displayName)}
                onSave={handleSave}
              />
            ))}
          </tbody>
        </table>
      </div>

      {syncResult && (
        <SyncModal 
          result={syncResult} 
          onClose={() => setSyncResult(null)} 
          onApply={applySync} 
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">添加新模型</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">模型名称</label>
                <input
                  type="text"
                  value={newModel.name}
                  onChange={e => setNewModel({ ...newModel, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="如: gpt-4o-mini"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">输入价格 ($/1M)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newModel.input}
                    onChange={e => setNewModel({ ...newModel, input: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="0.15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">输出价格 ($/1M)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newModel.output}
                    onChange={e => setNewModel({ ...newModel, output: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="0.60"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                取消
              </button>
              <button 
                onClick={handleAddModel}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PriceRow({ model, price, onSave }) {
  const [input, setInput] = useState(price?.input ?? '')
  const [output, setOutput] = useState(price?.output ?? '')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setInput(price?.input ?? '')
    setOutput(price?.output ?? '')
    setDirty(false)
  }, [price])

  const handleSave = () => {
    onSave(model.modelName, model.displayName, input || 0, output || 0)
    setDirty(false)
  }

  const hasPrice = price !== null
  // 显示标准化后的名称
  const displayName = model.displayName || model.modelName
  // 如果名称被转换过，显示提示
  const isTransformed = model.displayName && model.displayName !== model.modelName

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-3">
        <div className="font-mono text-sm" title={isTransformed ? `原始ID: ${model.modelName}` : ''}>
          {displayName}
          {isTransformed && (
            <span className="ml-1 text-xs text-gray-400" title={model.modelName}>ⓘ</span>
          )}
        </div>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          {model.channels.slice(0, 3).map((ch, i) => (
            <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{ch}</span>
          ))}
          {model.channels.length > 3 && (
            <span className="text-xs text-gray-500">+{model.channels.length - 3}</span>
          )}
        </div>
      </td>
      <td className="p-3">
        <input 
          type="number" 
          step="0.01"
          value={input} 
          onChange={e => { setInput(e.target.value); setDirty(true) }}
          placeholder={hasPrice ? '' : '未设置'}
          className={`border rounded px-2 py-1 w-24 ${!hasPrice && !dirty ? 'border-orange-300 bg-orange-50' : ''}`}
        />
      </td>
      <td className="p-3">
        <input 
          type="number" 
          step="0.01"
          value={output} 
          onChange={e => { setOutput(e.target.value); setDirty(true) }}
          placeholder={hasPrice ? '' : '未设置'}
          className={`border rounded px-2 py-1 w-24 ${!hasPrice && !dirty ? 'border-orange-300 bg-orange-50' : ''}`}
        />
      </td>
      <td className="p-3">
        {dirty && (
          <button onClick={handleSave} className="text-blue-600 hover:underline font-medium">保存</button>
        )}
        {!hasPrice && !dirty && (
          <span className="text-orange-500 text-sm">需配置</span>
        )}
      </td>
    </tr>
  )
}

function SyncModal({ result, onClose, onApply }) {
  const [selected, setSelected] = useState([])
  
  useEffect(() => {
    const initial = result.newPrices.map(m => ({
      model: m.model,
      originalName: m.originalName,
      input: m.price.input,
      output: m.price.output
    }))
    setSelected(initial)
  }, [result])

  const toggle = (model, originalName, price) => {
    const exists = selected.find(s => s.originalName === originalName)
    
    if (exists) {
      setSelected(selected.filter(s => s.originalName !== originalName))
    } else {
      setSelected([...selected, { model, originalName, input: price.input, output: price.output }])
    }
  }
  
  const isSelected = (originalName) => selected.some(s => s.originalName === originalName)

  const totalItems = result.conflicts.length + result.newPrices.length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <h3 className="text-xl font-bold mb-4">同步确认（仅同步您使用的模型）</h3>
        
        <div className="flex-1 overflow-y-auto">
          {result.conflicts.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2 text-amber-600 flex items-center">
                <span className="mr-2">⚠️</span> 价格差异 ({result.conflicts.length})
              </h4>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">您的模型</th>
                      <th className="p-2 text-right">本地价格</th>
                      <th className="p-2 text-right">远程价格</th>
                      <th className="p-2 text-center">更新?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.conflicts.map(c => (
                      <tr key={c.originalName || c.model} className="border-b last:border-0">
                        <td className="p-2">
                          <div className="font-mono">{c.model}</div>
                          {c.remoteModel && c.remoteModel !== c.model && (
                            <div className="text-xs text-gray-400">匹配: {c.remoteModel}</div>
                          )}
                        </td>
                        <td className="p-2 text-right">${c.local.input} / ${c.local.output}</td>
                        <td className="p-2 text-right font-medium">${c.remote.input} / ${c.remote.output}</td>
                        <td className="p-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected(c.originalName || c.model)}
                            onChange={() => toggle(c.model, c.originalName || c.model, c.remote)}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.newPrices.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2 text-green-600 flex items-center">
                <span className="mr-2">✨</span> 可获取价格 ({result.newPrices.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.newPrices.map(m => (
                  <label key={m.originalName || m.model} className={`flex items-center space-x-2 p-2 border rounded cursor-pointer ${isSelected(m.originalName || m.model) ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}>
                    <input 
                      type="checkbox" 
                      checked={isSelected(m.originalName || m.model)}
                      onChange={() => toggle(m.model, m.originalName || m.model, m.price)}
                      className="w-4 h-4"
                    />
                    <div className="overflow-hidden flex-1">
                      <div className="truncate font-medium text-sm">{m.model}</div>
                      <div className="text-xs text-gray-500">${m.price.input} / ${m.price.output}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {result.notFound.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2 text-gray-500 flex items-center">
                <span className="mr-2">❓</span> 未找到价格 ({result.notFound.length})
              </h4>
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                <p className="mb-2">以下模型在 models.dev 中未找到匹配，请手动设置价格：</p>
                <div className="flex flex-wrap gap-2">
                  {result.notFound.map(m => (
                    <span key={m} className="font-mono bg-gray-200 px-2 py-0.5 rounded text-xs">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {totalItems === 0 && result.notFound.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              所有模型价格已是最新，无需同步。
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
          <button 
            onClick={() => onApply(selected)} 
            disabled={selected.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            应用选中 ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

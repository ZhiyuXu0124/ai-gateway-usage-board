// 火山引擎渠道模型名称映射
// 将特殊 ID 转换为易读的模型名称

export const modelNameMap = {
  // 火山引擎特殊 ID 映射
  'ep-20251207134356-kbt7p': 'deepseek-v3.2',
  'ep-20251208162522-lnlhl': 'deepseek-v3.2',
  'ep-20241224143217-rsrmd': 'doubao-pro-256k',
  'ep-20241224144320-pt9qj': 'doubao-pro-32k',
  'ep-20241224144437-68j7x': 'doubao-lite-32k',
  'ep-20241224144519-6q65g': 'doubao-vision-pro-32k',
  'ep-20241224144731-q4jmw': 'doubao-vision-lite-32k',
  'ep-20241011100143-8bvnh': 'doubao-pro-4k-browsing',
  'ep-20250205163242-cqxgq': 'deepseek-reasoner',
  'ep-20250327103634-qscmc': 'deepseek-v3',
  'doubao-1-5-thinking-pro-m-250415': 'doubao-1-5-thinking-pro-vision',
  'doubao-1-5-thinking-pro-250415': 'doubao-1-5-thinking-pro',
  'doubao-1-5-vision-pro-32k-250115': 'doubao-1-5-vision-pro-32k',
  'doubao-1.5-vision-lite-250315': 'doubao-1.5-vision-lite',
  'doubao-1.5-vision-pro-250328': 'doubao-1.5-vision-pro',
  'doubao-1-5-pro-32k-250115': 'doubao-1-5-pro-32k',
  'doubao-1-5-pro-256k-250115': 'doubao-1-5-pro-256k',
  'ep-20250530084712-5dcs8': 'deepseek-r1-0528',
}

// 反向映射：标准化名称 -> 火山引擎 ID（用于识别）
export const volcanoIdSet = new Set(Object.keys(modelNameMap))

// 标准化模型名称（将特殊ID转换为标准名称）
export function normalizeModelName(name) {
  return modelNameMap[name] || name
}

// 获取显示名称（用于UI展示）
export function getDisplayName(name) {
  return normalizeModelName(name)
}

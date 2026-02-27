export async function fetchJson(url, options = {}) {
  const { timeoutMs = 15000, signal, ...init } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const forwardAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', forwardAbort, { once: true })
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    })

    const contentType = response.headers.get('content-type') || ''
    let payload = null

    if (contentType.includes('application/json')) {
      payload = await response.json()
    } else {
      const text = await response.text()
      payload = text ? { error: text } : null
    }

    if (!response.ok) {
      const message = payload && typeof payload === 'object' && payload.error
        ? payload.error
        : `Request failed with status ${response.status}`

      const error = new Error(message)
      error.status = response.status
      error.payload = payload
      throw error
    }

    return payload
  } finally {
    clearTimeout(timeoutId)
    if (signal) {
      signal.removeEventListener('abort', forwardAbort)
    }
  }
}

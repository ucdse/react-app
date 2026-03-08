import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_BASE_URL } from '@/config'
import { CHAT_ENDPOINTS } from './endpoints'
import {
  resolveAccessToken,
  refreshAccessToken,
} from './request'

export interface ChatStreamOptions {
  chat_id: string
  message: string
  signal?: AbortSignal
  onMessage: (chunk: string) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

const RETRY_AFTER_REFRESH = 'RETRY_AFTER_REFRESH'

function openStream(
  url: string,
  token: string,
  options: ChatStreamOptions,
  signal?: AbortSignal
): Promise<void> {
  const { chat_id, message, onMessage, onDone, onError } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  return new Promise((resolve, reject) => {
    fetchEventSource(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chat_id, message }),
      signal: signal ?? undefined,
      openWhenHidden: true,
      async onopen(response) {
        if (response.ok) return
        if (response.status === 401) {
          const newToken = await refreshAccessToken()
          if (newToken) {
            reject(new Error(RETRY_AFTER_REFRESH))
            throw new Error(RETRY_AFTER_REFRESH)
          }
        }
        const err = new Error(response.statusText || `HTTP ${response.status}`)
        reject(err)
        throw err
      },
      onmessage(ev) {
        if (ev.data != null) onMessage(ev.data)
      },
      onclose() {
        onDone?.()
        resolve()
      },
      onerror(err) {
        onError?.(err instanceof Error ? err : new Error(String(err)))
        reject(err)
      },
    }).catch(reject)
  })
}

/**
 * 调用 /api/chat/stream 流式接口，携带 JWT（与 axios 一致：先 resolve 再发，401 时刷新并重试一次），通过 onMessage 逐块回调内容。
 */
export async function chatStreamAPI(options: ChatStreamOptions): Promise<void> {
  const { signal } = options
  let token = await resolveAccessToken()
  if (!token) {
    const err = new Error('Please sign in first.')
    options.onError?.(err)
    throw err
  }

  const url = `${API_BASE_URL || ''}${CHAT_ENDPOINTS.stream}`.trim() || CHAT_ENDPOINTS.stream

  try {
    await openStream(url, token, options, signal)
  } catch (err) {
    if (err instanceof Error && err.message === RETRY_AFTER_REFRESH) {
      token = await resolveAccessToken()
      if (token) {
        await openStream(url, token, options, signal)
        return
      }
    }
    throw err
  }
}

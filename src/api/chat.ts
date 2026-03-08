import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_BASE_URL } from '@/config'
import { CHAT_ENDPOINTS } from './endpoints'
import { getAccessToken } from './token'

export interface ChatStreamOptions {
  chat_id: string
  message: string
  signal?: AbortSignal
  onMessage: (chunk: string) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

/**
 * 调用 /api/chat/stream 流式接口，携带 JWT，通过 onMessage 逐块回调内容。
 */
export async function chatStreamAPI(options: ChatStreamOptions): Promise<void> {
  const { chat_id, message, signal, onMessage, onDone, onError } = options
  const token = getAccessToken()
  if (!token) {
    const err = new Error('Please sign in first.')
    onError?.(err)
    throw err
  }

  const url = `${API_BASE_URL || ''}${CHAT_ENDPOINTS.stream}`.trim() || CHAT_ENDPOINTS.stream
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  await fetchEventSource(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chat_id, message }),
    signal: signal ?? undefined,
    // Keep SSE active when the tab is hidden so background streaming still updates UI state.
    openWhenHidden: true,
    onmessage(ev) {
      if (ev.data != null) {
        onMessage(ev.data)
      }
    },
    onclose() {
      onDone?.()
    },
    onerror(err) {
      onError?.(err instanceof Error ? err : new Error(String(err)))
      throw err
    },
  })
}

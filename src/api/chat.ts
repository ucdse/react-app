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
const isRetryAfterRefreshError = (error: Error): boolean =>
  error.message === RETRY_AFTER_REFRESH
const CHAT_AUTH_FAILURE_MESSAGE = 'Session expired. Please sign in again.'
const STREAM_EMPTY_MESSAGE = 'Stream closed before any response content.'
const isCompletionMarker = (chunk: string): boolean => chunk.trim() === '[DONE]'

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
    token,
  }
  return new Promise((resolve, reject) => {
    let completed = false
    let receivedContent = false
    let settled = false

    const resolveOnce = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const rejectOnce = (error: Error, notify = true) => {
      if (settled) return
      settled = true
      if (notify) onError?.(error)
      reject(error)
    }

    fetchEventSource(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chat_id, message }),
      signal: signal ?? undefined,
      openWhenHidden: true,
      async onopen(response) {
        if (response.ok) return
        if (response.status === 401 || response.status === 403) {
          // Unify 401/403 handshake failures under refresh sentinel so caller can
          // translate both refresh-success and refresh-failed cases consistently.
          await refreshAccessToken()
          throw new Error(RETRY_AFTER_REFRESH)
        }
        throw new Error(response.statusText || `HTTP ${response.status}`)
      },
      onmessage(ev) {
        if (ev.data == null) return
        if (isCompletionMarker(ev.data)) {
          completed = true
          onMessage(ev.data)
          return
        }
        receivedContent = true
        onMessage(ev.data)
      },
      onclose() {
        if (!completed && !receivedContent) {
          rejectOnce(new Error(STREAM_EMPTY_MESSAGE))
          return
        }
        onDone?.()
        resolveOnce()
      },
      onerror(err) {
        const normalizedError = err instanceof Error ? err : new Error(String(err))
        if (isRetryAfterRefreshError(normalizedError)) {
          throw normalizedError
        }
        // Throwing here stops fetchEventSource auto-retry so outer lifecycle stays consistent.
        throw normalizedError
      },
    }).catch((err) => {
      const normalizedError = err instanceof Error ? err : new Error(String(err))
      if (isRetryAfterRefreshError(normalizedError)) {
        rejectOnce(normalizedError, false)
        return
      }
      rejectOnce(normalizedError)
    })
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
    if (err instanceof Error && isRetryAfterRefreshError(err)) {
      token = await resolveAccessToken()
      if (!token) {
        const authError = new Error(CHAT_AUTH_FAILURE_MESSAGE)
        options.onError?.(authError)
        throw authError
      }
      try {
        await openStream(url, token, options, signal)
        return
      } catch (retryErr) {
        if (retryErr instanceof Error && isRetryAfterRefreshError(retryErr)) {
          const authError = new Error(CHAT_AUTH_FAILURE_MESSAGE)
          options.onError?.(authError)
          throw authError
        }
        throw retryErr
      }
    }
    throw err
  }
}

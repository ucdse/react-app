import { useState, useRef, useEffect } from 'react'
import { chatStreamAPI } from '@/api/chat'
import { getAccessToken } from '@/api/token'
import { getMeAPI } from '@/api/user'
import { toast } from 'sonner'

type Role = 'user' | 'assistant'

interface Message {
  id: string
  role: Role
  content: string
  createdAt: Date
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hi! I'm your UCDSE assistant. Ask me about bike sharing, stations, or sustainable mobility—or just say hello.",
  createdAt: new Date(),
}

/** 解析流式响应：后端每块为 {"content": "xxx"}，结尾可能为 [DONE] */
function parseStreamChunk(raw: string): string {
  const s = raw.trim()
  if (s === '[DONE]') return ''
  try {
    const obj = JSON.parse(s) as { content?: unknown }
    if (obj && typeof obj.content === 'string') return obj.content
    return s
  } catch {
    return raw
  }
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError'
  }
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')
  }
  return false
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [chatId, setChatId] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const chatIdSuffixRef = useRef<string>('')
  const chatIdInitPromiseRef = useRef<Promise<string> | null>(null)
  const submitLockRef = useRef(false)
  const isMountedRef = useRef(true)

  const handleChatPanelWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const list = messageListRef.current
    if (!list) return

    // Pointer inside chat panel: always consume wheel and scroll message list only.
    e.preventDefault()
    e.stopPropagation()
    list.scrollTop += e.deltaY
  }

  const getChatIdSuffix = (): string => {
    if (chatIdSuffixRef.current) return chatIdSuffixRef.current
    const generatedSuffix =
      crypto.randomUUID?.()?.replace(/-/g, '').slice(0, 8) ??
      Math.random().toString(36).slice(2, 10)
    chatIdSuffixRef.current = generatedSuffix || 'chat'
    return chatIdSuffixRef.current
  }

  const buildChatId = (username?: string): string => {
    const normalizedName = username?.trim()
    return `${normalizedName || 'chat'}_${getChatIdSuffix()}`
  }

  const ensureChatId = async (): Promise<string> => {
    const currentChatId = chatId.trim()
    if (currentChatId) return currentChatId

    if (chatIdInitPromiseRef.current) {
      return chatIdInitPromiseRef.current
    }

    const fallbackChatId = buildChatId()
    if (!getAccessToken()) {
      if (isMountedRef.current) {
        setChatId(fallbackChatId)
      }
      return fallbackChatId
    }

    const initPromise = getMeAPI()
      .then((me) => buildChatId(me?.username))
      .catch(() => fallbackChatId)
      .then((nextChatId) => {
        if (isMountedRef.current) {
          setChatId(nextChatId)
        }
        return nextChatId
      })
      .finally(() => {
        chatIdInitPromiseRef.current = null
      })

    chatIdInitPromiseRef.current = initPromise
    return initPromise
  }

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      abortRef.current?.abort()
      abortRef.current = null
      submitLockRef.current = false
    }
  }, [])

  const releaseSubmitLock = () => {
    submitLockRef.current = false
    abortRef.current = null
  }

  const finishSending = () => {
    if (isMountedRef.current) {
      setSending(false)
    }
    releaseSubmitLock()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending || submitLockRef.current) return

    submitLockRef.current = true
    setSending(true)
    const controller = new AbortController()
    abortRef.current = controller

    let resolvedChatId: string
    try {
      resolvedChatId = await ensureChatId()
    } catch {
      finishSending()
      return
    }
    if (controller.signal.aborted || !isMountedRef.current) {
      finishSending()
      return
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
    }
    const assistantId = `assistant-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput('')

    try {
      await chatStreamAPI({
        chat_id: resolvedChatId,
        message: text,
        signal: controller.signal,
        onMessage(chunk) {
          if (controller.signal.aborted) return
          const part = parseStreamChunk(chunk)
          if (!part) return
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + part } : m
            )
          )
          if (document.visibilityState === 'visible') {
            setTimeout(() => {
              const el = messageListRef.current
              if (el) el.scrollTop = el.scrollHeight
            }, 0)
          }
        },
        onDone() {
          if (controller.signal.aborted) return
          finishSending()
        },
        onError(err) {
          if (controller.signal.aborted || isAbortLikeError(err)) {
            finishSending()
            return
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `[请求失败] ${err.message}` }
                : m
            )
          )
          finishSending()
          toast.error(err.message)
        },
      })
    } catch (err) {
      if (controller.signal.aborted || isAbortLikeError(err)) {
        finishSending()
        return
      }
      finishSending()
    }
  }

  return (
    <section className="h-screen w-full pt-24 pb-8 flex flex-col overflow-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 min-h-0 flex flex-col px-4">
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-foreground">AI Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask about bike sharing, stations, or anything UCDSE-related.
          </p>
        </div>

        <div
          className="glass-card flex-1 min-h-0 flex flex-col overflow-hidden"
          onWheelCapture={handleChatPanelWheel}
        >
          <div
            ref={messageListRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4"
          >
            {messages.map((msg) => {
              const isStreamingEmpty =
                msg.role === 'assistant' &&
                sending &&
                msg.content === '' &&
                messages[messages.length - 1]?.id === msg.id
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted/80 text-foreground border border-border rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <span className="text-xs font-medium text-muted-foreground block mb-1">
                        Assistant
                      </span>
                    )}
                    {isStreamingEmpty ? (
                      <div className="flex gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content || '\u00A0'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-border bg-background/50"
          >
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    ;(e.target as HTMLTextAreaElement).form?.requestSubmit()
                  }
                }}
                placeholder="Type a message... (Enter to send, Shift+Enter to new line)"
                disabled={sending}
                rows={1}
                className="glass-input flex-1 min-h-[44px] max-h-32 resize-y rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: '#4F46E5' }}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

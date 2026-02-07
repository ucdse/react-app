import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import { API_BASE_URL } from '@/config'
import { USER_ENDPOINTS } from './endpoints'
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from './token'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const REQUEST_TIMEOUT_MS = 15_000

/** 创建统一基础配置的 axios 实例。 */
const createHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: API_BASE_URL || undefined,
    headers: JSON_HEADERS,
    timeout: REQUEST_TIMEOUT_MS,
  })

/** 仅用于刷新 token，不挂载拦截器，避免循环 */
const refreshClient = createHttpClient()

/** 业务请求统一实例（全局使用） */
const request: AxiosInstance = createHttpClient()

const LOGIN_EXPIRED_MESSAGE = 'Session expired. Please sign in again.'
const LOGIN_REDIRECT_TOAST = 'Session expired. Redirecting to sign in.'
const NETWORK_ERROR_MESSAGE = 'Network error'
const LOGIN_PATH = '/login'
const AUTH_EXEMPT_ENDPOINTS = [
  USER_ENDPOINTS.login,
  USER_ENDPOINTS.register,
  USER_ENDPOINTS.sendVerificationCode,
  USER_ENDPOINTS.activate,
  USER_ENDPOINTS.activateByToken,
]

/** 后端统一响应格式 */
export interface ApiResult<T = unknown> {
  code?: number
  msg?: string
  data?: T
}

/** 兼容后端历史约定：0/1 均视为成功 */
const SUCCESS_CODES = new Set([0, 1])
const DEFAULT_UNWRAP_MESSAGE = 'Request failed'

const isApiSuccessCode = (code: number | undefined): boolean => (code != null ? SUCCESS_CODES.has(code) : false)

const isApiResult = (payload: unknown): payload is ApiResult<unknown> =>
  typeof payload === 'object' && payload != null && 'code' in payload

const unwrapApiResult = <T>(result: ApiResult<T> | undefined, fallbackMessage: string): T => {
  if (isApiSuccessCode(result?.code) && result?.data != null) {
    return result.data
  }
  throw new Error(result?.msg ?? fallbackMessage)
}

interface BackendErrorPayload {
  msg?: unknown
}

/**
 * 从 axios 错误中提取更友好的错误信息。
 */
const extractErrorMessage = (error: unknown, fallbackMessage = NETWORK_ERROR_MESSAGE): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as BackendErrorPayload | undefined
    if (typeof data?.msg === 'string' && data.msg.trim()) {
      return data.msg
    }
    if (!error.response && error.request) {
      return 'Request sent but no response received. Please check the server or proxy.'
    }
    if (error.message) {
      return error.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

/** 将任意错误规整为 Error 对象，便于全链路统一处理。 */
const normalizeError = (error: unknown, fallbackMessage?: string): Error =>
  new Error(extractErrorMessage(error, fallbackMessage))

/** 将规整后的错误包装为 Promise.reject，适配 axios 拦截器签名。 */
const rejectWithNormalizedError = (error: unknown, fallbackMessage?: string): Promise<never> =>
  Promise.reject(normalizeError(error, fallbackMessage))

/**
 * 统一处理后端业务码并解包：当响应体是 { code, msg, data } 时，
 * 非成功码直接抛错；成功则将 response.data 替换为 data 字段（业务方直接拿到 T）。
 */
const handleBusinessResponse = <T>(response: AxiosResponse<unknown>): AxiosResponse<T> => {
  const payload = response.data as unknown
  if (!isApiResult(payload)) {
    return response as AxiosResponse<T>
  }
  if (!isApiSuccessCode(payload.code)) {
    throw new Error(payload.msg ?? DEFAULT_UNWRAP_MESSAGE)
  }
  ;(response as { data: unknown }).data = payload.data
  return response as AxiosResponse<T>
}

/**
 * 刷新并发控制：
 * - `isRefreshing` 控制同一时刻只有一个刷新请求。
 * - 其他失败请求进入 `failedQueue`，等待刷新结果后统一重试/失败。
 */
let isRefreshing = false
type PendingRequest = { resolve: (token: string) => void; reject: (error: Error) => void }
const failedQueue: PendingRequest[] = []

interface RefreshTokenVO {
  access_token: string
  refresh_token?: string
}

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean }

/**
 * 刷新完成后统一处理等待队列。
 */
const processQueue = (error: Error | null, token: string | null): void => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error ?? new Error(LOGIN_EXPIRED_MESSAGE))
    } else {
      resolve(token)
    }
  })
  failedQueue.length = 0
}

/**
 * 使用 refresh_token 静默刷新 access_token。
 * 失败时清理本地 token，交由上层走过期处理流程。
 */
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const { data } = await refreshClient.post<ApiResult<RefreshTokenVO>>(USER_ENDPOINTS.refresh, {
      refresh_token: refreshToken,
    })
    const result = unwrapApiResult(data, 'Session expired.')
    setAuthTokens({
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    })
    return result.access_token
  } catch {
    clearAuthTokens()
    return null
  }
}

/**
 * 请求发出前解析可用 access_token：有则直接用，无则尝试静默刷新
 */
const resolveAccessToken = async (): Promise<string | null> => {
  const accessToken = getAccessToken()
  if (accessToken) return accessToken
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  return refreshAccessToken()
}

/** 登录/注册等接口不走刷新重试逻辑，避免无意义循环。 */
const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false
  return AUTH_EXEMPT_ENDPOINTS.some((path) => url.includes(path))
}

/**
 * 清除本地 token 并跳转到登录页
 */
const handleTokenExpired = (): void => {
  clearAuthTokens()
  if (typeof window === 'undefined') return
  if (window.location.pathname === LOGIN_PATH) return

  window.history.replaceState({}, '', LOGIN_PATH)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const notifyTokenExpired = (): void => {
  toast.warning(LOGIN_REDIRECT_TOAST)
  handleTokenExpired()
}

/**
 * 同时写入 `Authorization` 和 `token`：
 * - `Authorization` 为标准 Bearer 鉴权头；
 * - `token` 为兼容后端旧字段。
 */
const setAuthorizationHeader = (config: InternalAxiosRequestConfig, token: string): void => {
  if (!config.headers) {
    config.headers = {} as InternalAxiosRequestConfig['headers']
  }
  config.headers.Authorization = `Bearer ${token}`
  config.headers.token = token
}

// ============ 请求拦截器 ============
request.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await resolveAccessToken()
    if (token) setAuthorizationHeader(config, token)
    return config
  },
  (error) => rejectWithNormalizedError(error, NETWORK_ERROR_MESSAGE)
)

// ============ 响应拦截器 ============
request.interceptors.response.use(
  (response) => handleBusinessResponse(response),
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined
    const status = error.response?.status

    // 401/403 且非登录/注册接口：尝试刷新 token 后重试
    if (
      (status === 401 || status === 403) &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((newToken) => {
            setAuthorizationHeader(originalRequest, newToken)
            return request(originalRequest)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const newToken = await refreshAccessToken()
        if (newToken) {
          processQueue(null, newToken)
          setAuthorizationHeader(originalRequest, newToken)
          return request(originalRequest)
        }
        processQueue(new Error(LOGIN_EXPIRED_MESSAGE), null)
        notifyTokenExpired()
        return Promise.reject(normalizeError(error, LOGIN_EXPIRED_MESSAGE))
      } catch (refreshError) {
        const err = normalizeError(refreshError, LOGIN_EXPIRED_MESSAGE)
        processQueue(err, null)
        notifyTokenExpired()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    // 其他错误：统一提示并 reject
    const message = extractErrorMessage(error, NETWORK_ERROR_MESSAGE)
    toast.error(message)
    return Promise.reject(new Error(message))
  }
)

export default request

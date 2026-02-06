import { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { USER_ENDPOINTS } from './endpoints'
import { createHttpClient } from './http'
import {
  handleBusinessResponse,
  normalizeError,
  rejectWithNormalizedError,
} from './interceptors'
import { type ApiResult, unwrapApiResult } from './response'
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from './token'

export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './token'

interface RefreshTokenVO {
  access_token: string
  refresh_token?: string
}

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean }
type PendingRequest = {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

const refreshClient = createHttpClient()
const failedQueue: PendingRequest[] = []
let isRefreshing = false

/**
 * 使用 refresh_token 请求后端刷新，成功返回新的 access_token，失败返回 null 并清理本地 token。
 */
async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const { data } = await refreshClient.post<ApiResult<RefreshTokenVO>>(USER_ENDPOINTS.refresh, {
      refresh_token: refreshToken,
    })
    const refreshResult = unwrapApiResult(data, '登录状态已过期')
    setAuthTokens({
      accessToken: refreshResult.access_token,
      refreshToken: refreshResult.refresh_token,
    })
    return refreshResult.access_token
  } catch {
    clearAuthTokens()
    return null
  }
}

/**
 * 请求发出前保证尽量带上可用 access_token：
 * - 有 access_token 直接使用
 * - 无 access_token 但有 refresh_token 时先尝试静默刷新
 */
async function resolveAccessToken(): Promise<string | null> {
  const accessToken = getAccessToken()
  if (accessToken) return accessToken

  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  return tryRefreshToken()
}

/** 403/401 时先尝试刷新，失败则跳转登录页。 */
function redirectToLogin(): void {
  if (window.location.pathname !== '/login') {
    window.history.replaceState({}, '', '/login')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

function setAuthorizationHeader(config: InternalAxiosRequestConfig, token: string): void {
  if (!config.headers) {
    config.headers = {} as InternalAxiosRequestConfig['headers']
  }
  config.headers.Authorization = `Bearer ${token}`
  config.headers.token = token
}

function processQueue(error: Error | null, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error ?? new Error('登录已过期，请重新登录'))
      return
    }
    resolve(token)
  })
  failedQueue.length = 0
}

/**
 * 带鉴权的 axios 实例：请求自动加 Authorization: Bearer <token>；
 * 若响应 403/401，先尝试 refresh_token 刷新，成功则用新 token 重试一次原请求，失败则跳转登录。
 */
export const axiosWithAuth: AxiosInstance = createHttpClient()

axiosWithAuth.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await resolveAccessToken()
    if (token) {
      setAuthorizationHeader(config, token)
    }
    return config
  },
  (error) => rejectWithNormalizedError(error)
)

axiosWithAuth.interceptors.response.use(
  (response) => handleBusinessResponse(response),
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config as RetryableRequest | undefined

    if (status !== 401 && status !== 403) {
      return rejectWithNormalizedError(error)
    }

    if (!originalRequest) {
      return rejectWithNormalizedError(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((newToken) => {
          setAuthorizationHeader(originalRequest, newToken)
          return axiosWithAuth(originalRequest)
        })
        .catch((queueError) => Promise.reject(queueError))
    }

    if (originalRequest._retry) {
      clearAuthTokens()
      redirectToLogin()
      return rejectWithNormalizedError(new Error('登录已过期，请重新登录'))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const newToken = await tryRefreshToken()
      if (!newToken) {
        throw new Error('登录已过期，请重新登录')
      }

      processQueue(null, newToken)
      setAuthorizationHeader(originalRequest, newToken)
      return axiosWithAuth(originalRequest)
    } catch (refreshError) {
      const normalizedRefreshError = normalizeError(refreshError, '登录已过期，请重新登录')
      processQueue(normalizedRefreshError, null)
      clearAuthTokens()
      redirectToLogin()
      return Promise.reject(normalizedRefreshError)
    } finally {
      isRefreshing = false
    }
  }
)

/** 登录后后端返回的 access_token 存在 storage 的 key */
export const ACCESS_TOKEN_KEY = 'access_token'

/** 登录后后端返回的 refresh_token 存在 storage 的 key */
export const REFRESH_TOKEN_KEY = 'refresh_token'

interface AuthTokenPayload {
  accessToken: string
  refreshToken?: string
}

export interface SetAuthTokensOptions {
  /** true = localStorage（关闭浏览器仍保留），false = sessionStorage（关标签/浏览器即失效） */
  persistent?: boolean
}

/**
 * 返回当前存有 token 的 Storage：优先 sessionStorage，其次 localStorage。
 * 用于读取 token 和刷新时写入同一存储。
 */
const getTokenStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  if (window.sessionStorage.getItem(ACCESS_TOKEN_KEY)) return window.sessionStorage
  if (window.localStorage.getItem(ACCESS_TOKEN_KEY)) return window.localStorage
  return null
}

/**
 * 根据「记住我」选择存储：persistent 为 true 用 localStorage，否则用 sessionStorage。
 */
const getStorageByPersistent = (persistent: boolean): Storage | null => {
  if (typeof window === 'undefined') return null
  return persistent ? window.localStorage : window.sessionStorage
}

export const getAccessToken = (): string | null =>
  getTokenStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null

export const getRefreshToken = (): string | null =>
  getTokenStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null

/**
 * 写入 access/refresh token。
 * @param payload - token 内容
 * @param options.persistent - 登录时：true 用 localStorage，false 用 sessionStorage；刷新时不传则沿用当前存 token 的存储
 */
export const setAuthTokens = (
  { accessToken, refreshToken }: AuthTokenPayload,
  options?: SetAuthTokensOptions
): void => {
  const storage =
    options?.persistent !== undefined
      ? getStorageByPersistent(options.persistent)
      : getTokenStorage() ?? (typeof window !== 'undefined' ? window.localStorage : null)
  if (!storage) return

  storage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }
}

/** 同时清除 sessionStorage 与 localStorage 中的 token，避免残留 */
export const clearAuthTokens = (): void => {
  if (typeof window === 'undefined') return
  for (const storage of [window.sessionStorage, window.localStorage]) {
    storage.removeItem(ACCESS_TOKEN_KEY)
    storage.removeItem(REFRESH_TOKEN_KEY)
  }
}

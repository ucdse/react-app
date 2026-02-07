/** 登录后后端返回的 access_token 存在 localStorage 的 key */
export const ACCESS_TOKEN_KEY = 'access_token'

/** 登录后后端返回的 refresh_token 存在 localStorage 的 key */
export const REFRESH_TOKEN_KEY = 'refresh_token'

interface AuthTokenPayload {
  accessToken: string
  refreshToken?: string
}

/**
 * 统一读取 localStorage，避免在非浏览器环境下直接访问 window 报错。
 */
const getStorage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage)

export const getAccessToken = (): string | null =>
  getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null

export const getRefreshToken = (): string | null =>
  getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null

export const setAuthTokens = ({
  accessToken,
  refreshToken,
}: AuthTokenPayload): void => {
  const storage = getStorage()
  if (!storage) return

  storage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }
}

export const clearAuthTokens = (): void => {
  const storage = getStorage()
  if (!storage) return

  storage.removeItem(ACCESS_TOKEN_KEY)
  storage.removeItem(REFRESH_TOKEN_KEY)
}

/** 登录后后端返回的 access_token 存在 localStorage 的 key */
export const ACCESS_TOKEN_KEY = 'access_token'

/** 登录后后端返回的 refresh_token 存在 localStorage 的 key */
export const REFRESH_TOKEN_KEY = 'refresh_token'

interface AuthTokenPayload {
  accessToken: string
  refreshToken?: string
}

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY)

export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY)

export const setAuthTokens = ({ accessToken, refreshToken }: AuthTokenPayload): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }
}

export const clearAuthTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

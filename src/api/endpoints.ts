const USER_API_PREFIX = '/api/users'

export const USER_ENDPOINTS = {
  login: `${USER_API_PREFIX}/login`,
  register: `${USER_API_PREFIX}/register`,
  me: `${USER_API_PREFIX}/me`,
  refresh: `${USER_API_PREFIX}/refresh`,
  logout: `${USER_API_PREFIX}/logout`,
} as const

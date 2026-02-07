/**
 * 统一管理 API 路径，避免业务代码里散落字符串常量。
 * 注意：这里只维护「路径」，不包含域名与协议。
 */
const USER_API_PREFIX = '/api/users'

/** 用户模块接口路径 */
export const USER_ENDPOINTS = {
  login: `${USER_API_PREFIX}/login`,
  register: `${USER_API_PREFIX}/register`,
  me: `${USER_API_PREFIX}/me`,
  refresh: `${USER_API_PREFIX}/refresh`,
  logout: `${USER_API_PREFIX}/logout`,
} as const

/**
 * 统一管理 API 路径，避免业务代码里散落字符串常量。
 * 注意：这里只维护「路径」，不包含域名与协议。
 */
const USER_API_PREFIX = '/api/users'
const STATION_API_PREFIX = '/api/stations'

/** 用户模块接口路径 */
export const USER_ENDPOINTS = {
  login: `${USER_API_PREFIX}/login`,
  register: `${USER_API_PREFIX}/register`,
  sendVerificationCode: `${USER_API_PREFIX}/send-verification-code`,
  activate: `${USER_API_PREFIX}/activate`,
  activateByToken: `${USER_API_PREFIX}/activate-by-token`,
  me: `${USER_API_PREFIX}/me`,
  refresh: `${USER_API_PREFIX}/refresh`,
  logout: `${USER_API_PREFIX}/logout`,
} as const

/** 站点模块接口路径 */
export const STATION_ENDPOINTS = {
  list: `${STATION_API_PREFIX}/`,
} as const

/** 天气模块接口路径 */
export const WEATHER_ENDPOINTS = {
  get: '/api/weather',
} as const

/** 聊天流式接口路径 */
export const CHAT_ENDPOINTS = {
  stream: '/api/chat/stream',
} as const

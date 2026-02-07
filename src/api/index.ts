/**
 * API 层统一出口：
 * - axios 客户端（request / axiosWithAuth）
 * - token 工具
 * - 业务 API（auth / user 模块）
 * - 通用响应类型
 */
export { default as request } from './request'
export { axiosWithAuth } from './client'
export {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  getAccessToken,
  clearAuthTokens,
} from './token'
export type { ApiResult } from './request'
export {
  userLoginAPI,
  userRegisterAPI,
  type UserLoginDTO,
  type UserLoginVO,
  type UserRegisterDTO,
  type UserRegisterVO,
} from './auth'
export {
  getMeAPI,
  userLogoutAPI,
  type UserProfileVO,
} from './user'

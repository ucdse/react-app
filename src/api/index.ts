/**
 * API 层统一入口：request 实例、鉴权 client、各业务模块及 DTO/VO。
 */
export { default as request } from './request'
export { axiosWithAuth } from './client'
export {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  getAccessToken,
  clearAuthTokens,
} from './token'
export type { ApiResult } from './response'
export {
  userLoginAPI,
  userRegisterAPI,
  getMeAPI,
  userLogoutAPI,
  type UserLoginDTO,
  type UserLoginVO,
  type UserRegisterDTO,
  type UserRegisterVO,
  type UserProfileVO,
} from './user'

import request from './request'
import { axiosWithAuth } from './client'
import { USER_ENDPOINTS } from './endpoints'
import { type ApiResult, unwrapApiResult } from './response'

// ============ 登录 ============
/** 用户登录请求参数 */
export interface UserLoginDTO {
  identifier: string
  password: string
}

/** 用户登录响应数据 */
export interface UserLoginVO {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

/**
 * 用户登录
 * @param data 登录数据（用户名或邮箱 + 密码）
 * @returns 登录响应数据
 */
export const userLoginAPI = async (data: UserLoginDTO): Promise<UserLoginVO> => {
  const res = await request.post<ApiResult<UserLoginVO>>(USER_ENDPOINTS.login, {
    identifier: data.identifier.trim(),
    password: data.password,
  })
  return unwrapApiResult(res.data, '登录失败')
}

// ============ 注册 ============
/** 用户注册请求参数 */
export interface UserRegisterDTO {
  username: string
  email: string
  password: string
}

/** 用户注册响应数据（与个人资料结构一致） */
export interface UserRegisterVO {
  id: number
  username: string
  email: string
  avatar_url: string | null
  is_active: boolean
  created_at: string | null
}

/**
 * 用户注册
 * @param data 注册数据
 * @returns 注册成功后的用户信息
 */
export const userRegisterAPI = async (data: UserRegisterDTO): Promise<UserRegisterVO> => {
  const res = await request.post<ApiResult<UserRegisterVO>>(USER_ENDPOINTS.register, {
    username: data.username.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
  })
  return unwrapApiResult(res.data, '注册失败')
}

// ============ 当前用户信息 ============
/** 用户信息 / 个人资料（与后端 serialize_user 一致） */
export interface UserProfileVO {
  id: number
  username: string
  email: string
  avatar_url: string | null
  is_active: boolean
  created_at: string | null
}

/**
 * 获取当前用户信息（需鉴权，401/403 时 client 会尝试刷新或跳转登录）
 * @returns 当前用户资料
 */
export const getMeAPI = async (): Promise<UserProfileVO> => {
  const res = await axiosWithAuth.get<ApiResult<UserProfileVO>>(USER_ENDPOINTS.me)
  return unwrapApiResult(res.data, '获取资料失败')
}

// ============ 登出 ============

/**
 * 用户登出（需鉴权，携带当前 access_token 通知服务端登出）
 */
export const userLogoutAPI = async (): Promise<void> => {
  await axiosWithAuth.post<ApiResult<null>>(USER_ENDPOINTS.logout)
}

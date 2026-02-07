import { USER_ENDPOINTS } from './endpoints'
import request from './request'
import type { UserProfileVO } from './user'

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
 * 注册返回结构与用户资料一致，使用类型别名复用定义。
 */
export type UserRegisterVO = UserProfileVO

/** 用户注册请求参数 */
export interface UserRegisterDTO {
  username: string
  email: string
  password: string
}

const normalizeIdentifier = (identifier: string): string => identifier.trim()

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/**
 * 用户登录。
 * 入参中 `identifier` 支持用户名或邮箱，发送前会自动 trim。
 */
export const userLoginAPI = async (data: UserLoginDTO): Promise<UserLoginVO> => {
  const res = await request.post<UserLoginVO>(USER_ENDPOINTS.login, {
    identifier: normalizeIdentifier(data.identifier),
    password: data.password,
  })
  return res.data
}

/**
 * 用户注册。
 * 入参中的用户名与邮箱会标准化，避免同值不同格式导致的后端校验歧义。
 * 注册成功后账户未激活，需调用激活接口完成邮箱验证。
 */
export const userRegisterAPI = async (data: UserRegisterDTO): Promise<UserRegisterVO> => {
  const res = await request.post<UserRegisterVO>(USER_ENDPOINTS.register, {
    username: normalizeIdentifier(data.username),
    email: normalizeEmail(data.email),
    password: data.password,
  })
  return res.data
}

/**
 * 请求发送验证码到指定邮箱或用户名对应的邮箱。
 * 未激活用户每分钟最多请求一次。
 */
export const sendVerificationCodeAPI = async (identifier: string): Promise<void> => {
  await request.post(USER_ENDPOINTS.sendVerificationCode, {
    identifier: normalizeIdentifier(identifier),
  })
}

/**
 * 使用邮箱或用户名 + 6 位验证码激活账户。
 * 激活成功后即可登录。
 */
export const activateAccountAPI = async (
  identifier: string,
  code: string
): Promise<UserRegisterVO> => {
  const res = await request.post<UserRegisterVO>(USER_ENDPOINTS.activate, {
    identifier: normalizeIdentifier(identifier),
    code: code.trim(),
  })
  return res.data
}

/**
 * 通过邮件中的激活链接 Token 激活账户（路径 /activate/:token 对应）。
 * 激活成功后即可登录。
 */
export const activateByTokenAPI = async (token: string): Promise<UserRegisterVO> => {
  const res = await request.post<UserRegisterVO>(USER_ENDPOINTS.activateByToken, {
    token: token.trim(),
  })
  return res.data
}

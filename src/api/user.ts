import { axiosWithAuth } from './client'
import { USER_ENDPOINTS } from './endpoints'

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
 * 获取当前用户信息（需鉴权）。
 * 若 401/403，client 会尝试刷新 token，失败后跳转登录页。
 */
export const getMeAPI = async (): Promise<UserProfileVO> => {
  const res = await axiosWithAuth.get<UserProfileVO>(USER_ENDPOINTS.me)
  return res.data
}

/**
 * 用户登出（需鉴权，携带当前 access_token 通知服务端注销会话）。
 */
export const userLogoutAPI = async (): Promise<void> => {
  await axiosWithAuth.post<void>(USER_ENDPOINTS.logout)
}

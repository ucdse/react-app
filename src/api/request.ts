import { type InternalAxiosRequestConfig } from 'axios'
import { createHttpClient } from './http'
import { handleBusinessResponse, rejectWithNormalizedError } from './interceptors'
import { getAccessToken } from './token'

/**
 * 未鉴权请求实例（登录、注册等），baseURL 为前端代理 /api 或配置的根路径
 */
const request = createHttpClient()

request.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token) {
      if (!config.headers) {
        config.headers = {} as InternalAxiosRequestConfig['headers']
      }
      config.headers.Authorization = `Bearer ${token}`
      config.headers.token = token
    }
    return config
  },
  (error) => rejectWithNormalizedError(error)
)

request.interceptors.response.use(
  (response) => handleBusinessResponse(response),
  (error) => rejectWithNormalizedError(error)
)

export default request

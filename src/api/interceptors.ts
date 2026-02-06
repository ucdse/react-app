import axios from 'axios'
import { type AxiosResponse } from 'axios'
import { isApiResult, isApiSuccessCode } from './response'

/**
 * 从 axios 错误中提取更友好的错误信息。
 */
export const extractErrorMessage = (error: unknown, fallbackMessage = '网络异常'): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { msg?: unknown } | undefined
    if (typeof data?.msg === 'string' && data.msg.trim()) {
      return data.msg
    }
    if (!error.response && error.request) {
      return '请求已发出，但未收到后端响应（请检查服务或代理）'
    }
    if (error.message) {
      return error.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

export const normalizeError = (error: unknown, fallbackMessage?: string): Error =>
  new Error(extractErrorMessage(error, fallbackMessage))

export const rejectWithNormalizedError = (error: unknown, fallbackMessage?: string): Promise<never> =>
  Promise.reject(normalizeError(error, fallbackMessage))

/**
 * 统一处理后端业务码：当响应体是 { code, msg, data } 时，非成功码直接抛错。
 */
export const handleBusinessResponse = <T>(response: AxiosResponse<T>): AxiosResponse<T> => {
  const payload = response.data as unknown
  if (isApiResult(payload) && !isApiSuccessCode(payload.code)) {
    throw new Error(payload.msg ?? '操作失败')
  }
  return response
}

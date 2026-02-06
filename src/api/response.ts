/** 后端统一响应格式 */
export interface ApiResult<T = unknown> {
  code?: number
  msg?: string
  data?: T
}

const SUCCESS_CODES = new Set([0, 1])

export const isApiSuccessCode = (code: number | undefined): boolean => (code != null ? SUCCESS_CODES.has(code) : false)

export const isApiResult = (payload: unknown): payload is ApiResult<unknown> =>
  typeof payload === 'object' && payload != null && 'code' in payload

/**
 * 校验并解包后端统一响应结构。
 */
export const unwrapApiResult = <T>(result: ApiResult<T> | undefined, fallbackMessage: string): T => {
  if (isApiSuccessCode(result?.code) && result?.data != null) {
    return result.data
  }
  throw new Error(result?.msg ?? fallbackMessage)
}

import axios, { type AxiosInstance } from 'axios'
import { API_BASE_URL } from '@/config'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const REQUEST_TIMEOUT_MS = 15_000

/**
 * 创建统一基础配置的 axios 实例。
 */
export const createHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: API_BASE_URL || undefined,
    headers: JSON_HEADERS,
    timeout: REQUEST_TIMEOUT_MS,
  })

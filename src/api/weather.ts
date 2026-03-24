import request from './request'
import { WEATHER_ENDPOINTS } from './endpoints'

export interface WeatherResponse {
  // 先定义通用结构，等看到实际返回数据后再完善
  [key: string]: unknown
}

/**
 * 获取天气数据 (后端统一返回都柏林数据)
 */
export const getWeatherAPI = async (): Promise<WeatherResponse> => {
  const res = await request.get<WeatherResponse>(WEATHER_ENDPOINTS.get)
  return res.data
}

import request from './request'
import { WEATHER_ENDPOINTS } from './endpoints'

export interface WeatherResponse {
  // 先定义通用结构，等看到实际返回数据后再完善
  [key: string]: unknown
}

/**
 * 获取天气数据
 * @param lat 纬度
 * @param lon 经度
 */
export const getWeatherAPI = async (lat: number, lon: number): Promise<WeatherResponse> => {
  const res = await request.get<WeatherResponse>(WEATHER_ENDPOINTS.get, {
    params: {
      lat: String(lat),
      lon: String(lon),
    },
  })
  return res.data
}

import request from './request'
import { STATION_ENDPOINTS } from './endpoints'

/** 站点信息（与后端 station_to_dict 一致） */
export interface StationVO {
  number: number
  contract_name: string
  name: string
  address: string
  latitude: number
  longitude: number
  banking: boolean
  bonus: boolean
  bike_stands: number
}

/**
 * 获取所有站点列表（无需鉴权）。
 */
export const getStationsAPI = async (): Promise<StationVO[]> => {
  const res = await request.get<StationVO[]>(STATION_ENDPOINTS.list)
  return res.data ?? []
}

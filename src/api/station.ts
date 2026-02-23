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



export interface StationAvailabilityVO {
  number: number;
  available_bikes: number;
  available_bike_stands: number;
  status: string;
  last_update: string;
  timestamp: string;
  requested_at: string;
}

/**
 * 獲取單一站點的最新可用狀態與歷史紀錄
 */
export const getStationAvailabilityAPI = async (number: number): Promise<StationAvailabilityVO[]> => {
  try {
    const res = await request.get(`/api/stations/${number}/availability`) as any;
    
    // 智能尋找資料在哪一層
    const actualData = res?.data?.data || res?.data || res;

    if (!actualData) return [];

    // 統一包裝成「陣列」回傳給 Maps.tsx
    return Array.isArray(actualData) ? actualData : [actualData];

  } catch (error) {
    console.error(`獲取站點 ${number} 的車位資料失敗:`, error);
    return []; // 失敗時回傳空陣列
  }
}
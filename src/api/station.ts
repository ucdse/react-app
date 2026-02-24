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
  id?: number;                    // Database ID / Sequence (optional)
  number: number;                 // Station number
  available_bikes: number;        // Number of available bikes
  available_bike_stands: number;  // Number of available bike stands
  bike_stands?: number;           // Total bike stands (optional, as it's missing in the CSV but might be used elsewhere)
  status: string;                 // Station status (e.g., "OPEN")
  last_update: number | string;   // Millisecond timestamp (number based on CSV), keeping string for fallback compatibility
  timestamp: string;              // Database record timestamp
  requested_at: string;           // API request timestamp
}

/**
 * Fetch the latest availability status and historical records for a single station.
 */
/**
 * Fetch the latest availability status and historical records for a single station.
 */
export const getStationAvailabilityAPI = async (number: number): Promise<StationAvailabilityVO[]> => {
  try {
    // 1. 先將 API 回傳結果標記為 unknown，避免 TypeScript 提早報錯
    const res = await request.get<unknown>(`/api/stations/${number}/availability`);
    
    let actualData: StationAvailabilityVO | StationAvailabilityVO[];
    
    // 2. 安全地檢查 res 是否為物件，並且裡面有沒有 'data' 這個屬性
    if (res && typeof res === 'object' && 'data' in res) {
      // 情況 A：資料被包在 { data: ... } 裡面，我們明確告訴 TS 這裡的結構
      actualData = (res as { data: StationAvailabilityVO | StationAvailabilityVO[] }).data;
    } else {
      // 情況 B：資料是直接回傳的，我們明確告訴 TS 它是純資料或陣列
      actualData = res as StationAvailabilityVO | StationAvailabilityVO[];
    }

    if (!actualData) return [];

    // 3. 確保永遠回傳陣列給 Maps.tsx 的 stationHistory 使用
    return Array.isArray(actualData) ? actualData : [actualData];

  } catch (error) {
    console.error(`Failed to fetch availability data for station ${number}:`, error);
    // 失敗時優雅降級，回傳空陣列，畫面才不會壞掉
    return []; 
  }
}
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
export const getStationAvailabilityAPI = async (number: number): Promise<StationAvailabilityVO[]> => {
  try {
  // 發送請求
    const res = await request.get<unknown>(`/api/stations/${number}/availability`);
    
    let actualData: unknown = res;

    // 1. 剝除第一層：Axios 的 response.data wrapper (如果有的話)
    if (actualData !== null && typeof actualData === 'object' && 'data' in actualData) {
      actualData = (actualData as Record<string, unknown>).data;
    }

    // 2. 剝除第二層：後端可能自己包裝的 { data: [...] } (確保它不是陣列才去剝)
    if (actualData !== null && typeof actualData === 'object' && !Array.isArray(actualData) && 'data' in actualData) {
      actualData = (actualData as Record<string, unknown>).data;
    }

    // 3. 確保型別安全並轉回我們要的格式
    const finalData = actualData as StationAvailabilityVO | StationAvailabilityVO[];

    if (!finalData) return [];

    // 4. 統一包裝成「陣列」回傳
    return Array.isArray(finalData) ? finalData : [finalData];

  } catch (error) {
    console.error(`Failed to fetch availability data for station ${number}:`, error);
    return []; 
  }
}


export const getStationsStatusAPI = async (): Promise<StationAvailabilityVO[]> => {
  try {
    const res = await request.get<unknown>('/api/stations/status')
    
    // 加上 : unknown 讓 TypeScript 知道我們要手動剝除外層
    let actualData: unknown = res;

    // 1. 剝除第一層：Axios 的 response.data wrapper (如果有的話)
    if (actualData !== null && typeof actualData === 'object' && 'data' in actualData) {
      actualData = (actualData as Record<string, unknown>).data;
    }

    // 2. 剝除第二層：Flask 後端的 { code: 0, data: [...] } wrapper
    if (actualData !== null && typeof actualData === 'object' && !Array.isArray(actualData) && 'data' in actualData) {
      actualData = (actualData as Record<string, unknown>).data;
    }

    // 3. 確保最後拿到的是陣列
    return Array.isArray(actualData) ? actualData : [];
  } catch (error) {
    console.error('Failed to fetch all stations status:', error);
    return [];
  }
}
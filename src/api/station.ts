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


/** 預測資料（與後端回傳的 JSON 結構一致） */
export interface PredictionResponseVO {
  forecast_time: string;
  predicted_available_bikes: number;
}

/** 轉換後給 Recharts 圖表使用的統一格式 */
export interface ChartData {
  timeLabel: string;     // X 軸顯示的時間，例如 "20:00"
  bikes: number;         // Y 軸的單車數量
  isPrediction: boolean; // 標記是否為預測數據 (用來改變圖表樣式)
}

/**
 * 獲取站點未來的單車預測數量
 * @param number 站點 ID
 * @param hours 想要截取的未來小時數 (例如 4 或 24)
 */
export const getStationPredictionAPI = async (number: number, hours: number): Promise<ChartData[]> => {
  try {
    const res = await request.get<unknown>(`/api/stations/${number}/prediction`);
    
    let actualData: unknown = res;

    // 1. 剝除第一層：Axios 的 response.data wrapper (如果有的話)
    if (actualData !== null && typeof actualData === 'object' && 'data' in actualData) {
      actualData = (actualData as Record<string, unknown>).data;
    }

    // 2. 剝除第二層：Flask 後端的 { code: 0, data: [...] } wrapper
    if (actualData !== null && typeof actualData === 'object' && !Array.isArray(actualData) && 'data' in actualData) {
      actualData = (actualData as Record<string, unknown>).data;
    }

    const finalData = actualData as PredictionResponseVO[];

    if (!Array.isArray(finalData)) return [];

    // 3. 根據使用者選擇的時間，截取對應的小時數
    const slicedData = finalData.slice(0, hours);

    // 4. 轉換成 Recharts 圖表需要的格式
    return slicedData.map(item => {
      const date = new Date(item.forecast_time);
      const hoursStr = date.getHours().toString().padStart(2, '0');
      const minutesStr = date.getMinutes().toString().padStart(2, '0');

      return {
        timeLabel: `${hoursStr}:${minutesStr}`,
        bikes: item.predicted_available_bikes,
        isPrediction: true // 加上預測標籤
      };
    });

  } catch (error) {
    console.error(`Failed to fetch prediction data for station ${number}:`, error);
    return [];
  }
}
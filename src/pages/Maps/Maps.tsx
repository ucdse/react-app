import { useEffect, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getStationsAPI, getStationAvailabilityAPI, type StationVO, type StationAvailabilityVO } from '@/api/station'
import Weather from '@/components/Weather'

// ========== Google Maps API 相关常量 ==========
/** 全局回调名，供 Google Maps 脚本加载完成后调用 */
const GOOGLE_MAPS_CALLBACK = '__googleMapsCallback'
const DEFAULT_CENTER = '40.12150192260742,-100.45039367675781'
const DEFAULT_ZOOM = 4
const USER_ZOOM = 15
const DEMO_MAP_ID = 'DEMO_MAP_ID'
const MARKER_BASE_Z_INDEX = 1
const MARKER_ACTIVE_Z_INDEX = 10_000

declare global {
  interface Window {
    [GOOGLE_MAPS_CALLBACK]?: () => void
  }
}

function formatLocationError(code: number): string {
  switch (code) {
    case 1:
      return '定位被拒绝，请在浏览器中允许位置权限'
    case 2:
      return '无法获取位置信息'
    case 3:
      return '定位超时，请重试'
    default:
      return '定位失败，请重试'
  }
}

export default function Maps() {
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const [stations, setStations] = useState<StationVO[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)
  const [stationsError, setStationsError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const [selectedStation, setSelectedStation] = useState<StationVO | null>(null)
  const [stationDetail, setStationDetail] = useState<StationAvailabilityVO | null>(null)

  const [stationHistory, setStationHistory] = useState<StationAvailabilityVO[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const keyError =
    !apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('AIza')
      ? '请设置有效的 VITE_GOOGLE_MAPS_API_KEY（.env）'
      : null
  const error = keyError ?? loadError

  /**
   * 【调用 Google Maps API】加载 Google Maps JavaScript SDK
   * - 通过动态插入 <script> 标签请求：https://maps.googleapis.com/maps/api/js
   * - 使用 key、callback、libraries=maps,marker、v=beta 等参数
   * - 加载成功后执行全局 callback，将 scriptLoaded 置为 true，从而触发地图渲染
   */
  useEffect(() => {
    if (keyError) return

    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      queueMicrotask(() => setScriptLoaded(true))
      return
    }

    window[GOOGLE_MAPS_CALLBACK] = () => setScriptLoaded(true)

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${GOOGLE_MAPS_CALLBACK}&libraries=maps,marker&v=beta`
    script.async = true
    script.onerror = () => setLoadError('Google Maps 脚本加载失败')
    document.head.appendChild(script)

    return () => {
      script.remove()
      delete window[GOOGLE_MAPS_CALLBACK]
    }
  }, [apiKey, keyError])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      setStationsLoading(true)
      setStationsError(null)
    })
    getStationsAPI()
      .then((data) => {
        if (!cancelled) setStations(data)
      })
      .catch((err) => {
        if (!cancelled) setStationsError(err instanceof Error ? err.message : '获取站点失败')
      })
      .finally(() => {
        if (!cancelled) setStationsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** 进入页面时自动定位到用户所在位置 */
  useEffect(() => {
    if (!navigator.geolocation) return
    queueMicrotask(() => {
      setLocationError(null)
      setLocationLoading(true)
    })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationLoading(false)
      },
      (err) => {
        setLocationError(formatLocationError(err.code))
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [])

  /**
   * 【地图渲染】在 Google Maps SDK 加载完成且容器存在时，创建并挂载地图
   * 渲染流程：
   * 1. 使用 Google 提供的 Web Component：document.createElement('gmp-map')，由 SDK 注册的 <gmp-map> 会内部调用 Maps JavaScript API 渲染地图瓦片
   * 2. 设置 center、zoom、map-id 等属性，决定地图中心与缩放级别
   * 3. 创建 gmp-advanced-marker 标记（用户位置 + 站点），append 到 gmp-map 上
   * 4. 将 gmpMap 挂载到 ref 对应的 div（mapContainerRef），地图即显示在页面上
   */
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return

    const container = mapContainerRef.current
    container.innerHTML = ''

    const center = userPosition
      ? `${userPosition.lat},${userPosition.lng}`
      : DEFAULT_CENTER
    const zoom = userPosition ? USER_ZOOM : DEFAULT_ZOOM

    /* 创建地图根节点：<gmp-map> 由 Google Maps JS SDK 注册，挂载后由 SDK 负责请求并渲染地图底图 */
    const gmpMap = document.createElement('gmp-map')
    gmpMap.setAttribute('center', center)
    gmpMap.setAttribute('zoom', String(zoom))
    gmpMap.setAttribute('map-id', DEMO_MAP_ID)
    gmpMap.style.height = '100%'
    gmpMap.style.width = '100%'
    gmpMap.style.minHeight = '0'

    let activeTooltip: HTMLDivElement | null = null
    let activeMarker: HTMLElement | null = null
    let hideTimeoutId: ReturnType<typeof setTimeout> | null = null

    const setMarkerZIndex = (marker: HTMLElement, zIndex: number) => {
      marker.setAttribute('z-index', String(zIndex))
      marker.style.zIndex = String(zIndex)
        ; (marker as HTMLElement & { zIndex?: number }).zIndex = zIndex
    }

    const clearHideTimeout = () => {
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId)
        hideTimeoutId = null
      }
    }

    const showTooltip = (marker: HTMLElement, tooltip: HTMLDivElement) => {
      clearHideTimeout()
      if (activeTooltip && activeTooltip !== tooltip) {
        activeTooltip.classList.add('hidden')
      }
      if (activeMarker && activeMarker !== marker) {
        setMarkerZIndex(activeMarker, MARKER_BASE_Z_INDEX)
      }
      tooltip.classList.remove('hidden')
      setMarkerZIndex(marker, MARKER_ACTIVE_Z_INDEX)
      activeTooltip = tooltip
      activeMarker = marker
    }

    /** 延迟隐藏，允许鼠标从圆点移动到悬浮框而不闪烁 */
    const hideTooltip = (marker: HTMLElement, tooltip: HTMLDivElement) => {
      clearHideTimeout()
      hideTimeoutId = setTimeout(() => {
        tooltip.classList.add('hidden')
        setMarkerZIndex(marker, MARKER_BASE_Z_INDEX)
        if (activeTooltip === tooltip) activeTooltip = null
        if (activeMarker === marker) activeMarker = null
        hideTimeoutId = null
      }, 150)
    }

    /** 立即隐藏（点击切换 / 点击地图空白处） */
    const hideTooltipNow = (marker: HTMLElement, tooltip: HTMLDivElement) => {
      clearHideTimeout()
      tooltip.classList.add('hidden')
      setMarkerZIndex(marker, MARKER_BASE_Z_INDEX)
      if (activeTooltip === tooltip) activeTooltip = null
      if (activeMarker === marker) activeMarker = null
    }

    /* 用户位置标记：<gmp-advanced-marker> 同样由 Google Maps SDK 提供，用于在地图上显示点位 */
    if (userPosition) {
      const userMarker = document.createElement('gmp-advanced-marker')
      userMarker.setAttribute('position', center)
      userMarker.setAttribute('title', '我的位置')
      gmpMap.appendChild(userMarker)
    }

    /* 站点标记：每个站点一个 gmp-advanced-marker，带自定义内容（图标 + 悬浮信息） */
    stations.forEach((s) => {
      const marker = document.createElement('gmp-advanced-marker')
      marker.setAttribute('position', `${s.latitude},${s.longitude}`)
      marker.setAttribute('title', s.name)
      marker.setAttribute('gmp-clickable', 'true')
      setMarkerZIndex(marker, MARKER_BASE_Z_INDEX)

      const markerContent = document.createElement('div')
      markerContent.className = 'relative flex items-center justify-center'
      markerContent.style.cursor = 'pointer'
      markerContent.tabIndex = 0
      markerContent.setAttribute('aria-label', s.name)

      const bikeIcon = document.createElement('div')
      bikeIcon.className =
        'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-white shadow-sm'
      bikeIcon.innerHTML = `
        <svg viewBox="0 0 80 80" fill="currentColor" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M63,34a16,16,0,0,0-3.19.32L57,23.87V16h8a1,1,0,0,0,0-2H56a1,1,0,0,0-1,1v8H31V20h5a1,1,0,0,0,0-2H24a1,1,0,0,0,0,2h5v3.76L23.25,35.27A16,16,0,1,0,33,51h7a1,1,0,0,0,.85-.48l14.79-24,2.25,8.35A16,16,0,1,0,63,34ZM17,64a14,14,0,0,1,0-28,13.84,13.84,0,0,1,5.35,1.07L16.11,49.55A1,1,0,0,0,17,51H31A14,14,0,0,1,17,64Zm1.62-15,5.51-11A14,14,0,0,1,31,49Zm20.82,0H33A16,16,0,0,0,25,36.18L30.62,25H54.21ZM63,64a14,14,0,0,1-4.59-27.21L62,50.26A1,1,0,0,0,63,51a1.15,1.15,0,0,0,.26,0A1,1,0,0,0,64,49.74L60.34,36.26A13.71,13.71,0,0,1,63,36a14,14,0,0,1,0,28Z"/>
        </svg>
      `

      const tooltip = document.createElement('div')
      tooltip.className =
        'hidden absolute bottom-[calc(100%+12px)] left-1/2 z-[99999] min-w-[240px] max-w-[280px] -translate-x-1/2 rounded-lg border border-border bg-background/95 px-4 py-3 text-left shadow-lg backdrop-blur'

      const title = document.createElement('div')
      title.className = 'font-medium text-foreground'
      title.textContent = s.name

      const address = document.createElement('div')
      address.className = 'mt-1 truncate text-xs text-muted-foreground'
      address.title = s.address
      address.textContent = s.address

      const numberLine = document.createElement('div')
      numberLine.className = 'mt-1 text-xs text-muted-foreground'
      numberLine.textContent = `Station No.: ${s.number}`

      const standsLine = document.createElement('div')
      standsLine.className = 'mt-1 text-xs text-muted-foreground'
      standsLine.textContent = `Docks: ${s.bike_stands}`

      const arrow = document.createElement('div')
      arrow.className =
        'absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-border bg-background/95'

      tooltip.append(title, address, numberLine, standsLine, arrow)
      markerContent.append(bikeIcon, tooltip)

      const openStationInfo = () => showTooltip(marker, tooltip)
      const closeStationInfo = () => hideTooltip(marker, tooltip)
      const toggleStationInfo = () => {
        if (tooltip.classList.contains('hidden')) {
          showTooltip(marker, tooltip)
        } else {
          hideTooltipNow(marker, tooltip)
        }
      }

      markerContent.addEventListener('pointerenter', openStationInfo)
      markerContent.addEventListener('pointerleave', closeStationInfo)
      markerContent.addEventListener('focus', openStationInfo)
      markerContent.addEventListener('blur', closeStationInfo)
      markerContent.addEventListener('click', (event) => {
        event.stopPropagation()
        toggleStationInfo()

        setDetailLoading(true)
        setStationDetail(null)
        setStationHistory([])

        setSelectedStation(s) // 更新選中的站點
      })
      marker.addEventListener('gmp-click', () => {
        toggleStationInfo()

        setDetailLoading(true)
        setStationDetail(null)
        setStationHistory([])
        setSelectedStation(s)
      })

      marker.appendChild(markerContent)
      gmpMap.appendChild(marker)
    })

    gmpMap.addEventListener('click', () => {
      if (activeTooltip && activeMarker) {
        hideTooltipNow(activeMarker, activeTooltip)
      }
    })

    /* 将地图根节点挂载到 DOM：此处触发 <gmp-map> 的渲染，地图底图由 Google Maps API 绘制 */
    container.appendChild(gmpMap)

    /** 精简 Google 默认控件：通过 SDK 暴露的 innerMap.setOptions 只保留缩放，关掉其余 */
    const mapEl = gmpMap as HTMLElement & {
      innerMap?: {
        setOptions: (opts: {
          disableDefaultUI?: boolean
          zoomControl?: boolean
          mapTypeControl?: boolean
          streetViewControl?: boolean
          fullscreenControl?: boolean
        }) => void
      }
    }
    let retries = 0
    const applyMapOptions = () => {
      if (mapEl.innerMap) {
        mapEl.innerMap.setOptions({
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        return
      }
      if (retries < 20) {
        retries += 1
        setTimeout(applyMapOptions, 50)
      }
    }
    setTimeout(applyMapOptions, 0)
  }, [scriptLoaded, userPosition, stations])


  // 在點擊站點時，跟 Flask 後端要即時車位資料與歷史紀錄
  useEffect(() => {
    if (!selectedStation) return

    let cancelled = false

    getStationAvailabilityAPI(selectedStation.number)
      .then((data) => {
        if (!cancelled) {
          // 1. 將資料依照時間戳 (last_update) 由舊到新 (升冪) 排序
          const sortedData = [...data].sort(
            (a, b) => Number(a.last_update) - Number(b.last_update)
          )

          // 2. 把排序好的資料交給歷史圖表 (保證 X 軸時間由左至右)
          setStationHistory(sortedData)

          // 3. 排序過後，陣列的最後一筆一定就是時間最新的資料！
          if (sortedData.length > 0) {
            setStationDetail(sortedData[sortedData.length - 1])
          } else {
            setStationDetail(null)
          }
        }
      })
      .catch((err) => {
        // 建議這裡也加上 catch 處理錯誤，避免 API 失敗時完全沒反應
        console.error('Failed to fetch station details:', err)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedStation])


  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocationError('当前浏览器不支持定位')
      return
    }
    setLocationError(null)
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationLoading(false)
      },
      (err) => {
        setLocationError(formatLocationError(err.code))
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div className="relative w-full h-screen min-h-0">
      {/* 地图铺满整个页面 */}
      <div className="absolute inset-0 z-0">
        {error ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 text-sm max-w-md">
              {error}
            </div>
          </div>
        ) : (
          <div
            ref={mapContainerRef}
            className="h-full w-full bg-gray-100"
            style={{ minHeight: 0 }}
          />
        )}
      </div>

      {/* 左侧悬浮面板：站点 + 定位 + 天气合并 */}
      <div
        className={`absolute top-24 left-4 bottom-10 z-20 w-72 pointer-events-auto rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg p-4 flex flex-col overflow-visible transition-transform duration-300 ease-in-out ${panelOpen ? 'translate-x-0' : '-translate-x-[calc(100%+16px)]'}`}
      >
        {/* 面板切换按钮 — 贴在面板右侧 */}
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="absolute -right-6 top-6 flex h-12 w-6 items-center justify-center rounded-r-lg rounded-l-none bg-white/90 backdrop-blur-sm shadow-[2px_1px_6px_-2px_rgba(0,0,0,0.12)] cursor-pointer"
        >
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${panelOpen ? '' : 'rotate-180'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* 站点信息 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-foreground">Maps</span>
          {stationsLoading && (
            <span className="text-xs text-muted-foreground">加载站点中…</span>
          )}
          {!stationsLoading && stationsError && (
            <span className="text-xs text-amber-600">{stationsError}</span>
          )}
          {!stationsLoading && !stationsError && (
            <span className="text-xs text-muted-foreground">共 {stations.length} 个站点</span>
          )}
        </div>

        {/* 定位按钮 */}
        <button
          type="button"
          onClick={handleLocate}
          disabled={locationLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow transition hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {locationLoading ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              定位中…
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              定位到我的位置
            </>
          )}
        </button>
        {userPosition && (
          <div className="mt-1.5 text-xs text-muted-foreground text-center">
            {userPosition.lat.toFixed(5)}, {userPosition.lng.toFixed(5)}
          </div>
        )}
        {locationError && (
          <div className="mt-1.5 text-xs text-amber-600 text-center">{locationError}</div>
        )}

        {/* 弹性占位 */}
        <div className="flex-1 min-h-0" />

        {/* 分割线 */}
        <div className="mb-3 border-t border-gray-200/60" />

        {/* 天气 */}
        <Weather lat={userPosition?.lat ?? null} lon={userPosition?.lng ?? null} />
      </div>


      {/* 站點詳細資訊的彈出面板 (置中顯示) */}
      {selectedStation && (
        <>
          {/* 半透明黑色遮罩，點擊可關閉 */}
          <div
            className="absolute inset-0 z-30 bg-black/20 backdrop-blur-sm"
            onClick={() => setSelectedStation(null)}
          />

          {/* 置中的白色視窗 */}
          <div className="absolute top-1/2 left-1/2 z-40 w-[90%] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">

            {/* 頂部標題與關閉按鈕 */}
            <div className="relative mb-6 flex items-center justify-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {selectedStation.name}
                {/* 狀態小圓點：載入中(閃爍灰) -> 沒資料(暗灰) -> 沒車(紅) -> 有車(綠) */}
                <span
                  className={`h-3.5 w-3.5 rounded-full shadow-sm ${detailLoading
                      ? 'bg-gray-300 animate-pulse' // 載入中：淺灰色 + 呼吸燈動畫
                      : !stationDetail
                        ? 'bg-gray-400'               // API 失敗或無資料：暗灰色
                        : stationDetail.available_bikes === 0
                          ? 'bg-red-500'                // 確定沒車了：紅色
                          : 'bg-[#a3c661]'              // 確定有車：綠色
                    }`}
                ></span>
              </h2>
              <button
                onClick={() => setSelectedStation(null)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-black hover:text-gray-600 transition-colors"
              >
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* 數據區塊 */}
            <div className="mb-2 flex flex-col gap-3">
              {/* Bikes Available */}
              <div className="flex items-center rounded-xl border border-gray-400 py-3 px-5">
                <div className="text-3xl text-black">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
                  </svg>
                </div>
                <div className="w-20 text-center text-[2.5rem] font-medium text-[#a3c661]">
                  {/* 動態顯示資料，載入中顯示 -- */}
                  {detailLoading ? '--' : (stationDetail?.available_bikes ?? '--')}
                </div>
                <div className="ml-4 text-xl text-gray-800">Bikes Available</div>
              </div>

              {/* Stands Free */}
              <div className="flex items-center rounded-xl border border-gray-400 py-3 px-5">
                <div className="text-[2.2rem] font-bold text-black pl-1.5 pr-1">P</div>
                <div className="w-20 text-center text-[2.5rem] font-medium text-[#f1c25f]">
                  {/* 動態顯示資料，載入中顯示 -- */}
                  {detailLoading ? '--' : (stationDetail?.available_bike_stands ?? '--')}
                </div>
                <div className="ml-4 text-xl text-gray-800">Stands Free</div>
              </div>
            </div>

            {/* 更新時間 */}
            <div className="mb-4 text-right text-xs text-gray-400 pr-1">
              {stationDetail?.last_update
                ? `Updated: ${
                // 將資料強制轉字串，安全處理空白分割。若沒有空白就直接顯示
                String(stationDetail.last_update).includes(' ')
                  ? String(stationDetail.last_update).split(' ')[1]
                  : new Date(Number(stationDetail.last_update)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }`
                : 'Updated: --'}
            </div>

            {/* 歷史紀錄圖表區塊 */}
            <div className="overflow-hidden rounded-xl border border-gray-400">
              <div className="flex items-center bg-[#9fbab8] text-white">
                <button className="flex-1 py-1.5 text-center text-sm font-medium hover:bg-black/10 transition-colors">
                  Historic Average
                </button>
                <button className="flex-1 border-l border-white/40 bg-white text-gray-700 py-1.5 text-center text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <span className="text-gray-400">▼</span> Last 30 Days
                </button>
              </div>

              <div className="h-56 w-full bg-white p-2">
                {/* 👇 判斷如果有歷史資料，就渲染 Recharts 圖表 */}
                {stationHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stationHistory}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <defs>
                        {/* 綠色漸層，呼應你的 Mockup 設計 */}
                        <linearGradient id="colorBikes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a3c661" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#a3c661" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />

                      {/* X軸：將時間格式化為 小時:分鐘 */}
                      <XAxis
                        dataKey="requested_at"
                        tickFormatter={(tick) => {
                          if (!tick) return '';
                          const d = new Date(tick);
                          return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
                        }}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />

                      {/* Y軸：車輛數 */}
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />

                      {/* 游標移上去的浮動提示 */}
                      <Tooltip
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                        formatter={(value) => [value, 'Available Bikes']}
                      />

                      <Area
                        type="monotone"
                        dataKey="available_bikes"
                        stroke="#a3c661"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorBikes)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400 text-sm">
                    {detailLoading ? '載入歷史資料中...' : '暫無歷史資料'}
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* Maps 页专用：小固定 footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/50 bg-background/95 py-2 px-4 text-center text-xs text-muted-foreground backdrop-blur sm:px-6">
        © 2026 UCDSE. All rights reserved. Built with using React + Vite + Tailwind
      </footer>
    </div>
  )
}

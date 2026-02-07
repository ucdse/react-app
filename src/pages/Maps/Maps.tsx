import { useEffect, useRef, useState } from 'react'
import { getStationsAPI, type StationVO } from '@/api/station'

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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const keyError =
    !apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('AIza')
      ? '请设置有效的 VITE_GOOGLE_MAPS_API_KEY（.env）'
      : null
  const error = keyError ?? loadError

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

  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return

    const container = mapContainerRef.current
    container.innerHTML = ''

    const center = userPosition
      ? `${userPosition.lat},${userPosition.lng}`
      : DEFAULT_CENTER
    const zoom = userPosition ? USER_ZOOM : DEFAULT_ZOOM

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
      ;(marker as HTMLElement & { zIndex?: number }).zIndex = zIndex
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

    if (userPosition) {
      const userMarker = document.createElement('gmp-advanced-marker')
      userMarker.setAttribute('position', center)
      userMarker.setAttribute('title', '我的位置')
      gmpMap.appendChild(userMarker)
    }

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
      })
      marker.addEventListener('gmp-click', toggleStationInfo)

      marker.appendChild(markerContent)
      gmpMap.appendChild(marker)
    })

    gmpMap.addEventListener('click', () => {
      if (activeTooltip && activeMarker) {
        hideTooltipNow(activeMarker, activeTooltip)
      }
    })

    container.appendChild(gmpMap)

    /** 精简 Google 默认控件：只保留缩放，关掉其余 */
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
      {/* 1. 地图铺满底层 */}
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
            className="absolute inset-0 h-full w-full bg-gray-100"
            style={{ minHeight: 0 }}
          />
        )}
      </div>

      {/* 2. 悬浮横条：站点信息 + 定位（在 Header 下方） */}
      <div className="absolute top-20 left-0 right-0 z-10 flex justify-center px-4">
        <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-full px-6 py-3 flex items-center gap-4 flex-wrap justify-center max-w-2xl">
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
          <button
            type="button"
            onClick={handleLocate}
            disabled={locationLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow transition hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed"
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
            <span className="text-xs text-muted-foreground">
              {userPosition.lat.toFixed(5)}, {userPosition.lng.toFixed(5)}
            </span>
          )}
          {locationError && (
            <span className="text-xs text-amber-600">{locationError}</span>
          )}
        </div>
      </div>

      {/* Maps 页专用：小固定 footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/50 bg-background/95 py-2 px-4 text-center text-xs text-muted-foreground backdrop-blur sm:px-6">
        © 2026 UCDSE. All rights reserved. Built with using React + Vite + Tailwind
      </footer>
    </div>
  )
}

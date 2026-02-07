import { useEffect, useRef, useState } from 'react'

const GOOGLE_MAPS_CALLBACK = '__googleMapsCallback'
const DEFAULT_CENTER = '40.12150192260742,-100.45039367675781'
const DEFAULT_ZOOM = 4
const USER_ZOOM = 15
const DEMO_MAP_ID = 'DEMO_MAP_ID'

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

    const marker = document.createElement('gmp-advanced-marker')
    marker.setAttribute('position', center)
    marker.setAttribute('title', '我的位置')

    gmpMap.appendChild(marker)
    container.appendChild(gmpMap)
  }, [scriptLoaded, userPosition])

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
    <section className="relative flex h-full flex-col min-h-0 pt-20">
      {/* Header 下横条：不遮挡地图，占位布局 */}
      <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Maps</span>
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

      {error ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 text-sm max-w-md">
            {error}
          </div>
        </div>
      ) : (
        <div
          ref={mapContainerRef}
          className="flex-1 min-h-0 w-full bg-gray-100"
        />
      )}

      {/* Maps 页专用：小固定 footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/50 bg-background/95 py-2 px-4 text-center text-xs text-muted-foreground backdrop-blur sm:px-6">
        © 2026 UCDSE. All rights reserved. Built with using React + Vite + Tailwind
      </footer>
    </section>
  )
}

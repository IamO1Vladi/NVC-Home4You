import React from 'react'
import './DeliveryEstimator.css'
import { useI18n } from '../i18n/I18nContext.jsx'

// Map
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix default marker icons for Vite/webpack
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

/**
 * DeliveryEstimator
 * - base: { lat, lon } — origin point (Marikостиново)
 * - ratePerKm: number — price per km (1.5)
 * - currency: string — 'лв.'
 */
export default function DeliveryEstimator({
  base = { lat: 41.43165, lon: 23.33813 }, // Marikostinovo (Bulgaria)
  ratePerKm = 1.5,
  currency = 'лв.'
}) {
  const [query, setQuery] = React.useState('')
  const [dest, setDest] = React.useState(null)       // { lat, lon, label }
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [route, setRoute] = React.useState(null)     // { distanceKm, coords:[[lat,lon],...], source:'osrm'|'haversine' }
  const { t } = useI18n()

  // --- Custom pin icons as inline SVG (no files required) ---
const PIN_PURPLE =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
  "<path fill='%234f46e5' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>" +
  "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>";

const PIN_GREEN =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
  "<path fill='%2310b981' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>" +
  "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>";

const iconDest = L.icon({
  iconUrl: PIN_PURPLE,
  iconRetinaUrl: PIN_PURPLE,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -36],
});

const iconBase = L.icon({
  iconUrl: PIN_GREEN,
  iconRetinaUrl: PIN_GREEN,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -36],
});


  // Simple map click-to-set component
  function ClickToSet({ onPick }) {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng
        onPick({ lat, lon: lng, label: 'Dropped pin' })
      }
    })
    return null
  }

  // Geocode with Nominatim (public endpoint; consider self-hosting for prod)
  async function geocode(q) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'bg,en' } })
    if (!res.ok) throw new Error('Грешка при геокодиране')
    const data = await res.json()
    if (!data?.length) throw new Error('Не е намерен адрес')
    const { lat, lon, display_name } = data[0]
    return { lat: parseFloat(lat), lon: parseFloat(lon), label: display_name }
  }

  // Haversine as a fallback if OSRM fails
  function haversineKm(a, b) {
    const toRad = (v) => (v * Math.PI) / 180
    const R = 6371 // km
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lon - a.lon)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  }

  // Route distance via OSRM; returns geojson polyline + km
  async function osrmRouteKm(a, b) {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) throw new Error('OSRM error')
    const data = await res.json()
    const r = data?.routes?.[0]
    if (!r) throw new Error('No route')
    const km = r.distance / 1000
    const coords = r.geometry.coordinates.map(([lon, lat]) => [lat, lon])
    return { distanceKm: km, coords, source: 'osrm' }
  }

  async function compute(destPoint) {
    setError('')
    setLoading(true)
    try {
      // Try OSRM route first
      const r = await osrmRouteKm(base, destPoint)
      setRoute(r)
    } catch {
      // Fallback to straight-line
      const km = haversineKm(base, destPoint)
      setRoute({ distanceKm: km, coords: [[base.lat, base.lon], [destPoint.lat, destPoint.lon]], source: 'haversine' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    if (!query.trim()) return
    try {
      setLoading(true)
      const p = await geocode(query.trim())
      setDest(p)
      await compute(p)
    } catch (err) {
      setError(err.message || 'Нещо се обърка')
    } finally {
      setLoading(false)
    }
  }

  function round(n, p = 2) { return Math.round(n * 10 ** p) / 10 ** p }

  const oneWayKm = route ? route.distanceKm : 0
  const billableKm = route ? round(oneWayKm * 2) : 0       // both directions
  const estimate = route ? round(billableKm * ratePerKm) : 0

  return (
    <section className="est">
      <div className="container">
        <div className="est-head">
          <h2 className="est-h">{t('delivery.map.mapHeader')}</h2>
          <p className="est-sub">{t('delivery.map.mapSubHeader')}</p>
        </div>

        <div className="est-grid">
          {/* Left: form + results */}
          <div className="est-card">
            <form className="est-form" onSubmit={handleSearch}>
              <input
                type="text"
                className="est-input"
                placeholder={t('delivery.map.mapPlaceholderAddress')}
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
              />
              <button className="btn" disabled={loading}>{loading ? t('delivery.map.mapButtonHelpText2') : t('delivery.map.mapButtonHelpText1')}</button>
            </form>

            {error && <div className="est-error">⚠️ {error}</div>}

            <div className="est-stats">
              <div><span className="est-k">{t('delivery.map.mapAddress')}</span> <span className="est-v">{dest?.label || '—'}</span></div>
              <div><span className="est-k">{t('delivery.map.mapDistanceOneWay')}</span> <span className="est-v">{route ? `${round(oneWayKm)} км` : '—'}</span></div>
              <div><span className="est-k">{t('delivery.map.mapDistanceInKm')}</span> <span className="est-v">{route ? `${billableKm} км` : '—'}</span></div>
              <div><span className="est-k">{t('delivery.map.mapEstimatePrice')}</span> <span className="est-v est-price">{route ? `${estimate} ${currency}` : '—'}</span></div>
              {route?.source === 'haversine' && (
                <small className="est-note">{t('delivery.map.mapSearchNote')}</small>
              )}
            </div>
          </div>

          {/* Right: map */}
          <div className="est-map-card">
            <MapContainer
              center={[base.lat, base.lon]}
              zoom={9}
              className="est-map"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Base (Marikostinovo) */}
              <Marker position={[base.lat, base.lon]} icon={iconDest} />

              {/* Destination */}
              {dest && <Marker
                position={[dest.lat, dest.lon]}
                icon={iconDest}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target.getLatLng()
                    const p = { lat: m.lat, lon: m.lng, label: dest.label }
                    setDest(p)
                    compute(p)
                  }
                }}
              />}

              {/* Route polyline */}
              {route?.coords && <Polyline positions={route.coords} pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.9 }} />}

              {/* Click to drop destination */}
              <ClickToSet onPick={(p)=>{ setDest(p); compute(p) }} />
            </MapContainer>

            <div className="est-hint">{t('delivery.map.mapHelpText')}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

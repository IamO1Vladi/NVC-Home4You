import React, { useMemo, useState } from 'react'
import './DeliveryEstimator.css'

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const PIN_PURPLE =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
  "<path fill='%234f46e5' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>" +
  "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>"

const PIN_GREEN =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
  "<path fill='%2310b981' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>" +
  "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>"

const iconDest = L.icon({
  iconUrl: PIN_PURPLE,
  iconRetinaUrl: PIN_PURPLE,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -36],
})

const iconBase = L.icon({
  iconUrl: PIN_GREEN,
  iconRetinaUrl: PIN_GREEN,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -36],
})

function round(n, p = 2) {
  return Math.round(n * 10 ** p) / 10 ** p
}

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function DeliveryEstimator({ content }) {
  const base = content?.base || { lat: 41.43165, lon: 23.33813 }
  const ratePerKm = typeof content?.ratePerKm === 'number' ? content.ratePerKm : 1.5
  const currency = content?.currency || 'BGN'
  const strings = content?.strings || {}
  const locale = content?.locale || 'en-GB'
  const acceptLanguage = content?.acceptLanguage || 'en,bg'

  const [query, setQuery] = useState('')
  const [dest, setDest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [route, setRoute] = useState(null)

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale]
  )

  function ClickToSet({ onPick }) {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng
        onPick({ lat, lon: lng, label: strings.droppedPin || 'Dropped pin' })
      },
    })
    return null
  }

  async function geocode(q) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': acceptLanguage } })
    if (!res.ok) throw new Error(strings.geocodeError || 'Geocoding failed')
    const data = await res.json()
    if (!data?.length) throw new Error(strings.notFoundError || 'Address not found')
    const { lat, lon, display_name } = data[0]
    return { lat: parseFloat(lat), lon: parseFloat(lon), label: display_name }
  }

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
      const r = await osrmRouteKm(base, destPoint)
      setRoute(r)
    } catch {
      const km = haversineKm(base, destPoint)
      setRoute({
        distanceKm: km,
        coords: [[base.lat, base.lon], [destPoint.lat, destPoint.lon]],
        source: 'haversine',
      })
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
      setError(err.message || strings.genericError || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const oneWayKm = route ? route.distanceKm : 0
  const billableKm = route ? round(oneWayKm * 2) : 0
  const estimate = route ? round(billableKm * ratePerKm) : 0
  const dash = strings.emptyValue || '—'
  const kmLabel = strings.km || 'km'

  return (
    <section className="est">
      <div className="container">
        <div className="est-head">
          <h2 className="est-h">{strings.heading}</h2>
          <p className="est-sub">{strings.subheading}</p>
        </div>

        <div className="est-grid">
          <div className="est-card">
            <form className="est-form" onSubmit={handleSearch}>
              <input
                type="text"
                className="est-input"
                placeholder={strings.placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={strings.placeholder}
              />
              <button className="btn" disabled={loading}>
                {loading ? strings.buttonLoading : strings.buttonIdle}
              </button>
            </form>

            {error ? <div className="est-error">⚠️ {error}</div> : null}

            <div className="est-stats">
              <div><span className="est-k">{strings.addressLabel}</span> <span className="est-v">{dest?.label || dash}</span></div>
              <div><span className="est-k">{strings.oneWayLabel}</span> <span className="est-v">{route ? `${numberFormatter.format(round(oneWayKm))} ${kmLabel}` : dash}</span></div>
              <div><span className="est-k">{strings.billableLabel}</span> <span className="est-v">{route ? `${numberFormatter.format(billableKm)} ${kmLabel}` : dash}</span></div>
              <div><span className="est-k">{strings.estimateLabel}</span> <span className="est-v est-price">{route ? `${numberFormatter.format(estimate)} ${currency}` : dash}</span></div>
              {route?.source === 'haversine' ? <small className="est-note">{strings.searchNote}</small> : null}
            </div>
          </div>

          <div className="est-map-card">
            <MapContainer center={[base.lat, base.lon]} zoom={9} className="est-map">
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              <Marker position={[base.lat, base.lon]} icon={iconBase} />

              {dest ? (
                <Marker
                  position={[dest.lat, dest.lon]}
                  icon={iconDest}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const m = e.target.getLatLng()
                      const p = { lat: m.lat, lon: m.lng, label: dest.label }
                      setDest(p)
                      compute(p)
                    },
                  }}
                />
              ) : null}

              {route?.coords ? (
                <Polyline positions={route.coords} pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.9 }} />
              ) : null}

              <ClickToSet
                onPick={(p) => {
                  setDest(p)
                  compute(p)
                }}
              />
            </MapContainer>

            <div className="est-hint">{strings.helpText}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

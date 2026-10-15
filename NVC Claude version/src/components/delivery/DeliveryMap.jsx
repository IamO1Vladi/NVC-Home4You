// The delivery calculator's map, loaded with React.lazy only when the visitor opens it, so
// Leaflet and its stylesheet never weigh on the page that merely shows the calculator.
//
// It confirms the place; it calculates nothing. The base the price is counted from and the
// chosen place are pinned and joined by a dashed STRAIGHT line labelled with the ROAD km (the
// route itself is not drawn: the distances were routed offline, see src/lib/deliveryPlaces.js).
// A tap hands its point back to the calculator, which picks the nearest town or says nothing
// is near.
//
// OpenStreetMap's tile policy: the tile URL exactly as below (no {s} subdomains) and the
// attribution "© OpenStreetMap contributors" linked to its copyright page.
import React, { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const pin = (fill) =>
  L.icon({
    iconUrl:
      'data:image/svg+xml;utf8,' +
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
      `<path fill='${encodeURIComponent(fill)}' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>` +
      "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    tooltipAnchor: [0, -34],
  })

// The base in the site's sage, the place in its accent blue: the same pair in both themes.
const ICONS = { base: pin('#3E7C59'), place: pin('#2B63C9') }

// Leaflet writes its attribution prefix's title in English; swap only the title, keeping the
// link, Leaflet's name and its flag (the same small swap the old estimator made).
function AttributionTitle({ title }) {
  const map = useMap()
  useEffect(() => {
    const control = map.attributionControl
    const prefix = L.Control.Attribution.prototype.options.prefix
    if (!title || !control || typeof prefix !== 'string') return
    const safe = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
    control.setPrefix(prefix.replace(/title="[^"]*"/, `title="${safe}"`))
  }, [map, title])
  return null
}

function FitTo({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points, { padding: [36, 36], maxZoom: 11 })
    else if (points.length === 1) map.setView(points[0], 8)
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// A tap picks a place. On a touch screen one-finger dragging starts switched off, so a thumb
// scrolling the page past the map does not pan it instead; the first tap switches it on.
function TapToPick({ onPick }) {
  const map = useMapEvents({
    click(e) {
      if (!map.dragging.enabled()) map.dragging.enable()
      onPick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/**
 * @param pins   [{ lat, lon, kind: 'base'|'place', label }]
 * @param line   { from: [lat, lon], to: [lat, lon], label } or null
 * @param onPick (lat, lon) => void
 * @param text   content.calculator.map (zoomIn, zoomOut, attributionTitle, label)
 */
export default function DeliveryMap({ pins = [], line = null, onPick, text = {} }) {
  const points = useMemo(() => pins.map((p) => [p.lat, p.lon]), [pins])
  const start = points[0] || [41.43165, 23.33813]
  const touch = useRef(Boolean(L.Browser.mobile)).current

  return (
    <div className="dc-map" role="region" aria-label={text.label}>
      <MapContainer
        center={start}
        zoom={8}
        className="dc-map-canvas"
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={!touch}
      >
        <ZoomControl
          {...(text.zoomIn ? { zoomInTitle: text.zoomIn } : {})}
          {...(text.zoomOut ? { zoomOutTitle: text.zoomOut } : {})}
        />
        <AttributionTitle title={text.attributionTitle} />
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        {pins.map((p) => (
          <Marker key={`${p.kind}-${p.lat}-${p.lon}`} position={[p.lat, p.lon]} icon={ICONS[p.kind] || ICONS.place} alt={p.label} title={p.label} />
        ))}
        {line ? (
          <Polyline positions={[line.from, line.to]} pathOptions={{ color: '#2B63C9', weight: 3, opacity: 0.9, dashArray: '6 8' }}>
            {line.label ? (
              <Tooltip permanent direction="center" className="dc-map-km">
                {line.label}
              </Tooltip>
            ) : null}
          </Polyline>
        ) : null}
        <FitTo points={points} />
        <TapToPick onPick={onPick} />
      </MapContainer>
    </div>
  )
}

import React from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './LogisticsWorld.css'
import { useI18n } from '../i18n/I18nContext.jsx'

/* ---------- Pins (inline SVG, no files) ---------- */
const PIN_GREEN =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
  "<path fill='%2310b981' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>" +
  "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>";
const PIN_PURPLE =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
  "<path fill='%236366f1' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>" +
  "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>";
const PIN_ORANGE =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>" +
  "<path fill='%23f59e0b' d='M12 0a10 10 0 0 0-10 10c0 6 10 26 10 26s10-20 10-26A10 10 0 0 0 12 0z'/>" +
  "<circle cx='12' cy='10' r='4' fill='%23ffffff'/></svg>";

const iconSH = L.icon({ iconUrl: PIN_PURPLE, iconRetinaUrl: PIN_PURPLE, iconSize:[30,42], iconAnchor:[15,42] })
const iconHCM = L.icon({ iconUrl: PIN_GREEN,  iconRetinaUrl: PIN_GREEN,  iconSize:[30,42], iconAnchor:[15,42] })
const iconLAEM= L.icon({ iconUrl: PIN_ORANGE, iconRetinaUrl: PIN_ORANGE, iconSize:[30,42], iconAnchor:[15,42] })
const iconDEST= L.icon({ iconUrl: PIN_PURPLE, iconRetinaUrl: PIN_PURPLE, iconSize:[28,40], iconAnchor:[14,40] })

/* ---------- Origins ---------- */
const ORIGINS = [
  { id:'sh',  label:'Shanghai (CN)',      lat:31.2304, lon:121.4737, color:'#6366f1', icon:iconSH },
  { id:'hcm', label:'Ho Chi Minh (VN)',   lat:10.8231, lon:106.6297, color:'#10b981', icon:iconHCM },
  { id:'lcb', label:'Laem Chabang (TH)',  lat:13.0980, lon:100.9150, color:'#f59e0b', icon:iconLAEM },
]

/* ---------- Destinations per mode ---------- */
const SEA_PORTS = [
  // EU West / North
  { id:'rtm', name:'Rotterdam, NL', lat:51.92, lon:4.48,  type:'EU_W' },
  { id:'ham', name:'Hamburg, DE',   lat:53.55, lon:9.99,  type:'EU_W' },
  { id:'ant', name:'Antwerp, BE',   lat:51.26, lon:4.40,  type:'EU_W' },
  // Mediterranean
  { id:'pir', name:'Piraeus, GR',   lat:37.94, lon:23.63, type:'MED'  },
  { id:'vlc', name:'Valencia, ES',  lat:39.45, lon:-0.32, type:'MED'  },
  // Black Sea
  { id:'cnd', name:'Constanța, RO', lat:44.17, lon:28.64, type:'BLACK'},
  { id:'var', name:'Varna, BG',     lat:43.21, lon:27.91, type:'BLACK'},
  // Americas
  //{ id:'lax', name:'Los Angeles, US', lat:33.74, lon:-118.26, type:'NA_W' },
  //{ id:'nyc', name:'New York, US',    lat:40.67, lon:-74.05,  type:'NA_E' },
  //{ id:'sts', name:'Santos, BR',      lat:-23.96, lon:-46.33, type:'SA'   },
  //{ id:'cll', name:'Callao, PE',      lat:-12.06, lon:-77.15, type:'SA_P' },
]

const AIR_DESTS = [
  { id:'sof', name:'Sofia (SOF), BG',      lat:42.695, lon:23.406 },
  { id:'ath', name:'Athens (ATH), GR',     lat:37.936, lon:23.944 },
  { id:'fra', name:'Frankfurt (FRA), DE',  lat:50.037, lon:8.562 },
  { id:'cdg', name:'Paris (CDG), FR',      lat:49.009, lon:2.547 },
  { id:'lhr', name:'London (LHR), UK',     lat:51.470, lon:-0.454 },
  //{ id:'jfk', name:'New York (JFK), US',   lat:40.641, lon:-73.778 },
  //{ id:'lax', name:'Los Angeles (LAX), US',lat:33.941, lon:-118.408 },
  { id:'gru', name:'São Paulo (GRU), BR',  lat:-23.431, lon:-46.469 },
]

const RAIL_DESTS = [
  { id:'dsg', name:'Duisburg, DE',  lat:51.434, lon:6.762 },
  { id:'ham', name:'Hamburg, DE',   lat:53.551, lon:9.993 },
  { id:'waw', name:'Warsaw, PL',    lat:52.229, lon:21.012 },
  { id:'bud', name:'Budapest, HU',  lat:47.497, lon:19.040 },
  { id:'sof', name:'Sofia, BG',     lat:42.697, lon:23.322 },
]



/* ---------- Helpers ---------- */
function toRad(d){ return d*Math.PI/180 } 
function toDeg(r){ return r*180/Math.PI }

// Great‑circle coordinates between two points
function greatCircle(a, b, n=64){
  const φ1 = toRad(a.lat), λ1 = toRad(a.lon)
  const φ2 = toRad(b.lat), λ2 = toRad(b.lon)
  const Δ = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2-φ1)/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin((λ2-λ1)/2)**2
  ))
  if(!Δ) return [[a.lat,a.lon],[b.lat,b.lon]]
  const sinΔ = Math.sin(Δ)
  const pts=[]
  for(let i=0;i<=n;i++){
    const f=i/n
    const A=Math.sin((1-f)*Δ)/sinΔ, B=Math.sin(f*Δ)/sinΔ
    const x=A*Math.cos(φ1)*Math.cos(λ1)+B*Math.cos(φ2)*Math.cos(λ2)
    const y=A*Math.cos(φ1)*Math.sin(λ1)+B*Math.cos(φ2)*Math.sin(λ2)
    const z=A*Math.sin(φ1)+B*Math.sin(φ2)
    const φ=Math.atan2(z,Math.sqrt(x*x+y*y)), λ=Math.atan2(y,x)
    pts.push([toDeg(φ),toDeg(λ)])
  }
  return pts
}

// Join multiple segments with GC curves
function joinSegments(points, seg=40){
  let out=[]
  for(let i=0;i<points.length-1;i++){
    const gc = greatCircle(points[i], points[i+1], seg)
    out = out.concat(i===0 ? gc : gc.slice(1))
  }
  return out
}

/* ---------- Sea corridors (stylized over-water lanes) ---------- */
const WAY = {
  MALACCA:{lat:1.30,  lon:103.80},  // Singapore
  LANKA:  {lat:6.93,  lon:79.85},   // Off Colombo
  ADEN:   {lat:12.80, lon:45.00},   // Gulf of Aden
  SUEZ:   {lat:30.00, lon:32.60},
  GIB:    {lat:36.00, lon:-5.60},
  AEGEAN: {lat:36.80, lon:24.00},
  BOSPH:  {lat:41.00, lon:29.00},
  ATL1:   {lat:30.00, lon:-30.00},  // N Atlantic
  GH:     {lat:-34.00,lon:18.00},   // Cape of Good Hope
  PAC1:   {lat:20.00, lon:130.00},  // W Pacific
  PAC2:   {lat:35.00, lon:170.00},
  PAC3:   {lat:38.00, lon:-150.00},
  PAC4:   {lat:35.00, lon:-125.00},
  PACEQ:  {lat:0.00,  lon:-120.00}
}

function seaCorridorFor(destType){
  switch(destType){
    case 'EU_W':  return [WAY.MALACCA, WAY.LANKA, WAY.ADEN, WAY.SUEZ, WAY.GIB]
    case 'MED':   return [WAY.MALACCA, WAY.LANKA, WAY.ADEN, WAY.SUEZ]
    case 'BLACK': return [WAY.MALACCA, WAY.LANKA, WAY.ADEN, WAY.SUEZ, WAY.AEGEAN, WAY.BOSPH]
    case 'NA_W':  return [WAY.PAC1, WAY.PAC2, WAY.PAC3, WAY.PAC4]
    case 'NA_E':  return [WAY.MALACCA, WAY.LANKA, WAY.ADEN, WAY.SUEZ, WAY.GIB, WAY.ATL1]
    case 'SA':    return [WAY.MALACCA, WAY.LANKA, WAY.ADEN, WAY.GH]
    case 'SA_P':  return [WAY.PAC1, WAY.PAC2, WAY.PACEQ]
    default: return []
  }
}

/* ---------- Fit map to everything drawn ---------- */
function FitAll({ groups }){
  const map = useMap()
  React.useEffect(()=>{
    const pts=[]
    groups.forEach(g=>g.forEach(p=>pts.push(p)))
    if(pts.length){
      const b = L.latLngBounds(pts)
      map.fitBounds(b,{ padding:[30,30], maxZoom:4 })
    }
  },[groups,map])
  return null
}

export default function WorldRoutes(){
  const [mode, setMode] = React.useState('sea') // 'sea' | 'air' | 'rail'
  const [seaDest, setSeaDest] = React.useState('rtm')
  const [airDest, setAirDest] = React.useState('sof')
  const [railDest, setRailDest] = React.useState('dsg')

  // Lookup helpers
  const sea = SEA_PORTS.find(p=>p.id===seaDest) || SEA_PORTS[0]
  const air = AIR_DESTS.find(a=>a.id===airDest) || AIR_DESTS[0]
  const rail= RAIL_DESTS.find(r=>r.id===railDest) || RAIL_DESTS[0]

  // Build polylines for current mode
  let lines = []
  if(mode==='sea'){
    const corridor = seaCorridorFor(sea.type)
    lines = ORIGINS.map(o => joinSegments([o, ...corridor, sea]))
  } else if(mode==='air'){
    lines = ORIGINS.map(o => greatCircle(o, air, 96))
  } else {
    // Stylized Eurasian rail corridor
    const XI_AN = {lat:34.34, lon:108.94}
    const ALMT  = {lat:43.24, lon:76.90}
    const MOS   = {lat:55.75, lon:37.62}
    const WAW   = {lat:52.23, lon:21.01}
    lines = ORIGINS.map(o => joinSegments([o, XI_AN, ALMT, MOS, WAW, rail]))
  }

  // Colors per origin (consistent across modes)
  const colors = ORIGINS.map(o=>o.color)

  // Flatten for fit
  const fitGroups = lines

  const { t } = useI18n()

  return (
    <div className="wr-card">
      {/* Controls */}
      <div className="wr-controls">
        <div className="wr-row">
          <span className="wr-label">{t('logistics.map.lead1')}</span>
          {['sea','air','rail'].map(m=>(
            <button key={m} className={['wr-chip', mode===m && 'is-on'].filter(Boolean).join(' ')} onClick={()=>setMode(m)}>
              {m==='sea'?t('logistics.map.seaBubble'):m==='air'?t('logistics.map.airBubble'):t('logistics.map.railBubble')}
            </button>
          ))}
        </div>

        {mode==='sea' && (
          <div className="wr-row">
            <span className="wr-label">{t('logistics.map.lead2')}</span>
            <select className="wr-select" value={seaDest} onChange={e=>setSeaDest(e.target.value)}>
              {SEA_PORTS.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {mode==='air' && (
          <div className="wr-row">
            <span className="wr-label">Airport:</span>
            <select className="wr-select" value={airDest} onChange={e=>setAirDest(e.target.value)}>
              {AIR_DESTS.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {mode==='rail' && (
          <div className="wr-row">
            <span className="wr-label">Rail hub:</span>
            <select className="wr-select" value={railDest} onChange={e=>setRailDest(e.target.value)}>
              {RAIL_DESTS.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Map */}
      <MapContainer className="wr-map" center={[25, 15]} zoom={2} minZoom={2} worldCopyJump>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {/* Dest marker */}
        {mode==='sea'  && <Marker position={[sea.lat,  sea.lon]}  icon={iconDEST} />}
        {mode==='air'  && <Marker position={[air.lat,  air.lon]}  icon={iconDEST} />}
        {mode==='rail' && <Marker position={[rail.lat, rail.lon]} icon={iconDEST} />}

        {/* Origins + lines */}
        {ORIGINS.map((o, i)=>(
          <React.Fragment key={o.id}>
            <Marker position={[o.lat,o.lon]} icon={o.icon} />
            <Polyline positions={lines[i]} pathOptions={{ color: colors[i], weight: 4, opacity: 0.92, dashArray: mode==='air'?'':'8 10' }} />
          </React.Fragment>
        ))}

        <FitAll groups={fitGroups} />
      </MapContainer>

      {/* Legend */}
      <div className="wr-legend">
        <span className="wr-dot" style={{'--c':'#6366f1'}} /> {t('logistics.map.townOne')}
        <span className="wr-dot" style={{'--c':'#10b981'}} /> {t('logistics.map.townTwo')}
        <span className="wr-dot" style={{'--c':'#f59e0b'}} /> {t('logistics.map.townThree')}
      </div>
    </div>
  )
}

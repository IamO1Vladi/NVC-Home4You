import React from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext.jsx'
import './ServiceTiles.css'

function IconHome(){ return (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 3 3 10v11h6v-6h6v6h6V10z"/>
  </svg>
)}
function IconLayers(){ return (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 3 2 8l10 5 10-5-10-5Zm0 8L2 16l10 5 10-5-10-5Z"/>
  </svg>
)}
function IconSteel(){ return (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
  </svg>
)}
function IconInterior(){ return (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M3 3h18v4H3zM3 9h8v12H3zM13 9h8v8h-8z"/>
  </svg>
)}

export default function ServiceTiles(){
  const { t } = useI18n()
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  const items = [
    {
      key: 'modularBuilds',
      to: '/modular-builds',
      title: t('nav.modularBuilds'),
      desc: t('home.tiles.modularBuilds.desc') || 'Ready-to-install modular units for living, office or retail—fast assembly, long-term use.',
      icon: <IconLayers />,
      img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbp/eg/vb',
    },
    {
      key: 'modularHouses',
      to: '/modular-houses',
      title: t('nav.modularHouses'),
      desc: t('home.tiles.modularHouses.desc') || 'Permanent modular homes with flexible layouts and finishes.',
      icon: <IconHome />,
      img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdb/eg/vd',
    },
    {
      key: 'steelHouses',
      to: '/steel-houses',
      title: t('nav.steelHouses'),
      desc: t('home.tiles.steelHouses.desc') || 'Light, strong steel-frame houses—smart on timelines and cost.',
      icon: <IconSteel />,
      img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdc/eg/vb',
    },
    {
      key: 'interiors',
      to: '/interiors',
      title: t('nav.interiors'),
      desc: t('home.tiles.interiors.desc') || 'Renovation of bathrooms & kitchens with a clear plan and transparent pricing.',
      icon: <IconInterior />,
      img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rce/eg/vb',
    },
  ]

  // Track mouse pos per-card so the clip-path wipe follows the cursor
  const onMove = (e) => {
    const card = e.currentTarget
    const r = card.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    card.style.setProperty('--mx', `${x}%`)
    card.style.setProperty('--my', `${y}%`)
  }

  return (
    <section className="svx" aria-label={t('home?.services.header') || 'Our services'}>
      <div className="container">
        <div className="svx-head">
          <h2 className="svx-title">{t('home.services.header') || 'Explore our services'}</h2>
          <p className="svx-sub">{t('home.services.subHeader') || 'Hover to reveal details, tap to open the page'}</p>
        </div>

        <div className="svx-grid">
          {items.map((s) => (
            <Link
              key={s.key}
              to={s.to}
              className="svx-card"
              onMouseMove={onMove}
              aria-label={s.title}
            >
              <img
                className="svx-img"
                src={s.img}
                alt={s.title}
                onError={(e)=>{ e.currentTarget.src = fallback }}
                width="1600" height="1000" loading="lazy"
              />
             {/* BOTTOM-LEFT BULGARIAN LABEL */}
<div className="svx-bl-label">
  {s.title}
</div>

              <div className="svx-info">
                <div className="svx-icon">{s.icon}</div>
                <h3 className="svx-h">{s.title}</h3>
                <p className="svx-p">{s.desc}</p>
                <span className="svx-cta">{t('home.tiles.button') || 'Explore →'}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

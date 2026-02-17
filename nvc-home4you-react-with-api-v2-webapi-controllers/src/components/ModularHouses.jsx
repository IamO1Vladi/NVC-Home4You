import React from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import './ModularHouses.css'
import SEO from './SEO.jsx'

export default function ModularHouses(){
  const { t } = useI18n()
  const { openOffer, openQuestion } = useModalActions()
  const img = (f) => `${import.meta.env.BASE_URL}houses/${f}`
  const asset = (f) => `${import.meta.env.BASE_URL}modular-builds/${f}` // PDF + fallback img

  const models = [
    {
      key: 'house',
      href: `${asset('Космически Капсули.pdf')}#page=1`,
      image: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc8/eg/vb',
      fallback: asset('card.svg'),
    },
    {
      key: 'expandable',
      href: `${asset('Разгъваеми “Бокс” Къща.pdf')}#page=1`,
      image: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc5/eg/vb',
      fallback: asset('card.svg'),
    }
  ]

  return (
    <main className="mh-page">

  <SEO
      title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
      description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
      image="../../public/logo3"
      url="https://nvc-home4you.eu/modular-houses"
      hreflangs={[
      { hrefLang:'bg', href:'https://nvc-home4you.eu/modular-houses' },
      { hrefLang:'en', href:'https://nvc-home4you.eu/modular-houses' }
      ]}/>

      {/* ===== HERO ===== */}
      <section className="mh-hero">
        <div className="container">
          <div className="mh-hero-grid">
            <div>
              <h1 className="mh-title">{t('modHouses.title')}</h1>
              <p className="mh-lead">{t('modHouses.lead')}</p>
              <div className="mh-lead mh-sizes">{t('modHouses.sizes')}</div>

              <div className="row mt-6">
                <button className="btn" onClick={openOffer}>{t('nav.getOffer')}</button>
                <button className="btn ghost" onClick={openQuestion}>{t('nav.askQuestion')}</button>
              </div>
            </div>

            {/* Sticky quick facts */}
            <aside className="mh-aside">
              <div className="mh-aside-card">
                <div className="mh-aside-h">{t('modHouses.quick.h')}</div>
                <ul className="mh-aside-list">
                  <li>{t('modHouses.quick.bath')}</li>
                  <li>{t('modHouses.quick.facade')}</li>
                  <li>{t('modHouses.quick.floor')}</li>
                  <li>{t('modHouses.quick.assembly')}</li>
                </ul>
                <a className="mh-aside-link" href={`${asset('modular-builds.pdf')}#page=2`} target="_blank" rel="noopener noreferrer">
                  {t('modHouses.quick.viewPdf')}
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ===== MODEL CARDS (2) ===== */}
      <section>
        <div className="container mh-card-grid">
          {models.map(m => (
            <a key={m.key} className="mh-card" href={m.href} target="_blank" rel="noopener noreferrer" aria-label={t(`modHouses.models.${m.key}.aria`)}>
              <img
                className="mh-card-media"
                src={m.image}
                alt={t(`modHouses.models.${m.key}.alt`)}
                onError={(e)=>{ e.currentTarget.src = m.fallback }}
                width="1024"
                height="640"
                loading="lazy"
              />
              <div className="mh-card-pad">
                <div className="mh-card-kicker">{t(`modHouses.models.${m.key}.kicker`)}</div>
                <div className="mh-card-title">{t(`modHouses.models.${m.key}.title`)}</div>
                <p className="mh-card-desc">{t(`modHouses.models.${m.key}.desc`)}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ===== MATERIALS STRIP ===== */}
      <section>
        <div className="container mh-mats">
          <div className="mh-mats-h">{t('modHouses.mats.h')}</div>
          <div className="mh-mats-row">
            <span className="mh-chip">{t('modHouses.mats.mat1')}</span>
            <span className="mh-chip">{t('modHouses.mats.mat2')}</span>
            <span className="mh-chip">{t('modHouses.mats.mat3')}</span>
            <span className="mh-chip">{t('modHouses.mats.mat4')}</span>
            <span className="mh-chip">{t('modHouses.mats.mat5')}</span>
          </div>
          <div className="mh-muted">{t('modHouses.mats.note')}</div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section>
        <div className="container">
          <div className="mh-table-wrap">
            <table className="mh-table" role="table">
              <caption className="visually-hidden">{t('modHouses.table.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('modHouses.table.feature')}</th>
                  <th scope="col">{t('modHouses.models.house.title')}</th>
                  <th scope="col">{t('modHouses.models.expandable.title')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('modHouses.table.size')}</th>
                  <td>40–100 m²</td>
                  <td>37м2 / 58м2 / 78м2</td>
                </tr>
                <tr>
                  <th scope="row">{t('modHouses.table.walls')}</th>
                  <td>{t('modHouses.models.house.walls')}</td>
                  <td>{t('modHouses.models.expandable.walls')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('modHouses.table.facade')}</th>
                  <td>{t('modHouses.table.facadeHouse')}</td>
                  <td>{t('modHouses.table.facadeExp')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('modHouses.table.floor')}</th>
                  <td>{t('modHouses.models.house.flooring')}</td>
                  <td>{t('modHouses.models.expandable.flooring')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('modHouses.table.interior')}</th>
                  <td>{t('modHouses.table.interiorHouse')}</td>
                  <td>{t('modHouses.table.interiorExp')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('modHouses.table.bath')}</th>
                  <td>{t('modHouses.table.included')}</td>
                  <td>{t('modHouses.table.included')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('modHouses.table.assembly')}</th>
                  <td>{t('modHouses.table.depends')}</td>
                  <td>{t('modHouses.table.days')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="row mt-6" style={{justifyContent:'center'}}>
            <button className="btn" onClick={openOffer}>{t('nav.getOffer')}</button>
            <button className="btn ghost" onClick={openQuestion}>{t('nav.askQuestion')}</button>
          </div>
        </div>
      </section>
    </main>
  )
}

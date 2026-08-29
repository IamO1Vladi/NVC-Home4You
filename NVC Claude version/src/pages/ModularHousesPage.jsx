// src/pages/ModularHousesPage.jsx
import React from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import '../style/ModularHouses.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { brochureUrl } from '../lib/brochure.js'



export default function ModularHousesPage({ locale, content }) {


      const { openOffer, openQuestion } = useModalActions()
      const img = (f) => `${import.meta.env.BASE_URL}houses/${f}`
      const asset = (f) => `${import.meta.env.BASE_URL}modular-builds/${f}` // fallback img

      // Only the artwork lives here. Which brochure each card opens is content, and is named
      // in modularHouses.js next to the copy of the card that links it — these two used to be
      // hard-coded hrefs, and they are the two biggest PDFs on the site, so anything that went
      // looking for brochures in the content directory found four of six.
      const models = [
        {
          key: 'house',
          image: '/api/img/content/bvk4n834b-rc8-eg-vb.webp',
          fallback: asset('card.svg'),
        },
        {
          key: 'expandable',
          image: '/api/img/content/bvk4n834b-rc5-eg-vb.webp',
          fallback: asset('card.svg'),
        }
      ]
  return (
    <main className="mh-page">
    {/* ===== HERO ===== */}
      <section className="mh-hero">
        <div className="container">
          <div className="mh-hero-grid">
            <div>
              <h1 className="mh-title">{content.title}</h1>
              <p className="mh-lead">{content.lead}</p>
              <div className="mh-lead mh-sizes">{content.sizes}</div>

              <div className="row mt-6">
                <button className="btn" onClick={openOffer}>{content.getOffer}</button>
                <button className="btn ghost" onClick={openQuestion}>{content.askQuestion}</button>
              </div>
            </div>

            {/* Sticky quick facts */}
            <aside className="mh-aside">
              <div className="mh-aside-card">
                <div className="mh-aside-h">{content.quick.h1}</div>
                <ul className="mh-aside-list">
                  <li>{content.quick.bath}</li>
                  <li>{content.quick.facade}</li>
                  <li>{content.quick.floor}</li>
                  <li>{content.quick.assembly}</li>
                </ul>
                <a className="mh-aside-link" href={brochureUrl(content.quick.brochureSlug, content.quick.brochurePage, locale)} target="_blank" rel="noopener noreferrer">
                  {content.quick.viewPdf}
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
            <a key={m.key} className="mh-card" href={brochureUrl(content.models[m.key].brochureSlug, content.models[m.key].brochurePage, locale)} target="_blank" rel="noopener noreferrer" aria-label={content.models[m.key].aria}>
              <img
                className="mh-card-media"
                src={cdnImage(m.image, { width: 1024 })}
                srcSet={cdnSrcSet(m.image, [512, 768, 1024, 1440])}
                sizes="(max-width: 820px) 100vw, 520px"
                alt={content.models[m.key].alt}
                onError={(e)=>{ e.currentTarget.src = m.fallback }}
                width="1024"
                height="640"
                loading="lazy"
              />
              <div className="mh-card-pad">
                <div className="mh-card-kicker">{content.models[m.key].kicker}</div>
                <div className="mh-card-title">{content.models[m.key].title}</div>
                <p className="mh-card-desc">{content.models[m.key].desc}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ===== MATERIALS STRIP ===== */}
      <section>
        <div className="container mh-mats">
          <div className="mh-mats-h">{content.mats.h}</div>
          <div className="mh-mats-row">
            <span className="mh-chip">{content.mats.mat1}</span>
            <span className="mh-chip">{content.mats.mat2}</span>
            <span className="mh-chip">{content.mats.mat3}</span>
            <span className="mh-chip">{content.mats.mat4}</span>
            <span className="mh-chip">{content.mats.mat5}</span>
          </div>
          <div className="mh-muted">{content.mats.note}</div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section>
        <div className="container">
          <div className="mh-table-wrap" tabIndex={0} role="group" aria-label={content.table.caption}>
            <table className="mh-table" role="table">
              <caption className="visually-hidden">{content.table.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{content.table.feature}</th>
                  <th scope="col">{content.models.house.title}</th>
                  <th scope="col">{content.models.expandable.title}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{content.table.size}</th>
                  <td>40–100 m²</td>
                  <td>37м2 / 58м2 / 78м2</td>
                </tr>
                <tr>
                  <th scope="row">{content.table.walls}</th>
                  <td>{content.models.house.walls}</td>
                  <td>{content.models.expandable.walls}</td>
                </tr>
                <tr>
                  <th scope="row">{content.table.facade}</th>
                  <td>{content.table.facadeHouse}</td>
                  <td>{content.table.facadeExp}</td>
                </tr>
                <tr>
                  <th scope="row">{content.table.floor}</th>
                  <td>{content.models.house.flooring}</td>
                  <td>{content.models.expandable.flooring}</td>
                </tr>
                <tr>
                  <th scope="row">{content.table.interior}</th>
                  <td>{content.table.interiorHouse}</td>
                  <td>{content.table.interiorExp}</td>
                </tr>
                <tr>
                  <th scope="row">{content.table.bath}</th>
                  <td>{content.table.included}</td>
                  <td>{content.table.included}</td>
                </tr>
                <tr>
                  <th scope="row">{content.table.assembly}</th>
                  <td>{content.table.depends}</td>
                  <td>{content.table.days}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="row mt-6" style={{justifyContent:'center'}}>
            <button className="btn" onClick={openOffer}>{content.getOffer}</button>
            <button className="btn ghost" onClick={openQuestion}>{content.askQuestion}</button>
          </div>
        </div>
      </section>
    </main>
  )
}
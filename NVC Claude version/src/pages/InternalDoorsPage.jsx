// /bg/interiorni-vrati, „Интериорни врати": the catalogue of a SEPARATE product, rebuilt
// 2026-10-15 on the product pages' system (<main class="hp pp idp">, HomePage.css and
// ProductPage.css first, InternalDoors.css for what only this page has).
//
// The owner's facts (content/bg/internalDoors.js says where each one comes from): the doors are
// sold on their own to builders, developers, shops and individuals, with no minimum; price and
// delivery are quoted by the quantity ordered; NVC fits them on request. The range is the
// owner's catalogue (content/shared/doorsCatalogue.js): its photos, drawings, colours, handles,
// trims, sliding doors and wall panels. Where the old page and the catalogue differ, the old
// page's information stays (the owner: "the catalogue is a little old"): the frame widths
// 70–180 mm and the three standard colours per type (components/doors/doorOptions.js).
//
// It replaces a page of stock room renders, a visualiser whose preview could stay invisible,
// "Брава" pictures that were hinges and a review modal. Every enquiry on the page now goes
// through one in-page form (DoorsEnquiry, #zapitvane) with origin 'doors'; the builder, a
// sliding-door style and the wall panels' button write their text into it.
//
// Sections, in order: the hero (the catalogue's cover); what every door has; the four types
// (each opens its drawing, details and catalogue models); the builder (#izbor); sliding doors;
// wall panels; how ordering works; the form; the questions (FaqList: #q-{id} links, also FAQ
// JSON-LD; the FAQ hub shows them too); the other pages;
// the closing card. No price anywhere: none exists.
//
// The hero's photo is an admin slot (doors-hero, since 2026-10-16), for a photo of doors the team
// has fitted once there is one. While it is empty the hero is the catalogue's cover as before;
// with the owner's photo the "photo from our catalogue" chip goes (it would no longer be true)
// and the alt is his description on the Bulgarian page, the content's general words otherwise.
// The share picture stays the cover.
import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/PartnerEnquiry.css'
import '../style/InternalDoors.css'
import ProductHero from '../components/product/ProductHero.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import FinalCta from '../components/FinalCta.jsx'
import FaqList from '../components/product/FaqList.jsx'
import DoorBuilder from '../components/doors/DoorBuilder.jsx'
import DoorsEnquiry from '../components/doors/DoorsEnquiry.jsx'
import { BUILDER_TYPES, STANDARD_FINISHES, fill, initialSelection, photoColourOf } from '../components/doors/doorOptions.js'
import {
  DOORS_COVER,
  DOOR_FEATURES,
  DOOR_FINISHES,
  DOOR_HARDWARE,
  SLIDING_DOORS,
  WALL_PANELS,
} from '../content/shared/doorsCatalogue.js'
import { paths } from '../routes/paths.js'
import { markedUp, pageQuestions } from '../lib/questions.js'
import { slotHeroPhoto, useSlotPhoto } from '../lib/homePhotos.js'

/** The hero's admin slot (photoSlotNames.js). */
export const DOORS_HERO_SLOT = 'doors-hero'

// The features in the order the page shows them: the owner-confirmed four (fire, sound, water,
// WPC), then the two the catalogue adds (eco, termite). Sound and WPC are the owner's, not in
// DOOR_FEATURES; the other four are its keys.
export const FEATURE_ORDER = ['fire', 'sound', 'water', 'wpc', 'eco', 'termite']
const CATALOGUE_FEATURES = new Set(DOOR_FEATURES.map((f) => f.key))

// The wall panels' room photos the page shows (of the seven in the catalogue).
const PANEL_ROOMS = [0, 2, 3]

function Tick() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
}

const FEATURE_ICONS = {
  fire: <path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z" />,
  sound: <><path d="M4 10v4h3l4 3V7L7 10H4z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>,
  water: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  wpc: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M4 14h16M9 4v16" /></>,
  eco: <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7" />,
  termite: <><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
}

function Icon({ name }) {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true">{FEATURE_ICONS[name]}</svg>
}

/** The questions as the FAQ markup publishes them: every one the page prints (lib/questions.js). */
export function faqItems(c) {
  return markedUp(pageQuestions('doors', c))
}

function TypeCard({ type, locale, c, onChoose }) {
  const t = c.range.types[type.key]
  const lang = (o) => (o ? o[locale] || o.en : '')
  const std = STANDARD_FINISHES[type.key]
  const views = type.variants
    ? type.variants.map((v) => ({ key: v.key, name: c.range.variants[v.key], room: v.room, roomAlt: lang(v.roomAlt), drawing: v.drawing }))
    : [{ key: type.key, name: t.name, room: type.room, roomAlt: lang(type.roomAlt), drawing: type.drawing }]
  const headingId = `idp-type-${type.key}`

  return (
    <li className="hp-card idp-type">
      <div className="idp-type-doors" aria-hidden="true">
        {std.map((f) => (
          <img key={f.key} src={type.photos[f.photo].src} alt="" width="140" height="300" loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="idp-type-body">
        <h3 id={headingId}>{t.name}</h3>
        <p className="idp-muted">{t.desc}</p>
        <p className="idp-sub-legend">{c.range.standard}</p>
        <ul className="idp-colours" aria-label={`${t.name}: ${c.range.standard}`}>
          {std.map((f) => (
            <li key={f.key}><span className="idp-swatch" style={{ '--sw': f.swatch }} aria-hidden="true" />{c.colors[f.key]}</li>
          ))}
        </ul>

        <details className="idp-more idp-type-more">
          <summary>{c.range.details}</summary>
          <div className="idp-type-views">
            {views.map((v) => (
              <figure key={v.key} className="idp-type-view">
                <div className="idp-type-pair">
                  <img src={v.room} alt={v.roomAlt} width="400" height="432" loading="lazy" decoding="async" />
                  <img className="idp-drawing" src={v.drawing} alt={fill(c.range.drawingAlt, { name: v.name })} width="300" height="432" loading="lazy" decoding="async" />
                </div>
                <figcaption>{type.variants ? v.name : c.range.drawing}</figcaption>
              </figure>
            ))}
          </div>
          <h4 className="idp-h4">{c.range.features}</h4>
          <ul className="idp-list">
            {t.features.map((line) => <li key={line}><Tick />{line}</li>)}
          </ul>
          <h4 className="idp-h4">{c.range.models}</h4>
          <ul className="idp-models">
            {type.photos.map((photo, i) => {
              // A standard colour's photo carries that colour's name, as on the chips above.
              const colour = photoColourOf(type, i, locale, c.colors)
              const detail = photo.detail ? lang(photo.detail) : ''
              return (
                <li key={photo.src}>
                  <img src={photo.src} alt={fill(c.range.photoAlt, { name: t.name, colour })} width="70" height="150" loading="lazy" decoding="async" />
                  <span>{colour}{detail ? <><br /><small>{detail}</small></> : null}</span>
                </li>
              )
            })}
          </ul>
        </details>

        <button type="button" className="hp-btn ghost idp-choose" onClick={() => onChoose(type.key)} aria-describedby={headingId}>
          {c.range.choose}
        </button>
      </div>
    </li>
  )
}

export default function InternalDoorsPage({ locale = 'bg', content }) {
  const c = content
  const [selection, setSelection] = useState(initialSelection)
  const [message, setMessage] = useState('')
  const [filled, setFilled] = useState(false)
  const formHeadingRef = useRef(null)
  const builderRef = useRef(null)
  const heroAdmin = useSlotPhoto(DOORS_HERO_SLOT)

  if (!c) return null
  const lang = (o) => (o ? o[locale] || o.en : '')
  const pathOf = (key) => paths[key]?.[locale] || paths[key]?.en

  const scrollTo = (id) => {
    const target = document.getElementById(id)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }
  const toForm = () => {
    scrollTo('zapitvane')
    formHeadingRef.current?.focus?.({ preventScroll: true })
  }
  const toBuilder = () => {
    scrollTo('izbor')
    builderRef.current?.focus?.({ preventScroll: true })
  }
  // Only the builder's text is "your choice from this page" (the form then links back to the
  // builder); a sliding-door or wall-panel line is just a starting message.
  const fillForm = (text, fromBuilder = false) => {
    setMessage(text)
    setFilled(fromBuilder)
    toForm()
  }
  // Emptied (by the visitor or by a sent form), the message is no longer the builder's.
  const onMessage = (text) => {
    setMessage(text)
    if (!text) setFilled(false)
  }

  // The sliding doors' enquiry, with the catalogue style when one was clicked.
  const slidingText = (style) => [c.message.sliding, style ? fill(c.message.slidingStyle, { style }) : null].filter(Boolean).join('\n')

  const chooseType = (key) => {
    setSelection((prev) => ({ ...prev, type: key }))
    toBuilder()
  }

  const faq = pageQuestions('doors', c, locale)
  const panelSizes = WALL_PANELS.sizes.map((s) => ({
    label: s.code,
    values: [fill(c.panels.mm, { n: s.widthMm }), fill(c.panels.mm, { n: s.thicknessMm }), s.joint],
  }))

  const siblings = [
    { to: pathOf('interiors'), label: c.siblings.interiors.label, desc: c.siblings.interiors.desc },
    { to: pathOf('modularBuilds'), label: c.siblings.containers.label, desc: c.siblings.containers.desc },
    { to: pathOf('partner'), label: c.siblings.partner.label, desc: c.siblings.partner.desc },
  ]

  return (
    <main className="hp pp idp">
      <ProductHero
        titleId="idp-hero-title"
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        lead={c.hero.lead}
        primary={{ label: c.hero.primary, onClick: toForm }}
        secondary={{ label: c.hero.secondary, onClick: toBuilder }}
        facts={c.hero.facts}
        photo={slotHeroPhoto(
          heroAdmin,
          { url: DOORS_COVER.src, alt: lang(DOORS_COVER.alt), caption: c.hero.chip, position: '30% 50%' },
          // No adminCaption: the owner's photo carries no chip.
          { locale, adminAlt: c.hero.adminAlt },
        )}
      />

      <section className="pp-band" id="idp-features" aria-labelledby="idp-features-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="idp-features-title">{c.features.heading}</h2>
            </div>
          </div>
          <div className="idp-features">
            <ul className="idp-feature-list">
              {FEATURE_ORDER.map((key) => (
                <li key={key} className="hp-card idp-feature" data-feature={key} data-source={CATALOGUE_FEATURES.has(key) ? 'catalogue' : 'owner'}>
                  <Icon name={key} />
                  <h3>{c.features.items[key].title}</h3>
                  <p>{c.features.items[key].text}</p>
                </li>
              ))}
            </ul>
            <div className="hp-card idp-set">
              <h3>{c.features.set.title}</h3>
              <p>{c.features.set.text}</p>
              <ul className="idp-set-parts">
                {c.features.set.parts.map((part) => <li key={part}><Tick />{part}</li>)}
              </ul>
              <div className="idp-set-hw">
                {DOOR_HARDWARE.hinges.slice(0, 3).map((h) => (
                  <img key={h.key} src={h.src} alt={lang(h.look)} width="58" height="94" loading="lazy" decoding="async" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="idp-range" aria-labelledby="idp-range-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="idp-range-title">{c.range.heading}</h2>
              <p className="hp-sub">{c.range.sub}</p>
            </div>
          </div>
          <ul className="idp-types">
            {BUILDER_TYPES.map((type) => (
              <TypeCard key={type.key} type={type} locale={locale} c={c} onChoose={chooseType} />
            ))}
          </ul>
        </div>
      </section>

      <div className="pp-band idp-builder-band" ref={builderRef} tabIndex={-1}>
        <DoorBuilder locale={locale} content={c} selection={selection} onChange={setSelection} onSend={(text) => fillForm(text, true)} />
      </div>

      <section id="idp-sliding" aria-labelledby="idp-sliding-title">
        <div className="hp-container">
          <div className="pp-split idp-sliding">
            <div className="idp-sliding-text">
              <h2 id="idp-sliding-title">{c.sliding.heading}</h2>
              <p className="hp-sub">{c.sliding.text}</p>
              <div className="idp-sliding-pair">
                <img src={SLIDING_DOORS.room} alt={lang(SLIDING_DOORS.roomAlt)} width="1200" height="912" loading="lazy" decoding="async" />
                <img className="idp-drawing" src={SLIDING_DOORS.drawing} alt={c.sliding.drawingAlt} width="766" height="720" loading="lazy" decoding="async" />
              </div>
              <button type="button" className="hp-btn" onClick={() => fillForm(slidingText())}>{c.sliding.ask}</button>
            </div>
            <div>
              <h3 className="idp-h3">{c.sliding.styles}</h3>
              <ul className="idp-sliding-styles">
                {SLIDING_DOORS.styles.map((s, i) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      className="idp-style"
                      onClick={() => fillForm(slidingText(`${i + 1} · ${lang(s.look)} (${fill(c.builder.pageRef, { p: s.page })})`))}
                      aria-label={`${c.sliding.askStyle}: ${lang(s.look)}`}
                    >
                      <img src={s.src} alt="" width="503" height="600" loading="lazy" decoding="async" />
                      <span>{lang(s.look)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="pp-band" id="idp-panels" aria-labelledby="idp-panels-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="idp-panels-title">{c.panels.heading}</h2>
              <p className="hp-sub">{c.panels.text}</p>
            </div>
            <button type="button" className="hp-btn ghost" onClick={() => fillForm(c.message.panels)}>{c.panels.ask}</button>
          </div>

          <ul className="idp-panel-rooms">
            {PANEL_ROOMS.map((i) => (
              <li key={WALL_PANELS.rooms[i].src}>
                <img src={WALL_PANELS.rooms[i].src} alt={lang(WALL_PANELS.rooms[i].alt)} width="1000" height="667" loading="lazy" decoding="async" />
              </li>
            ))}
          </ul>

          <div className="idp-panels-grid">
            <div className="hp-card idp-panel-card">
              <h3 className="idp-h3">{c.panels.finishes}</h3>
              <p className="idp-sub-legend">{lang(WALL_PANELS.finishes.wpc.title)}</p>
              <p className="idp-muted idp-small">{c.panels.wpcNote}</p>
              <ul className="idp-swatches" aria-label={lang(WALL_PANELS.finishes.wpc.title)}>
                {DOOR_FINISHES.map((f) => (
                  <li key={f.code} title={f.code}><img src={f.src} alt={f.code} width="40" height="64" loading="lazy" decoding="async" /></li>
                ))}
              </ul>
              {['pet', 'melamine'].map((kind) => (
                <React.Fragment key={kind}>
                  <p className="idp-sub-legend">{lang(WALL_PANELS.finishes[kind].title)}</p>
                  <ul className="idp-swatches idp-swatches--wide" aria-label={lang(WALL_PANELS.finishes[kind].title)}>
                    {WALL_PANELS.finishes[kind].items.map((f, i) => (
                      <li key={f.key}><img src={f.src} alt={`${lang(WALL_PANELS.finishes[kind].title)} ${i + 1}`} width="60" height="45" loading="lazy" decoding="async" /></li>
                    ))}
                  </ul>
                </React.Fragment>
              ))}
            </div>

            <div className="idp-panel-card">
              <table className="idp-sizes">
                <caption>{c.panels.sizesCaption}</caption>
                <thead>
                  <tr>{c.panels.cols.map((col) => <th key={col} scope="col">{col}</th>)}</tr>
                </thead>
                <tbody>
                  {panelSizes.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {row.values.map((v, i) => <td key={i}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pp-note">{c.panels.edgeNote}</p>
              <div className="idp-panel-boards">
                <img src={WALL_PANELS.board.src} alt={c.panels.boardAlt} width="800" height="405" loading="lazy" decoding="async" />
                <img src={WALL_PANELS.profile.src} alt="" width="800" height="446" loading="lazy" decoding="async" />
              </div>
              <details className="idp-more">
                <summary>{c.panels.more}</summary>
                <p className="idp-muted idp-small">{fill(c.panels.accessories, { n: WALL_PANELS.accessories.length })}</p>
                <h4 className="idp-h4">{c.panels.profiles}</h4>
                <ul className="idp-tags">
                  {WALL_PANELS.metalLines.profiles.map((p) => <li key={p.en}>{lang(p)}</li>)}
                </ul>
                <div className="idp-panel-schemes">
                  <img className="idp-drawing" src={WALL_PANELS.metalLines.src} alt={c.panels.metalAlt} width="1000" height="1185" loading="lazy" decoding="async" />
                  <img className="idp-drawing" src={WALL_PANELS.installScheme.src} alt={c.panels.installAlt} width="1000" height="1242" loading="lazy" decoding="async" />
                </div>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section id="idp-order" aria-labelledby="idp-order-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="idp-order-title">{c.order.heading}</h2>
            </div>
          </div>
          <ol className="hp-steps">
            {c.order.steps.map((step, i) => (
              <li key={step.title} className="hp-card hp-step">
                <strong><span className="hp-step-n" aria-hidden="true">{i + 1}</span>{step.title}</strong>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="pp-band idp-form-band">
        <DoorsEnquiry locale={locale} content={c.form} message={message} onMessage={onMessage} filled={filled && Boolean(message)} headingRef={formHeadingRef} />
      </div>

      <section id="idp-faq" aria-labelledby="idp-faq-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="idp-faq-title">{c.faq.heading}</h2>
            </div>
          </div>
          <FaqList items={faq} />
          {/* The FAQ hub, which gathers these and answers the rest (prices, warranty, customs). */}
          {c.faq.more ? <p className="pp-links"><Link to={pathOf('faq')}>{c.faq.more}</Link></p> : null}
        </div>
      </section>

      <SiblingLinks id="idp-siblings" heading={c.siblings.heading} go={c.siblings.go} items={siblings} />

      <FinalCta locale={locale} title={c.finalTitle} desc={c.finalDesc} onPrimary={toForm} />
    </main>
  )
}

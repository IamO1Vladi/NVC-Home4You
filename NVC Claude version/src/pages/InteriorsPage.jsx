// /bg/vytreshni-remonti, „Вътрешни ремонти": bathroom and kitchen renovations by NVC's own
// builder team, from Sofia to Petrich. Rebuilt 2026-10-15 on the home page's system (hp-*, the
// product pages' pp-*) from the owner's answers of that day (see bg/interiors.js).
//
// It replaces the old ir- page: a "complexity / до 1 седмица" scorer nobody backed, a brochure
// link to the wrong catalogue page, tabs that hid the kitchen from crawlers, and a kitchen
// before/after pair nobody could trace to NVC. Nothing on this page states a price or a
// duration (InteriorsPage.test.jsx), and every picture is the owner's own (interiorsMedia.js).
//
// Sections, in order: the hero (the owner's black-marble bathroom); what we do (the eight
// works, beside a photo of the kitchen being fitted) and the materials, ours or yours; our
// renovations (two muted clips, lazy as on the delivery page, the finished kitchen, and the
// before/after pairs); how we work (five steps, no pictures: the photos are above); where we
// work and the terms at a glance; the enquiry form at #zapitvane (origin 'interiors'); the
// questions (FaqList: #q-{id} links, also FAQ JSON-LD; the FAQ hub shows them too); the sibling
// pages; the closing card. The breadcrumbs and the Service markup are the route's.
import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/ProductSteel.css'
import '../style/Delivery.css'
import '../style/Interiors.css'
import ProductHero from '../components/product/ProductHero.jsx'
import ProcessSteps from '../components/product/ProcessSteps.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import FinalCta from '../components/FinalCta.jsx'
import { ClipMedia } from '../components/delivery/JourneyClips.jsx'
import InteriorsEnquiry, { INTERIORS_LEAD_SOURCE } from '../components/interiors/InteriorsEnquiry.jsx'
import FaqList from '../components/product/FaqList.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { getHomeContent } from '../content/home/index.js'
import { INTERIORS_CLIPS, INTERIORS_PAIRS, INTERIORS_PHOTOS, photoSrcSet } from '../content/shared/interiorsMedia.js'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'
import { paths } from '../routes/paths.js'
import { markedUp, pageQuestions } from '../lib/questions.js'

/** The questions as the FAQ markup publishes them: every one the page prints (lib/questions.js). */
export function faqItems(c) {
  return markedUp(pageQuestions('interiors', c))
}

// One line icon per work, drawn in currentColor.
const WORK_ICONS = {
  demolition: <><path d="M14 4l6 6-3 3-6-6z" /><path d="M11 7L4 20" /></>,
  plumbing: <><path d="M4 8h9a3 3 0 0 1 3 3v2" /><path d="M4 5v6" /><path d="M16 17c0 1.7-1.3 3-3 3s-3-1.3-3-3c0-2 3-5 3-5s3 3 3 5z" transform="translate(3 0)" /></>,
  electrics: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  tiling: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  plasterboard: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9.3 3v18M14.7 3v18" /></>,
  painting: <><rect x="4" y="3" width="14" height="6" rx="1.5" /><path d="M18 6h2v5h-8v3" /><path d="M11 14h2v7h-2z" /></>,
  flooring: <><path d="M3 20h18" /><path d="M3 15l5-5h13M3 10l5-5h13" /><path d="M8 10v10M14 10v10" /></>,
  kitchenFitting: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M4 11h16M12 11v10" /><path d="M9 7h6M9.5 15v2M14.5 15v2" /></>,
}

function WorkIcon({ name }) {
  const shape = WORK_ICONS[name]
  if (!shape) return null
  return (
    <svg className="ir-work-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {shape}
    </svg>
  )
}

/** A photo from /public/interiors, in its 600 and 1200 wide files. */
function Photo({ photo, alt, sizes, className }) {
  return (
    <img
      className={className}
      src={photo.large}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={alt}
      width={photo.width}
      height={photo.height}
      loading="lazy"
      decoding="async"
    />
  )
}

// What a pair photo that fails to load falls back to: the site's wordless placeholder.
const FALLBACK = `${import.meta.env.BASE_URL || '/'}modular-builds/card.svg`

/** One side of a before/after pair: a static crop, or an /api/img photo the server resizes. */
function PairImage({ image, alt }) {
  const sizes = '(max-width: 899px) 50vw, 300px'
  const fromApi = image.src.startsWith('/api/img/')
  return (
    <img
      src={fromApi ? cdnImage(image.src, { width: 640 }) : image.src}
      srcSet={fromApi ? cdnSrcSet(image.src, [320, 480, 640, 800]) : `${image.small} 600w, ${image.src} ${image.width}w`}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      onError={imageFallback(FALLBACK)}
    />
  )
}

/** The area drawn as what it is: one stretch of road, Sofia at the top, Petrich at the foot. */
function AreaLine({ from, to, label }) {
  return (
    <svg className="ir-area-line" viewBox="0 0 120 220" role="img" aria-label={label}>
      <path className="ir-area-road" d="M60 26 C 40 70, 82 104, 58 140 S 66 184, 60 196" />
      <circle className="ir-area-dot" cx="60" cy="26" r="9" />
      <circle className="ir-area-dot" cx="60" cy="196" r="9" />
      <text x="76" y="31" className="ir-area-name">{from}</text>
      <text x="76" y="201" className="ir-area-name">{to}</text>
    </svg>
  )
}

export default function InteriorsPage({ locale = 'bg', content }) {
  const { openQuestion } = useModalActions()
  const formHeadingRef = useRef(null)
  const c = content
  if (!c) return null

  const home = getHomeContent(locale)?.home
  const telephone = home?.localBusiness?.telephone || ''
  const pathOf = (key) => paths[key]?.[locale] || paths[key]?.en
  const faq = pageQuestions('interiors', c, locale)

  // The closing card's first button goes to the page's own form (the free site visit, with the
  // service, the town and a phone), under the hero's words; the generic offer modal asks for
  // none of those. The second still opens the shared question form, tagged with this page.
  const question = () => openQuestion({ source: INTERIORS_LEAD_SOURCE })

  const toForm = () => {
    const target = document.getElementById('zapitvane')
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    formHeadingRef.current?.focus?.({ preventScroll: true })
  }

  const workLabels = Object.fromEntries(c.works.items.map((item) => [item.key, item.title]))
  const photoAlt = (key) => c.jobs.photos.find((p) => p.key === key) || {}
  const kitchen = photoAlt('kitchen')
  const fitting = photoAlt('kitchenFitting')

  const siblings = [
    { to: pathOf('doors'), ...c.siblings.doors },
    { to: pathOf('about'), ...c.siblings.about },
    { to: pathOf('modularBuilds'), ...c.siblings.containers },
  ]

  return (
    <main className="hp pp ir">
      <ProductHero
        titleId="ir-hero-title"
        eyebrow={c.hero.eyebrow}
        title={c.hero.h1}
        lead={c.hero.lead}
        primary={{ label: c.hero.primary, onClick: toForm }}
        secondary={telephone ? { label: c.hero.call, href: `tel:${telephone}` } : null}
        facts={c.hero.facts}
        photo={{
          url: INTERIORS_PHOTOS.bathBlack.large,
          srcSet: photoSrcSet(INTERIORS_PHOTOS.bathBlack),
          alt: c.hero.photoAlt,
          caption: c.hero.photoCaption,
          position: '50% 62%',
        }}
      />

      <section className="pp-band" id="raboti" aria-labelledby="ir-works-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ir-works-title">{c.works.heading}</h2>
              <p className="hp-sub">{c.works.sub}</p>
            </div>
          </div>

          <div className="ir-works-grid">
            <ul className="ir-works">
              {c.works.items.map((item) => (
                <li key={item.key} className="hp-card ir-work" data-work={item.key}>
                  <WorkIcon name={item.key} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <figure className="ir-works-photo">
              <Photo photo={INTERIORS_PHOTOS.kitchenFitting} alt={fitting.alt} sizes="(max-width: 899px) 100vw, 440px" />
              <figcaption>{fitting.title}</figcaption>
            </figure>
          </div>

          <h3 className="ir-materials-title" id="ir-materials-title">{c.materials.heading}</h3>
          <ul className="pp-pair ir-materials" aria-labelledby="ir-materials-title">
            {['ours', 'yours'].map((side) => (
              <li key={side} className="hp-card ir-material" data-materials={side}>
                <h4>{c.materials[side].title}</h4>
                <p>{c.materials[side].text}</p>
              </li>
            ))}
          </ul>
          <p className="pp-note">{c.materials.note}</p>
        </div>
      </section>

      <section id="nashi-remonti" aria-labelledby="ir-jobs-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ir-jobs-title">{c.jobs.heading}</h2>
              <p className="hp-sub">{c.jobs.sub}</p>
            </div>
          </div>

          <ul className="ir-gallery">
            {c.jobs.clips.map((clip) => (
              INTERIORS_CLIPS[clip.key] ? (
                <li key={clip.key} className="ir-tile ir-tile--clip" data-clip={clip.key}>
                  <ClipMedia
                    className="ir-tile-media"
                    src={INTERIORS_CLIPS[clip.key].src}
                    poster={INTERIORS_CLIPS[clip.key].poster}
                  />
                  <h3 className="ir-tile-title">{clip.title}</h3>
                  <p className="ir-tile-text">{clip.text}</p>
                </li>
              ) : null
            ))}
            <li className="ir-tile ir-tile--wide" data-photo="kitchen">
              <div className="ir-tile-media">
                <Photo photo={INTERIORS_PHOTOS.kitchen} alt={kitchen.alt} sizes="(max-width: 599px) 100vw, (max-width: 899px) 100vw, 580px" />
              </div>
              <h3 className="ir-tile-title">{kitchen.title}</h3>
            </li>
          </ul>

          <h3 className="ir-pairs-title" id="ir-pairs-title">{c.jobs.pairsHeading}</h3>
          <ul className="ir-pairs" aria-labelledby="ir-pairs-title">
            {c.jobs.pairs.map((pair) => {
              const media = INTERIORS_PAIRS[pair.key]
              if (!media) return null
              return (
                <li key={pair.key} className="hp-card ir-pair" data-pair={pair.key}>
                  <h4>{pair.title}</h4>
                  <div className="ir-pair-row">
                    {['before', 'after'].map((side) => (
                      <figure key={side} className="ir-pair-fig">
                        <PairImage image={media[side]} alt={pair[side].alt} />
                        <figcaption className={`ir-pair-tag ir-pair-tag--${side}`}>{pair[side].label}</figcaption>
                      </figure>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <div className="pp-steel ir-process">
        <ProcessSteps id="kak-rabotim" heading={c.process.heading} sub={c.process.sub} steps={c.process.steps} />
      </div>

      <section className="pp-band" id="rayon" aria-labelledby="ir-area-title">
        <div className="hp-container">
          <div className="ir-area">
            <div className="hp-card ir-area-card">
              <div>
                <h2 id="ir-area-title">{c.area.heading}</h2>
                <p className="ir-area-place">{c.area.place}</p>
                <p className="ir-area-text">{c.area.text}</p>
              </div>
              <AreaLine from={c.area.from} to={c.area.to} label={c.area.mapLabel} />
            </div>
            <div className="ir-glance">
              <h3 id="ir-glance-title">{c.area.termsHeading}</h3>
              <dl className="pp-terms" aria-labelledby="ir-glance-title">
                {c.area.terms.map((term) => (
                  <div key={term.key} data-term={term.key}>
                    <dt>{term.label}</dt>
                    <dd>{term.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <InteriorsEnquiry locale={locale} content={c.form} workLabels={workLabels} headingRef={formHeadingRef} />

      <section id="vaprosi" aria-labelledby="ir-faq-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ir-faq-title">{c.faq.heading}</h2>
            </div>
          </div>
          <FaqList items={faq} />
          {/* The FAQ hub, which gathers these and answers the rest (prices, warranty, customs). */}
          {c.faq.more ? <p className="pp-links"><Link to={pathOf('faq')}>{c.faq.more}</Link></p> : null}
        </div>
      </section>

      <SiblingLinks id="ir-siblings" heading={c.siblings.heading} go={c.siblings.go} items={siblings} />

      <FinalCta
        locale={locale}
        content={{ ...home?.finalCta, primaryCta: c.hero.primary }}
        title={c.finalTitle}
        desc={c.finalDesc}
        onPrimary={toForm}
        onSecondary={question}
      />
    </main>
  )
}


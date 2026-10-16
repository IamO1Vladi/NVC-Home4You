// /bg/za-nas, "За нас": who is behind NVC Home4You, where, and why buying a house made in China
// from them is safe. Rebuilt 2026-10-15 on the home page's system (hp-*, the product pages'
// pp-*), replacing the old dark glass page: its "40+ suppliers", "6 countries" and "8 weeks"
// were unbacked or false, its year tabs hid two of three milestones, and its framer-motion
// fade made the prerendered hero blink to nothing and back (main.jsx renders with createRoot).
// Nothing here animates on load.
//
// EVERY FIGURE IS READ, NONE IS TYPED. The lead times come from deliveryRates.js LEAD_TIMES,
// the warranty's years from warranty.js (the 15 are the structure's alone and the tile says
// so), the review score and count from the live feed the home page's reviews read, and the
// case's stars from /api/cases-page. A tile whose figure is not there is not drawn.
//
// The copy keeps the owner's rules (see the content files): one factory, "нашата фабрика в
// Китай"; delivery "в целия ЕС", Bulgaria and Greece priced by the calculator; customs ours;
// insurance and tracking offered; the CE certificate, materials list and drawings for every
// buyer, a quality check at our factory before shipping, visits to the base by appointment only
// (owner, 2026-10-15). The homes count (shared/company.js) and the opening hours (the home
// content's contact band, the footer's source too) were confirmed on 2026-10-16.
//
// Sections, in order: the hero (the owner's crane-lift photo); the facts strip; who we are (the
// owner's timeline, 2021 logistics to 2026 steel-frame houses, then today, the base, visits and
// the company's VAT number from shared/company.js); the team (initials until the photos are in
// TEAM_PHOTOS); from our factory to your plot (the factory hall and, first of the clips, the
// factory loop, both the owner's of 2026-10-17; the four delivery clips; the published Paralia
// Kariani case); what we take on and what stays with you; the warranty; the
// reviews; where next; the closing card. The offer and question buttons carry the lead source 'about-page' (App.jsx
// reports it to GA and Meta). The breadcrumbs and AboutPage markup are the route's.
//
// The hero, the factory floor and each person's picture are admin slots (since 2026-10-16): the
// owner can replace them in "Снимки на сайта", and an empty slot shows exactly the photo (or the
// initials) named above. The share picture and the markup's primaryImageOfPage stay the crane.
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/Delivery.css'
import '../style/About.css'
import ProductHero from '../components/product/ProductHero.jsx'
import WarrantyTerms from '../components/product/WarrantyTerms.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import JourneyClips from '../components/delivery/JourneyClips.jsx'
import Testimonials from '../components/Testimonials.jsx'
import FinalCta from '../components/FinalCta.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { getHomeContent } from '../content/home/index.js'
import { LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { usePublishedCase, langOf, caseHref } from '../lib/usePublishedCase.js'
import { useReviewSummary } from '../lib/useReviewSummary.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { slotAlt, slotHeroPhoto, useSlotPhotos } from '../lib/homePhotos.js'
import { photoSlotOf, teamSlotName } from '../lib/photoSlotNames.js'
import SlotImg from '../components/SlotImg.jsx'
import { paths } from '../routes/paths.js'
import { COMPANY, TEAM_PHOTOS } from '../content/shared/company.js'
import { ABOUT_PHOTO, FACTORY_CLIP, FACTORY_PHOTO } from '../content/shared/aboutMedia.js'

/** The lead source the page's offer and question buttons report. */
export const ABOUT_LEAD_SOURCE = 'about-page'
export const ABOUT_ORIGIN = 'about'

const BASE = import.meta.env.BASE_URL || '/'
// The crane lift (the hero) and the factory floor: content/shared/aboutMedia.js, where the admin
// panel finds them too as the defaults of the about-hero and factory-floor slots. Re-exported
// here because the page's tests import them from the page.
export { ABOUT_PHOTO, FACTORY_PHOTO }

// The page's photos the owner can change in "Снимки на сайта" (photoSlotNames.js): the hero, the
// factory floor and one per person. An empty slot shows exactly what the page showed before.
export const ABOUT_HERO_SLOT = 'about-hero'
export const FACTORY_SLOT = 'factory-floor'

export const fill = (pattern, values = {}) => String(pattern ?? '').replace(
  /\{(\w+)\}/g,
  (m, key) => (values[key] == null ? m : String(values[key])),
)

/** The figures the copy names, from the modules (and the reviews, when they have answered). */
export function aboutFigures(reviews) {
  // Written as the reviews section under it writes it ("4.8 от 12 потвърдени отзива"), so the
  // two figures on one page read the same.
  const score = reviews?.average ? reviews.average.toFixed(1) : null
  return {
    homes: COMPANY.homesDelivered,
    days: LEAD_TIMES.containerInStockDays,
    production: LEAD_TIMES.boxProductionDays,
    months: LEAD_TIMES.boxToAddressMonths,
    years: WARRANTY_YEARS.structure,
    score,
    // "from 1 verified reviews" reads wrong in all three languages: one review is not a count.
    count: reviews?.total > 1 ? reviews.total : null,
  }
}

const TILE_ORDER = ['homes', 'container', 'production', 'toAddress', 'warranty', 'reviews']

/** "Владимир Владимиров" -> "ВВ": the first letter of the first and the family name. */
export const initials = (name) => String(name || '')
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0])
  .filter((_, i, all) => i === 0 || i === all.length - 1)
  .join('')
  .toUpperCase()

/**
 * The photo the owner set for a person in "Снимки на сайта" (their about-team-<slug> slot), or,
 * should it fail to load, `children`: what the card shows without it. Avatar keys it by the
 * photo's URL, so a new photo starts afresh even after the last one failed.
 */
function AdminAvatar({ slug, admin, children }) {
  const [failed, setFailed] = useState(false)
  if (failed) return children
  // An upright phone portrait cropped into a circle from its centre loses the top of the head;
  // the slot says where to crop instead.
  return (
    <img
      className="ab-avatar"
      src={cdnImage(admin.url, { width: 160 })}
      srcSet={cdnSrcSet(admin.url, [160, 240, 320])}
      sizes="72px"
      alt=""
      width="160"
      height="160"
      loading="lazy"
      decoding="async"
      style={{ objectPosition: photoSlotOf(teamSlotName(slug))?.adminPosition || '50% 50%' }}
      onError={() => setFailed(true)}
    />
  )
}

/**
 * A person's picture, the first of these that is there and loads: the photo the owner set in
 * "Снимки на сайта" (`admin`), the file TEAM_PHOTOS lists, the initials in a circle. Each is
 * decorative: the name is the card's heading, right beside it. Without an admin photo it is
 * exactly the picture the card had before the slots.
 */
function Avatar({ slug, name, admin }) {
  const own = <OwnAvatar slug={slug} name={name} />
  if (!admin?.url) return own
  return <AdminAvatar key={admin.url} slug={slug} admin={admin}>{own}</AdminAvatar>
}

/** The file TEAM_PHOTOS lists for a person, or (without one, or if it fails) their initials. */
function OwnAvatar({ slug, name }) {
  const [failed, setFailed] = useState(false)
  const photo = TEAM_PHOTOS[slug]
  if (photo && !failed) {
    return (
      <img
        className="ab-avatar"
        src={`${BASE}${String(photo).replace(/^\//, '')}`}
        alt=""
        width="160"
        height="160"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    )
  }
  return <span className="ab-avatar ab-monogram" aria-hidden="true">{initials(name)}</span>
}

export default function AboutPage({ locale = 'bg', content }) {
  const { openOffer, openQuestion } = useModalActions()
  const reviews = useReviewSummary()
  const c = content
  const published = usePublishedCase(c?.proof?.case?.id)
  const slots = useSlotPhotos([
    ABOUT_HERO_SLOT,
    FACTORY_SLOT,
    ...(c?.team?.people || []).map((person) => teamSlotName(person.slug)),
  ])
  if (!c) return null

  const home = getHomeContent(locale)?.home || {}
  const business = home.localBusiness || {}
  const telephone = business.telephone || ''
  // The hours as the footer prints them; without them the term is left out.
  const hours = String(home.band?.hours || '').trim()
  const v = aboutFigures(reviews)
  // origin: the server's key for this page, so staff read "Запитване от страницата „За нас“"
  // above the visitor's words and the mail says "[За нас]" (EnquiryOrigin in the API).
  const offer = () => openOffer({ source: ABOUT_LEAD_SOURCE, origin: ABOUT_ORIGIN })
  const question = () => openQuestion({ source: ABOUT_LEAD_SOURCE })

  // A tile is drawn only when every figure it names is known: the reviews tile waits for the
  // feed and never shows a zero.
  const tiles = TILE_ORDER
    .map((key) => ({ key, ...c.facts.tiles[key] }))
    .filter((tile) => tile.value)
    // A range ("3–4") holds together with word joiners: it broke at the dash on a wide screen,
    // "около 3–" over "4 месеца".
    .map((tile) => ({ ...tile, value: fill(tile.value, v).replace(/(\d)–(\d)/g, '$1⁠–⁠$2'), label: fill(tile.label, v) }))
    .filter((tile) => !/\{\w+\}/.test(`${tile.value} ${tile.label}`))

  const casePhoto = published && (published.images || []).includes(c.proof.photo.url) ? c.proof.photo : null
  const quote = String(published?.quote || '').trim()
  const quoteLang = quote ? langOf(quote) : null
  const rating = Number(published?.rating) || 0
  // The case's year is the published case's own (edited in /admin), never typed; without one
  // the line simply ends at the place.
  const caseLine = fill(c.proof.case.line, { year: published?.year }).replace(/\s*·\s*\{\w+\}/g, '')

  const deliveryPath = paths.delivery[locale] || paths.delivery.en
  const siblings = [
    { to: paths.cases[locale], ...c.siblings.cases },
    { to: paths.faq[locale], ...c.siblings.faq },
    { to: paths.gallery[locale], ...c.siblings.gallery },
    { to: deliveryPath, ...c.siblings.delivery },
    { to: paths.partner[locale], ...c.siblings.partner },
    { to: paths.doors[locale], ...c.siblings.doors },
  ]

  return (
    <main className="hp pp ab">
      <ProductHero
        titleId="ab-hero-title"
        eyebrow={c.hero.eyebrow}
        title={c.hero.h1}
        lead={c.hero.lead}
        primary={{ label: c.hero.offer, onClick: offer }}
        secondary={telephone ? { label: c.hero.call, href: `tel:${telephone}` } : null}
        photo={slotHeroPhoto(
          slots[ABOUT_HERO_SLOT],
          { url: ABOUT_PHOTO.url, srcSet: ABOUT_PHOTO.srcSet, alt: c.hero.photoAlt },
          { locale, adminAlt: c.hero.adminAlt },
        )}
      />

      <section className="pp-band" id="facts" aria-labelledby="ab-facts-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ab-facts-title">{c.facts.heading}</h2>
            </div>
          </div>
          <ul className="ab-tiles">
            {tiles.map((tile) => (
              <li key={tile.key} className="hp-card ab-tile" data-fact={tile.key}>
                <strong className="ab-tile-value">
                  {tile.key === 'reviews' ? <span className="hp-agg-star" aria-hidden="true">★ </span> : null}
                  {tile.value}
                </strong>
                <span className="ab-tile-label">{tile.label}</span>
              </li>
            ))}
          </ul>
          <p className="ab-everywhere">
            {c.facts.everywhere} <Link to={deliveryPath}>{c.facts.calculator}</Link>
          </p>
        </div>
      </section>

      <section id="who" aria-labelledby="ab-who-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ab-who-title">{c.story.heading}</h2>
              <p className="hp-sub">{c.story.lead}</p>
            </div>
          </div>

          <ol className="ab-timeline" aria-label={c.story.timelineLabel}>
            {c.story.timeline.map((step) => (
              <li key={step.year} className="ab-step" data-year={step.year}>
                <span className="ab-step-year">{step.year}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {/* The products the company started, to their pages (owner's timeline, 2026-10-15). */}
                {step.pathKey && step.link && paths[step.pathKey]?.[locale] ? (
                  <p className="ab-step-link"><Link to={paths[step.pathKey][locale]}>{step.link}</Link></p>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="pp-split ab-who">
            <div className="pp-prose">
              <h3>{c.story.todayHeading}</h3>
              {c.story.paragraphs.map((text) => <p key={text}>{text}</p>)}
              <p>
                {c.story.renovation.text}{' '}
                <Link to={paths.interiors[locale] || paths.interiors.en}>{c.story.renovation.link}</Link>
              </p>
            </div>
            <dl className="pp-terms ab-who-terms">
              {c.story.terms.filter((term) => term.key !== 'hours' || hours).map((term) => (
                <div key={term.key} data-term={term.key}>
                  <dt>{term.label}</dt>
                  <dd>
                    {fill(term.text, { vat: COMPANY.vatID, hours })}
                    {term.map && business.mapsHref ? (
                      <> <a href={business.mapsHref} target="_blank" rel="noopener noreferrer">{term.map}</a></>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="pp-band" id="team" aria-labelledby="ab-team-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ab-team-title">{c.team.heading}</h2>
              <p className="hp-sub">{c.team.sub}</p>
            </div>
          </div>
          <ul className="ab-team">
            {c.team.people.map((person) => (
              <li key={person.slug} className="hp-card ab-person" data-person={person.slug}>
                <Avatar slug={person.slug} name={person.name} admin={slots[teamSlotName(person.slug)]} />
                <div className="ab-person-text">
                  <h3>{person.name}</h3>
                  <p className="ab-person-role">{person.role}</p>
                  {person.area ? <p className="ab-person-area">{person.area}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="journey" aria-labelledby="ab-journey-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ab-journey-title">{c.journey.heading}</h2>
              <p className="hp-sub" id="ab-journey-sub">{c.journey.sub}</p>
            </div>
          </div>

          <figure className="hp-card ab-factory">
            <SlotImg
              admin={slots[FACTORY_SLOT]}
              adminAlt={slotAlt(slots[FACTORY_SLOT], { locale, adminAlt: c.journey.factory.adminAlt })}
              adminSizes="(max-width: 719px) 100vw, (max-width: 899px) 50vw, 780px"
              src={FACTORY_PHOTO.url}
              srcSet={`${FACTORY_PHOTO.small} 600w, ${FACTORY_PHOTO.url} 1200w`}
              sizes="(max-width: 719px) 100vw, (max-width: 899px) 50vw, 780px"
              alt={c.journey.factory.alt}
              width={FACTORY_PHOTO.width}
              height={FACTORY_PHOTO.height}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <h3>{c.journey.factory.title}</h3>
              <p>{c.journey.factory.text}</p>
            </figcaption>
          </figure>

          <JourneyClips
            clips={(c.journey.clips || []).map((clip) => (clip.id === 'factory' ? { ...clip, ...FACTORY_CLIP } : clip))}
            labelledBy="ab-journey-sub"
          />

          {published ? (
            <div className="pp-split ab-proof">
              <article className="cs-review-card">
                <h3>{c.proof.heading}</h3>
                <p className="cs-review-name">{caseLine}</p>
                <p className="cs-muted">{c.proof.case.result}</p>
                {quote ? (
                  <p className="hp-lead" lang={quoteLang !== locale ? quoteLang : undefined}>“{quote}”</p>
                ) : null}
                <p className="cs-review-name">{c.proof.case.name}</p>
                {rating ? (
                  <p className="hp-agg">
                    <span className="hp-agg-star" aria-hidden="true">★</span>
                    {fill(c.proof.stars, { rating })}
                  </p>
                ) : null}
                <p className="pp-links"><Link to={caseHref(paths.cases[locale], c.proof.case?.id)}>{c.proof.more}</Link></p>
              </article>
              {casePhoto ? (
                <img
                  className="ab-proof-img"
                  src={cdnImage(casePhoto.url, { width: 800 })}
                  srcSet={cdnSrcSet(casePhoto.url, [480, 640, 800, 1200])}
                  sizes="(max-width: 899px) 100vw, 520px"
                  alt={casePhoto.alt}
                  width="1200"
                  height="900"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </div>
          ) : null}

          <p className="pp-links"><Link to={deliveryPath}>{c.journey.more}</Link></p>
        </div>
      </section>

      <section className="pp-band" id="in-writing" aria-labelledby="ab-writing-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ab-writing-title">{c.inWriting.heading}</h2>
              <p className="hp-sub">{c.inWriting.sub}</p>
            </div>
          </div>
          <dl className="pp-terms">
            {c.inWriting.terms.map((term) => (
              <div key={term.key} data-term={term.key}>
                <dt>{term.label}</dt>
                <dd>
                  {term.text}
                  {term.link ? <> <Link to={paths.prices[locale] || paths.prices.en}>{term.link}</Link></> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <WarrantyTerms id="warranty" content={c.warranty} />

      <Testimonials locale={locale} content={home.testimonials} />

      <SiblingLinks id="ab-siblings" heading={c.siblings.heading} go={c.siblings.go} items={siblings} />

      <FinalCta locale={locale} title={c.finalTitle} onPrimary={offer} onSecondary={question} />
    </main>
  )
}

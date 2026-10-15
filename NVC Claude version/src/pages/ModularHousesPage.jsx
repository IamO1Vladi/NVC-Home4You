// src/pages/ModularHousesPage.jsx
//
// The modular houses page (/bg/modulni-kysthi): the expandable Box houses from 18 to 74 m²
// and the capsule. Its one job is to help a visitor choose a size and either build it in
// the configurator or ask about that model.
//
// EVERY FIGURE COMES FROM THE GALLERY ROWS (useProductRows, the same call the prices page
// makes), never from the content file: the hero's "from", each card's house price and its
// assembly, the comparison row, the sibling link's container price and the Product markup.
// The delivery line's rate, crane and lead times are the owner's, from deliveryRates.js.
// A Box house is quoted the way the home strip quotes it since 2026-10-12, the house with
// VAT and without its assembly, and the assembly is printed under it (prices.js grosses it
// up from BOX_ASSEMBLY_NET_BY_ID), or "on request" where we do not know it yet.
//
// The 37, 58 and 73 m² cards open the configurator on that model, so the price tapped is
// the price the configurator opens on. The others ask for an offer with the model attached.
// The capsule is one wide card that says only what its gallery entry says.
//
// The main photo is the admin's page-modular-houses slot when one is set, and otherwise the
// delivered 58 m² house from the published case, with a chip naming where it stands. The
// proof card reads the same case from /api/cases-page and is not drawn if it is unpublished.
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import ProductHero from '../components/product/ProductHero.jsx'
import UnitCard from '../components/product/UnitCard.jsx'
import SpecTable from '../components/product/SpecTable.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import Catalogues from '../components/Catalogues.jsx'
import FinalCta from '../components/FinalCta.jsx'
import { ProductsJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { paths } from '../routes/paths.js'
import { useProductRows, lowest, rowById, modelRequest, productJsonLdItems, displayTitle } from '../lib/productRows.js'
import { usePagePhoto } from '../lib/homePhotos.js'
import { euro, getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// The size cards, by gallery id, in the order a visitor reads sizes. `variant` is the same
// house with veranda and double roof, printed as one line of its card rather than a card of
// its own; `model` is the configurator's key for the sizes it can build. Ids, not titles,
// for the reason prices.js gives: titles get edited in the admin panel, ids do not move.
const SIZES = [
  { id: 100016 },
  { id: 10, variant: 11, model: '37' },
  { id: 5, variant: 4, model: '58' },
  { id: 9, variant: 15, model: '73' },
  { id: 16 },
  { id: 17 },
]
const CAPSULE_ID = 100015

// The truck leg and the crane a Box house needs, the owner's figures shared with every page.
const BOX_DELIVERY = DELIVERY_RATES.products.box

const NUMBER_LOCALES = { bg: 'bg-BG', en: 'en-GB', el: 'el-GR' }

const fill = (pattern, values) => Object.entries(values).reduce(
  (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
  String(pattern || ''),
)

/** Millimetres from the catalogue ('5900x2260x2500', the second figure) as metres, 2,26. */
function widthInMetres(dimensions, locale) {
  const mm = Number(String(dimensions || '').split('x')[1])
  if (!Number.isFinite(mm) || mm <= 0) return null
  return new Intl.NumberFormat(NUMBER_LOCALES[locale] || 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(mm / 1000)
}

/** The script a quote is written in, so a Bulgarian page can mark an English quote lang="en". */
function langOf(text) {
  if (/[А-Яа-я]/.test(text)) return 'bg'
  if (/[Α-Ωα-ωάέήίόύώ]/.test(text)) return 'el'
  return 'en'
}

/**
 * The published case with this id from /api/cases-page, or null: while it loads, if the
 * call fails and if the case is no longer published. The prerender waits for the call.
 */
function usePublishedCase(id) {
  const [found, setFound] = useState(null)
  useEffect(() => {
    if (!id || typeof fetch !== 'function') return undefined
    let active = true
    fetch(`${API_BASE}/api/cases-page`)
      .then((res) => (res && res.ok ? res.json() : null))
      .then((body) => {
        if (!active || !body) return
        const hit = (Array.isArray(body.cases) ? body.cases : []).find((c) => String(c?.id) === String(id))
        setFound(hit || null)
      })
      .catch(() => {})
    return () => { active = false }
  }, [id])
  return found
}

export default function ModularHousesPage({ locale = 'bg', content }) {
  const c = content
  const { openOffer, requestModel } = useModalActions()
  const { box, wagon, loading, error, galleryPath } = useProductRows(locale)
  const adminPhoto = usePagePhoto('modularHouses')
  const published = usePublishedCase(c.case?.id)
  const pricesCopy = getPricesCopy(locale)

  const pricesPath = paths.prices[locale]
  const configuratorPath = paths.boxConfigurator[locale]
  const { models } = getBoxConfiguratorCatalog(locale)
  const modelKeys = new Set(models.map((m) => m.key))

  // The capsule is a different product at a different price; the "from" is the Box houses'.
  const houses = box.filter((row) => String(row.id) !== String(CAPSULE_ID))
  const from = lowest(houses, (row) => row.house)
  const capsule = rowById(box, CAPSULE_ID)

  // The cards in SIZES order, each with its variant row; a house the gallery has and this
  // list does not know yet (added in the admin panel) still gets a plain card at the end,
  // rather than a priced product silently missing from its own page.
  const known = new Set([CAPSULE_ID, ...SIZES.flatMap((s) => [s.id, s.variant])].filter(Boolean).map(String))
  const cards = [
    ...SIZES.map((size) => ({ ...size, row: rowById(box, size.id), variantRow: size.variant ? rowById(box, size.variant) : null })),
    ...houses.filter((row) => !known.has(String(row.id))).map((row) => ({ id: row.id, row, variantRow: null })),
  ].filter((card) => card.row)

  const shown = [...cards.flatMap((card) => [card.row, card.variantRow]), capsule].filter(Boolean)
  const jsonLdItems = productJsonLdItems(shown, { pick: (row) => row.house, category: c.schemaCategory })

  const money = (value) => euro(value, locale)

  const assemblyLine = (row) => (row.assemblyGross == null
    ? c.sizes.assemblyOnRequest
    : fill(c.sizes.assembly, { price: money(row.assemblyGross) }))

  const variantLine = (row) => {
    if (!row) return null
    const text = row.assemblyGross == null
      ? fill(c.sizes.variantOnRequest, { house: money(row.house) })
      : fill(c.sizes.variant, { house: money(row.house), assembly: money(row.assemblyGross) })
    return <Link to={row.item.url}>{text}</Link>
  }

  // The admin's photo carries no chip: the chip names the Paralia Kariani house, and the
  // admin may have chosen another. Its alt is typed in Bulgarian, so the Bulgarian page uses
  // it and the others (and a blank one) get the page's generic adminAlt. While the answer is
  // still on its way (undefined) the case photo shows, as it does for an empty slot.
  const photo = adminPhoto
    ? { url: adminPhoto.url, alt: (locale === 'bg' && adminPhoto.alt) || c.hero.adminAlt }
    : { ...c.hero.photo, caption: c.case?.line }

  const model37 = models.find((m) => m.key === '37')
  const widths = {
    folded: widthInMetres(model37?.dimensionsFolded, locale),
    open: widthInMetres(model37?.dimensionsOpen, locale),
  }

  const casePhotos = published
    ? (c.proof.photos || []).filter((p) => (published.images || []).includes(p.url))
    : []
  const quote = String(published?.quote || '').trim()
  const quoteLang = quote ? langOf(quote) : null
  const rating = Number(published?.rating) || 0

  const wagonFrom = lowest(wagon)
  const siblings = [
    {
      to: paths.modularBuilds[locale],
      label: c.siblings.containers.label,
      desc: c.siblings.containers.desc,
      price: wagonFrom == null ? null : `${c.siblings.from} ${money(wagonFrom)} ${c.siblings.withAssembly}`,
    },
    {
      to: paths.steelHouses[locale],
      label: c.siblings.steel.label,
      desc: c.siblings.steel.desc,
    },
  ]

  return (
    <main className="hp pp">
      <ProductHero
        eyebrow={c.hero.eyebrow}
        title={c.hero.h1}
        lead={c.hero.lead}
        price={{ prefix: c.hero.from, value: from == null ? null : money(from), caption: c.hero.basis }}
        primary={{ label: c.hero.build, to: configuratorPath }}
        secondary={{ label: c.hero.offer, onClick: openOffer }}
        facts={c.hero.facts}
        photo={photo}
      />

      <section id="sizes" aria-labelledby="mh-sizes-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="mh-sizes-title">{c.sizes.heading}</h2>
              <p className="hp-sub">{c.sizes.sub}</p>
            </div>
          </div>

          {!box.length && loading ? <p className="pp-note" role="status">{pricesCopy.loading}</p> : null}
          {!box.length && !loading && error ? <p className="pp-note" role="alert">{pricesCopy.loadError}</p> : null}

          {/* A list of the sizes, as the containers page has: a screen reader announces how
              many there are, and the capsule's item spans the grid (pp-units-full). */}
          {cards.length || capsule ? (
            <ul className="pp-units">
              {cards.map(({ id, row, variantRow, model }) => (
                <li key={id}>
                  <UnitCard
                    id={row.id}
                    title={displayTitle(row.item.title)}
                    photo={{ url: row.item.coverUrl }}
                    price={{ value: money(row.house), caption: c.sizes.basis }}
                    difference={c.sizes.diff?.[row.id]}
                    lines={[assemblyLine(row), variantLine(variantRow)]}
                    primary={model && modelKeys.has(model)
                      ? { label: c.sizes.build, to: `${configuratorPath}?model=${model}` }
                      : { label: c.sizes.ask, onClick: () => requestModel(modelRequest(row)) }}
                    details={{ label: c.sizes.more, to: row.item.url }}
                  />
                </li>
              ))}

              {capsule ? (
                <li className="pp-units-full">
                  <UnitCard
                    wide
                    id={capsule.id}
                    title={displayTitle(capsule.item.title)}
                    photo={{ url: capsule.item.coverUrl }}
                    price={{ value: money(capsule.house), caption: c.capsule.basis }}
                    lines={c.capsule.lines}
                    primary={{ label: c.sizes.ask, onClick: () => requestModel(modelRequest(capsule)) }}
                    details={{ label: c.sizes.more, to: capsule.item.url }}
                  />
                </li>
              ) : null}
            </ul>
          ) : null}

          {/* The secondary links after the cards, where the containers page has them, so on
              a phone the first priced card follows its heading straight away and every
              product page puts these links in the same place. */}
          <p className="pp-links">
            <Link to={pricesPath}>{c.sizes.allPrices}</Link>
            <Link to={`${galleryPath}?cat=modular`}>{c.sizes.allPhotos}</Link>
          </p>

          <ProductsJSONLD items={jsonLdItems} listName={c.listName} listUrl={paths.modularHouses[locale]} />
        </div>
      </section>

      <section className="pp-band" aria-labelledby="mh-compare-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="mh-compare-title">{c.compare.heading}</h2>
            </div>
          </div>
          <SpecTable
            labelledBy="mh-compare-title"
            columns={c.compare.columns}
            rows={[
              ...c.compare.rows,
              {
                label: c.compare.priceLabel,
                values: [
                  from == null ? null : fill(c.compare.boxPrice, { price: money(from) }),
                  capsule ? fill(c.compare.capsulePrice, { price: money(capsule.house) }) : null,
                ],
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="mh-arrival-title">
        <div className="hp-container pp-split">
          <div className="pp-prose">
            <h2 id="mh-arrival-title">{c.arrival.heading}</h2>
            {c.arrival.paragraphs
              .filter((text) => (widths.folded && widths.open) || !text.includes('{folded}'))
              .map((text) => <p key={text}>{fill(text, widths)}</p>)}
            <p>{fill(c.arrival.delivery, { rate: euro(BOX_DELIVERY.perKm, locale), crane: euro(BOX_DELIVERY.crane.about, locale), production: LEAD_TIMES.boxProductionDays, months: LEAD_TIMES.boxToAddressMonths })}</p>
            <p className="pp-links">
              <Link to={pricesPath}>{c.arrival.pricesLink}</Link>
              <Link to={paths.delivery[locale]}>{c.arrival.deliveryLink}</Link>
            </p>
          </div>

          {/* The same words /bg/ceni uses for what the price covers and what it does not
              (pricesCopy), so the two pages cannot disagree about the crane. */}
          <div className="hp-card hp-why-card">
            <h3>{c.arrival.includedHeading}</h3>
            <ul className="pp-unit-lines">
              {pricesCopy.included.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <h3>{c.arrival.excludedHeading}</h3>
            <ul className="pp-unit-lines">
              {pricesCopy.excluded.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <p>{pricesCopy.foundationNote}</p>
            <p>{c.arrival.foundationAsk}</p>
          </div>
        </div>
      </section>

      {published ? (
        <section className="pp-band" aria-labelledby="mh-proof-title">
          <div className="hp-container">
            <div className="hp-head">
              <div>
                <h2 id="mh-proof-title">{c.proof.heading}</h2>
                <p className="hp-sub">{c.proof.sub}</p>
              </div>
            </div>
            <div className="pp-split">
              <article className="cs-review-card">
                <h3>{c.case.line}</h3>
                <p className="cs-muted">{c.case.result}</p>
                {quote ? (
                  <p className="hp-lead" lang={quoteLang !== locale ? quoteLang : undefined}>“{quote}”</p>
                ) : null}
                <p className="cs-review-name">{c.case.name}</p>
                {rating ? (
                  <p className="hp-agg">
                    <span className="hp-agg-star" aria-hidden="true">★</span>
                    {fill(c.proof.stars, { rating })}
                  </p>
                ) : null}
              </article>
              {casePhotos.length ? (
                <div className="pp-photos">
                  {casePhotos.map((p) => (
                    <img
                      key={p.url}
                      src={cdnImage(p.url, { width: 640 })}
                      srcSet={cdnSrcSet(p.url, [320, 480, 640, 960])}
                      sizes="(max-width: 899px) 50vw, 300px"
                      alt={p.alt}
                      width="1200"
                      height="900"
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <p className="pp-links">
              <Link to={paths.cases[locale]}>{c.proof.more}</Link>
            </p>
          </div>
        </section>
      ) : null}

      <Catalogues locale={locale} content={c.catalogues} />

      <SiblingLinks heading={c.siblings.heading} go={c.siblings.go} items={siblings} />

      <FinalCta locale={locale} title={c.finalTitle} />
    </main>
  )
}

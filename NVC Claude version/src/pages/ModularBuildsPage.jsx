// /bg/modulni-postroiki, "Container units": the page's one job is to help a visitor pick
// one of the six priced container units and ask about that unit.
//
// It used to be three brochure cards with the specs hidden behind hover, no price, no
// button and no link anywhere on the site, while Product markup told Google the cheapest
// unit cost 4,240 leva. Now every figure on it is read from the gallery: the cards are the
// gallery's wagon rows (useProductRows, the same call /bg/ceni makes), the hero's "from" is
// the cheapest of them, the assembly share is prices.js's, the delivery rate and the crane
// are deliveryRates.js's (the module the delivery estimator charges from), and the Product
// markup is built from the very rows the cards print. Nothing the visitor reads as a price
// is typed in the content file, so nothing here can go stale the way the brochures' 4,240
// and 5,370 did.
//
// The spec table says only what all six gallery descriptions say. The crane, the
// accommodation, the kitchen, the foundation and the made-to-order sizes are the owner's
// answers (2026-10-12; the crane's cost, the 3–4 nights and the workers' travel are his
// 2026-10-15 figures in deliveryRates.js) and are worded in the content file exactly as he gave them; nothing
// about permits, lead times or what foundation to pour is said, because nobody has.
//
// The hero photo is the admin's "page-modular-builds" slot when one is set, otherwise a real
// daylight photo from the gallery. Never the CGI night render the page used to open on.
import React from 'react'
import { Link } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import ProductHero from '../components/product/ProductHero.jsx'
import UnitCard from '../components/product/UnitCard.jsx'
import SpecTable from '../components/product/SpecTable.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import Testimonials from '../components/Testimonials.jsx'
import Catalogues from '../components/Catalogues.jsx'
import FinalCta from '../components/FinalCta.jsx'
import { ProductsJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { getHomeContent } from '../content/home/index.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { usePagePhoto } from '../lib/homePhotos.js'
import { useProductRows, lowest, rowById, modelRequest, productJsonLdItems, displayTitle } from '../lib/productRows.js'
import { paths } from '../routes/paths.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'

// The container's rate, crane and no-crane terms: the same module the delivery estimator
// charges from, so the sentence here and the calculator one tap away cannot disagree.
const CONTAINER = DELIVERY_RATES.products.container

const fill = (pattern, values) => Object.entries(values).reduce(
  (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
  String(pattern || ''),
)

export default function ModularBuildsPage({ locale = 'en', content }) {
  const { openOffer, openQuestion, requestModel } = useModalActions()
  const { box, wagon, error, galleryPath } = useProductRows(locale)
  const adminPhoto = usePagePhoto('modularBuilds')

  if (!content) return null
  const c = content

  const telephone = getHomeContent(locale)?.home?.localBusiness?.telephone || ''
  const callHref = telephone ? `tel:${telephone}` : undefined

  // Container prices already contain their VAT and assembly, so the cheapest total is the
  // finished "from" figure, unlike the houses, whose assembly comes on top.
  const from = lowest(wagon)
  // Every container carries the same assembly share (WAGON_ASSEMBLY_GROSS, read off the
  // rows so a page without rows prints no figure).
  const assemblyGross = lowest(wagon, (row) => row.assemblyGross)
  const housesFrom = lowest(box, (row) => row.house)

  // The admin types one alt, in Bulgarian, so it is used on the Bulgarian page only; a blank
  // one, and every other language, get the page's generic adminAlt. Not the default photo's
  // alt, which describes the 8×3 gable-roof interior and not whatever the admin uploaded.
  // While the photo answer is still on its way (undefined) the default photo shows, so a
  // visit with nothing kept has a hero from the first paint. A default that has since been
  // deleted from the gallery falls back to the site's plain card rather than a broken image.
  const fallback = `${import.meta.env.BASE_URL || '/'}modular-builds/card.svg`
  const heroPhoto = adminPhoto
    ? { url: adminPhoto.url, alt: (locale === 'bg' && adminPhoto.alt) || c.hero.adminAlt, fallback }
    : c.hero.photo && { ...c.hero.photo, fallback }

  const pricesPath = paths.prices[locale] || paths.prices.en
  const pricesHref = wagon.length ? `${pricesPath}#item-${wagon[0].id}` : pricesPath
  const galleryHref = `${galleryPath}?cat=wagon`

  const specPhotos = (c.specs.photos || [])
    .map((photo) => {
      const url = rowById(wagon, photo.id)?.item?.images?.[photo.index]
      return url ? { url, alt: photo.alt } : null
    })
    .filter(Boolean)

  const assemblyLines = [
    assemblyGross != null && { label: c.assembly.includedLabel, text: fill(c.assembly.included, { amount: euro(assemblyGross, locale) }) },
    { label: c.assembly.craneLabel, text: fill(c.assembly.crane, { crane: euro(CONTAINER.crane.about, locale) }) },
    {
      label: c.assembly.noCraneLabel,
      text: fill(c.assembly.noCrane, { nights: CONTAINER.noCrane.nights, travel: euro(CONTAINER.noCrane.travelMax, locale) }),
    },
    { label: c.assembly.foundationLabel, text: c.assembly.foundation },
    { label: c.assembly.deliveryLabel, text: fill(c.assembly.delivery, { rate: euro(CONTAINER.perKm, locale), days: LEAD_TIMES.containerInStockDays }) },
  ].filter(Boolean)

  const siblings = [
    {
      to: paths.modularHouses[locale],
      label: c.siblings.houses.label,
      desc: c.siblings.houses.desc,
      price: housesFrom == null ? undefined : fill(c.siblings.houses.price, { price: euro(housesFrom, locale) }),
    },
    { to: paths.steelHouses[locale], label: c.siblings.steel.label, desc: c.siblings.steel.desc },
  ]

  const productItems = productJsonLdItems(wagon, { category: c.schemaCategory })

  return (
    <main className="hp pp">
      <ProductHero
        eyebrow={c.hero.eyebrow}
        title={c.hero.h1}
        lead={c.hero.lead}
        price={{ prefix: c.hero.from, value: from == null ? null : euro(from, locale), caption: c.hero.basis }}
        primary={{ label: c.hero.cta, onClick: openOffer }}
        secondary={callHref ? { label: c.hero.call, href: callHref } : null}
        facts={c.hero.facts}
        photo={heroPhoto}
      />

      <section id="units" aria-labelledby="pp-units-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="pp-units-title">{c.units.heading}</h2>
              <p className="hp-sub">{c.units.lead}</p>
            </div>
          </div>

          {wagon.length ? (
            <ul className="pp-units">
              {wagon.map((row) => (
                <li key={row.id}>
                  <UnitCard
                    id={row.id}
                    title={displayTitle(row.item.title)}
                    photo={{ url: row.item.coverUrl }}
                    price={{ value: euro(row.total, locale), caption: c.units.basis }}
                    difference={c.units.diff?.[row.id]}
                    primary={{ label: c.units.ask, onClick: () => requestModel(modelRequest(row)) }}
                    details={{ label: c.units.more, to: row.item.url }}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {/* No cards and no stale figure while the gallery loads; if it fails, say so. The
              links under the spec table lead to the same rows on the prices page and in
              the gallery. */}
          {error && !wagon.length ? <p className="pp-note" role="status">{c.units.loadError}</p> : null}

          <p className="pp-note">{c.units.madeToOrder}</p>
        </div>
      </section>

      <section className="pp-band" id="specs" aria-labelledby="pp-specs-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="pp-specs-title">{c.specs.heading}</h2>
              {c.specs.lead ? <p className="hp-sub">{c.specs.lead}</p> : null}
            </div>
          </div>

          <div className="pp-split">
            <SpecTable labelledBy="pp-specs-title" rows={c.specs.rows} />
            {specPhotos.length ? (
              <div className="pp-photos">
                {specPhotos.map((photo) => (
                  <img
                    key={photo.url}
                    src={cdnImage(photo.url, { width: 640 })}
                    srcSet={cdnSrcSet(photo.url, [320, 480, 640, 800])}
                    sizes="(max-width: 899px) 50vw, 280px"
                    alt={photo.alt}
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
            <Link to={pricesHref}>{c.units.pricesLink}</Link>
            <Link to={galleryHref}>{c.units.galleryLink}</Link>
          </p>
        </div>
      </section>

      <section id="assembly" aria-labelledby="pp-assembly-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="pp-assembly-title">{c.assembly.heading}</h2>
            </div>
          </div>

          {/* Five terms, each a label and its sentence: a description list, so a phone
              reads them as five short rows divided by hairlines instead of one block of
              prose with bold words in it. */}
          <dl className="pp-terms">
            {assemblyLines.map((line) => (
              <div key={line.label}>
                <dt>{line.label}</dt>
                <dd>{line.text}</dd>
              </div>
            ))}
          </dl>

          <p className="pp-links">
            <Link to={paths.delivery[locale] || paths.delivery.en}>{c.assembly.deliveryLink}</Link>
          </p>

          <div className="hp-cta-row">
            <button type="button" className="hp-btn ghost" onClick={openQuestion}>{c.assembly.ask}</button>
            {callHref ? <a className="hp-btn ghost" href={callHref}>{c.assembly.call}</a> : null}
          </div>
        </div>
      </section>

      <Testimonials
        locale={locale}
        content={{ ...getHomeContent(locale).home.testimonials, heading: c.reviewsHeading }}
        product="modularBuilds"
        limit={6}
      />

      <Catalogues locale={locale} content={c.catalogues} />

      <SiblingLinks heading={c.siblings.heading} go={c.siblings.go} items={siblings} />

      <FinalCta locale={locale} title={c.finalTitle} />

      {productItems.length ? (
        <ProductsJSONLD items={productItems} listName={c.listName} listUrl={paths.modularBuilds[locale]} />
      ) : null}
    </main>
  )
}

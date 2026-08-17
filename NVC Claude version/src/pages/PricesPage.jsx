import React from 'react'
import { Link } from 'react-router-dom'
import { useModalActions } from '../context/ModalActions.jsx'
import { paths } from '../routes/paths.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { buildPriceSections, startingPrice } from '../content/shared/prices.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { ProductsJSONLD } from '../components/StructuredData.jsx'
import { useLocalizedGalleryItems } from '../gallery/galleryUtils.js'

// What everything in the catalogue costs, finished.
//
// PRICED FROM /api/gallery, deliberately. The first version carried its own copy of the box
// prices, and the site was meanwhile quoting €25,500 and €26,500 for the same 73 m² house on
// two different pages — one source had a typo and nothing could notice. Now the gallery is
// the single price source and this page adds only what the gallery does not know: what
// assembly costs (src/content/shared/prices.js, keyed by gallery id).
//
// TWO SECTIONS, EACH WITH ITS OWN TABLE DIRECTLY UNDER ITS CARDS — box houses first, then
// wagons — because the two sell differently and even their arithmetic differs: a box house's
// assembly is ADDED to its price, while a wagon's price already CONTAINS its €1,000
// assembly, so its table splits the figure out rather than adding one on.
//
// The cards sell (real product photo, finished price); each table compares. Both views of a
// section render from the same rows, so they cannot disagree.

export default function PricesPage({ locale = 'en' }) {
  const t = getPricesCopy(locale)
  const { openOffer } = useModalActions()

  const galleryBase = paths.gallery[locale] || paths.gallery.en
  const { items, loading, error } = useLocalizedGalleryItems(locale, galleryBase)
  const { box, wagon } = React.useMemo(() => buildPriceSections(items), [items])

  const money = (value) => euro(value, locale)
  const from = box.length ? Math.min(...box.map((r) => r.total)) : startingPrice(locale)

  const pageUrl = `https://nvc-home4you.eu${paths.prices[locale] || paths.prices.en}`

  // Offer markup from the same rows the sections render — this is where price snippets
  // under a search result come from. Each product's url is its own anchor on this page,
  // matched by the card ids below.
  const products = React.useMemo(() => (
    [...box, ...wagon].map((row) => ({
      id: `gal-${row.id}`,
      url: `${pageUrl}#item-${row.id}`,
      name: row.item.title,
      description: `${row.item.title}. ${t.colTotal}: ${money(row.total)}.`,
      image: row.item.coverUrl,
      price: row.total,
      currency: row.item.currency || 'EUR',
    }))
  ), [box, wagon, pageUrl, t.colTotal, locale])

  return (
    <main className="arx prices-page">
      <header className="prices-hero">
        <h1>{t.h1}</h1>
        <p className="prices-lead">{t.lead}</p>
        <p className="prices-from">
          <span className="prices-from-label">{t.fromLabel}</span>
          <strong className="prices-from-value">{money(from)}</strong>
        </p>
      </header>

      {error ? <p className="prices-state">{t.loadError}</p> : null}
      {loading && !items.length ? <p className="prices-state">{t.loading}</p> : null}

      <ProductsJSONLD items={products} listName={t.tableCaption} listUrl={pageUrl} />

      {/* --- Box houses --------------------------------------------------------------- */}
      {box.length > 0 && (
        <PriceSection
          rows={box}
          t={t}
          money={money}
          title={t.boxSectionTitle}
          intro={t.boxSectionIntro}
          // Box assembly is an addition, and half of it is quoted net — the table needs
          // all four money columns.
          columns="full"
        />
      )}

      {/* --- Wagons -------------------------------------------------------------------- */}
      {wagon.length > 0 && (
        <PriceSection
          rows={wagon}
          t={t}
          money={money}
          title={t.wagonSectionTitle}
          intro={t.wagonSectionIntro}
          // A wagon's list price IS the total; its table splits assembly out of it rather
          // than adding it on, and everything is gross. Fewer columns, different headings.
          columns="included"
        />
      )}

      {/* What assembly does and does not cover — the section that makes the numbers above
          believable. Every competitor publishes a price that turns out to exclude
          something; naming the two things that are extra, unasked, is the reason to trust
          the rest of the page. */}
      <section className="prices-scope">
        <div className="prices-scope-col">
          <h2>{t.includedTitle}</h2>
          <ul className="prices-list is-in">
            {t.included.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="prices-scope-col">
          <h2>{t.excludedTitle}</h2>
          <ul className="prices-list is-out">
            {t.excluded.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="prices-foundation">{t.foundationNote}</p>
        </div>
      </section>

      <section className="prices-others">
        <div className="prices-card">
          <h2>{t.customTitle}</h2>
          <p>{t.customBody}</p>
          <button type="button" className="btn ghost" onClick={openOffer}>{t.quoteCta}</button>
        </div>

        <div className="prices-card">
          <h2>{t.configuratorTitle}</h2>
          <p>{t.configuratorBody}</p>
          <Link className="btn" to={paths.boxConfigurator[locale] || paths.boxConfigurator.en}>
            {t.configuratorCta}
          </Link>
        </div>
      </section>
    </main>
  )
}

// One catalogue section: its cards, then its table, directly underneath.
function PriceSection({ rows, t, money, title, intro, columns }) {
  const full = columns === 'full'

  return (
    <section className="prices-section">
      <h2 className="prices-section-head">{title}</h2>
      {intro ? <p className="prices-section-intro">{intro}</p> : null}

      <div className="prices-cards">
        {rows.map((row, index) => (
          <article className="prices-card-model" id={`item-${row.id}`} key={row.id}>
            <div className="prices-card-media">
              <img
                src={row.item.coverUrl}
                alt={row.item.title}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                width="640"
                height="420"
              />
            </div>

            <div className="prices-card-body">
              {/* The title is the link, and a ::after overlay makes the whole card
                  clickable — one link per card rather than an image link and a title link
                  pointing at the same place, which a screen reader reads out twice. Goes to
                  the catalogue page for the model, where the specification lives; the price
                  answers "how much", that page answers "what is it". */}
              <h3 className="prices-card-title">
                {/* `url`, not `href` — toLocalizedItem() builds the localized catalogue
                    path under that name. This read `href`, which is always undefined, so
                    every card fell back to "#" and clicking one did nothing at all. A
                    fallback that silently swallows the click is worse than no link: it
                    looks interactive and is not. Rendered as plain text when there is
                    genuinely nowhere to go. */}
                {row.item.url ? (
                  <Link to={row.item.url} className="prices-card-link">
                    {row.item.title}
                  </Link>
                ) : row.item.title}
              </h3>

              <dl className="prices-breakdown">
                <div>
                  <dt>{full ? t.colHouse : t.wagonColHouse}</dt>
                  <dd className="num">{money(row.house)}</dd>
                </div>
                <div>
                  <dt>{full ? t.colAssemblyGross : t.wagonColAssembly}</dt>
                  <dd className="num">
                    {row.assemblyGross == null ? t.assemblyOnRequest : money(row.assemblyGross)}
                  </dd>
                </div>
              </dl>

              <p className="prices-card-total">
                <span className="prices-card-total-label">{t.colTotal}</span>
                <strong className="num">{money(row.total)}</strong>
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="prices-table-scroll">
        <table className="prices-table">
          <caption className="visually-hidden">{title}</caption>
          <thead>
            {full ? (
              <tr>
                <th scope="col">{t.colModel}</th>
                {/* Headings name their VAT basis because the two sides differ: gallery
                    prices include VAT, box-house assembly is quoted without it. */}
                <th scope="col">{t.colHouse}</th>
                <th scope="col">{t.colAssemblyNet}</th>
                <th scope="col">{t.colAssemblyGross}</th>
                <th scope="col" className="is-total">{t.colTotal}</th>
              </tr>
            ) : (
              <tr>
                <th scope="col">{t.colModel}</th>
                <th scope="col">{t.wagonColHouse}</th>
                <th scope="col">{t.wagonColAssembly}</th>
                <th scope="col" className="is-total">{t.colTotal}</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="prices-model">
                  <span className="prices-model-name">{row.item.title}</span>
                </th>
                <td className="num" data-label={full ? t.colHouse : t.wagonColHouse}>
                  {money(row.house)}
                </td>
                {full ? (
                  <td className="num" data-label={t.colAssemblyNet}>
                    {row.assemblyNet == null ? t.assemblyOnRequest : money(row.assemblyNet)}
                  </td>
                ) : null}
                <td className="num" data-label={full ? t.colAssemblyGross : t.wagonColAssembly}>
                  {row.assemblyGross == null ? t.assemblyOnRequest : money(row.assemblyGross)}
                </td>
                <td className="num is-total" data-label={t.colTotal}>{money(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="prices-vat-note">{full ? t.vatNote : t.wagonVatNote}</p>
    </section>
  )
}

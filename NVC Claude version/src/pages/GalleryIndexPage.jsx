// The gallery index (/bg/galeriq, /en/gallery, /el/gkaleri): every model, its photo, its price
// and the way to its own page.
//
// REBUILT 2026-10-17 on the product pages' system (<main class="hp pp gl">: HomePage.css, then
// ProductPage.css, then Gallery.css's gl- layer). It had kept the old look: a grey glass label
// over every photo, the price only on phones (desktop hid it behind a hover), the filter chips
// in a font of their own, an inline-styled H1, and 4 of the 16 models behind a page-2 <button>
// that no crawler follows.
//
// - The head is the product pages' hero (ProductHero): an eyebrow, the H1, one line under it.
// - The filters are toggle buttons (aria-pressed), the FAQ hub's chips: no ARIA tabs, as there
//   are no tab panels. Up to four, the product lines in the site's words (galleryUtils
//   INDEX_FILTER_IDS: containers, Box houses, space capsules, steel-frame houses), each drawn
//   only while it has a model (indexFilterIds), so no filter opens empty; garage is never one.
//   While the list loads, the two lines it always has. A ?cat= the index does not offer shows
//   every model; the canonical drops the query anyway (GalleryRoutes.jsx).
//   The URL keeps the filter (?cat=wagon, as the containers and Box pages link here), replaced
//   rather than pushed, so Back leaves the page instead of undoing filters.
// - A card is the photo uncovered, the model's name, its price with VAT and what it includes,
//   and a cue to its page. The name is the card's one link, stretched over the card (as on
//   /bg/ceni), so a screen reader hears each model once. It opens the model over the list (the
//   route modal, state.backgroundLocation), as it always has. The card and its price helpers
//   live in src/gallery/GalleryCard.jsx, which the item page's "similar models" and its price
//   block read too.
// - The price and its words come from the prices table's own rows (shared/prices.js
//   buildPriceSections, the call /bg/ceni and the product pages make): a container's price
//   includes its assembly, a Box house's does not, and a model whose assembly figure the table
//   does not know says only "with VAT". A steel-frame project (prefab, 2026-10-17) is in neither
//   section: its price is that project's, and without one it is "priced per project".
// - Every model on one page (16 today). Past PAGE_SIZE (24) the list pages with real
//   <a href="?page=N"> links. The ItemList markup covers exactly the cards on show.
// - Loading keeps the cards' shape (placeholders with the same photo box), so nothing jumps
//   when the models arrive; the count line says what is happening.
import React, { useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/Gallery.css'
import ProductHero from '../components/product/ProductHero.jsx'
import { GalleryListJSONLD } from '../components/GalleryStructuredData.jsx'
import {
  LOADING_FILTER_IDS,
  PAGE_SIZE,
  catFromItemCategory,
  indexFilterIds,
  pageModel,
  resolveIndexFilter,
  resolvePageParam,
  useLocalizedGalleryItems,
} from '../gallery/galleryUtils.js'
import GalleryCard, { priceEntries } from '../gallery/GalleryCard.jsx'

// As many placeholders as fill a first screen: two rows of four on a wide screen, four rows
// of two on a phone.
const SKELETONS = 8
// The first row loads eagerly with a high priority hint (the LCP candidate); the rest lazily.
const EAGER = 4

const fill = (pattern, values) => Object.entries(values).reduce(
  (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
  String(pattern || ''),
)

/** "16 модела", "1 model": the locale's plural form of the count line. */
function countText(content, locale, n) {
  let form = 'other'
  try {
    form = new Intl.PluralRules(locale).select(n)
  } catch {
    // An unknown locale keeps the "other" form.
  }
  return fill(content.count?.[form] ?? content.count?.other ?? '{n}', { n })
}

/**
 * The query for a filter and a page, keeping anything else in it (a tracking tag). The old
 * page parameter (?p=) goes; "all" and page 1 are the bare URL.
 */
function searchFor(params, cat, page) {
  const next = new URLSearchParams(params)
  if (!cat || cat === 'all') next.delete('cat')
  else next.set('cat', cat)
  next.delete('p')
  if (!page || page <= 1) next.delete('page')
  else next.set('page', String(page))
  const query = next.toString()
  return query ? `?${query}` : ''
}

function SkeletonCard() {
  return (
    <li aria-hidden="true">
      <div className="hp-card gl-card gl-card--skel">
        <div className="gl-photo gl-skel" />
        <div className="gl-body">
          <span className="gl-skel gl-skel-line" />
          <span className="gl-skel gl-skel-line is-short" />
          <span className="gl-skel gl-skel-line is-price" />
        </div>
      </div>
    </li>
  )
}

/** Real links to each page of the list, only when there is more than one. */
function Pager({ page, pageCount, hrefFor, labels }) {
  if (pageCount <= 1) return null
  return (
    <nav className="gl-pager" aria-label={labels.paginationAria}>
      <ul>
        {page > 1 ? (
          <li><Link className="gl-page" to={hrefFor(page - 1)} rel="prev">‹ {labels.prev}</Link></li>
        ) : null}
        {pageModel(page - 1, pageCount).map((x, i) => {
          if (x === '…') return <li key={`gap-${i}`} className="gl-gap" aria-hidden="true">…</li>
          const n = Number(x) + 1
          return (
            <li key={n}>
              <Link
                className="gl-page"
                to={hrefFor(n)}
                aria-label={fill(labels.page, { n })}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </Link>
            </li>
          )
        })}
        {page < pageCount ? (
          <li><Link className="gl-page" to={hrefFor(page + 1)} rel="next">{labels.next} ›</Link></li>
        ) : null}
      </ul>
    </nav>
  )
}

export default function GalleryIndexPage({ locale, content, basePath }) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { items, loading, error } = useLocalizedGalleryItems(locale, basePath)
  // The filters this list has models for; the two it always has while it loads.
  const offered = useMemo(() => (loading ? LOADING_FILTER_IDS : indexFilterIds(items)), [loading, items])
  const activeCat = resolveIndexFilter(searchParams.get('cat'), offered)
  const listRef = useRef(null)

  // Each model's row in the prices table, keyed by the item itself rather than its id: two
  // items can share an id (App.galleryEnquiry.test.jsx keeps a pair on purpose).
  const entries = useMemo(() => priceEntries(items), [items])

  const filtered = useMemo(() => (
    activeCat === 'all'
      ? items
      : items.filter((item) => catFromItemCategory(item?.category).includes(activeCat))
  ), [items, activeCat])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = resolvePageParam(searchParams.get('page'), pageCount)
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  // A page link is followed at the foot of the list; the next page starts at its top. Not on
  // arrival, and not for a filter (the same query rule as ScrollManager.jsx).
  const shownPage = useRef(page)
  useEffect(() => {
    if (shownPage.current === page) return
    shownPage.current = page
    listRef.current?.scrollIntoView?.({ block: 'start' })
  }, [page])

  // A toggle, as on the FAQ hub: pressing the pressed filter again lets it go, back to all.
  function setFilter(id) {
    const next = id === activeCat ? 'all' : id
    setSearchParams(searchFor(searchParams, next, 1), { replace: true })
  }

  const hrefFor = (n) => ({ search: searchFor(searchParams, activeCat, n) })
  const ready = !loading && !error

  let status = ''
  if (loading) status = content.loading
  else if (!error) status = countText(content, locale, filtered.length)

  return (
    <main className="hp pp gl">
      {/* The list's url is the bare gallery URL, the page's canonical (GalleryRoutes.jsx): a filter,
          a page number or a tracking tag in the query is the same list. Its items are the cards
          on show. */}
      <GalleryListJSONLD items={ready ? pageItems : []} locale={locale} listName={content.schema.listName} listUrl={basePath} />

      <ProductHero titleId="gl-title" eyebrow={content.eyebrow} title={content.heading} lead={content.lead} />

      <div className="gl-list" ref={listRef}>
        <div className="hp-container">
          {!error ? (
            <div className="gl-tools">
              <div className="gl-chips" role="group" aria-label={content.filtersAria}>
                <button
                  type="button"
                  className="gl-chip"
                  aria-pressed={activeCat === 'all'}
                  onClick={() => setFilter('all')}
                >
                  {content.filters.all}
                </button>
                {offered.map((id) => (content.filters.shown?.[id] ? (
                  <button
                    key={id}
                    type="button"
                    className="gl-chip"
                    aria-pressed={activeCat === id}
                    onClick={() => setFilter(id)}
                  >
                    {content.filters.shown[id]}
                  </button>
                ) : null))}
              </div>
              <p className="gl-count" role="status">{status}</p>
            </div>
          ) : null}

          {error ? (
            <div className="hp-card gl-state" role="alert">
              <p>{content.error}</p>
              {/* A failed load is remembered for the visit (and the prices page reads the same
                  data), so the way out is a fresh load of the page. */}
              <div className="hp-cta-row">
                <button type="button" className="hp-btn ghost" onClick={() => window.location.reload()}>{content.retry}</button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <ul className="gl-grid" aria-busy="true">
              {Array.from({ length: SKELETONS }, (_, i) => <SkeletonCard key={i} />)}
            </ul>
          ) : null}

          {ready && filtered.length === 0 ? (
            <div className="hp-card gl-state">
              <p>{activeCat === 'all' ? content.empty.all : content.empty.filtered}</p>
              {activeCat !== 'all' ? (
                <button type="button" className="hp-btn ghost" onClick={() => setFilter('all')}>
                  {content.empty.showAll}
                </button>
              ) : null}
            </div>
          ) : null}

          {ready && pageItems.length > 0 ? (
            <ul className="gl-grid">
              {pageItems.map((item, index) => (
                <li key={item.id ?? item.slug ?? index}>
                  <GalleryCard
                    item={item}
                    entry={entries.get(item)}
                    content={content}
                    locale={locale}
                    location={location}
                    eager={page === 1 && index < EAGER}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {ready ? <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} labels={content.pagination} /> : null}
        </div>
      </div>
    </main>
  )
}

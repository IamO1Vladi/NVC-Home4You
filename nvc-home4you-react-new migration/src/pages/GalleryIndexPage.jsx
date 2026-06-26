import React, { useMemo, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import '../style/Gallery.css'
import {
  PAGE_SIZE,
  clamp,
  snippet,
  htmlToText,
  pageModel,
  resolveCatParam,
  catFromItemCategory,
  useLocalizedGalleryItems,
} from '../gallery/galleryUtils.js'
import { GalleryListJSONLD } from '../components/GalleryStructuredData.jsx'

function Pager({ page, pageCount, onGo, labels }) {
  if (pageCount <= 1) return null
  const model = pageModel(page, pageCount)

  return (
    <div className="gallery-pager" role="navigation" aria-label={labels.paginationAria}>
      <button type="button" className="gpg-btn" onClick={() => onGo(page - 1)} disabled={page === 0} aria-label={labels.prev}>
        ‹
      </button>
      <div className="gpg-pages" aria-label={labels.pages}>
        {model.map((x, i) => {
          if (x === '…') return <span key={`e-${i}`} className="gpg-ellipsis" aria-hidden="true">…</span>
          const n = Number(x)
          const active = n === page
          return (
            <button
              key={n}
              type="button"
              className={['gpg-page', active && 'is-active'].filter(Boolean).join(' ')}
              onClick={() => onGo(n)}
              aria-current={active ? 'page' : undefined}
            >
              {String(n + 1).padStart(2, '0')}
            </button>
          )
        })}
      </div>
      <button type="button" className="gpg-btn" onClick={() => onGo(page + 1)} disabled={page === pageCount - 1} aria-label={labels.next}>
        ›
      </button>
      <div className="gpg-meta" aria-label={labels.currentPage}>
        {labels.pageAbbr} {String(page + 1).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}
      </div>
    </div>
  )
}

export default function GalleryIndexPage({ locale, content, basePath }) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCat = resolveCatParam(searchParams.get('cat'))
  const currentPage = Math.max(1, Number(searchParams.get('p') || 1))
  const { items, loading, error } = useLocalizedGalleryItems(locale, basePath)
  const gridTopRef = useRef(null)

  const filteredItems = useMemo(() => {
    if (activeCat === 'all') return items
    return items.filter((item) => catFromItemCategory(item?.category).includes(activeCat))
  }, [items, activeCat])

  const pageCount = useMemo(() => {
    const total = filteredItems.length || 0
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [filteredItems.length])

  const safePage = clamp(currentPage, 1, pageCount)
  const page = safePage - 1
  const start = page * PAGE_SIZE
  const pageItems = useMemo(() => filteredItems.slice(start, start + PAGE_SIZE), [filteredItems, start])

  const emptyMsg = activeCat === 'all' ? content.empty.all : content.empty.filtered

  function updateSearch(nextCat, nextPage) {
    const next = new URLSearchParams(searchParams)
    if (!nextCat || nextCat === 'all') next.delete('cat')
    else next.set('cat', nextCat)
    if (!nextPage || nextPage <= 1) next.delete('p')
    else next.set('p', String(nextPage))
    setSearchParams(next, { replace: true })
  }

  function setFilter(catId) {
    updateSearch(catId, 1)
  }

  function goToPage(next) {
    const p = clamp(next + 1, 1, pageCount)
    updateSearch(activeCat, p)
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <main className="arx">
      <GalleryListJSONLD items={pageItems} locale={locale} listName={content.schema.listName} listUrl={basePath + (location.search || '')} />
      <section className="gallery">
        <div className="container">
          <div className="gallery-head">
            <div>
              <h1 style={{ fontSize: 'clamp(28px,4vw,40px)', margin: 0 }}>{content.heading}</h1>
              <p className="mt-2" style={{ opacity: 0.85, marginBottom: 0 }}>{content.sub}</p>

              {!loading && !error && items.length > 0 && (
                <div className="gallery-filters mt-3" role="tablist" aria-label={content.filtersAria}>
                  <button
                    type="button"
                    className={['gfilter', activeCat === 'all' && 'is-on'].filter(Boolean).join(' ')}
                    onClick={() => setFilter('all')}
                    role="tab"
                    aria-selected={activeCat === 'all'}
                  >
                    {content.filters.all}
                  </button>

                  {Object.entries(content.filters.categories).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={['gfilter', activeCat === id && 'is-on'].filter(Boolean).join(' ')}
                      onClick={() => setFilter(id)}
                      role="tab"
                      aria-selected={activeCat === id}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!loading && !error && filteredItems.length > 0 && (
              <Pager
                page={page}
                pageCount={pageCount}
                onGo={goToPage}
                labels={content.pagination}
              />
            )}
          </div>

          <div className="gallery-wrap mt-6">
            {loading && (
              <div className="gallery-loader" role="status" aria-live="polite">
                <div className="loader-ring" />
                <div className="loader-text">{content.loading}</div>
              </div>
            )}

            {error && (
              <div className="mt-6" style={{ opacity: 0.8 }}>{content.error}</div>
            )}

            {loading && (
              <div className="gallery-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="gcard gcard--skel">
                    <div className="skel-img" />
                    <div className="gcard-skel-info">
                      <div className="skel-line w-60" />
                      <div className="skel-line w-30 mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && (
              <>
                {filteredItems.length === 0 ? (
                  <div className="mt-6" style={{ opacity: 0.8 }}>{emptyMsg}</div>
                ) : (
                  <div ref={gridTopRef} className="gallery-grid">
                    {pageItems.map((item, localIndex) => {
                      const priceText = typeof item.price === 'number'
                        ? `${item.price} ${item.currency || ''}`.trim()
                        : content.viewDetails

                      const descShort = snippet(htmlToText(item.description), 135)
                      const key = item.id ?? item.coverUrl ?? `${start + localIndex}`
                      return (
                        <Link
                          key={key}
                          to={item.slug}
                          state={{ backgroundLocation: location }}
                          className="gcard"
                          style={{ '--i': localIndex }}
                          aria-label={`${item.title}${item.price ? `, ${priceText}` : ''}`}
                        >
                          <img alt={item.title || ''} src={item.coverUrl} loading="lazy" decoding="async" />
                          <div className="gcard-info">
                            <div className="gcard-title">{item.title}</div>
                            <div className="gcard-more" aria-hidden="true">
                              <div className="gcard-metaRow">
                                <span className="gcard-price">{priceText}</span>
                                <span className="gcard-open">{content.openCta}</span>
                              </div>
                              {descShort && <div className="gcard-desc">{descShort}</div>}
                            </div>
                          </div>
                          <span className="gcard-glare" aria-hidden="true" />
                        </Link>
                      )
                    })}
                  </div>
                )}

                {filteredItems.length > 0 && (
                  <div className="gallery-foot mt-6">
                    <Pager page={page} pageCount={pageCount} onGo={goToPage} labels={content.pagination} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

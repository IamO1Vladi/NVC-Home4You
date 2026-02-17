import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Lightbox from './Lightbox.jsx'
import { useI18n } from '../i18n/I18nContext.jsx'
import './Gallery.css'
import SEO from './SEO.jsx'
import { BreadcrumbsJSONLD, ProductsJSONLD } from './StructuredData.jsx'

const PAGE_SIZE = 12

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)) }

function snippet(text, n = 120){
  if(!text) return ''
  const s = String(text).replace(/\s+/g,' ').trim()
  return s.length > n ? (s.slice(0, n).trimEnd() + '…') : s
}

// If description is HTML (QuickBase rich text), strip tags for the hover preview.
function htmlToText(html){
  if(!html) return ''
  try{
    const doc = new DOMParser().parseFromString(String(html), 'text/html')
    return (doc.body.textContent || '').replace(/\s+/g,' ').trim()
  }catch{
    return String(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
  }
}

/**
 * Returns an array like: [0, 1, 2, '…', 9]
 */
function pageModel(current, total){
  if(total <= 7) return Array.from({length: total}, (_,i)=>i)

  const out = []
  const push = (v) => out.push(v)

  const left = Math.max(0, current - 1)
  const right = Math.min(total - 1, current + 1)

  push(0)

  if(left > 1) push('…')
  for(let i = left; i <= right; i++){
    if(i !== 0 && i !== total - 1) push(i)
  }
  if(right < total - 2) push('…')

  push(total - 1)
  return out
}

function Pager({ page, pageCount, onGo, isBg }){
  if(pageCount <= 1) return null
  const model = pageModel(page, pageCount)

  const pLabel = isBg ? 'Стр.' : 'Page'
  const prevLabel = isBg ? 'Предишна' : 'Previous'
  const nextLabel = isBg ? 'Следваща' : 'Next'

  return (
    <div className="gallery-pager" role="navigation" aria-label={isBg ? 'Навигация по страници' : 'Pagination'}>
      <button
        type="button"
        className="gpg-btn"
        onClick={()=>onGo(page - 1)}
        disabled={page === 0}
        aria-label={prevLabel}
      >
        ‹
      </button>

      <div className="gpg-pages" aria-label={isBg ? 'Страници' : 'Pages'}>
        {model.map((x, i) => {
          if(x === '…') return <span key={`e-${i}`} className="gpg-ellipsis" aria-hidden="true">…</span>
          const n = Number(x)
          const active = n === page
          return (
            <button
              key={n}
              type="button"
              className={['gpg-page', active && 'is-active'].filter(Boolean).join(' ')}
              onClick={()=>onGo(n)}
              aria-current={active ? 'page' : undefined}
            >
              {String(n + 1).padStart(2,'0')}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="gpg-btn"
        onClick={()=>onGo(page + 1)}
        disabled={page === pageCount - 1}
        aria-label={nextLabel}
      >
        ›
      </button>

      <div className="gpg-meta" aria-label={isBg ? 'Текуща страница' : 'Current page'}>
        {pLabel} {String(page + 1).padStart(2,'0')} / {String(pageCount).padStart(2,'0')}
      </div>
    </div>
  )
}

/* ===== Filters =====
   API returns item.category as one of:
   - "Сглобяема къща" | "Фургон" | "Модулна къща" | "Гараж"
*/
const FILTERS = [
  { id:'prefab',  bg:'Сглобяема къща', en:'Prefab house' },
  { id:'wagon',   bg:'Фургон',         en:'Wagon / site cabin' },
  { id:'modular', bg:'Модулна къща',   en:'Modular house' },
  { id:'garage',  bg:'Гараж',          en:'Garage' },
]

const norm = (v) => String(v ?? '').trim().toLowerCase()
const byBg = Object.fromEntries(FILTERS.map(f => [norm(f.bg), f.id]))
const byEn = Object.fromEntries(FILTERS.map(f => [norm(f.en), f.id]))
const byId = new Set(FILTERS.map(f => f.id))

function resolveCatParam(v){
  const n = norm(v)
  if(!n) return 'all'
  if(n === 'all') return 'all'
  if(byId.has(n)) return n
  return byBg[n] || byEn[n] || 'all'
}

function catFromItemCategory(raw){
  // supports string or array; also supports delim if you ever need it
  const parts = Array.isArray(raw) ? raw : String(raw || '').split(/[;,|]/)
  const codes = []
  for(const p of parts){
    const n = norm(p)
    if(!n) continue
    if(byId.has(n)) codes.push(n)
    else if(byBg[n]) codes.push(byBg[n])
    else if(byEn[n]) codes.push(byEn[n])
  }
  return Array.from(new Set(codes))
}

export default function Gallery({ onRequestModel }){
  const { lang, t } = useI18n?.() || { lang: 'en', t: (k)=>k }
  const isBg = String(lang).toLowerCase().startsWith('bg')

  const [searchParams, setSearchParams] = useSearchParams()
  const activeCat = resolveCatParam(searchParams.get('cat'))

  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const [open, setOpen]       = useState(false)
  const [si, setSi]           = useState(0)
  const [idx, setIdx]         = useState(0)

  // Pagination + “catalog turn” animation
  const [page, setPage] = useState(0)
  const [turn, setTurn] = useState('') // '', 'next', 'prev'
  const gridTopRef = useRef(null)

  useEffect(() => {
    async function load(){
      try{
        const base = import.meta.env.VITE_API_BASE || ''
        const res = await fetch(base + '/api/gallery')
        if(!res.ok) throw new Error('Failed to load gallery')
        const json = await res.json()
        setItems(json.items || [])
      }catch(e){
        setError(e.message)
      }finally{
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filtered list (based on item.category)
  const filteredItems = useMemo(() => {
    if(activeCat === 'all') return items
    return items.filter(it => catFromItemCategory(it?.category).includes(activeCat))
  }, [items, activeCat])

  const pageCount = useMemo(() => {
    const total = filteredItems.length || 0
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [filteredItems.length])

  useEffect(() => {
    // keep page valid
    setPage(p => clamp(p, 0, pageCount - 1))
  }, [pageCount])

  // when filter changes, reset page + close lightbox (prevents mismatched indices)
  useEffect(() => {
    setPage(0)
    setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat])

  const start = page * PAGE_SIZE
  const pageItems = useMemo(
    () => filteredItems.slice(start, start + PAGE_SIZE),
    [filteredItems, start]
  )

  function openLightbox(i, imageIndex=0){
    setSi(i)
    setIdx(imageIndex)
    setOpen(true)
  }

  function goToPage(next){
    const p = clamp(next, 0, pageCount - 1)
    if(p === page) return
    setTurn(p > page ? 'next' : 'prev')
    setPage(p)
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView?.({ behavior:'smooth', block:'start' })
    })
  }

  function setFilter(catId){
    const next = new URLSearchParams(searchParams)
    if(catId === 'all') next.delete('cat')
    else next.set('cat', catId)
    setSearchParams(next, { replace: true })
  }

  const emptyMsg = activeCat === 'all'
    ? (isBg ? 'Няма добавени модели.' : 'No models added yet.')
    : (isBg ? 'Няма модели в тази категория.' : 'No models in this category.')

  return (
    <main className='arx'>
      <SEO
        title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
        description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
        image="../../public/logo3"
        url="https://nvc-home4you.eu/gallery"
        hreflangs={[
          { hrefLang:'bg', href:'https://nvc-home4you.eu/gallery' },
          { hrefLang:'en', href:'https://nvc-home4you.eu/gallery' }
        ]}
      />
       <ProductsJSONLD items={items} />
       <BreadcrumbsJSONLD items={items}></BreadcrumbsJSONLD>
      <section className="gallery">
        <div className="container">
          <div className="gallery-head">
            <div>
              <h1 style={{fontSize:'clamp(28px,4vw,40px)', margin:0}}>{t('gallery.heading')}</h1>
              <p className="mt-2" style={{opacity:.85, marginBottom:0}}>{t('gallery.sub')}</p>

              {/* Filters */}
              {!loading && !error && items.length > 0 && (
                <div className="gallery-filters mt-3" role="tablist" aria-label={isBg ? 'Филтри' : 'Filters'}>
                  <button
                    type="button"
                    className={['gfilter', activeCat === 'all' && 'is-on'].filter(Boolean).join(' ')}
                    onClick={() => setFilter('all')}
                    role="tab"
                    aria-selected={activeCat === 'all'}
                  >
                    {isBg ? 'Всички' : 'All'}
                  </button>

                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className={['gfilter', activeCat === f.id && 'is-on'].filter(Boolean).join(' ')}
                      onClick={() => setFilter(f.id)}
                      role="tab"
                      aria-selected={activeCat === f.id}
                    >
                      {isBg ? f.bg : f.en}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!loading && !error && (
              <Pager page={page} pageCount={pageCount} onGo={goToPage} isBg={isBg} />
            )}
          </div>

          <div className="gallery-wrap mt-6">
            {/* overlay loader */}
            {loading && (
              <div className="gallery-loader" role="status" aria-live="polite">
                <div className="loader-ring" />
                <div className="loader-text">{isBg ? 'Зареждане на модели…' : 'Loading models…'}</div>
              </div>
            )}

            {/* error state */}
            {error && (
              <div className="mt-6" style={{opacity:.8}}>
                {isBg ? 'Галерията не можа да се зареди. Опитайте по-късно.' : 'Couldn’t load gallery. Please try again later.'}
              </div>
            )}

            {/* skeletons while loading */}
            {loading && (
              <div className="gallery-grid">
                {Array.from({length:8}).map((_,i)=>(
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

            {/* real items */}
            {!loading && !error && (
              <>
                {filteredItems.length === 0 ? (
                  <div className="mt-6" style={{opacity:.8}}>
                    {emptyMsg}
                  </div>
                ) : (
                  <div
                    ref={gridTopRef}
                    className={['gallery-grid', turn ? `is-${turn}` : ''].filter(Boolean).join(' ')}
                    onAnimationEnd={() => setTurn('')}
                  >
                    {pageItems.map((s, localIndex) => {
                      const globalIndex = start + localIndex

                      const title = isBg && s.titleBg ? s.titleBg : s.title
                      const desc  = isBg && s.descriptionBg ? s.descriptionBg : s.description

                      // description may be HTML; preview must be text
                      const descShort = snippet(htmlToText(desc), 135)

                      const priceText = s.price
                        ? `${s.price} ${s.currency || ''}`.trim()
                        : (isBg ? 'Виж детайли' : 'View details')

                      const key = s.id ?? s.coverUrl ?? `${globalIndex}`

                      return (
                        <button
                          key={key}
                          type="button"
                          className="gcard"
                          style={{ '--i': localIndex }}
                          onClick={() => openLightbox(globalIndex, 0)}
                          aria-label={`${title}${s.price ? `, ${priceText}` : ''}`}
                        >
                          <img
                            alt={title || ''}
                            src={s.coverUrl}
                            loading="lazy"
                            decoding="async"
                          />

                          {/* minimal label always; more info on hover (desktop) */}
                          <div className="gcard-info">
                            <div className="gcard-title">{title}</div>

                            <div className="gcard-more" aria-hidden="true">
                              <div className="gcard-metaRow">
                                <span className="gcard-price">{priceText}</span>
                                <span className="gcard-open">
                                  {isBg ? 'Отвори →' : 'Open →'}
                                </span>
                              </div>
                              {descShort && <div className="gcard-desc">{descShort}</div>}
                            </div>
                          </div>

                          <span className="gcard-glare" aria-hidden="true" />
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* bottom pager */}
                {filteredItems.length > 0 && (
                  <div className="gallery-foot mt-6">
                    <Pager page={page} pageCount={pageCount} onGo={goToPage} isBg={isBg} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Lightbox uses filteredItems index */}
        {open && filteredItems[si] && (() => {
          const s = filteredItems[si]
          const title = isBg && s.titleBg ? s.titleBg : s.title
          const desc  = isBg && s.descriptionBg ? s.descriptionBg : s.description
          return (
            <Lightbox
              modelId={s.id}
              title={title}
              images={s.images}
              price={s.price}
              currency={s.currency || 'EUR'}
              desc={desc}
              index={idx}
              onClose={() => setOpen(false)}
              onRequest={(payload) => onRequestModel?.(payload)}
            />
          )
        })()}
      </section>
    </main>
  )
}

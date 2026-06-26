import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useModalActions } from '../context/ModalActions.jsx'
import LogisticsWorld from '../components/LogisticsWorld.jsx'
import '../style/Partner.css'

function resolveAsset(assetFn, src) {
  if (!src) return ''
  return /^https?:/i.test(src) ? src : assetFn(src)
}

export default function PartnerPage({ content }) {
  const { openOffer, openQuestion } = useModalActions()
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const heroSrc = resolveAsset(asset, content.hero.image)
  const roadRef = useRef(null)
  const stepRefs = useRef([])

  useEffect(() => {
    const root = roadRef.current
    if (!root || typeof window === 'undefined') return undefined

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      root.style.setProperty('--roadProgress', '1')
      stepRefs.current.forEach((node) => node?.classList.add('is-visible'))
      return undefined
    }

    let raf = 0

    const updateProgress = () => {
      const rect = root.getBoundingClientRect()
      const viewport = window.innerHeight || document.documentElement.clientHeight || 1
      const startOffset = viewport * 0.82
      const endOffset = viewport * 0.18
      const distance = rect.height + startOffset - endOffset
      const travelled = startOffset - rect.top
      const progress = Math.max(0, Math.min(1, travelled / distance))

      root.style.setProperty('--roadProgress', progress.toFixed(4))
      raf = 0
    }

    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(updateProgress)
    }

    updateProgress()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const nodes = stepRefs.current.filter(Boolean)
    if (!nodes.length) return undefined

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        })
      },
      { threshold: 0.28, rootMargin: '0px 0px -8% 0px' }
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="partner-page">
      <header className="ppr-hero" role="banner" style={{ '--heroImg': `url("${heroSrc}")` }}>
        <div className="ppr-hero-bg" aria-hidden="true">
          <img src={heroSrc} alt="" loading="eager" decoding="async" />
        </div>

        <div className="ppr-hero-scrim" aria-hidden="true" />

        <div className="container ppr-hero-inner">
          <div className="ppr-hero-head">
            <div className="ppr-hero-titleWrap">
              <h1 className="ppr-hero-title">{content.hero.title}</h1>
            </div>
            <div className="ppr-hero-leadWrap">
              <p className="ppr-hero-lead">{content.hero.lead}</p>
            </div>
          </div>

          <div className="ppr-products" aria-label={content.hero.productsAriaLabel}>
            {content.products.map((product) => {
              const tileImg = resolveAsset(asset, product.img) || heroSrc
              const tileBg = `url("${tileImg}")`

              return (
                <Link
                  key={product.key}
                  to={product.to}
                  className="ppr-prod"
                  style={{
                    '--pos': product.pos || '50% 50%',
                    '--tileImg': tileBg,
                  }}
                  aria-label={product.ariaLabel || product.title}
                >
                  <div className="ppr-prod-media" aria-hidden="true" />
                  <div className="ppr-prod-pad">
                    <div className="ppr-prod-kicker">{content.hero.productKicker}</div>
                    <div className="ppr-prod-title">{product.title}</div>
                    <div className="ppr-prod-desc">{product.desc}</div>
                    <span className="ppr-prod-cta">{content.hero.productCta}</span>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="ppr-cta">
            <div className="ppr-cta-badge">{content.hero.cta.badge}</div>
            <div className="ppr-cta-copy">
              <div className="ppr-cta-title">{content.hero.cta.title}</div>
              <div className="ppr-cta-sub">{content.hero.cta.sub}</div>
            </div>

            <div className="ppr-cta-actions">
              <button type="button" className="btn" onClick={openOffer}>
                {content.hero.cta.primary}
              </button>

              <button type="button" className="btn ghost" onClick={openQuestion}>
                {content.hero.cta.secondary}
              </button>

              <Link className="btn ghost" to={content.hero.cta.tertiaryTo}>
                {content.hero.cta.tertiary}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="ppr-roadflow" ref={roadRef} aria-labelledby="partner-road-title">
        <div className="container">
          <div className="ppr-roadflow-head">
            <div className="ppr-roadflow-kicker">{content.roadIntro.kicker}</div>
            <h2 className="ppr-roadflow-title" id="partner-road-title">{content.roadIntro.title}</h2>
            <p className="ppr-roadflow-lead">{content.roadIntro.lead}</p>
          </div>

          <div className="ppr-roadflow-wrap">
            <div className="ppr-road-backbone" aria-hidden="true">
              <span className="ppr-road-backbone-track" />
              <span className="ppr-road-backbone-fill" />
              <span className="ppr-road-backbone-cap is-top" />
              <span className="ppr-road-backbone-cap is-bottom" />
            </div>

            <div className="ppr-road-list">
              {content.roadSteps.map((step, index) => {
                const isLeft = index % 2 === 0
                const stepImg = resolveAsset(asset, step.img)
                const fallback = resolveAsset(asset, step.fallback) || heroSrc

                return (
                  <article
                    key={step.key}
                    ref={(node) => { stepRefs.current[index] = node }}
                    className={['ppr-road-step', isLeft ? 'is-left' : 'is-right'].join(' ')}
                    style={{ '--stepDelay': `${index * 70}ms` }}
                  >
                    <div className="ppr-road-copyCol">
                      <div className="ppr-road-copyCard">
                        <div className="ppr-road-stepTop">
                          <span className="ppr-road-stepNum">{String(index + 1).padStart(2, '0')}</span>
                          <span className="ppr-road-stepBadge">{step.badge}</span>
                        </div>
                        <h3 className="ppr-road-stepTitle">{step.title}</h3>
                        <p className="ppr-road-stepText">{step.text}</p>
                        <ul className="ppr-road-stepList">
                          {step.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="ppr-road-center" aria-hidden="true">
                      <span className="ppr-road-node">{index + 1}</span>
                    </div>

                    <div className="ppr-road-mediaCol">
                      <div className="ppr-road-mediaCard">
                        <div className="ppr-road-mediaFrame">
                          <img
                            src={stepImg}
                            alt={step.alt}
                            width="1400"
                            height="1040"
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              event.currentTarget.src = fallback
                            }}
                          />
                          <span className="ppr-road-mediaTag">{step.badge}</span>
                        </div>
                        <div className="ppr-road-mediaNote">{step.mediaNote}</div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="ppr-road-cta">
            <div>
              <div className="ppr-road-ctaTitle">{content.roadCta.title}</div>
              <p className="ppr-road-ctaText">{content.roadCta.text}</p>
            </div>

            <div className="ppr-road-ctaActions">
              <button type="button" className="btn" onClick={openOffer}>
                {content.roadCta.primary}
              </button>
              <button type="button" className="btn ghost" onClick={openQuestion}>
                {content.roadCta.secondary}
              </button>
            </div>
          </div>
        </div>
      </section>

      <LogisticsWorld content={content.logisticsWorld} />
    </main>
  )
}

import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import SEO from './SEO.jsx'
import './Partner.css'

export default function Partner(){
  const { lang } = useI18n()
  const { openOffer, openQuestion } = useModalActions()
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const isBg = String(lang).toLowerCase().startsWith('bg')

  const heroSrc = asset('partner/hero.png')
  const roadRef = useRef(null)
  const stepRefs = useRef([])

  const title = isBg ? 'Стани наш партньор' : 'Become our partner'
  const lead = isBg
    ? 'Поръчайте 6+ контейнера и се възползвайте от специални цени с доставка до избран от вас обект. Разгледайте моделите в галерията.'
    : 'Order 6+ containers and take advantage of special prices with delivery to a location of your choice. View the models in our gallery.'

  const products = [
    {
      key: 'livable',
      title: isBg ? 'Контейнери за живеене' : 'Modular units',
      desc:  isBg ? 'Готови решения за живеене и настаняване.' : 'Ready-to-live container solutions.',
      pos:   '50% 55%',
      img:   'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc6/eg/vb',
      to:    '/gallery?cat=wagon',
    },
    {
      key: 'box',
      title: isBg ? 'Box къщи' : 'Box Houses',
      desc:  isBg ? 'Модулни “box” конфигурации за дом или бизнес.' : 'Box-style modular layouts for home or business.',
      pos:   '50% 55%',
      img:   'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc5/eg/vb',
      to:    '/gallery?cat=modular',
    },
    {
      key: 'capsules',
      title: isBg ? 'Капсули' : 'Capsules',
      desc:  isBg ? 'Комбинация от технологии и комфорт.' : 'Combination of technology and comfort.',
      pos:   '50% 55%',
      img:   'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc8/eg/vb',
      to:    '/gallery',
    },
    {
      key: 'prefab',
      title: isBg ? 'Сглобяеми къщи' : 'Prefab Houses',
      desc:  isBg ? 'Kъщи с метална конструкция' : 'Houses with metal structure',
      pos:   '50% 55%',
      img:   'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc9/eg/vb',
      to:    '/gallery?cat=prefab',
    },
  ]

  const roadIntro = {
    kicker: isBg ? 'Партньорски процес' : 'Partner process',
    title: isBg ? 'Ясен път от избора до доставката' : 'A clear road from selection to delivery',
    lead: isBg
      ? 'Процесът е подреден в ясни стъпки - от моделите и спецификациите до контрола, логистиката и следващите доставки.'
      : 'The process is structured into clear stages - from model selection and specifications to quality control, logistics, and repeat deliveries.'
  }

  const roadSteps = [
    {
      key: 'config',
      title: isBg ? 'Избор на модели и конфигурация' : 'Model selection and configuration',
      text: isBg
        ? 'Изпращате ни кодовете на моделите, а ние подреждаме количествата и конфигурацията според вашия проект.'
        : 'You send the model codes, and we structure the quantities and configuration around your project.',
      points: isBg
        ? [
            'Фиксираме размери, материали, покрития, цветове и аксесоари.',
            'Консултираме ви за приложение, бюджет и технически изисквания.'
          ]
        : [
            'We lock in sizes, materials, finishes, colors, and accessories.',
            'We advise on application, budget, and technical requirements.'
          ],
      badge: isBg ? 'Каталог и конфигурация' : 'Catalog and configuration',
      img: asset('partner/road/step-01.jpg'),
      fallback: products[1].img,
      alt: isBg ? 'Модулен модел за партньорска програма' : 'Modular unit used as a partner program example',
      mediaNote: isBg ? 'Първо уточняваме точния модел и пакета.' : 'We start by fixing the exact model and package.'
    },
    {
      key: 'production',
      title: isBg ? 'Договор, производство и контрол' : 'Contract, production, and control',
      text: isBg
        ? 'След одобрение подготвяме договор и стартираме производството по финалните параметри.'
        : 'After approval, we prepare the contract and launch production against the final parameters.',
      points: isBg
        ? [
            'Получавате срокове, условия за плащане, гаранция и доставка.',
            'Изпращаме известия за напредъка и снимки от ключовите етапи.'
          ]
        : [
            'You receive deadlines, payment terms, warranty, and delivery conditions.',
            'We send progress updates and photos from the key production stages.'
          ],
      badge: isBg ? 'Производство' : 'Production',
      img: asset('partner/road/step-02.jpg'),
      fallback: products[0].img,
      alt: isBg ? 'Производствен етап на модулни решения' : 'Production stage for modular solutions',
      mediaNote: isBg ? 'Контролът започва още по време на производството.' : 'Quality control starts during production itself.'
    },
    {
      key: 'logistics',
      title: isBg ? 'Проверки, спецификации и логистика' : 'Checks, specifications, and logistics',
      text: isBg
        ? 'Всеки продукт преминава проверки, а документацията се подготвя прецизно за безпроблемен внос.'
        : 'Each product goes through checks while the documentation is prepared precisely for smooth import and delivery.',
      points: isBg
        ? [
            'Предоставяме параметри, спецификации и съобразяване с местните изисквания.',
            'Избираме маршрут с баланс между цена, транзитно време и сигурност.'
          ]
        : [
            'We provide parameters, specifications, and alignment with local requirements.',
            'We select the route by balancing cost, transit time, and reliability.'
          ],
      badge: isBg ? 'Документи и маршрути' : 'Documents and routing',
      img: asset('partner/road/step-03.jpg'),
      fallback: products[3].img,
      alt: isBg ? 'Сертификати и документация' : 'Certificates and project documentation',
      mediaNote: isBg ? 'Документите и маршрутът се настройват според пазара.' : 'Documents and routing are tuned to the target market.'
    },
    {
      key: 'delivery',
      title: isBg ? 'Доставка, проследяване и follow-up' : 'Delivery, tracking, and follow-up',
      text: isBg
        ? 'Следим пратката от експедицията до разтоварването и улесняваме следващи доставки по вече одобрени параметри.'
        : 'We track the shipment from dispatch to unloading and make repeat deliveries easier under the already approved parameters.',
      points: isBg
        ? [
            'Получавате сертификати, инструкции и списък с комплектация.',
            'Съдействаме за резервни части, застраховка и повторни поръчки.'
          ]
        : [
            'You receive certificates, instructions, and a packing list.',
            'We support spare parts, insurance, and repeat ordering.'
          ],
      badge: isBg ? 'Доставка' : 'Delivery',
      img: asset('partner/road/step-04.jpg'),
      fallback: products[2].img,
      alt: isBg ? 'Подготовка на товар за изпращане' : 'Shipment prepared for dispatch',
      mediaNote: isBg ? 'Оставаме до вас и след първата доставка.' : 'We stay involved after the first delivery too.'
    },
  ]

  useEffect(() => {
    const root = roadRef.current
    if (!root || typeof window === 'undefined') return

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
      const start = viewport * 0.82
      const end = viewport * 0.18
      const distance = rect.height + start - end
      const travelled = start - rect.top
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

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        })
      },
      { threshold: 0.28, rootMargin: '0px 0px -8% 0px' }
    )

    nodes.forEach((node) => io.observe(node))
    return () => io.disconnect()
  }, [])

  return (
    <main className="partner-page">
      <SEO
        title={isBg ? 'Стани наш партньор - NVC Home4You' : 'Partner with us - NVC Home4You'}
        description={
          isBg
            ? 'Партньорска програма: при 6+ контейнера предлагаме специални цени, ясен процес и доставка до локация по ваш избор.'
            : 'Partner program: for 6+ containers we offer special pricing, a clear process, and delivery to a location of your choice.'
        }
        image="../public/logo3"
        url="https://nvc-home4you.eu/partner"
        hreflangs={[
          { hrefLang:'bg', href:'https://nvc-home4you.eu/partner' },
          { hrefLang:'en', href:'https://nvc-home4you.eu/partner' }
        ]}
      />

      {/* HERO */}
      <header className="ppr-hero" role="banner" style={{ '--heroImg': `url("${heroSrc}")` }}>
        <div className="ppr-hero-bg" aria-hidden="true">
          <img src={heroSrc} alt="" loading="eager" decoding="async" />
        </div>

        <div className="ppr-hero-scrim" aria-hidden="true" />

        <div className="container ppr-hero-inner">
          <div className="ppr-hero-head">
            <div className="ppr-hero-titleWrap">
              <h1 className="ppr-hero-title">{title}</h1>
            </div>
            <div className="ppr-hero-leadWrap">
              <p className="ppr-hero-lead">{lead}</p>
            </div>
          </div>

          <div className="ppr-products" aria-label={isBg ? 'Основни продукти' : 'Main products'}>
            {products.map((p) => {
              const tileImg = p.img && String(p.img).trim() ? p.img : heroSrc
              const tileBg = `url("${tileImg}")`

              return (
                <Link
                  key={p.key}
                  to={p.to}
                  className="ppr-prod"
                  style={{
                    '--pos': p.pos || '50% 50%',
                    '--heroImg': tileBg,
                  }}
                  aria-label={p.title}
                >
                  <div className="ppr-prod-media" aria-hidden="true" />
                  <div className="ppr-prod-pad">
                    <div className="ppr-prod-kicker">{isBg ? 'Категория' : 'Category'}</div>
                    <div className="ppr-prod-title">{p.title}</div>
                    <div className="ppr-prod-desc">{p.desc}</div>
                    <span className="ppr-prod-cta">{isBg ? 'Виж модели ->' : 'View models ->'}</span>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="ppr-cta">
            <div className="ppr-cta-badge">6+</div>
            <div className="ppr-cta-copy">
              <div className="ppr-cta-title">
                {isBg ? 'Специални цени и доставка при 6+ контейнера' : 'Special pricing & delivery for 6+ containers'}
              </div>
              <div className="ppr-cta-sub">
                {isBg
                  ? 'Изпратете ни количеството и дестинацията, а ние ще ви отговорим с оферта, на която трудно се отказва.'
                  : 'Send us the quantity and destination, and we will respond with an offer that is hard to refuse.'}
              </div>
            </div>

            <div className="ppr-cta-actions">
              <button className="btn" onClick={openOffer}>
                {isBg ? 'Поискай партньорска оферта' : 'Request partner offer'}
              </button>

              <button className="btn ghost" onClick={openQuestion}>
                {isBg ? 'Контакт' : 'Contact'}
              </button>

              <Link className="btn ghost" to="/gallery">
                {isBg ? 'Галерия' : 'Gallery'}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ROAD FLOW */}
      <section className="ppr-roadflow" ref={roadRef} aria-labelledby="partner-road-title">
        <div className="container">
          <div className="ppr-roadflow-head">
            <div className="ppr-roadflow-kicker">{roadIntro.kicker}</div>
            <h2 className="ppr-roadflow-title" id="partner-road-title">{roadIntro.title}</h2>
            <p className="ppr-roadflow-lead">{roadIntro.lead}</p>
          </div>

          <div className="ppr-roadflow-wrap">
            <div className="ppr-road-backbone" aria-hidden="true">
              <span className="ppr-road-backbone-track" />
              <span className="ppr-road-backbone-fill" />
              <span className="ppr-road-backbone-cap is-top" />
              <span className="ppr-road-backbone-cap is-bottom" />
            </div>

            <div className="ppr-road-list">
              {roadSteps.map((step, i) => {
                const isLeft = i % 2 === 0
                return (
                  <article
                    key={step.key}
                    ref={(node) => { stepRefs.current[i] = node }}
                    className={['ppr-road-step', isLeft ? 'is-left' : 'is-right'].join(' ')}
                    style={{ '--stepDelay': `${i * 70}ms` }}
                  >
                    <div className="ppr-road-copyCol">
                      <div className="ppr-road-copyCard">
                        <div className="ppr-road-stepTop">
                          <span className="ppr-road-stepNum">{String(i + 1).padStart(2, '0')}</span>
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
                      <span className="ppr-road-node">{i + 1}</span>
                    </div>

                    <div className="ppr-road-mediaCol">
                      <div className="ppr-road-mediaCard">
                        <div className="ppr-road-mediaFrame">
                          <img
                            src={step.img}
                            alt={step.alt}
                            width="1400"
                            height="1040"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => { e.currentTarget.src = step.fallback || heroSrc }}
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
              <div className="ppr-road-ctaTitle">
                {isBg ? 'Имате конкретен пазар, срок или държава?' : 'Do you have a specific market, deadline, or destination?'}
              </div>
              <p className="ppr-road-ctaText">
                {isBg
                  ? 'Настройваме документацията, производствения график и логистичната схема според продукта, количеството и пазара.'
                  : 'We adapt the documentation, production schedule, and logistics chain to the product, quantity, and target market.'}
              </p>
            </div>

            <div className="ppr-road-ctaActions">
              <button className="btn" onClick={openOffer}>
                {isBg ? 'Стартирай партньорски разговор' : 'Start partner discussion'}
              </button>
              <button className="btn ghost" onClick={openQuestion}>
                {isBg ? 'Задай въпрос' : 'Ask a question'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

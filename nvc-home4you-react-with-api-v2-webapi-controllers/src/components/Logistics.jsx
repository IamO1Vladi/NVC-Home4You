import React from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import LogisticsWorld from './LogisticsWorld.jsx'
import './Logistics.css'
import SEO from './SEO.jsx'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function Logistics(){
  const { openOffer, openQuestion } = useModalActions()
  const [region, setRegion] = React.useState('EU') // 'EU' | 'NA' | 'SA'
  const { t } = useI18n()

  // Steps: text-only (comes from your translations)
    const steps = React.useMemo(() => ([
      { key: 'order'  },
      { key: 'prod'   },
      { key: 'export' },
      { key: 'import' },
      { key: 'door'   },
    ]), [t])

   const SEG_MS = 1500
    const [active, setActive] = React.useState(-1) // -1 = not started
    const timerRef = React.useRef(null)

    const start = (from = -1) => {
      clearInterval(timerRef.current)
      let current = from
      timerRef.current = setInterval(() => {
        current += 1
        setActive(prev => (prev < steps.length - 1 ? prev + 1 : prev))
        if (current >= steps.length - 1) clearInterval(timerRef.current)
      }, SEG_MS)
    }
  
    React.useEffect(() => {
      start(-1)
      return () => clearInterval(timerRef.current)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [steps.length])
  
    const pause = () => clearInterval(timerRef.current)
    const resume = () => { if (active < steps.length - 1) start(active) }
    const replay = () => { setActive(-1); start(-1) }

  const tiles = [
    {
      id:'sea',
      h:t('logistics.tiles.seaTitle'),
      p:t('logistics.tiles.seaDesc'),
      img:'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rv/eg/vb',
      href:'/services/sea'
    },
    {
      id:'air',
      h:t('logistics.tiles.airTitle'),
      p:t('logistics.tiles.airDesc'),
      img:'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbq/eg/vb',
      href:'/services/air'
    },
    {
      id:'rail',
      h:t('logistics.tiles.trainTitle'),
      p:t('logistics.tiles.trainDesc'),
      img:'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rx/eg/vb',
      href:'/services/rail'
    },
    {
      id:'multi',
      h:t('logistics.tiles.combinedTitle'),
      p:t('logistics.tiles.combinedDesc'),
      img:'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcd/eg/vb',
      href:'/services/multimodal'
    }
  ]

  return (
    <main className="glb">

  <SEO
      title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
      description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
      image="../../public/logo3"
      url="https://nvc-home4you.eu/logistics"
      hreflangs={[
      { hrefLang:'bg', href:'https://nvc-home4you.eu/logistics' },
      { hrefLang:'en', href:'https://nvc-home4you.eu/logistics' }
      ]}/>

      {/* Hero (gradient; no image required) */}
      <header className="glb-hero" role="banner">

        <div className="glb-hero-bg" aria-hidden="true">
    <img
      src={'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcd/eg/vb'}
      alt=""
      loading="eager"
    />
  </div>

        <div className="container glb-hero-inner">
          <div>
            <h1 className="glb-title">{t('logistics.title')}</h1>
            <p className="glb-lead">
              {t('logistics.lead')}
            </p>
            <div className="row mt-3">
              <button className="btn" onClick={openQuestion}>{t('logistics.button')}</button>
            </div>
          </div>
        </div>
      </header>


      {/* ===== ARROW: all information lives inside the chevrons ===== */}
      <section className="arx-body">
        <div className="container">
          <div className="arx-top">
            <p className="arx-lead">{t('delivery.lead')}</p>
            <div className="arx-controls">
              <button className="btn small ghost" onClick={replay}>{t('logistics.replayButton')}</button>
            </div>
          </div>

          <ol
            className="arx-arrow"
            onMouseEnter={pause}
            onMouseLeave={resume}
          >
            {steps.map((s, i) => {
              const shape = i === steps.length - 1 ? 'is-last' : 'is-mid'
              const solid = i <= active ? 'is-solid' : 'is-ghost'
              return (
                <li
                  key={s.key}
                  className={['arx-seg', shape, solid].join(' ')}
                  style={{ '--i': i, '--delay': `${i * SEG_MS}ms` }}
                  onClick={() => { pause(); setActive(i) }}
                  role="tab"
                  aria-selected={i === active}
                >
                  <div className="arx-fill" aria-hidden="true" />
                  <div className="arx-seg-content">
                    <div className="arx-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="arx-h">{t(`delivery.steps.${s.key}.h`)}</div>
                    <div className="arx-p">
                      {t(`delivery.steps.${s.key}.p`)}
                      {t(`delivery.steps.${s.key}.meta`) && (
                        <span className="arx-badge"> · {t(`delivery.steps.${s.key}.meta`)}</span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="arx-band">
            <div className="arx-chip"><strong>{t('delivery.windows.west')}</strong></div>
            <div className="arx-chip"><strong>{t('delivery.windows.east')}</strong></div>
            <div className="arx-sub">{t('delivery.windows.sub')}</div>
          </div>
        </div>
      </section>


      {/* World map with switchable regions */}
      <section className="glb-world">
        <div className="container">
         

          <LogisticsWorld region={region} height="560px" />

          <div className="glb-note">
            {t('logistics.map.helpText')}
          </div>
        </div>
      </section>

      {/* Big visual tiles */}
      <section className="glb-tiles">
        <div className="container">
          <div className="glb-tiles-grid">
            {tiles.map(t => (
              <a key={t.id} className="glb-tile"  style={{ ['--bg']: `url(${t.img})` }}>
                <div className="glb-tile-overlay">
                  <h3>{t.h}</h3>
                  <p>{t.p}</p>                
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 
      <section className="glb-cta">
        <div className="container glb-cta-card">
          <h3>Готови ли сте да фиксираме маршрут?</h3>
          <p>Изпратете ни товарен лист / адреси и предпочитани Incoterms — ще върнем график и верига от етапи.</p>
          <div className="row mt-3">
            <button className="btn" onClick={openOffer}>Поискай оферта</button>
            <button className="btn ghost" onClick={openQuestion}>Контакт</button>
          </div>
        </div>
      </section>
      */}
    </main>
  )
}

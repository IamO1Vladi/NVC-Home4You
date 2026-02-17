import React from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import './Delivery.css'
import DeliveryEstimator from './DeliveryEstimator.jsx'
import SEO from './SEO.jsx'
import { BreadcrumbsJSONLD } from './StructuredData.jsx'

export default function Delivery(){
  const { t } = useI18n()
  const { openOffer, openQuestion } = useModalActions()
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`

  // Steps: text-only (comes from your translations)
  const steps = React.useMemo(() => ([
    { key: 'order'  },
    { key: 'prod'   },
    { key: 'export' },
    { key: 'import' },
    { key: 'door'   },
  ]), [t])

  // Arrow fill animation (no undeclared variables anywhere)
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

  return (
    <main className="arx">

      <BreadcrumbsJSONLD items={[      { name:'Начало', url:'https://nvc-home4you.eu/' },
       { name:'Доставка до вратата', url:'https://nvc-home4you.eu/delivery' }
     ]}/>
    <SEO
      title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
      description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
      image="../../public/logo3"
      url="https://nvc-home4you.eu/delivery"
      hreflangs={[
      { hrefLang:'bg', href:'https://nvc-home4you.eu/delivery' },
      { hrefLang:'en', href:'https://nvc-home4you.eu/delivery' }
      ]}/>
      {/* ===== HERO: big header image only ===== */}
    {/* ===== HERO: image + bottom-left overlay ===== */}
<header className="arx-hero" role="banner">
  <div className="arx-hero-bg" aria-hidden="true">
    {/* You can replace this URL with a local asset later, e.g. asset('delivery/hero.jpg') */}
    <img
      src="https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcd/eg/vb"
      alt=""
      loading="eager"
    />
  </div>

  <div className="container">
    <div className="arx-hero-inner">
      <h1 className="arx-title">{t('delivery.title')}</h1>
      <div className="arx-hero-actions">     
        <button className="btn" onClick={openQuestion}>{t('nav.askQuestion')}</button>
      </div>
    </div>
  </div>
</header>


    

      <DeliveryEstimator
  base={{ lat: 41.43165, lon: 23.33813 }}  // Marikostinovo
  ratePerKm={0.8}
  currency="€."
/>
    </main>
  )
  
}

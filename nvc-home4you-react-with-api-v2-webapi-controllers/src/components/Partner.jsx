import React from 'react'
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

  const title = isBg ? 'Стани наш партньор' : 'Become our partner'
  const lead = isBg
    ? 'Поръчайте 6+ контейнера и се възползвайте от специални цени с доставка до избран от вас обект. Разгледайте моделите в галерията.'
    : 'Order 6+ containers and take advantage of special prices with delivery to a location of your choice. View the models in our gallery.'

  // ✅ Product tiles (each tile can use a DIFFERENT image URL)
  // Replace the img values with your real URLs (QuickBase, CDN, etc.)
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
      desc:  isBg ? 'Комбинация от технологии и комфорт.' : 'Combination of technology and comfort. ',
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

  return (
    <main className="partner-page">
      <SEO
        title={isBg ? 'Стани наш партньор — NVC Home4You' : 'Partner with us — NVC Home4You'}
        description={
          isBg
            ? 'Партньорска програма: при 6+ контейнера предлагаме специални цени и доставка до локация по ваш избор. Разгледайте моделите в галерията.'
            : 'Partner program: for 6+ containers we offer special pricing and delivery to a location of your choice. Browse models in the gallery.'
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

          {/* ✅ Product tiles */}
          <div className="ppr-products" aria-label={isBg ? 'Основни продукти' : 'Main products'}>
            {products.map((p) => {
              // IMPORTANT: override the SAME CSS variable your tiles already use: --heroImg
              // This is the change that actually makes each tile unique.
              const tileImg = p.img && String(p.img).trim() ? p.img : heroSrc
              const tileBg = `url("${tileImg}")`

              return (
                <Link
                  key={p.key}
                  to={p.to}
                  className="ppr-prod"
                  style={{
                    '--pos': p.pos || '50% 50%',
                    '--heroImg': tileBg, // ✅ per-tile image
                  }}
                  aria-label={p.title}
                >
                  <div className="ppr-prod-media" aria-hidden="true" />
                  <div className="ppr-prod-pad">
                    <div className="ppr-prod-kicker">{isBg ? 'Категория' : 'Category'}</div>
                    <div className="ppr-prod-title">{p.title}</div>
                    <div className="ppr-prod-desc">{p.desc}</div>
                    <span className="ppr-prod-cta">{isBg ? 'Виж модели →' : 'View models →'}</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* CTA row */}
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
    </main>
  )
}

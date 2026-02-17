import React from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import './ModularBuilds.css'
import SEO from './SEO.jsx'
import { ProductsJSONLD } from './StructuredData.jsx'

export default function ModularBuilds() {
  const { t } = useI18n()
  const asset = (file) => `${import.meta.env.BASE_URL}modular-builds/${file}`

  const products = [
    {
      name: 'Standard modular unit',
      image: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcx/eg/vb',
      priceCurrency: 'BGN',
      priceFrom: 4240,
      price: 4240
    },
    {
      name: 'Villa / Office module',
      image: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcu/eg/vb',
      priceCurrency: 'BGN',
      priceFrom: 4950,
      price: 4950
    },
    {
      name: 'Retail module',
      image: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcv/eg/vb',
      priceCurrency: 'BGN',
      priceFrom: 5370,
      price: 5370
    },
  ]

  return (
    <main className="mb-page">
      {/* Structured data for products */}
      <ProductsJSONLD items={products} />

      {/* SEO meta for this page */}
      <SEO
        title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
        description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
        image="../../public/logo3"
        url="https://nvc-home4you.eu/modular-builds"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/modular-builds' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/modular-builds' },
        ]}
      />

      {/* HERO */}
      <section className="mb-hero">
        <div className="container mb-hero-grid">
          <div>
            <h1 className="mb-title">{t('modular.title')}</h1>
            <p className="mb-lead">{t('modular.heroLead')}</p>
            <p className="mb-lead mb-sizes">{t('modular.sizes')}</p>
          </div>
          <div className="mb-hero-visual">
            <img
              className="mb-hero-img"
              src="https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc7/eg/vb"
              alt={t('modular.heroAlt')}
              loading="eager"
              width="800"
              height="500"
            />
          </div>
        </div>
      </section>

      {/* IMAGE-FIRST CARDS WITH OVERLAYS */}
      <section>
        <div className="container mb-card-grid">
          {/* Standard */}
          <a
            className="mb-card"
            href={`${asset('Стандартни контейнери.pdf')}#page=1`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('modular.standard.aria')}
          >
            <img
              className="mb-card-media"
              src="https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcu/eg/vb"
              alt={t('modular.standard.alt')}
              width="960"
              height="600"
              loading="lazy"
            />

            {/* Always-visible short title over image */}
            <div className="mb-card-label">
              {t('modular.standard.title')}
            </div>

            {/* Hover overlay with full text (existing content) */}
            <div className="mb-card-pad">
              <div className="mb-card-kicker">
                {t('modular.standard.kicker')}
              </div>
              <div className="mb-card-title">
                {t('modular.standard.title')}
              </div>
              <p className="mb-card-desc">
                {t('modular.standard.desc')}
              </p>
            </div>
          </a>

          {/* Villa / Office */}
          <a
            className="mb-card"
            href={`${asset('Вила-Офис.pdf')}#page=1`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('modular.villa.aria')}
          >
            <img
              className="mb-card-media"
              src="https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcv/eg/vb"
              alt={t('modular.villa.alt')}
              width="960"
              height="600"
              loading="lazy"
            />

            <div className="mb-card-label">
              {t('modular.villa.title')}
            </div>

            <div className="mb-card-pad">
              <div className="mb-card-kicker">
                {t('modular.villa.kicker')}
              </div>
              <div className="mb-card-title">
                {t('modular.villa.title')}
              </div>
              <p className="mb-card-desc">
                {t('modular.villa.desc')}
              </p>
            </div>
          </a>

          {/* Retail */}
          <a
            className="mb-card"
            href={`${asset('Скосен покрив.pdf')}#page=1`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('modular.retail.aria')}
          >
            <img
              className="mb-card-media"
              src="https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcw/eg/vb"
              alt={t('modular.retail.alt')}
              width="960"
              height="600"
              loading="lazy"
            />

            <div className="mb-card-label">
              {t('modular.retail.title')}
            </div>

            <div className="mb-card-pad">
              <div className="mb-card-kicker">
                {t('modular.retail.kicker')}
              </div>
              <div className="mb-card-title">
                {t('modular.retail.title')}
              </div>
              <p className="mb-card-desc">
                {t('modular.retail.desc')}
              </p>
            </div>
          </a>
        </div>

        <div className="container mb-note">
          <small>{t('modular.pdfNote')}</small>
        </div>
      </section>
    </main>
  )
}

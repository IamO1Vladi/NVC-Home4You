import React from 'react'
import Hero from '../components/Hero.jsx'
import Steps from '../components/Steps.jsx'
import WhyUs from '../components/WhyUs.jsx'
import GlideServices from '../components/GlideServices.jsx'
import ServiceTiles from '../components/ServiceTiles.jsx'
import Testimonials from '../components/Testimonials.jsx'
import { LocalBusinessJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'

export default function HomePage({ locale = 'en', bundle }) {
  const { openOffer, openQuestion } = useModalActions()
  const content = bundle?.home

  if (!content) return null

  return (
    <main>
      <Hero locale={locale} content={content.hero} onOpenOffer={openOffer} onOpenQuestion={openQuestion} />
      <ServiceTiles locale={locale} content={content.serviceTiles} />
      <GlideServices locale={locale} content={content.glideServices} />
      <Steps content={content.steps} />
      <WhyUs content={content.whyUs} />
      <Testimonials locale={locale} content={content.testimonials} />

      <section>
        <div className="container">
          <div className="mt-10 card p-10 center">
            <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,28px)' }}>{content.finalCta.title}</h2>
            <p className="mt-3" style={{ opacity: 0.85 }}>{content.finalCta.desc}</p>
            <div className="row center mt-6" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={openOffer}>{content.finalCta.primaryCta}</button>
              <button className="btn ghost" onClick={openQuestion}>{content.finalCta.secondaryCta}</button>
            </div>
            <div className="mt-6" style={{ opacity: 0.8 }}>
              <div>📞 {content.finalCta.phone}</div>
              <div>✉️ {content.finalCta.email}</div>
            </div>
          </div>
        </div>
      </section>

      <LocalBusinessJSONLD
        url={content.localBusiness.url}
        email={content.localBusiness.email}
        telephone={content.localBusiness.telephone}
      />
    </main>
  )
}

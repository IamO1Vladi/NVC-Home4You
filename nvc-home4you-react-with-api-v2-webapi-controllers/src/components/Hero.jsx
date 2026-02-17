import React from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'
import HeroShowcase from './HeroShowcase.jsx'
import SEO from './SEO.jsx'

export default function Hero({ onOpenOffer, onOpenQuestion }){
  const { t } = useI18n()
  const title = t('hero.title')

  return (
    <section className="hero">
       <SEO
              title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
              description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
              image="../public/logo3"
              url="https://nvc-home4you.eu/"
              hreflangs={[
                { hrefLang:'bg', href:'https://nvc-home4you.eu/' },
                { hrefLang:'en', href:'https://nvc-home4you.eu/' }
              ]}
            />

      <div className="container">
        <div className="hero-grid">
          {/* LEFT — unchanged */}
          <div>
            <motion.h1 style={{fontSize:'clamp(32px,5vw,70px)',lineHeight:1.05,margin:0}}
              initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{duration:.5}}>
              <span dangerouslySetInnerHTML={{__html: title
                .replace('<g>', '<span class=\"grad-text\">')
                .replace('</g>', '</span>')}} />
            </motion.h1>

            <motion.p className="mt-5" style={{maxWidth:640,color:'var(--muted)'}}
              initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:.05, duration:.5}}>
              {t('hero.lead')}
            </motion.p>           

            <div className="row mt-6">
              <motion.button className="btn" onClick={onOpenOffer} whileTap={{scale:.98}}>
                {t('nav.getOffer')}
              </motion.button>
              <motion.button className="btn ghost" onClick={onOpenQuestion} whileTap={{scale:.98}}>
                {t('nav.askQuestion')}
              </motion.button>
            </div>

            <div className="mt-4" style={{opacity:.7}}>{t('brand.motto')}</div>
          </div>

          {/* RIGHT — NEW cinematic image showcase */}
          <div>
            <div className="hero-visual">
              <HeroShowcase
  slides={[
    { src: `https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdg/eg/vb`, alt: 'Modular builds',        to: '/modular-builds'  },
    { src: `https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdf/eg/vb`, alt: 'Modular houses',        to: '/modular-houses'  },
    { src: `https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rde/eg/vb`, alt: 'Steel-structure houses',to: '/steel-houses'    },
    { src: `https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdc/eg/vb`, alt: 'Interiors',             to: '/interiors'       },
    { src: `https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbx/eg/vb`, alt: 'Interiors',             to: '/interiors'       },
    { src: `https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r7/eg/vb`, alt: 'Interiors',             to: '/interiors'       },
    { src: `https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbu/eg/vb`, alt: 'Interiors',             to: '/interiors'       },
  ]}
  durationMs={5600}
  size={560}
/>

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

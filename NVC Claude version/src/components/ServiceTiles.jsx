// The four "what we build" tiles: a photograph seen whole, its title and one line in an
// ink band along the bottom. No hover wipe, no instruction line, no icon: the text sits in
// a solid band so it reads over any photo, and the only hover is a 2px lift. Styles in
// src/style/HomePage.css (.hp-tile*).
import React from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../routes/paths.js'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'

export default function ServiceTiles({ locale = 'en', content }) {
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  if (!content) return null

  return (
    <section className="hp-tiles-section" aria-labelledby="hp-tiles-title">
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <h2 id="hp-tiles-title">{content.heading}</h2>
            {content.subheading ? <p className="hp-sub">{content.subheading}</p> : null}
          </div>
        </div>

        <div className="hp-tiles">
          {content.items.map((item) => (
            <Link
              key={item.key}
              to={paths[item.pathKey]?.[locale] || paths[item.pathKey]?.en || '/'}
              className="hp-tile"
              aria-label={item.title}
            >
              <img
                src={cdnImage(item.img, { width: 1200 })}
                srcSet={cdnSrcSet(item.img, [640, 800, 1200, 1600])}
                sizes="(max-width: 899px) 100vw, (max-width: 1239px) 50vw, 590px"
                alt=""
                onError={imageFallback(fallback)}
                width="1600"
                height="1000"
                loading="lazy"
                decoding="async"
              />
              <div className="hp-tile-cap">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <span className="hp-tile-go">{content.button}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

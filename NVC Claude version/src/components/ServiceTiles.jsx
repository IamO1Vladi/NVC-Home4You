// The four "what we build" tiles: a photograph seen whole, its title and one line in an
// ink band along the bottom. No hover wipe, no instruction line, no icon: the text sits in
// a solid band so it reads over any photo, and the only hover is a 2px lift. Styles in
// src/style/HomePage.css (.hp-tile*).
//
// Each tile's photo is an admin slot ("home-tile-<page>", photoSlotNames.js), changed in
// "Снимки на сайта". While a slot is empty the tile is exactly the content's photo; once the
// owner fills one, his photo shows, falling back to the content's photo and then to the card
// placeholder should it fail to load. The photo stays decorative (alt=""): the title in the
// link says where it goes.
import React from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../routes/paths.js'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'
import { useSlotPhotos } from '../lib/homePhotos.js'
import { tileSlotName } from '../lib/photoSlotNames.js'
import SlotImg from './SlotImg.jsx'

const TILE_WIDTHS = [640, 800, 1200, 1600]

export default function ServiceTiles({ locale = 'en', content }) {
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')
  const photos = useSlotPhotos((content?.items || []).map((item) => tileSlotName(item.key)))

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
              <SlotImg
                admin={photos[tileSlotName(item.key)]}
                adminWidths={TILE_WIDTHS}
                fallbacks={[fallback]}
                src={cdnImage(item.img, { width: 1200 })}
                srcSet={cdnSrcSet(item.img, TILE_WIDTHS)}
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

        {/* For buyers of several units and resellers: the partner page. */}
        {content.partnerLink && paths.partner?.[locale] ? (
          <p className="hp-tiles-more"><Link to={paths.partner[locale]}>{content.partnerLink}</Link></p>
        ) : null}
      </div>
    </section>
  )
}

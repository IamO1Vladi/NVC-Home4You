// The owner's photo of a container delivered to a customer's plot (sent 2026-10-17): the
// default of the containers page's hero (the "page-modular-builds" slot; the owner can replace it
// in "Снимки на сайта") and, in its 16:10 crop, that page's share picture. It was the home page's
// fifth slide for a day: the container stands at the photo's left edge, which the home hero fades
// under the heading from 768px, so slide 5 shows the crane lift instead (shared/aboutMedia.js).
//
// Cut by scripts/media/owner-2026-10-17.mjs from the owner's photo (EXIF and GPS dropped). Both
// crops start at the photo's left edge, where the container stands, and keep the A1 dish and
// its pole on the right out of the frame.
//
// Paths only, no words: the alt text is each content file's. Plain '/'-rooted paths (the app is
// served from the root), so routeMeta.js, which runs in plain Node at build time, can name the
// wide one as the containers page's share picture. Static files have no resizer behind them,
// so each place gets its own srcSet.

/** 16:10, for the containers page's share card (routeMeta.js). */
export const DELIVERED_CONTAINER_WIDE = Object.freeze({
  url: '/delivered/container-lakeside-16x10-1600.webp',
  small: '/delivered/container-lakeside-16x10-800.webp',
  srcSet: '/delivered/container-lakeside-16x10-800.webp 800w, /delivered/container-lakeside-16x10-1600.webp 1600w',
  width: 1600,
  height: 1000,
})

/** 4:3, for the containers page's hero (ProductHero frames 4:3, and wider on a phone). */
export const DELIVERED_CONTAINER = Object.freeze({
  url: '/delivered/container-lakeside-4x3-1200.webp',
  small: '/delivered/container-lakeside-4x3-800.webp',
  srcSet: '/delivered/container-lakeside-4x3-800.webp 800w, /delivered/container-lakeside-4x3-1200.webp 1200w',
  width: 1200,
  height: 900,
})

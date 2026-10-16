// An <img> whose picture the owner can change from the admin panel ("Снимки на сайта").
//
// The page writes its image exactly as it always has — src, srcSet, sizes, alt, width, height,
// loading, onError, whatever it had — and adds the slot's answer as `admin`:
//
//   <SlotImg admin={photos['factory-floor']} adminAlt={…} src={FACTORY_PHOTO.url} alt={…} … />
//
// EMPTY SLOT: THE SAME <img>, TO THE ATTRIBUTE. With `admin` null or undefined (the slot is
// empty, the API failed, or its first answer is still on its way) the props go through
// untouched: no srcset, sizes, onError, style or attribute is added that the page did not
// write. That is the promise of the slots, "an empty place looks exactly like today", and it is
// what keeps every test that pins today's markup true without a change.
//
// FILLED SLOT: the owner's photo through the /api/img resizer (cdnImage, cdnSrcSet), so a
// phone gets a phone-sized file; width and height stay the page's, so the box keeps its
// shape and CSS crops whatever arrives. Three things are the page's own and are NOT reused:
//   - the alt: the page's alt describes the default photo, so the owner's photo gets `adminAlt`
//     (the page computes it with slotAlt; "" for a decorative picture, and "" when not given);
//   - the crop: the page's CSS and style were tuned to the default, so an owner's photo is
//     cropped from the centre, set inline so it beats the stylesheet (`adminPosition` moves it;
//     a slot that needs another, like the team's 50% 30%, says so in photoSlotNames.js);
//   - onError: if the owner's file fails, the image falls back to the page's own default
//     picture (its src) and then to `fallbacks` (e.g. the site's card.svg), through
//     imageFallback, which marks the fallback for the prerender.
import React from 'react'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'

/** The resizer widths an owner's photo is offered in, unless the page asks for others. */
export const SLOT_IMG_WIDTHS = [480, 640, 800, 1200, 1600]

const isUrl = (value) => typeof value === 'string' && value.trim().length > 0

export default function SlotImg({
  admin,
  adminAlt,
  adminWidth = 1200,
  adminWidths = SLOT_IMG_WIDTHS,
  adminSizes,
  adminPosition = '50% 50%',
  fallbacks = [],
  ...img
}) {
  if (!admin || !isUrl(admin.url)) return <img {...img} />

  // The page's srcSet, onError and alt belong to the default photo and are dropped; without an
  // adminAlt the owner's photo gets alt="" rather than a description of a photo it is not.
  // eslint-disable-next-line no-unused-vars
  const { src, srcSet, sizes, onError, style, alt, ...rest } = img
  return (
    <img
      {...rest}
      src={cdnImage(admin.url, { width: adminWidth })}
      srcSet={cdnSrcSet(admin.url, adminWidths)}
      sizes={adminSizes ?? sizes}
      alt={typeof adminAlt === 'string' ? adminAlt : ''}
      style={{ ...style, objectPosition: adminPosition }}
      onError={imageFallback(src, ...(Array.isArray(fallbacks) ? fallbacks : [fallbacks]))}
    />
  )
}

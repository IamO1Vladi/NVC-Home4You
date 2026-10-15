// The interiors page's pictures: the owner's own renovation jobs, and nothing else.
//
// Every file under /interiors/ was cut from the owner's iCloud photos and videos by
// scripts/interiors/clips.mjs (2026-10-15; the cut table and what each shot shows are at the
// top of that script). The bathroom before/after pair is the one the old page already showed,
// which the owner confirmed is NVC's own job. The old page's kitchen pair (an empty room and a
// North-American kitchen) is gone: nobody could say whose kitchen that was.
//
// Paths only, no words: the alt text and captions are the content files', per language, keyed
// by the ids below. InteriorsPage.test.jsx fails if the page draws any picture or clip that is
// not listed here.
//
// Plain '/'-rooted paths (the app is served from the root; brochure.test.js pins that), so
// routeMeta.js, which runs in plain Node at build time, can name the hero photo too.

/** Photos, each in a 1200 and a 600 wide WebP, with the larger one's size. */
export const INTERIORS_PHOTOS = {
  bathBlack: { large: '/interiors/bath-black-1200.webp', small: '/interiors/bath-black-600.webp', width: 1200, height: 1500 },
  kitchen: { large: '/interiors/kitchen-1200.webp', small: '/interiors/kitchen-600.webp', width: 1200, height: 750 },
  kitchenFitting: { large: '/interiors/kitchen-fitting-1200.webp', small: '/interiors/kitchen-fitting-600.webp', width: 1200, height: 1500 },
  kitchenProgress: { large: '/interiors/kitchen-progress-1200.webp', small: '/interiors/kitchen-progress-600.webp', width: 1200, height: 1500 },
  kitchenRun: { large: '/interiors/kitchen-run-1200.webp', small: '/interiors/kitchen-run-600.webp', width: 1200, height: 1500 },
}

/** Short muted loops (640 x 800, H.264), each with its WebP poster. */
export const INTERIORS_CLIPS = {
  bathBlack: { src: '/interiors/clip-bath-black.mp4', poster: '/interiors/clip-bath-black.webp' },
  bathWhite: { src: '/interiors/clip-bath-white.mp4', poster: '/interiors/clip-bath-white.webp' },
}

/**
 * The two before/after pairs. The bathroom's two photos are served by /api/img (resized on
 * request); the kitchen's are the static crops above, during fitting and finished.
 */
export const INTERIORS_PAIRS = {
  bathroom: {
    before: { src: '/api/img/content/bvk4n834b-rc2-eg-vb.webp', width: 1331, height: 2048 },
    after: { src: '/api/img/content/bvk4n834b-rc4-eg-vb.webp', width: 1188, height: 2048 },
  },
  kitchen: {
    before: { src: INTERIORS_PHOTOS.kitchenProgress.large, small: INTERIORS_PHOTOS.kitchenProgress.small, width: 1200, height: 1500 },
    after: { src: INTERIORS_PHOTOS.kitchenRun.large, small: INTERIORS_PHOTOS.kitchenRun.small, width: 1200, height: 1500 },
  },
}

/** A static photo's srcset, its 600 and 1200 wide files (no resizer stands behind /public). */
export const photoSrcSet = (photo) => `${photo.small} 600w, ${photo.large} ${photo.width}w`

/** Every path the page may draw, for the test that keeps stock pictures off it. */
export const INTERIORS_MEDIA_PATHS = [
  ...Object.values(INTERIORS_PHOTOS).flatMap((p) => [p.large, p.small]),
  ...Object.values(INTERIORS_CLIPS).flatMap((c) => [c.src, c.poster]),
  ...Object.values(INTERIORS_PAIRS).flatMap((pair) => [pair.before.src, pair.after.src]),
]

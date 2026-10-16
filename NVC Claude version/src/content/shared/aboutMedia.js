// The About page's two fixed photographs, the files it shows while the admin's "about-hero"
// and "factory-floor" slots are empty, and its factory clip. Paths only, no words: the alt text
// and the clip's caption are the about content's.
//
// They live here rather than in AboutPage.jsx (which still re-exports them, for its tests) so
// the admin panel can show them as the slots' defaults without importing the page.

const BASE = import.meta.env.BASE_URL || '/'

// The owner's crane lift, the delivery page's photo, in its 800 and 1500 wide crops. The share
// picture (routeMeta PAGE_IMAGES.about) is the 1500 one.
export const ABOUT_PHOTO = {
  url: `${BASE}delivery/crane-lift-1500.webp`,
  srcSet: `${BASE}delivery/crane-lift-800.webp 800w, ${BASE}delivery/crane-lift-1500.webp 1500w`,
}

// The hall of "our factory in China", the owner's photo of 2026-10-17 (it replaced the older
// partner/factory-floor.webp); the partner page's process shows it too, at its second step.
// Cut by scripts/media/owner-2026-10-17.mjs at the old file's 1200:891, so the width and height
// stay; `small` is its 600 wide copy (the panel's thumbnail).
export const FACTORY_PHOTO = {
  url: `${BASE}factory/factory-hall-1200.webp`,
  small: `${BASE}factory/factory-hall-600.webp`,
  width: 1200,
  height: 891,
}

// The factory loop, the first step of the About page's "from our factory to your plot" clips:
// a slow pan past stacked sandwich panels in the same hall (640 x 800, muted, no person in it),
// drawn by JourneyClips like the delivery clips beside it.
export const FACTORY_CLIP = {
  src: `${BASE}factory/clip-factory-pan.mp4`,
  poster: `${BASE}factory/clip-factory-pan.webp`,
}

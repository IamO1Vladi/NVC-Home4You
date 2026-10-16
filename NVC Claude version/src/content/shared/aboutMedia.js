// The About page's two fixed photographs, the files it shows while the admin's "about-hero"
// and "factory-floor" slots are empty. Paths only, no words: the alt text is the about content's.
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

// The factory floor the partner page shows, "our factory in China".
export const FACTORY_PHOTO = { url: `${BASE}partner/factory-floor.webp`, width: 1200, height: 891 }

export const paths = {
  home: {
    bg: '/bg',
    en: '/en',
    el: '/el',
  },
  modularBuilds: {
    bg: '/bg/modulni-postroiki',
    en: '/en/modular-builds',
    el: '/el/domikes-kataskeves',
  },
  modularHouses: {
    bg: '/bg/modulni-kysthi',
    en: '/en/modular-houses',
    el: '/el/domika-spitia',
  },
  faq: {
    bg: '/bg/chesto-zadavani-vyprosi',
    en: '/en/faq',
    el: '/el/syxnes-erotiseis',
  },
  about: {
    bg: '/bg/za-nas',
    en: '/en/about',
    el: '/el/sxetika-me-emas',
  },
  steelHouses: {
    bg: '/bg/sglobqemi-kyshti',
    en: '/en/steel-houses',
    el: '/el/metallika-spitia',
  },
  gallery: {
    bg: '/bg/galeriq',
    en: '/en/gallery',
    el: '/el/gkaleri',
  },
  interiors: {
    bg: '/bg/vytreshni-remonti',
    en: '/en/interiors',
    el: '/el/esoterikoi-xoroi',
  },
  delivery: {
    bg: '/bg/dostavka-do-vratata',
    en: '/en/delivery',
    el: '/el/paradosi-sto-spiti',
  },
  logistics: {
     bg: '/bg/mejdunarodna-logistika',
     en: '/en/logistics',
     el: '/el/diethnis-efodiastiki',
  },
  partner: {
   bg: '/bg/stani-partnjor',
   en: '/en/partner',
   el: '/el/ginete-synergatis',
  },
  planner: {
    bg: '/bg/planirane-na-razpredelenie',
    en: '/en/floor-planner',
    el: '/el/sxediasmos-katopsis',
  },
  boxConfigurator: {
    bg: '/bg/konfigurator-box-kyshti',
    en: '/en/box-house-configurator',
    el: '/el/diamorfotis-box-spitiou',
  },
  doors: {
     bg: '/bg/interiorni-vrati',
     en: '/en/internal-doors',
     el: '/el/esoterikes-portes',
  },
  cases: {
     bg: '/bg/kazusi-i-otzivi',
     en: '/en/cases',
     el: '/el/erga-kai-kritikes',
  },
  // REMOVED 2026-08-17: `services` (/uslugi, /services, /ypiresies). A legacy page from
  // early development that nothing linked to. Removing it from here is what drops all three
  // from the sitemap and the prerender list; Program.cs 301s the old URLs to their locale
  // homepage. See ROADMAP-services-removal notes in the commit.
  //
  // Transliterated like every other Bulgarian slug (see the note at the top of this file);
  // the Greek is the readable Latin form of τιμές.
  prices: {
    bg: '/bg/ceni',
    en: '/en/prices',
    el: '/el/times',
  },
  privacy: {
    bg: '/bg/poveritelnost-i-biskvitki',
    en: '/en/privacy-and-cookies',
    el: '/el/aporrito-kai-cookies',
  },
}

function normalizePath(pathname = '/') {
  const clean = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  if (clean !== '/' && clean.endsWith('/')) return clean.slice(0, -1)
  return clean
}

export function getLocaleFromPath(pathname = '/') {
  const path = normalizePath(pathname)
  if (path === '/bg' || path.startsWith('/bg/')) return 'bg'
  if (path === '/en' || path.startsWith('/en/')) return 'en'
  if (path === '/el' || path.startsWith('/el/')) return 'el'
  return null
}

export function getPageKeyByPath(pathname = '/') {
  const path = normalizePath(pathname)
  if (path === '/') return 'home'

  for (const [key, localized] of Object.entries(paths)) {
    const variants = Object.values(localized || {})
    if (variants.some((variant) => normalizePath(variant) === path)) return key
  }

  return null
}

export function getLocalizedPath(pathname = '/', locale = 'en') {
  const path = normalizePath(pathname)
  if (path === '/') return paths.home[locale] || '/'

  const pageKey = getPageKeyByPath(path)
  if (pageKey && paths[pageKey] && paths[pageKey][locale]) {
    return paths[pageKey][locale]
  }

  return path
}

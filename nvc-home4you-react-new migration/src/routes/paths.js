export const paths = {
  home: {
    bg: '/bg',
    en: '/en',
  },
  modularBuilds: {
    bg: '/bg/modulni-postroiki',
    en: '/en/modular-builds',
  },
  modularHouses: {
    bg: '/bg/modulni-kysthi',
    en: '/en/modular-houses',
  },
  faq: {
    bg: '/bg/chesto-zadavani-vyprosi',
    en: '/en/faq',
  },
  about: {
    bg: '/bg/za-nas',
    en: '/en/about',
  },
  steelHouses: {
    bg: '/bg/sglobqemi-kyshti',
    en: '/en/steel-houses',
  },
  gallery: {
    bg: '/bg/galeriq',
    en: '/en/gallery',
  },
  interiors: {
    bg: '/bg/vytreshni-remonti',
    en: '/en/interiors',
  },
  delivery: {
    bg: '/bg/dostavka-do-vratata',
    en: '/en/delivery',
  },
  logistics: {
     bg: '/bg/mejdunarodna-logistika',
     en: '/en/logistics',
  },
  partner: {
   bg: '/bg/stani-partnjor',
   en: '/en/partner',
  },
  planner: {
    bg: '/bg/planirane-na-razpredelenie',
    en: '/en/floor-planner',
  },
  boxConfigurator: {
    bg: '/bg/konfigurator-box-kyshti',
    en: '/en/box-house-configurator',
  },
  doors: {
     bg: '/bg/interiorni-vrati',
     en: '/en/internal-doors',
  },
  cases: {
     bg: '/bg/kazusi-i-otzivi',
     en: '/en/cases',
  },
  services: {
    bg: '/uslugi',
    en: '/services',
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

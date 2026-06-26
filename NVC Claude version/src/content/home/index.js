import bg from '../bg/home.js'
import en from '../en/home.js'
import el from '../el/home.js'

export const homeContentByLocale = { bg, en, el }

export function getHomeContent(locale = 'en') {
  return homeContentByLocale[locale] || en
}

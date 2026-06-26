import bg from '../bg/home.js'
import en from '../en/home.js'

export const homeContentByLocale = { bg, en }

export function getHomeContent(locale = 'en') {
  return homeContentByLocale[locale] || en
}

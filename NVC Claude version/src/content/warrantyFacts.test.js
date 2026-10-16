import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { WARRANTY_YEARS } from './shared/warranty.js'
import { hubQuestions } from '../lib/faqHub.js'

// The owner's warranty of 2026-10-15 (the annex to our Box-house sales contract, the same
// terms for containers), held to every file that words it: the years live in
// shared/warranty.js alone, so no content file types "15 години", "15 years" or "15 χρόνια" of
// its own, and nothing about the steel-frame houses, which are quoted per project, claims a
// warranty at all.

// Every content module in the three languages, tests excluded, evaluated.
const MODULES = import.meta.glob(['./{bg,en,el}/*.js', '!./**/*.test.js'], { eager: true })
const LOCALES = ['bg', 'en', 'el']

// The same files and the pages and components that word copy, as source text: a figure
// interpolated from the module is "${W.structure}" there, a typed one is a digit.
const SOURCES = import.meta.glob(
  ['./**/*.js', '../i18n/*.js', '../pages/*.jsx', '../components/**/*.jsx', '!./**/*.test.js', '!../**/*.test.jsx', '!./shared/warranty.js'],
  { eager: true, query: '?raw', import: 'default' },
)

const WARRANTY = /гаранц|warrant|εγγύησ/i
// A count of years, in the words the copy uses for one: "15 години", "15 г.", "15 years",
// "15 χρόνια". Not preceded by a digit, so "2026 г." is a date, not a two-year term.
const YEARS_WORD = /\s*(години|година|г\.|years?|yrs|χρόνια|χρόνο|έτη|έτος)/.source
const yearsOf = (n) => new RegExp(`(?<![\\d.,])${n}${YEARS_WORD}`, 'i')
const ANY_YEARS = new RegExp(`(?<![\\d.,])(\\d+)${YEARS_WORD}`, 'gi')

const content = (locale, name) => MODULES[`./${locale}/${name}.js`].default

/** Every [dotted path, string] in a value. */
function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

describe('warranty facts across the content', () => {
  it('reads the files it checks', () => {
    // A glob that silently matched nothing would make the checks below pass on nothing.
    for (const locale of LOCALES) {
      for (const name of ['faq', 'partner', 'modularBuilds', 'modularHouses', 'steelHouses']) {
        expect(MODULES[`./${locale}/${name}.js`], `${locale}/${name}.js`).toBeDefined()
        expect(SOURCES[`./${locale}/${name}.js`], `${locale}/${name}.js source`).toBeDefined()
      }
    }
    expect(SOURCES['../i18n/translations.js']).toBeDefined()
    expect(SOURCES['../pages/PartnerPage.jsx']).toBeDefined()
    expect(SOURCES['./shared/warranty.js']).toBeUndefined()
  })

  it('knows a typed figure when it sees one', () => {
    for (const typed of ['15 години', 'конструкция 15 г.', '15 years', '15 χρόνια', 'санитария 2 г.']) {
      expect(Object.values(WARRANTY_YEARS).some((n) => yearsOf(n).test(typed)), typed).toBe(true)
    }
    for (const fine of ['2026 г.', '16 години', '${W.structure} години', '{years} years']) {
      expect(Object.values(WARRANTY_YEARS).some((n) => yearsOf(n).test(fine)), fine).toBe(false)
    }
  })

  it('types none of the warranty\'s years outside warranty.js', () => {
    const typed = []
    for (const [file, text] of Object.entries(SOURCES)) {
      // A written-out no-break space ("{years} години") is a space, not the digits "00a0".
      text.replaceAll('\\u00a0', ' ').split('\n').forEach((line, i) => {
        // The module's own figures, anywhere; any count of years, on a line about the warranty.
        const own = Object.values(WARRANTY_YEARS).some((n) => yearsOf(n).test(line))
        const near = WARRANTY.test(line) && new RegExp(ANY_YEARS.source, 'i').test(line)
        if (own || near) typed.push(`${file}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(typed).toEqual([])
  })

  it.each(LOCALES)('%s: the FAQ answer gives every year from the module, and no other', (locale) => {
    // The hub's own questions, filled as the page shows them; the warranty is one of them, worded
    // with the module's placeholders as the partner page's answer is.
    const asked = hubQuestions(content(locale, 'faq'), locale).filter((item) => WARRANTY.test(item.question))
    expect(asked).toHaveLength(1)
    expect(asked[0].id).toBe('warranty')
    const words = content(locale, 'faq').items.find((item) => item.id === 'warranty').a
    for (const key of ['structureYears', 'panelYears', 'joineryYears', 'sanitaryYears']) expect(words).toContain(`{${key}}`)
    const a = asked[0].answer
    for (const n of Object.values(WARRANTY_YEARS)) expect(a).toMatch(yearsOf(n))
    const counts = [...a.matchAll(ANY_YEARS)].map((m) => Number(m[1]))
    expect(counts.length).toBe(Object.keys(WARRANTY_YEARS).length)
    for (const n of counts) expect(Object.values(WARRANTY_YEARS)).toContain(n)
  })

  it.each(LOCALES)('%s: the partner page and the product pages word the years as placeholders', (locale) => {
    const partner = content(locale, 'partner')
    const row = partner.terms.rows.find((r) => r.key === 'warranty')
    const question = partner.faq.items.find((item) => WARRANTY.test(item.q))
    for (const text of [row.text, question.a]) {
      for (const key of ['structureYears', 'panelYears', 'joineryYears', 'sanitaryYears']) expect(text).toContain(`{${key}}`)
    }
    for (const name of ['modularBuilds', 'modularHouses']) {
      const { rows } = content(locale, name).warranty
      expect(rows.map((r) => r.key)).toEqual(Object.keys(WARRANTY_YEARS))
      for (const r of rows) expect(r.text).toContain('{years}')
    }
  })

  it.each(LOCALES)('%s: claims no warranty term for the steel-frame houses, only that it depends on the project', (locale) => {
    // Their own page says of one only what the owner said (2026-10-17): it depends on the
    // project, like the timeline. One question, no figure and no term.
    const DEPENDS = { bg: /зависят от проекта/, en: /depend on the project/, el: /εξαρτώνται από τη μελέτη/ }[locale]
    const steel = content(locale, 'steelHouses')
    const asked = steel.faq.items.find((item) => item.id === 'steel-warranty-time')
    expect(asked.a).toMatch(DEPENDS)
    expect(`${asked.q} ${asked.a}`).not.toMatch(/\d|\{\w+\}/)
    // (Its id, "steel-warranty-time", is a link target, not words.)
    expect(strings(steel).filter(([at, text]) => !at.endsWith('.id') && WARRANTY.test(text))).toEqual([['faq.items[3].q', asked.q]])
    expect(steel.faq.items[3]).toBe(asked)
    // And no other warranty sentence names them; "steel structure" alone is a container's or a
    // Box house's frame, so the check is for the names the site gives those houses.
    const STEEL_HOUSE = { bg: /сглобяем|по проект/i, en: /steel-frame|to a plan|to your plan/i, el: /μεταλλικά σπίτια|σε σχέδιο/i }[locale]
    const partnerRow = content(locale, 'partner').terms.rows.find((r) => r.key === 'warranty')
    const warrantyStrings = [
      ...Object.entries(MODULES)
        .filter(([file]) => file.startsWith(`./${locale}/`))
        .flatMap(([file, mod]) => strings(mod.default, file))
        .filter(([at, text]) => at.includes('.warranty.') || WARRANTY.test(text)),
      ['partner.terms.warranty', partnerRow.text],
    ]
    // The two product blocks (heading, lead, rows, conditions, excluded), the FAQ and the
    // partner page's row and question at the least.
    expect(warrantyStrings.length).toBeGreaterThan(12)
    const theQuestion = `./${locale}/steelHouses.js.faq.items[3].q`
    expect(warrantyStrings.filter(([at, text]) => at !== theQuestion && STEEL_HOUSE.test(text))).toEqual([])
  })
})

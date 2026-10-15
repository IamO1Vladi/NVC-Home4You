// The partner page's enquiry form, at #zapitvane: one form on the page instead of the generic
// pop-up, which asks a company for nothing but a name and free text.
//
// WHAT IT SENDS is the site's ordinary offer (POST /api/offer, the fields App.jsx's offer form
// sends) plus one trailing "partner" block, the contract the server checks value by value:
//   { role, sector?, products?, quantity, timing?, country, region?, company?, vatId?, logistics? }
// Every choice is one of the fixed lists below (the server holds the same lists and answers an
// unknown value with a 400); the three texts are trimmed and cut to the server's lengths; a key
// with nothing in it is left out rather than sent empty. The server writes the block as one
// Bulgarian line in front of the visitor's own message, so staff read it in Запитвания and in
// the sales email whatever language the visitor wrote in. Phone is required here, unlike the
// retail form: a company enquiry gets a call.
//
// HOW IT SENDS is the doors page's way (InternalDoorsPage.jsx): fire-and-forget through
// submitInBackground, whose banner reports it and retries a dead connection, with the honeypot
// and the representative's slug (#38). Analytics only once the server has the enquiry, and
// only what kind of enquiry it was: never a name, a number, a company or the message.
//
// The page's door buttons preset the role through `preset` ({ role, n }: a new n re-applies it
// even when the role is the same). Validation is the component's own (noValidate), so a chip
// group gets the same message and focus as a text field in every browser.
import React, { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import HoneypotField from '../HoneypotField.jsx'
import { submitInBackground } from '../../lib/backgroundSubmit.js'
import { loadRep } from '../../lib/repAttribution.js'
import { trackEvent } from '../../lib/analytics.js'
import { getHomeContent } from '../../content/home/index.js'
import { LEAD_TIMES } from '../../content/shared/deliveryRates.js'
import { PARTNER_MIN_UNITS } from '../../content/shared/partnerTerms.js'
import { paths } from '../../routes/paths.js'
import '../../style/PartnerEnquiry.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// The contract's lists, in the order the form shows them. The server keeps the same ones.
export const ROLES = ['reseller', 'ownSite', 'other']
export const SECTORS = ['glamping', 'hotel', 'construction', 'farm', 'investor', 'shop', 'realEstate', 'other']
export const PRODUCTS = ['container', 'box37', 'box58', 'box73', 'steel']
export const QUANTITIES = ['2-5', '6-10', '11-25', '25+']
export const TIMINGS = ['month', '1-3m', '3-6m', 'season', 'exploring']
export const COUNTRIES = ['BG', 'GR', 'MK', 'RO', 'EU', 'nonEU']
export const LOGISTICS = ['ours', 'own']
export const LIMITS = { region: 80, company: 120, vatId: 30 }

const BOX_PRODUCTS = new Set(['box37', 'box58', 'box73'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fill = (pattern, values) => String(pattern ?? '').replace(/\{(\w+)\}/g, (m, key) => (values[key] == null ? m : String(values[key])))
const clean = (value, max) => {
  const text = String(value ?? '').trim()
  return max ? text.slice(0, max) : text
}

/** The partner block, with only the keys that hold something, each one from its list. */
export function partnerBlock(choices, texts = {}) {
  const pick = (value, list) => (list.includes(value) ? value : undefined)
  const block = {
    role: pick(choices.role, ROLES),
    sector: pick(choices.sector, SECTORS),
    products: PRODUCTS.filter((p) => (choices.products || []).includes(p)),
    quantity: pick(choices.quantity, QUANTITIES),
    timing: pick(choices.timing, TIMINGS),
    country: pick(choices.country, COUNTRIES),
    region: clean(texts.region, LIMITS.region),
    company: clean(texts.company, LIMITS.company),
    vatId: clean(texts.vatId, LIMITS.vatId),
    logistics: pick(choices.logistics, LOGISTICS),
  }
  if (!block.products.length) delete block.products
  for (const key of Object.keys(block)) {
    if (block[key] === undefined || block[key] === '') delete block[key]
  }
  return block
}

/** The fields still missing, in the order the form shows them. */
export function missingFields(choices, texts) {
  const missing = []
  if (!ROLES.includes(choices.role)) missing.push('role')
  if (!QUANTITIES.includes(choices.quantity)) missing.push('quantity')
  if (!COUNTRIES.includes(choices.country)) missing.push('country')
  if (!clean(texts.name)) missing.push('name')
  if (!clean(texts.phone)) missing.push('phone')
  if (!EMAIL_RE.test(clean(texts.email))) missing.push('email')
  return missing
}

const EMPTY = { role: '', sector: '', products: [], quantity: '', timing: '', country: '', logistics: '' }

function Chips({ idBase, name, legend, options, keys, value, onChange, required, error, hint, type = 'radio', optional }) {
  const errorId = `${idBase}-error`
  const hintId = `${idBase}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <fieldset className="pe-group" aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined}>
      <legend className="pe-label">
        {legend}
        {required ? <span aria-hidden="true"> *</span> : null}
        {optional ? <span className="pe-optional"> ({optional})</span> : null}
      </legend>
      <div className="pe-chips">
        {keys.map((key) => {
          const checked = type === 'radio' ? value === key : (value || []).includes(key)
          return (
            <label key={key} className="pe-chip">
              <input
                type={type}
                name={name}
                value={key}
                checked={checked}
                required={required && type === 'radio' ? true : undefined}
                onChange={() => onChange(key)}
              />
              <span>{options[key]}</span>
            </label>
          )
        })}
      </div>
      {hint ? <p className="pe-hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="pe-error" id={errorId}>{error}</p> : null}
    </fieldset>
  )
}

function Field({ id, label, required, optional, error, children }) {
  return (
    <div className="pe-field">
      <label className="pe-label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {optional ? <span className="pe-optional"> ({optional})</span> : null}
      </label>
      {children}
      {error ? <p className="pe-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  )
}

/**
 * @param locale   'bg' | 'en' | 'el'
 * @param content  the page content's `form` block
 * @param preset   { role, n } from a door button, or null
 * @param id       the section id the page links to (#zapitvane)
 */
export default function PartnerEnquiry({ locale = 'bg', content, preset = null, id = 'zapitvane', headingRef }) {
  const c = content
  const uid = useId().replace(/:/g, '')
  const [choices, setChoices] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  // A door button sets the role, and clears the role's error if it had one.
  useEffect(() => {
    if (!preset?.role || !ROLES.includes(preset.role)) return
    setChoices((prev) => ({ ...prev, role: preset.role }))
    setErrors((prev) => (prev.role ? { ...prev, role: undefined } : prev))
  }, [preset?.role, preset?.n])

  if (!c) return null

  const thresholds = { containerMin: PARTNER_MIN_UNITS.container, boxMin: PARTNER_MIN_UNITS.box }
  const lead = { production: LEAD_TIMES.boxProductionDays, months: LEAD_TIMES.boxToAddressMonths }
  const boxTooSoon = choices.timing === 'month' && choices.products.some((p) => BOX_PRODUCTS.has(p))
  const fid = (name) => `pe-${uid}-${name}`

  const choose = (key) => (value) => {
    setChoices((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }
  const toggleProduct = (value) => setChoices((prev) => ({
    ...prev,
    products: prev.products.includes(value) ? prev.products.filter((p) => p !== value) : [...prev.products, value],
  }))
  const clearError = (key) => () => { if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined })) }

  const onSubmit = (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const texts = Object.fromEntries(['name', 'phone', 'email', 'message', 'region', 'company', 'vatId'].map((k) => [k, fd.get(k) || '']))

    const missing = missingFields(choices, texts)
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((key) => [key, true])))
      // The first one the visitor has to fix: a chip group's first chip, or the field.
      const first = missing[0]
      const target = form.querySelector(`[name="${first}"]`)
      target?.focus?.()
      return
    }

    const partner = partnerBlock(choices, texts)
    const payload = {
      name: clean(texts.name),
      email: clean(texts.email),
      phone: clean(texts.phone),
      project: clean(texts.message),
      modelId: '',
      locale,
      rep: loadRep() || '',
      website: fd.get('website') || '',
      partner,
    }

    // Captured now, from the block: what kind of enquiry, never who sent it.
    const analytics = { role: partner.role, quantity: partner.quantity, rep: payload.rep }
    const ui = getHomeContent(locale)?.common || {}

    submitInBackground({
      url: `${API_BASE}/api/offer`,
      payload,
      labels: {
        sending: ui.banner?.sending,
        retrying: ui.banner?.retrying,
        success: ui.toast?.offerSuccess,
        error: ui.toast?.offerError,
        retry: ui.banner?.retry,
        close: ui.close,
      },
      onSuccess: () => {
        trackEvent('request_quote_success', {
          form_type: 'partner',
          lead_source: 'partner-page',
          ...analytics,
        })
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
          window.fbq('track', 'Lead', { content_name: 'Partner enquiry', content_category: 'Partner form', form_type: 'partner' })
        }
      },
    })

    form.reset()
    setChoices(EMPTY)
    setErrors({})
  }

  const err = (key, text) => (errors[key] ? text : null)
  const opt = c.optional
  const privacyPath = paths.privacy[locale] || paths.privacy.en

  return (
    <section className="pe" id={id} aria-labelledby={`${id}-title`}>
      <div className="hp-container">
        <div className="hp-card pe-card">
          <div className="pe-head">
            <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{c.heading}</h2>
            <p className="hp-sub">{c.sub}</p>
          </div>

          <form className="pe-form" onSubmit={onSubmit} noValidate>
            {Object.values(errors).some(Boolean) ? (
              <p className="pe-error pe-summary" role="alert">{c.invalid}</p>
            ) : null}

            <Chips
              idBase={fid('role')}
              name="role"
              legend={c.role.legend}
              options={c.role.options}
              keys={ROLES}
              value={choices.role}
              onChange={choose('role')}
              required
              error={err('role', c.role.error)}
            />

            <div className="pe-row">
              <Field id={fid('sector')} label={c.sector.label} optional={opt}>
                <select id={fid('sector')} name="sector" value={choices.sector} onChange={(e) => choose('sector')(e.target.value)}>
                  <option value="">{c.sector.placeholder}</option>
                  {SECTORS.map((key) => <option key={key} value={key}>{c.sector.options[key]}</option>)}
                </select>
              </Field>
              <Field id={fid('timing')} label={c.timing.label} optional={opt}>
                <select id={fid('timing')} name="timing" value={choices.timing} onChange={(e) => choose('timing')(e.target.value)}>
                  <option value="">{c.timing.placeholder}</option>
                  {TIMINGS.map((key) => <option key={key} value={key}>{c.timing.options[key]}</option>)}
                </select>
              </Field>
            </div>

            <Chips
              idBase={fid('products')}
              type="checkbox"
              name="products"
              legend={c.products.legend}
              options={c.products.options}
              keys={PRODUCTS}
              value={choices.products}
              onChange={toggleProduct}
              optional={opt}
            />

            {boxTooSoon ? <p className="pe-note" role="status">{fill(c.boxNote, lead)}</p> : null}

            <Chips
              idBase={fid('quantity')}
              name="quantity"
              legend={c.quantity.legend}
              options={c.quantity.options}
              keys={QUANTITIES}
              value={choices.quantity}
              onChange={choose('quantity')}
              required
              hint={fill(c.quantity.hint, thresholds)}
              error={err('quantity', c.quantity.error)}
            />

            <Chips
              idBase={fid('logistics')}
              name="logistics"
              legend={c.logistics.legend}
              options={c.logistics.options}
              keys={LOGISTICS}
              value={choices.logistics}
              onChange={choose('logistics')}
              optional={opt}
            />

            <div className="pe-row">
              <Field id={fid('country')} label={c.country.label} required error={err('country', c.country.error)}>
                <select
                  id={fid('country')}
                  name="country"
                  required
                  value={choices.country}
                  onChange={(e) => choose('country')(e.target.value)}
                  aria-invalid={errors.country ? 'true' : undefined}
                  aria-describedby={errors.country ? `${fid('country')}-error` : undefined}
                >
                  <option value="">{c.country.placeholder}</option>
                  {COUNTRIES.map((key) => <option key={key} value={key}>{c.country.options[key]}</option>)}
                </select>
              </Field>
              <Field id={fid('region')} label={c.region} optional={opt}>
                <input id={fid('region')} name="region" maxLength={LIMITS.region} autoComplete="address-level2" />
              </Field>
            </div>

            <div className="pe-row">
              <Field id={fid('company')} label={c.company} optional={opt}>
                <input id={fid('company')} name="company" maxLength={LIMITS.company} autoComplete="organization" />
              </Field>
              <Field id={fid('vatId')} label={c.vatId} optional={opt}>
                <input id={fid('vatId')} name="vatId" maxLength={LIMITS.vatId} autoComplete="off" />
              </Field>
            </div>

            <div className="pe-row pe-row--3">
              {['name', 'phone', 'email'].map((key) => (
                <Field key={key} id={fid(key)} label={c[key].label} required error={err(key, c[key].error)}>
                  <input
                    id={fid(key)}
                    name={key}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                    autoComplete={key === 'phone' ? 'tel' : key}
                    required
                    onInput={clearError(key)}
                    aria-invalid={errors[key] ? 'true' : undefined}
                    aria-describedby={errors[key] ? `${fid(key)}-error` : undefined}
                  />
                </Field>
              ))}
            </div>

            <Field id={fid('message')} label={c.message.label} optional={opt}>
              <textarea id={fid('message')} name="message" rows={4} placeholder={c.message.placeholder} />
            </Field>

            <HoneypotField />

            <div className="pe-foot">
              <button type="submit" className="hp-btn">{c.submit}</button>
              <p className="pe-privacy">
                {c.privacy} <Link to={privacyPath}>{c.privacyLink}</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

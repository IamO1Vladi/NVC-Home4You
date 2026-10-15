// The interiors page's enquiry form, at #zapitvane: "book a free site visit".
//
// WHAT IT SENDS is the site's ordinary offer (POST /api/offer) through sendOffer(), with
// origin 'interiors', so the server writes "Запитване за ремонт" above the message, tags the
// sales mail "[Ремонт]" and, on promotion, stamps the lead's Source (EnquiryOrigin in the
// API). Recipients stay the general inbox. The visitor's choices travel as plain text in
// `project`, one line per answer, then a blank line and the visitor's own words, IN THE PAGE'S
// LANGUAGE, as the doors page writes its message: the server mails `project` back to the
// visitor under "Here's a copy of what you sent us" in their own language, so an English or
// Greek visitor must not get a Bulgarian copy. Staff still know what it is from the server's
// Bulgarian "Запитване за ремонт" line and the "[Ремонт]" tag. On the Bulgarian page the
// lines are STAFF_LINES:
//
//   Услуга: Баня
//   Работи: Къртене и демонтаж, ВиК, Плочки
//   Материали: от NVC
//   Населено място: Благоевград
//   Кога: Възможно най-скоро
//
//   <message>
//
// On the English and Greek pages the labels are the content's form.summary and the answers
// are the form's own words ("Service: Bathroom", "Materials: Please supply them"). A line
// with nothing chosen is left out. Required: what is renovated, the town, name, phone
// (a site visit is arranged by phone) and email (the offer endpoint requires one).
//
// HOW IT SENDS is the partner form's way: fire-and-forget through submitInBackground, whose
// banner reports it and retries a dead connection, with the honeypot and the representative's
// slug. Analytics only once the server has the enquiry, and only what was asked for: never a
// name, a number, a town or the message. The look is the partner form's (PartnerEnquiry.css,
// pe-*), so the two in-page forms read as one site.
import React, { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import HoneypotField from '../HoneypotField.jsx'
import { sendOffer } from '../../lib/sendOffer.js'
import { trackEvent } from '../../lib/analytics.js'
import { getHomeContent } from '../../content/home/index.js'
import { paths } from '../../routes/paths.js'
import '../../style/PartnerEnquiry.css'

export const INTERIORS_ORIGIN = 'interiors'
export const INTERIORS_LEAD_SOURCE = 'interiors-page'

// The form's fixed lists, in the order it shows them. WORKS are the page's works grid.
export const SERVICES = ['bathroom', 'kitchen', 'other']
export const WORKS = ['demolition', 'plumbing', 'electrics', 'tiling', 'plasterboard', 'painting', 'flooring', 'kitchenFitting']
export const MATERIALS = ['ours', 'yours', 'unsure']
export const TIMINGS = ['asap', 'months', 'later', 'exploring']
export const LIMITS = { town: 80 }

// The Bulgarian page's summary lines: what staff read in Запитвания and in the mail.
export const STAFF_LINES = {
  service: { label: 'Услуга', options: { bathroom: 'Баня', kitchen: 'Кухня', other: 'Друго' } },
  works: {
    label: 'Работи',
    options: {
      demolition: 'Къртене и демонтаж',
      plumbing: 'ВиК',
      electrics: 'Електро',
      tiling: 'Плочки',
      plasterboard: 'Гипсокартон',
      painting: 'Боядисване',
      flooring: 'Подови настилки',
      kitchenFitting: 'Монтаж на кухня',
    },
  },
  materials: { label: 'Материали', options: { ours: 'от NVC', yours: 'осигурява клиентът', unsure: 'още не знае' } },
  town: { label: 'Населено място' },
  timing: { label: 'Кога', options: { asap: 'Възможно най-скоро', months: 'В следващите няколко месеца', later: 'По-нататък', exploring: 'Още проучва' } },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clean = (value, max) => {
  const text = String(value ?? '').trim()
  return max ? text.slice(0, max) : text
}

/**
 * The summary's labels and answers for a page: STAFF_LINES in Bulgarian, otherwise the page's
 * own words (form.summary's labels; the form's options and the works grid's titles).
 */
export function projectLabels(locale, content, workLabels = {}) {
  const s = content?.summary
  if (locale === 'bg' || !s) return STAFF_LINES
  return {
    service: { label: s.service, options: content.service.options },
    works: { label: s.works, options: workLabels },
    materials: { label: s.materials, options: content.materials.options },
    town: { label: s.town },
    timing: { label: s.timing, options: content.timing.options },
  }
}

/** The message: one line per answer given, then the visitor's words (STAFF_LINES by default). */
export function composeProject(choices, texts = {}, labels = STAFF_LINES) {
  const L = labels
  const lines = []
  if (SERVICES.includes(choices.service)) lines.push(`${L.service.label}: ${L.service.options[choices.service]}`)
  const works = WORKS.filter((w) => (choices.works || []).includes(w))
  if (works.length) lines.push(`${L.works.label}: ${works.map((w) => L.works.options[w]).join(', ')}`)
  if (MATERIALS.includes(choices.materials)) lines.push(`${L.materials.label}: ${L.materials.options[choices.materials]}`)
  const town = clean(texts.town, LIMITS.town)
  if (town) lines.push(`${L.town.label}: ${town}`)
  if (TIMINGS.includes(choices.timing)) lines.push(`${L.timing.label}: ${L.timing.options[choices.timing]}`)
  const message = clean(texts.message)
  return message ? `${lines.join('\n')}\n\n${message}` : lines.join('\n')
}

/** The fields still missing, in the order the form shows them. */
export function missingFields(choices, texts) {
  const missing = []
  if (!SERVICES.includes(choices.service)) missing.push('service')
  if (!clean(texts.town)) missing.push('town')
  if (!clean(texts.name)) missing.push('name')
  if (!clean(texts.phone)) missing.push('phone')
  if (!EMAIL_RE.test(clean(texts.email))) missing.push('email')
  return missing
}

const EMPTY = { service: '', works: [], materials: '', timing: '' }

function Chips({ idBase, name, legend, options, keys, value, onChange, required, error, hint, type = 'radio', optional }) {
  const errorId = `${idBase}-error`
  const hintId = `${idBase}-hint`
  return (
    // aria-invalid is not supported on a group (ARIA 1.2), so the error state and its message
    // go on each radio, where a screen reader announces them as the radio is reached.
    <fieldset className="pe-group" aria-describedby={hint ? hintId : undefined}>
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
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
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
 * @param locale      'bg' | 'en' | 'el'
 * @param content     the page content's `form` block
 * @param workLabels  { [work key]: label } in the page's language (the works grid's titles)
 * @param id          the section id the page links to (#zapitvane)
 * @param headingRef  the h2, which the page focuses when a button scrolls here
 */
export default function InteriorsEnquiry({ locale = 'bg', content, workLabels = {}, id = 'zapitvane', headingRef }) {
  const c = content
  const uid = useId().replace(/:/g, '')
  const [choices, setChoices] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  if (!c) return null

  const fid = (name) => `ie-${uid}-${name}`
  const choose = (key) => (value) => {
    setChoices((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }
  const toggleWork = (value) => setChoices((prev) => ({
    ...prev,
    works: prev.works.includes(value) ? prev.works.filter((w) => w !== value) : [...prev.works, value],
  }))
  const clearError = (key) => () => { if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined })) }

  const onSubmit = (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const texts = Object.fromEntries(['name', 'phone', 'email', 'message', 'town'].map((k) => [k, fd.get(k) || '']))

    const missing = missingFields(choices, texts)
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((key) => [key, true])))
      form.querySelector(`[name="${missing[0]}"]`)?.focus?.()
      return
    }

    // Captured now: what was asked for, never who asked.
    const analytics = { service: choices.service, works: choices.works.length }
    const ui = getHomeContent(locale)?.common || {}

    sendOffer({
      name: texts.name,
      email: texts.email,
      phone: texts.phone,
      project: composeProject(choices, texts, projectLabels(locale, c, workLabels)),
      locale,
      origin: INTERIORS_ORIGIN,
      website: fd.get('website') || '',
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
          form_type: 'interiors',
          lead_source: INTERIORS_LEAD_SOURCE,
          ...analytics,
        })
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
          window.fbq('track', 'Lead', { content_name: 'Interiors enquiry', content_category: 'Interiors form', form_type: 'interiors' })
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
    <section className="pe ir-form" id={id} aria-labelledby={`${id}-title`}>
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
              idBase={fid('service')}
              name="service"
              legend={c.service.legend}
              options={c.service.options}
              keys={SERVICES}
              value={choices.service}
              onChange={choose('service')}
              required
              error={err('service', c.service.error)}
            />

            <Chips
              idBase={fid('works')}
              type="checkbox"
              name="works"
              legend={c.works.legend}
              options={workLabels}
              keys={WORKS.filter((key) => workLabels[key])}
              value={choices.works}
              onChange={toggleWork}
              optional={opt}
              hint={c.works.hint}
            />

            <Chips
              idBase={fid('materials')}
              name="materials"
              legend={c.materials.legend}
              options={c.materials.options}
              keys={MATERIALS}
              value={choices.materials}
              onChange={choose('materials')}
              optional={opt}
            />

            <div className="pe-row">
              <Field id={fid('town')} label={c.town.label} required error={err('town', c.town.error)}>
                <input
                  id={fid('town')}
                  name="town"
                  maxLength={LIMITS.town}
                  autoComplete="address-level2"
                  required
                  onInput={clearError('town')}
                  aria-invalid={errors.town ? 'true' : undefined}
                  aria-describedby={errors.town ? `${fid('town')}-error` : undefined}
                />
              </Field>
              <Field id={fid('timing')} label={c.timing.label} optional={opt}>
                <select id={fid('timing')} name="timing" value={choices.timing} onChange={(e) => choose('timing')(e.target.value)}>
                  <option value="">{c.timing.placeholder}</option>
                  {TIMINGS.map((key) => <option key={key} value={key}>{c.timing.options[key]}</option>)}
                </select>
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

// The doors page's enquiry form (#zapitvane): name, phone, email and the message, which the
// builder, a sliding-door style or the wall panels' button fills in and the visitor can edit.
//
// It sends the site's ordinary offer through sendOffer with origin 'doors', so staff read
// "Запитване за врати" above the visitor's words, the sales mail is tagged "[Врати]" and the
// lead goes to the general inbox like every offer (EnquiryOrigin in the API). Fire-and-forget:
// the banner reports the request and retries a dead connection; the form clears at once.
// Analytics only once the server has the enquiry, and only that it was a doors enquiry.
import React, { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import HoneypotField from '../HoneypotField.jsx'
import { sendOffer } from '../../lib/sendOffer.js'
import { trackEvent } from '../../lib/analytics.js'
import { getHomeContent } from '../../content/home/index.js'
import { paths } from '../../routes/paths.js'

export const DOORS_ORIGIN = 'doors'
export const DOORS_LEAD_SOURCE = 'doors-page'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param locale      'bg' | 'en' | 'el'
 * @param content     the page content's `form` block
 * @param message     the message text (controlled by the page)
 * @param onMessage   (text) => void
 * @param filled      true once the builder has written the message: shows the "your choice is
 *                    in the message" line with a link back to the builder
 * @param headingRef  the heading, focused when a button brings the visitor here
 */
export default function DoorsEnquiry({ locale = 'bg', content, message, onMessage, filled = false, headingRef, id = 'zapitvane', builderId = 'izbor' }) {
  const c = content
  const uid = useId().replace(/:/g, '')
  const [errors, setErrors] = useState({})
  if (!c) return null
  const fid = (key) => `de-${uid}-${key}`

  const onSubmit = (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const texts = Object.fromEntries(['name', 'phone', 'email'].map((k) => [k, String(fd.get(k) || '').trim()]))

    const missing = []
    if (!texts.name) missing.push('name')
    if (!EMAIL_RE.test(texts.email)) missing.push('email')
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((k) => [k, true])))
      form.querySelector(`[name="${missing[0]}"]`)?.focus?.()
      return
    }

    const ui = getHomeContent(locale)?.common || {}
    const sent = sendOffer({
      name: texts.name,
      email: texts.email,
      phone: texts.phone,
      project: message,
      locale,
      origin: DOORS_ORIGIN,
      website: String(fd.get('website') || ''),
      labels: {
        sending: ui.banner?.sending,
        retrying: ui.banner?.retrying,
        success: ui.toast?.offerSuccess,
        error: ui.toast?.offerError,
        retry: ui.banner?.retry,
        close: ui.close,
      },
      onSuccess: () => {
        trackEvent('request_quote_success', { form_type: 'doors', lead_source: DOORS_LEAD_SOURCE })
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
          window.fbq('track', 'Lead', { content_name: 'Internal doors enquiry', content_category: 'Internal doors', form_type: 'doors' })
        }
      },
    })
    if (!sent) return
    form.reset()
    onMessage('')
    setErrors({})
  }

  const clear = (key) => () => { if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined })) }
  const privacyPath = paths.privacy[locale] || paths.privacy.en

  return (
    <section className="pe idp-form" id={id} aria-labelledby={`${id}-title`}>
      <div className="hp-container">
        <div className="hp-card pe-card">
          <div className="pe-head">
            <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{c.heading}</h2>
            <p className="hp-sub">{c.sub}</p>
          </div>

          <form className="pe-form" onSubmit={onSubmit} noValidate>
            {Object.values(errors).some(Boolean) ? <p className="pe-error pe-summary" role="alert">{c.invalid}</p> : null}

            {filled ? (
              <p className="pe-note idp-filled">
                {c.selection} <a href={`#${builderId}`}>{c.change}</a>
              </p>
            ) : null}

            <div className="pe-row pe-row--3">
              {['name', 'phone', 'email'].map((key) => {
                const required = key !== 'phone'
                return (
                  <div className="pe-field" key={key}>
                    <label className="pe-label" htmlFor={fid(key)}>
                      {c[key]}
                      {required ? <span aria-hidden="true"> *</span> : <span className="pe-optional"> ({c.optional})</span>}
                    </label>
                    <input
                      id={fid(key)}
                      name={key}
                      type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                      autoComplete={key === 'phone' ? 'tel' : key}
                      required={required}
                      onInput={clear(key)}
                      aria-invalid={errors[key] ? 'true' : undefined}
                      aria-describedby={errors[key] ? `${fid(key)}-error` : undefined}
                    />
                    {errors[key] ? <p className="pe-error" id={`${fid(key)}-error`}>{c[`${key}Error`]}</p> : null}
                  </div>
                )
              })}
            </div>

            <div className="pe-field">
              <label className="pe-label" htmlFor={fid('message')}>{c.message}</label>
              <textarea
                id={fid('message')}
                name="project"
                rows={message ? 12 : 5}
                maxLength={4000}
                placeholder={c.messagePlaceholder}
                value={message}
                onChange={(e) => onMessage(e.target.value)}
              />
            </div>

            <HoneypotField />

            <div className="pe-foot">
              <button type="submit" className="hp-btn">{c.submit}</button>
              <p className="pe-privacy">{c.privacy} <Link to={privacyPath}>{c.privacyLink}</Link></p>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

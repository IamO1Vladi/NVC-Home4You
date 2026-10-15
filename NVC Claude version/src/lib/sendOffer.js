// The ordinary offer (POST /api/offer) for a page's own in-page form, sent in the background.
//
// The doors page, the interiors page and the About page ask for things that are not a house,
// so the server is told which page it was with one optional key, `origin` (2026-10-15). From
// it the server writes one Bulgarian line in front of the message staff read ("Запитване за
// врати"), tags the sales mail's subject ("[Врати]") and, on promotion, stamps the lead's
// Source. Everything else is the site's ordinary offer: the page composes its own message
// text into `project`; recipients stay the sales inbox. See EnquiryOrigin in the API.
//
// The keys are a fixed list the server checks; an unknown one is a 400. So the helper refuses
// one before sending — a typo in a page is a bug to see in development, not a lost enquiry.
// src/lib/__fixtures__/enquiry-origins.json is the contract both sides' tests read.
//
// Fire-and-forget like every public form (submitInBackground): the caller closes or resets its
// form at once, and the top-right banner reports the request and retries a dead connection.
import { submitInBackground } from './backgroundSubmit.js'
import { loadRep } from './repAttribution.js'
import { ENQUIRY_ORIGINS } from './enquiryOrigins.js'

export { ENQUIRY_ORIGINS }

const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * The JSON body /api/offer takes, with `origin` only when one is given.
 *
 * @param {{ name: string, email: string, phone?: string, project?: string, locale: string,
 *           origin?: 'doors'|'interiors'|'about'|null, website?: string, modelId?: string }} fields
 */
export function buildOfferPayload({ name, email, phone = '', project = '', locale, origin = null, website = '', modelId = '' }) {
  if (origin != null && !ENQUIRY_ORIGINS.includes(origin)) {
    throw new TypeError(`sendOffer: unknown origin "${origin}" (expected one of ${ENQUIRY_ORIGINS.join(', ')})`)
  }
  const payload = {
    name: String(name ?? '').trim(),
    email: String(email ?? '').trim(),
    phone: String(phone ?? '').trim(),
    project: String(project ?? ''),
    modelId: modelId || '',
    locale,
    // The representative whose link brought this visitor (#38), read at submit; the server
    // resolves it against its registry and ignores anything it does not know.
    rep: loadRep() || '',
    // The honeypot (HoneypotField): empty for every human.
    website: website || '',
  }
  if (origin) payload.origin = origin
  return payload
}

/**
 * Sends an in-page enquiry in the background. Returns false (and sends nothing) when the name
 * or email is blank — the form's own `required` attributes normally stop that first — and
 * true once the request is handed to the banner.
 *
 * @param {object} args
 * @param {string} args.name
 * @param {string} args.email
 * @param {string} [args.phone]
 * @param {string} [args.project]   the message text the page composed
 * @param {string} args.locale      'bg' | 'en' | 'el'
 * @param {'doors'|'interiors'|'about'|null} [args.origin]
 * @param {string} [args.website]   the honeypot's value
 * @param {object} args.labels      submitInBackground's banner labels
 *                                  { sending, retrying, success, error, retry, close }
 * @param {() => void} [args.onSuccess]  analytics, run only once the server has the enquiry
 * @returns {boolean}
 */
export function sendOffer({ labels, onSuccess, ...fields }) {
  const payload = buildOfferPayload(fields)
  if (!payload.name || !payload.email) return false
  submitInBackground({ url: `${API_BASE}/api/offer`, payload, labels, onSuccess })
  return true
}

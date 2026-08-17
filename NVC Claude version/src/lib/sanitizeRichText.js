import DOMPurify from 'dompurify'

// One definition of "what HTML this site will actually render".
//
// It was duplicated in GalleryModal and Lightbox, and the admin editor now needs it too —
// which is the part that matters. An editor that allowed something the renderer strips would
// be lying: you would style a paragraph, save it, and watch the formatting vanish on the live
// site with nothing to explain why. Sharing this keeps the editor honest by construction.
//
// `style` is forbidden deliberately: inline styles from a pasted Word document are the usual
// way a page's typography gets wrecked, and stripping them means pasted text adopts the
// site's own styling instead.
export function sanitizeRichText(value) {
  if (!value) return ''

  const raw = String(value)

  // Plain text still arrives from older Quickbase rows, where line breaks carried the
  // formatting. Without this they would collapse into one run-on paragraph.
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw)
  const html = looksLikeHtml ? raw : raw.replace(/\n/g, '<br/>')

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['style'],
  })
}

// The tags the editor's toolbar can produce, and therefore the only ones worth offering.
// Anything outside this set survives sanitising but has no button, which is fine — pasted
// content keeps its structure without the toolbar implying more control than exists.
export const RICH_TEXT_TAGS = ['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'H3', 'H4', 'UL', 'OL', 'LI', 'A']

/** Escapes text for safe injection into an HTML string. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Plain text — an AI draft, a pasted note — as rich-text HTML.
 *
 * Escaped BEFORE the line breaks become <br/>, because the reverse order would let a
 * literal "<" in the text be parsed as markup and stripped by the next sanitise pass —
 * "price < 30000" would arrive as "price ".
 */
export function plainTextToRichHtml(text) {
  const value = String(text ?? '').trim()
  if (!value) return ''
  return `<p>${escapeHtml(value).replace(/\n/g, '<br/>')}</p>`
}

/**
 * Rich-text HTML back to plain text — for the places that genuinely want prose: the AI
 * drafter's steer, an attachment caption. Block boundaries become newlines so "two
 * paragraphs" does not flatten into one run-on sentence.
 */
export function richTextToPlain(value) {
  if (!value) return ''
  const div = document.createElement('div')
  // Sanitised first so this can never execute anything, whatever it is handed.
  div.innerHTML = sanitizeRichText(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6])>/gi, '\n')
  return div.textContent.replace(/\n{3,}/g, '\n\n').trim()
}

/** True when the value has no visible content — an empty editor still holds markup. */
export function isRichTextEmpty(value) {
  const clean = sanitizeRichText(value)
  if (!clean) return true

  const text = clean
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()

  return text.length === 0
}

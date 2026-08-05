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

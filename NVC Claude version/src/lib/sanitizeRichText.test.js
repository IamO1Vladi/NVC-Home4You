import { describe, it, expect } from 'vitest'
import { sanitizeRichText, isRichTextEmpty } from './sanitizeRichText.js'

// This is the contract between the admin editor and the public pages: both run description
// HTML through here, so anything this strips is something staff must not be able to author.
// If they diverge, an editor formats something that silently disappears once published.
describe('sanitizeRichText', () => {
  it('keeps the formatting the editor offers', () => {
    const html = '<p>A <strong>bold</strong> and <em>italic</em> line.</p><h3>Heading</h3><ul><li>One</li></ul>'
    expect(sanitizeRichText(html)).toBe(html)
  })

  it('strips inline styles', () => {
    // Why the toolbar has no colour or font buttons: a style set here vanishes on the live
    // site, so offering it would be offering a control that does nothing.
    const out = sanitizeRichText('<p style="color:red;font-size:40px">Hi</p>')
    expect(out).toBe('<p>Hi</p>')
  })

  it('strips scripts and event handlers', () => {
    expect(sanitizeRichText('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
    expect(sanitizeRichText('<img src=x onerror="alert(1)">')).not.toContain('onerror')
  })

  it('drops javascript: links', () => {
    // These descriptions render on public pages, so a link authored in the panel is a
    // stored-XSS vector if it survives.
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('keeps ordinary links', () => {
    expect(sanitizeRichText('<a href="https://example.com">x</a>')).toContain('href="https://example.com"')
  })

  it('turns plain text line breaks into markup', () => {
    // Older Quickbase rows are plain text where line breaks carried the formatting; without
    // this they collapse into one run-on paragraph.
    // DOMPurify normalises the self-closing form, so assert the break exists rather than
    // pinning its exact spelling.
    expect(sanitizeRichText('line one\nline two')).toMatch(/line one<br\s*\/?>line two/)
  })

  it('leaves existing markup alone rather than double-converting', () => {
    expect(sanitizeRichText('<p>one</p>\n<p>two</p>')).not.toContain('<br')
  })

  it.each([null, undefined, '', '   '])('handles %p', (value) => {
    expect(sanitizeRichText(value)).toBe(value ? sanitizeRichText(value) : '')
  })
})

describe('isRichTextEmpty', () => {
  it('treats markup with no visible text as empty', () => {
    // An emptied contenteditable still contains tags; without this the placeholder never
    // comes back once you have typed and deleted.
    expect(isRichTextEmpty('<p></p>')).toBe(true)
    expect(isRichTextEmpty('<p><br></p>')).toBe(true)
    expect(isRichTextEmpty('<p>&nbsp;</p>')).toBe(true)
    expect(isRichTextEmpty('')).toBe(true)
    expect(isRichTextEmpty(null)).toBe(true)
  })

  it('treats real content as not empty', () => {
    expect(isRichTextEmpty('<p>Hello</p>')).toBe(false)
    expect(isRichTextEmpty('Hello')).toBe(false)
  })
})

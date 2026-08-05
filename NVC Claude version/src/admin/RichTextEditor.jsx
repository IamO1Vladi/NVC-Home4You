import React from 'react'
import { sanitizeRichText, isRichTextEmpty } from '../lib/sanitizeRichText.js'

// A small rich-text editor for the description fields.
//
// These hold HTML — they were Rich Text in Quickbase — so a plain <textarea> showed staff raw
// markup and asked them to hand-write <p> and <strong>. That is a reasonable way to get
// broken markup onto the live site.
//
// Built on contenteditable + execCommand rather than pulling in an editor framework.
// execCommand is deprecated, and the honest reason to accept that is scope: this needs bold,
// italic, a subheading, lists and links, for a handful of staff on a handful of records. A
// ProseMirror-based editor is five packages and a schema to maintain for the same result. If
// this ever needs tables, images or collaborative editing, that trade flips.
//
// Everything is sanitised through the SAME helper the public pages render with, so what the
// editor shows is what the site will show. Inline styles are stripped by that helper, which
// is why the toolbar offers no colours or fonts — a button that silently does nothing after
// save would be worse than no button.

const TOOLS = [
  { cmd: 'bold', icon: 'B', title: { bg: 'Удебелен', en: 'Bold' }, style: { fontWeight: 800 } },
  { cmd: 'italic', icon: 'I', title: { bg: 'Курсив', en: 'Italic' }, style: { fontStyle: 'italic' } },
  { cmd: 'formatBlock', arg: 'h3', icon: 'H', title: { bg: 'Подзаглавие', en: 'Subheading' } },
  { cmd: 'insertUnorderedList', icon: '•—', title: { bg: 'Списък', en: 'Bullet list' } },
  { cmd: 'insertOrderedList', icon: '1—', title: { bg: 'Номериран списък', en: 'Numbered list' } },
  { cmd: 'createLink', icon: '🔗', title: { bg: 'Връзка', en: 'Link' } },
  { cmd: 'removeFormat', icon: '⌫', title: { bg: 'Изчисти форматирането', en: 'Clear formatting' } },
]

export default function RichTextEditor({ value, onChange, lang = 'bg', placeholder = '', id }) {
  const ref = React.useRef(null)
  const [focused, setFocused] = React.useState(false)

  // Written straight to the DOM rather than rendered by React. A contenteditable whose
  // innerHTML React controls loses the caret on every keystroke, because re-rendering
  // replaces the nodes the selection points at.
  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    // Only sync from props while the editor is NOT focused. Doing it mid-typing would fight
    // the user for the caret.
    if (focused) return

    const next = sanitizeRichText(value)
    if (el.innerHTML !== next) el.innerHTML = next
  }, [value, focused])

  const emit = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    onChange(sanitizeRichText(el.innerHTML))
  }, [onChange])

  function run(tool) {
    const el = ref.current
    if (!el) return

    el.focus()

    if (tool.cmd === 'createLink') {
      const url = window.prompt(lang === 'bg' ? 'Адрес на връзката:' : 'Link URL:')
      if (!url) return
      // Only http(s). A javascript: URL here would be stored XSS aimed at the public site,
      // and DOMPurify's default profile would strip it anyway — failing loudly beats a
      // button that quietly does nothing.
      if (!/^https?:\/\//i.test(url)) {
        window.alert(lang === 'bg' ? 'Връзката трябва да започва с http:// или https://' : 'The link must start with http:// or https://')
        return
      }
      document.execCommand('createLink', false, url)
    } else if (tool.cmd === 'formatBlock') {
      // Toggle: pressing the heading button inside a heading returns it to a paragraph.
      const inHeading = document.queryCommandValue('formatBlock')?.toLowerCase() === tool.arg
      document.execCommand('formatBlock', false, inHeading ? 'p' : tool.arg)
    } else {
      document.execCommand(tool.cmd, false, undefined)
    }

    emit()
  }

  // Pasted content is the main way junk markup arrives — Word and Google Docs both paste
  // deep inline-styled HTML. Sanitising here rather than relying on the save path means the
  // editor shows the cleaned version immediately, so what you see is what is stored.
  function onPaste(e) {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')

    const clean = html
      ? sanitizeRichText(html)
      : sanitizeRichText(text.replace(/\n/g, '<br/>'))

    document.execCommand('insertHTML', false, clean)
    emit()
  }

  const showPlaceholder = !focused && isRichTextEmpty(value)

  return (
    <div className={`adm-rte${focused ? ' is-focused' : ''}`}>
      <div className="adm-rte-tools" role="toolbar" aria-label={lang === 'bg' ? 'Форматиране' : 'Formatting'}>
        {TOOLS.map((tool) => (
          <button
            key={tool.cmd + (tool.arg ?? '')}
            type="button"
            title={tool.title[lang] ?? tool.title.en}
            aria-label={tool.title[lang] ?? tool.title.en}
            style={tool.style}
            // onMouseDown, not onClick: clicking a button blurs the editor and collapses the
            // selection, so by the time onClick fires there is nothing left to format.
            onMouseDown={(e) => { e.preventDefault(); run(tool) }}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="adm-rte-surface">
        <div
          id={id}
          ref={ref}
          className="adm-rte-input"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          onBlur={() => { setFocused(false); emit() }}
          onFocus={() => setFocused(true)}
          onPaste={onPaste}
        />
        {showPlaceholder ? <span className="adm-rte-placeholder">{placeholder}</span> : null}
      </div>
    </div>
  )
}

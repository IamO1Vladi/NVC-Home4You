import React from 'react'

// A single floating "chat" launcher that expands to WhatsApp + Viber, so the corner
// stays uncluttered (one bubble at rest instead of a stack). Mobile-only via CSS,
// matching the previous single Viber bubble.
const PHONE = '359879355269' // +359 87 935 5269, digits only
const WHATSAPP_HREF = `https://wa.me/${PHONE}`
const VIBER_HREF = `viber://chat?number=%2B${PHONE}`

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm-4.42 6.1c.19 0 .38 0 .55.01.18.01.42-.07.66.5.24.58.83 2.02.9 2.17.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.18-.31.4-.45.53-.15.15-.3.31-.13.61.17.3.77 1.28 1.66 2.07 1.14 1.02 2.1 1.33 2.4 1.48.3.15.48.13.65-.07.17-.2.74-.87.94-1.17.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.23.57.35.07.13.07.72-.18 1.42-.25.7-1.47 1.37-2.02 1.42-.55.05-1.06.25-3.58-.74-3.03-1.19-5.01-4.24-5.16-4.44-.15-.2-1.23-1.64-1.23-3.12 0-1.48.78-2.22 1.06-2.52.28-.3.61-.38.81-.38Z"/>
    </svg>
  )
}

function ViberIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M12 2C7 2 3 5.6 3 10.1c0 2 .8 3.9 2.3 5.3v3.6l2.9-1.7c1.2.4 2.5.6 3.8.6 5 0 9-3.6 9-8.1S17 2 12 2Zm4.9 11.4c-.2.5-1 1-1.5 1.1-.4.1-.9.1-1.4-.1-.3-.1-.8-.3-1.4-.5-2.4-1-4-3.4-4.1-3.6-.1-.2-1-1.3-1-2.5s.6-1.8.8-2c.2-.2.4-.3.6-.3h.4c.14 0 .3.02.48.4l.6 1.45c.08.15.03.32-.06.44l-.3.36c-.1.12-.2.25-.09.48.12.22.53.86 1.16 1.4.8.7 1.48.92 1.7 1.03.22.1.35.08.48-.06l.6-.68c.15-.18.3-.15.5-.08l1.4.66c.2.1.34.15.4.24.06.13.06.6-.14 1.06Z"/>
    </svg>
  )
}

function LauncherIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
    </svg>
  )
}

export default function ContactDock({ labels }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`contact-dock${open ? ' is-open' : ''}`} ref={ref}>
      <a
        className="contact-action contact-action--whatsapp"
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={labels.whatsapp}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      >
        <WhatsAppIcon />
        <span className="contact-action__label">WhatsApp</span>
      </a>
      <a
        className="contact-action contact-action--viber"
        href={VIBER_HREF}
        aria-label={labels.viber}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      >
        <ViberIcon />
        <span className="contact-action__label">Viber</span>
      </a>
      <button
        type="button"
        className="contact-launcher"
        aria-expanded={open}
        aria-label={labels.contact}
        onClick={() => setOpen((o) => !o)}
      >
        <LauncherIcon open={open} />
      </button>
    </div>
  )
}

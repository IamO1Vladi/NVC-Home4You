import React from 'react'

// The editor's icons: 20 px line drawings in currentColor, in the home page's
// .hp-ico manner (1.75 stroke, round joins). Decorative: every button that shows
// one also carries its words, so they are aria-hidden.
const PATHS = {
  select: <path d="M5 3.5l10.5 6-4.6 1.4 2.7 5.1-2 1-2.7-5.1L5 15.4z" />,
  room: <rect x="3.5" y="3.5" width="13" height="13" rx="1.5" />,
  wall: (
    <>
      <path d="M3 6.5h14M3 13.5h14" />
      <path d="M7 6.5v7M13 6.5v7M10 3v3.5M10 13.5V17" />
    </>
  ),
  door: (
    <>
      <path d="M4 17V3.5h7.5V17" />
      <path d="M11.5 3.5A13.5 13.5 0 0 1 16.5 15" />
      <path d="M3 17h14" />
    </>
  ),
  window: (
    <>
      <rect x="3.5" y="4.5" width="13" height="11" rx="1" />
      <path d="M10 4.5v11M3.5 10h13" />
    </>
  ),
  erase: (
    <>
      <path d="M8 16.5h8.5" />
      <path d="M4.2 11.8l6.9-6.9a1.6 1.6 0 0 1 2.3 0l2.2 2.2a1.6 1.6 0 0 1 0 2.3l-6.7 6.7a1.6 1.6 0 0 1-1.2.4H6.8a1.6 1.6 0 0 1-1.2-.5l-1.4-1.4a1.6 1.6 0 0 1 0-2.8z" />
      <path d="M8.3 7.7l4.9 4.9" />
    </>
  ),
  undo: <path d="M7.5 5.5L4 9l3.5 3.5M4.5 9H12a4 4 0 0 1 0 8H9" />,
  redo: <path d="M12.5 5.5L16 9l-3.5 3.5M15.5 9H8a4 4 0 0 0 0 8h3" />,
  zoomIn: (
    <>
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="M12.3 12.3L17 17M6.5 8.5h4M8.5 6.5v4" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="M12.3 12.3L17 17M6.5 8.5h4" />
    </>
  ),
  fit: <path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4" />,
  more: (
    <>
      <circle cx="4.5" cy="10" r="1.1" />
      <circle cx="10" cy="10" r="1.1" />
      <circle cx="15.5" cy="10" r="1.1" />
    </>
  ),
  help: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7.9 7.8a2.2 2.2 0 1 1 3 2c-.6.3-.9.8-.9 1.4v.4M10 14.2v.1" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
  send: <path d="M17 3L8.5 11.5M17 3l-5 14-3.5-5.5L3 8z" />,
  print: (
    <>
      <path d="M6 7.5V3.5h8v4M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-3.5A1.5 1.5 0 0 1 4.5 7.5h11A1.5 1.5 0 0 1 17 9v3.5a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M6 11.5h8v5H6z" />
    </>
  ),
  save: <path d="M10 3.5v9M6.5 9L10 12.5 13.5 9M4 16.5h12" />,
  open: <path d="M10 12.5v-9M6.5 7L10 3.5 13.5 7M4 16.5h12" />,
  trash: <path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  info: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.5M10 6.5v.1" />
    </>
  ),
}

export default function PlannerIcon({ name, className = '' }) {
  return (
    <svg className={`fp-ico ${className}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {PATHS[name] || null}
    </svg>
  )
}

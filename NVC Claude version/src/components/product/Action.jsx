// One call to action, described as data: { label, to } is a router link, { label, href } a
// plain link (tel:, mailto:, a PDF), and { label, onClick } a button. The product pages hand
// their buttons over this way so a content file can say where a button goes without
// knowing what element it becomes; a link that navigates stays a link and a control that
// opens a form stays a button, which is what a screen reader announces.
import React from 'react'
import { Link } from 'react-router-dom'

export default function Action({ action, className = 'hp-btn' }) {
  if (!action || !action.label) return null
  const { label, to, href, onClick, external, ariaLabel } = action

  if (to) {
    return <Link className={className} to={to} aria-label={ariaLabel}>{label}</Link>
  }
  if (href) {
    const opensElsewhere = external || /\.pdf(\?|#|$)/i.test(href)
    return (
      <a
        className={className}
        href={href}
        aria-label={ariaLabel}
        {...(opensElsewhere ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {label}
      </a>
    )
  }
  return <button type="button" className={className} onClick={onClick} aria-label={ariaLabel}>{label}</button>
}

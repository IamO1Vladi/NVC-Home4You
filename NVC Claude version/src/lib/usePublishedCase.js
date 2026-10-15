// The published case with one id from /api/cases-page: the Box page's proof card and the
// delivery page's "Delivered to a customer" both read it, so either disappears the moment the
// case is unpublished.
import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * The case, or null: while it loads, if the call fails and if the case is no longer
 * published. The prerender waits for the call, so the snapshot has the card.
 */
export function usePublishedCase(id) {
  const [found, setFound] = useState(null)
  useEffect(() => {
    if (!id || typeof fetch !== 'function') return undefined
    let active = true
    fetch(`${API_BASE}/api/cases-page`)
      .then((res) => (res && res.ok ? res.json() : null))
      .then((body) => {
        if (!active || !body) return
        const hit = (Array.isArray(body.cases) ? body.cases : []).find((c) => String(c?.id) === String(id))
        setFound(hit || null)
      })
      .catch(() => {})
    return () => { active = false }
  }, [id])
  return found
}

/** The script a quote is written in, so a Bulgarian page can mark an English quote lang="en". */
export function langOf(text) {
  if (/[А-Яа-я]/.test(text)) return 'bg'
  if (/[Α-Ωα-ωάέήίόύώ]/.test(text)) return 'el'
  return 'en'
}

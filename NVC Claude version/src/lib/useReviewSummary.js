// The site-wide review score and count, live from the feed the home page's reviews read
// (/api/reviews/featured, the same address Testimonials asks for without a product, so the
// browser can answer both from one response). The About page's facts strip prints it as a
// tile; it is never typed anywhere, because "4.8 from 12" goes stale with the next review.
import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''
export const REVIEW_SUMMARY_URL = `${API_BASE}/api/reviews/featured?take=3`

/**
 * { average, total } once the feed answers with at least one rated review; null while it
 * loads, if the call fails, and when there is nothing to show. A caller hides what it would
 * have printed rather than print a zero.
 */
export function useReviewSummary() {
  const [summary, setSummary] = useState(null)
  useEffect(() => {
    if (typeof fetch !== 'function') return undefined
    let active = true
    fetch(REVIEW_SUMMARY_URL)
      .then((res) => (res && res.ok ? res.json() : null))
      .then((body) => {
        if (!active || !body) return
        const average = Number(body.averageRating)
        const total = Number(body.totalCount)
        if (Number.isFinite(average) && average > 0 && Number.isFinite(total) && total > 0) {
          setSummary({ average, total })
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])
  return summary
}

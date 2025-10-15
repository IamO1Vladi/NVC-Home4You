import React from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function RouteChips({ nodes = [] }){
  const { t } = useI18n()
  return (
    <nav aria-label={t('routes.aria')}>
      <ol className="route-band" role="list">
        {nodes.map((n, i) => (
          <React.Fragment key={(n.title || n.flag || 'node') + '-' + i}>
            <li className="route-node">
              <span className="route-code" aria-hidden="true">{n.flag || '•'}</span>
              <div className="route-text">
                <div className="route-title">{n.title}</div>
                {n.sub ? <div className="route-sub">{n.sub}</div> : null}
              </div>
            </li>
            {i < nodes.length - 1 && (
              <li className="route-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </li>
            )}
          </React.Fragment>
        ))}
      </ol>
    </nav>
  )
}

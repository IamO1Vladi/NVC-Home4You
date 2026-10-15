// "How it works": the four steps from picking a model to an offer, as the home page's step
// cards (hp-steps). A plain ordered list, all of it in the markup; four across on a wide
// screen, two on a tablet, one under the other on a phone. Where the editor is not on the
// page (below 900px) a step that would promise drawing says what a phone can do (textPhone).
import React from 'react'
import { fill } from './PlannerTemplates.jsx'

/**
 * @param content  the route's floorPlanner content (how.title, how.sub, how.steps[{ title, text, textPhone? }])
 * @param values   placeholders the step texts may use ({ areas, areasOr })
 * @param wide     whether the editor is on the page; default true
 */
export default function PlannerHowItWorks({ content, values = {}, wide = true }) {
  const copy = content?.how || {}
  const steps = (copy.steps || []).filter((step) => step && step.title)
  if (!steps.length) return null

  return (
    <section id="how" className="fpp-how" aria-labelledby="fpp-how-title">
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <h2 id="fpp-how-title">{copy.title}</h2>
            {copy.sub ? <p className="hp-sub">{copy.sub}</p> : null}
          </div>
        </div>
        <ol className="hp-steps fpp-steps">
          {steps.map((step, i) => {
            const body = wide ? step.text : step.textPhone || step.text
            return (
              <li key={step.title} className="hp-card hp-step">
                <strong><span className="hp-step-n" aria-hidden="true">{i + 1}</span>{step.title}</strong>
                {body ? <p>{fill(body, values)}</p> : null}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

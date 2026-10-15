// The planner page's first screen: what the page is for, the two ways in (a catalogue layout
// or a blank plan), and the house itself unfolding in 3D, with the roof-and-veranda version a
// click away.
//
// The words are the product page hero's (pp-hero, pp-title, hp-lead, hp-cta-row, hp-facts),
// so the planner reads as the same site. The picture is not a photo but <UnfoldHouse>: its
// light half is imported here, and three.js arrives on its own once the house nears the screen
// (src/components/planner/UnfoldHouse.jsx). Until then, without WebGL and in the prerendered
// snapshot it is a poster and its stages as text, so the hero never waits on the 3D.
//
// The two buttons are links to the sections they lead to (#templates, #editor), so they work
// and mean something without the script; with it the first scrolls there smoothly instead of
// rewriting the URL, and "Празен план" really starts a blank plan in the editor (onBlank)
// before scrolling to it -- the page loads it as one undo step, so Undo brings the visitor's
// earlier plan back.
//
// Below 900px there is no editor (the owner's call), so nothing here promises drawing: the
// lead and the facts have phone versions (leadPhone, factsPhone), and the second button asks
// for an offer instead (secondaryPhone, onOffer).
import React from 'react'
import UnfoldHouse from './UnfoldHouse.jsx'
import { fill } from './PlannerTemplates.jsx'

function Tick() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
}

/**
 * @param content        the route's floorPlanner content (hero.*, unfold?)
 * @param locale         'bg' | 'en' | 'el'
 * @param values         { count, areas } for the copy's placeholders
 * @param model          the 3D's model, '37' | '58' | '73', with onModelChange
 * @param onGo           (sectionId) => void, scrolls to a section
 * @param wide           whether the editor is on the page (900px and up); default true
 * @param onBlank        () => void, starts a blank plan in the editor and scrolls to it
 * @param onOffer        () => void, opens the offer form (the phone's second button)
 */
export default function PlannerHero({
  content,
  locale = 'bg',
  values = {},
  model,
  onModelChange,
  onGo,
  wide = true,
  onBlank,
  onOffer,
}) {
  const copy = content?.hero || {}
  const go = (id) => (ev) => {
    if (!onGo) return
    ev.preventDefault()
    onGo(id)
  }
  const blank = (ev) => {
    if (!onBlank) return go('editor')(ev)
    ev.preventDefault()
    onBlank()
  }
  const lead = wide ? copy.lead : copy.leadPhone || copy.lead
  const facts = wide ? copy.facts : copy.factsPhone || copy.facts

  return (
    <section className="pp-hero fpp-hero" aria-labelledby="fpp-hero-title">
      <div className="hp-container">
        <div className="fpp-hero-top">
          <div className="fpp-hero-copy">
            {copy.eyebrow ? <span className="hp-eyebrow">{copy.eyebrow}</span> : null}
            <h1 id="fpp-hero-title" className="pp-title">{copy.title}</h1>
            {lead ? <p className="hp-lead">{fill(lead, values)}</p> : null}
          </div>
          <div className="fpp-hero-act">
            <div className="hp-cta-row">
              <a className="hp-btn" href="#templates" onClick={go('templates')}>{copy.primary}</a>
              {wide ? (
                <a className="hp-btn ghost" href="#editor" onClick={blank}>{copy.secondary}</a>
              ) : (
                <button type="button" className="hp-btn ghost" onClick={() => onOffer?.()}>
                  {copy.secondaryPhone || copy.secondary}
                </button>
              )}
            </div>
            {Array.isArray(facts) && facts.length ? (
              <ul className="hp-facts">
                {facts.map((fact) => <li key={fact}><Tick />{fill(fact, values)}</li>)}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="fpp-hero-stage">
          <UnfoldHouse locale={locale} content={content?.unfold} model={model} onModelChange={onModelChange} />
        </div>
      </div>
    </section>
  )
}

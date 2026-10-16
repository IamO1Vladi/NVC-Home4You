// /bg/sglobqemi-kyshti — „Сглобяеми къщи по проект“: houses on a steel frame, built to a
// plan and priced per project. The page has one job: get a project or a sketch from the
// visitor, or offer to draw the project up when they have none, and send anyone who wants a
// figure today to the two lines that have one.
//
// Built on the home page's system like the other two product pages (HomePage.css, then
// ProductPage.css, inside <main class="hp pp">), plus ProductSteel.css for the two parts
// only this page has. In this order: the hero with the "decided per project" card beside
// it, the two ways of working, the five steps of a project with a picture each, the price
// (there is none, and the block says why), the two priced lines, and the contact card.
//
// NO FIGURES. The owner (2026-10-12): every steel-frame house is its own project, so the page
// states no area, floors, bedrooms, profile thickness or fixed finish; the hero's card says
// what the project decides instead (DecideCard below).
//
// NO HERO PHOTO UNLESS THE ADMIN SETS ONE. NVC has no photograph of a steel build of its own
// yet, so the hero's photo is the admin's page-steel-houses slot (usePagePhoto) and nothing
// otherwise; the card then takes the right-hand column on its own. The five stage pictures
// (white-background renders of one example house) were looked at for the hero and left in
// the steps, where they explain something; as a hero they would present one A-frame as the
// product of a line where every house is different.
//
// THE PICTURES BELOW THE FOLD. The steps (ProcessSteps) pair each of the owner's five stages
// with the render that shows it, all in the DOM, as a timeline on a phone and a sticky
// picture beside the list on a wide screen. There is NO example gallery: the owner
// (2026-10-12) wanted the steps and their pictures back but said explicitly not to bring back
// the old seven example visualisations, so none of them is on this page, not even as its
// share picture (routeMeta.js uses the first step's render).
//
// THE OWNER CAN PUT A REAL PROJECT IN EACH STAGE (since 2026-10-17): the stages are the slots
// steel-step-1..5 of "Снимки на сайта" (STEEL_STEP_SLOTS). An empty one draws today's render,
// to the attribute (ProcessSteps' StepImg). A filled one shows his photo with the content's
// general words for it (adminAlt; his own description on the Bulgarian page), and the words
// that do not fit a real project give way: step 1's caption, which calls the picture a render
// (adminCaption, none), and step 5's, which names the render's canopies (adminCaption, the
// step's own work). The sub's "the pictures show one example house at each stage" goes too: with
// EVERY stage a photo the sub is its first sentence alone (adminSub); with some still renders it
// says the pictures that are not project photos are renders (mixedSub), so those stay marked as
// renders beside his photos. The share picture stays the first render.
//
// NO PRICE IS TYPED HERE. The sibling cards' "from" figures are computed from the gallery
// rows (useProductRows), the same rows the container and house pages render, so they cannot
// quote a figure those pages do not show. The containers' figure is a total with assembly;
// the houses' is the house alone, which is how the houses page states it.
//
// No Product markup: a line priced per project has no offer to give. The route publishes
// breadcrumbs and a Service (ServiceJSONLD) instead, with no price in it.
// No reviews section either — none of the published reviews is about a steel-frame house,
// and Testimonials would render nothing.
//
// The questions (2026-10-17) are the page's own, filled by lib/productQuestions.js and marked
// up here (the only FAQPage markup on this page): the price, the project's cost, the factory,
// the warranty and the timeline (both depend on the project, and no figure is given), delivery
// and customs in the quote, and the partner prices. The FAQ hub gathers them under its
// steel-frame houses topic, which the section links to.
import React from 'react'
import { Link } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/ProductSteel.css'
import ProductHero from '../components/product/ProductHero.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import ProcessSteps from '../components/product/ProcessSteps.jsx'
import FinalCta from '../components/FinalCta.jsx'
import FaqList from '../components/product/FaqList.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { getHomeContent } from '../content/home/index.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { useProductRows, lowest } from '../lib/productRows.js'
import { boxHouseRows } from '../content/shared/prices.js'
import { slotAlt, usePagePhoto, useSlotPhotos } from '../lib/homePhotos.js'
import { STEEL_STEP_SLOTS } from '../lib/photoSlotNames.js'
import { paths } from '../routes/paths.js'
import { hubTopicPath, productQuestions } from '../lib/productQuestions.js'

/**
 * What a project decides, beside the hero's words: the six things every project settles as
 * one list of short items, one sentence that answers all six, and the frame on its own line.
 * It replaced a seven-row table whose six answers were all "по проект" or "по ваш избор",
 * which on a phone was the first screen's worth of the same words in a ragged right column.
 * A real list and a real heading, all in the markup, so a crawler and a screen reader read
 * it as they read the rest of the page.
 */
function DecideCard({ decide }) {
  if (!decide) return null
  return (
    <div className="hp-card pp-decide" role="group" aria-labelledby="pp-decide-title">
      <h2 id="pp-decide-title" className="pp-decide-title">{decide.title}</h2>
      <ul className="pp-chips">
        {decide.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <p className="pp-decide-note">{decide.note}</p>
      <p className="pp-decide-frame">
        <strong>{decide.frameLabel}:</strong> {decide.frame}
      </p>
    </div>
  )
}

export default function SteelHousesPage({ locale = 'en', content }) {
  const { openOffer } = useModalActions()
  const { box, wagon } = useProductRows(locale)
  const adminPhoto = usePagePhoto('steelHouses')
  const stagePhotos = useSlotPhotos(STEEL_STEP_SLOTS)

  if (!content) return null
  const c = content

  // The phone and email the contact card and the header print, from the object
  // LocalBusinessJSONLD publishes, so this page cannot dial a different number.
  const business = getHomeContent(locale)?.home?.localBusiness || {}

  const pathOf = (key) => paths[key]?.[locale] || paths[key]?.en

  // A finished figure for the containers (assembly is part of their price), the house alone
  // for the Box houses (assembly is added per model, and the 18 m² one has none yet).
  const priceLine = (value, basis) => (value == null ? null : `${c.ready.from} ${euro(value, locale)} ${basis}`)
  const containersFrom = lowest(wagon)
  // The Box houses' own "from", as their page has it: never the capsule (prices.js).
  const housesFrom = lowest(boxHouseRows(box), (row) => row.house)

  // Nothing while the answer is on its way (undefined), not only for an empty slot: a photo
  // that arrived after the first paint would push the heading down on a phone. The answer
  // is usually there at once, read from the snapshot (see homePhotos.js). The admin's alt is
  // typed in Bulgarian, so only the Bulgarian page uses it; the rest get the generic photoAlt.
  const photo = adminPhoto ? { url: adminPhoto.url, alt: (locale === 'bg' && adminPhoto.alt) || c.hero.photoAlt } : null

  const faq = productQuestions('steelHouses', c, locale)

  // Each stage's picture: today's render while its slot is empty (the step untouched), the
  // owner's photo once it is filled, with words that fit any photo of that stage.
  const stagePhotoOf = (i) => stagePhotos[STEEL_STEP_SLOTS[i]] || null
  const stagePhotoCount = c.process.steps.filter((_, i) => stagePhotoOf(i)).length
  // Today's sub with no photo; its first sentence alone with every stage a photo; and while
  // only some are, the sentence that keeps the remaining renders marked as renders.
  const processSub = stagePhotoCount === 0
    ? c.process.sub
    : stagePhotoCount === c.process.steps.length ? c.process.adminSub : c.process.mixedSub
  const stageImage = (image, i) => {
    const admin = stagePhotoOf(i)
    if (!admin || !image) return image
    return {
      ...image,
      admin,
      adminAlt: slotAlt(admin, { locale, adminAlt: image.adminAlt }),
      caption: image.adminCaption ?? image.caption,
    }
  }

  return (
    <main className="hp pp pp-steel">
      <ProductHero
        eyebrow={c.hero.eyebrow}
        title={c.hero.h1}
        lead={c.hero.lead}
        primary={{ label: c.hero.cta, onClick: openOffer }}
        secondary={business.telephone ? { label: c.hero.call, href: `tel:${business.telephone}` } : null}
        photo={photo}
      >
        <DecideCard decide={c.decide} />
      </ProductHero>

      <section className="pp-band" aria-labelledby="pp-how-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="pp-how-title">{c.how.h2}</h2>
              {c.how.sub ? <p className="hp-sub">{c.how.sub}</p> : null}
            </div>
          </div>
          {/* Two alternatives, not steps in a row, so an unordered list. */}
          <ul className="pp-pair">
            {c.how.routes.map((route) => (
              <li key={route.h} className="hp-card hp-why-card">
                <h3>{route.h}</h3>
                <p>{route.p}</p>
              </li>
            ))}
          </ul>
          {business.email ? (
            <p className="pp-note">
              {c.how.filesLead} <a href={`mailto:${business.email}`}>{business.email}</a>.
            </p>
          ) : null}
        </div>
      </section>

      <ProcessSteps
        id="pp-process"
        heading={c.process.h2}
        sub={processSub}
        // A step's link names its page by pathKey; ?product=project opens the delivery
        // calculator on "a house to a project", whose delivery is quoted with the project.
        steps={c.process.steps.map((step, i) => {
          const image = stageImage(step.image, i)
          const linked = step.link
            ? { ...step, link: { label: step.link.label, to: `${pathOf(step.link.pathKey)}?product=project` } }
            : step
          return image === step.image ? linked : { ...linked, image }
        })}
      />

      <section aria-labelledby="pp-price-title">
        <div className="hp-container">
          <div className="pp-prose">
            <h2 id="pp-price-title">{c.price.h2}</h2>
            {/* The prices page's card for this line, word for word, so the two cannot drift. */}
            <p>{getPricesCopy(locale).customBody}</p>
          </div>
          <p className="pp-links">
            <Link to={pathOf('prices')}>{c.price.link}</Link>
            <Link to={pathOf('gallery')}>{c.price.galleryLink}</Link>
            {c.price.partnerLink ? <Link to={`${pathOf('partner')}#zapitvane`}>{c.price.partnerLink}</Link> : null}
          </p>
        </div>
      </section>

      {faq.length ? (
        <section id="questions" aria-labelledby="pp-faq-title">
          <div className="hp-container">
            <div className="hp-head">
              <div>
                <h2 id="pp-faq-title">{c.faq.heading}</h2>
              </div>
            </div>
            <FaqList items={faq} />
            {/* The FAQ hub's steel-frame houses topic, which gathers these with the rest. */}
            {c.faq.more ? <p className="pp-links"><Link to={hubTopicPath('steelHouses', locale)}>{c.faq.more}</Link></p> : null}
          </div>
        </section>
      ) : null}

      <SiblingLinks
        id="pp-ready"
        heading={c.ready.h2}
        go={c.ready.go}
        items={[
          {
            to: pathOf('modularBuilds'),
            label: c.ready.containers.label,
            desc: c.ready.containers.desc,
            price: priceLine(containersFrom, c.ready.containers.basis),
          },
          {
            to: pathOf('modularHouses'),
            label: c.ready.houses.label,
            desc: c.ready.houses.desc,
            price: priceLine(housesFrom, c.ready.houses.basis),
          },
        ]}
      />

      <FinalCta locale={locale} title={c.final.title} desc={c.final.desc} />
    </main>
  )
}

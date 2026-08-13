import React from 'react'
import { Link } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, UnauthorizedError } from '../admin/adminApi.js'

// The landing page for /admin.
//
// Until now /admin dropped you straight into the review queue with no navigation at all, so
// the other two sections were only reachable if someone had told you their URLs. This is the
// menu: three plain-language cards saying what each section is for, each carrying the one
// number that tells you whether it needs you today.

const TEXT = {
  bg: {
    title: 'Здравейте',
    subtitle: 'Изберете какво искате да редактирате.',
    needsYou: 'Изисква внимание',
    allClear: 'Няма нищо за одобрение в момента.',
    open: 'Отвори',
    cards: {
      leads: {
        name: 'Запитвания',
        blurb: 'Новите запитвания от сайта. Създайте лийд, за да започнете разговор.',
      },
      pipeline: {
        name: 'Лийдове',
        blurb: 'Клиентите, с които говорите — история, оферти и отговори на едно място.',
      },
      reviews: {
        name: 'Отзиви',
        blurb: 'Одобрявайте нови отзиви от клиенти, преди да се появят на сайта.',
      },
      gallery: {
        name: 'Галерия',
        blurb: 'Модели, цени и снимки — това, което посетителите виждат в галерията.',
      },
      cases: {
        name: 'Проекти',
        blurb: 'Реализирани проекти с клиенти, снимки и препоръки.',
      },
    },
    stats: {
      pending: (n) => `${n} ${n === 1 ? 'чака' : 'чакат'} одобрение`,
      noPending: 'Всичко е прегледано',
      waiting: (n) => `${n} ${n === 1 ? 'чака' : 'чакат'} обработка`,
      allHandled: 'Няма нови запитвания',
      deals: (n) => `${n} ${n === 1 ? 'активен лийд' : 'активни лийда'}`,
      models: (n) => `${n} ${n === 1 ? 'модел' : 'модела'}`,
      cases: (n) => `${n} ${n === 1 ? 'проект' : 'проекта'}`,
      drafts: (n) => `${n} в чернова`,
      published: 'всички публикувани',
    },
    tipTitle: 'Полезно да знаете',
    tips: [
      'Промените се виждат на сайта веднага след като натиснете „Запази“.',
      '„Чернова“ означава, че записът съществува, но посетителите не го виждат.',
      'Ако нещо се обърка, не изтривайте — направете го чернова и се обадете.',
    ],
  },
  en: {
    title: 'Welcome',
    subtitle: 'Choose what you would like to edit.',
    needsYou: 'Needs attention',
    allClear: 'Nothing is waiting for approval.',
    open: 'Open',
    cards: {
      leads: {
        name: 'Inquiries',
        blurb: 'New enquiries from the site. Create a lead to start a conversation.',
      },
      pipeline: {
        name: 'Leads',
        blurb: 'The customers you are talking to — history, quotes and replies in one place.',
      },
      reviews: {
        name: 'Reviews',
        blurb: 'Approve new customer reviews before they appear on the site.',
      },
      gallery: {
        name: 'Gallery',
        blurb: 'Models, prices and photos — what visitors see in the gallery.',
      },
      cases: {
        name: 'Cases',
        blurb: 'Completed customer projects, with photos and testimonials.',
      },
    },
    stats: {
      pending: (n) => `${n} waiting for approval`,
      noPending: 'All reviewed',
      // The English side inherited neither of these when the leads sections were added,
      // so an EN user saw "undefined" the moment either tile had a number to show.
      waiting: (n) => `${n} waiting to be handled`,
      allHandled: 'No new inquiries',
      deals: (n) => `${n} active ${n === 1 ? 'lead' : 'leads'}`,
      models: (n) => `${n} ${n === 1 ? 'model' : 'models'}`,
      cases: (n) => `${n} ${n === 1 ? 'case' : 'cases'}`,
      drafts: (n) => `${n} in draft`,
      published: 'all published',
    },
    tipTitle: 'Worth knowing',
    tips: [
      'Changes appear on the site as soon as you press Save.',
      '“Draft” means the entry exists but visitors cannot see it.',
      'If something goes wrong, do not delete it — set it to draft and call.',
    ],
  },
}

export default function AdminHomePage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang]

  const [state, setState] = React.useState('loading')
  const [me, setMe] = React.useState(null)
  const [counts, setCounts] = React.useState({})
  const [houses, setHouses] = React.useState([])
  const [cases, setCases] = React.useState([])
  const [outstanding, setOutstanding] = React.useState(0)
  const [deals, setDeals] = React.useState(0)

  const load = React.useCallback(async () => {
    setState('loading')
    try {
      // The two lead calls tolerate failure on purpose: this page is a menu, and a
      // section whose count could not be fetched should still be reachable rather than
      // taking the whole screen to the error state.
      const [countRes, houseRes, caseRes, who, leadCounts, openDeals] = await Promise.all([
        adminGet('/api/admin/reviews/counts'),
        adminGet('/api/admin/gallery'),
        adminGet('/api/admin/cases'),
        adminGet('/api/admin/me').catch(() => null),
        adminGet('/api/admin/leads/counts').catch(() => null),
        adminGet('/api/admin/pipeline?status=open').catch(() => null),
      ])
      setCounts(countRes ?? {})
      setHouses(houseRes ?? [])
      setCases(caseRes ?? [])
      setMe(who)
      setOutstanding(Number(leadCounts?.notReachedOut) || 0)
      setDeals(Array.isArray(openDeals) ? openDeals.length : 0)
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  const pending = Number(counts.pending) || 0
  const houseDrafts = houses.filter((h) => !h.isPublished).length
  const caseDrafts = cases.filter((c) => !c.isPublished).length

  const firstName = (me?.name || '').trim().split(/\s+/)[0]

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="home"
      title={firstName ? `${t.title}, ${firstName}` : t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={load}
    >
      <div className="adm-tiles">
        <HomeTile
          to="/admin/inquiries"
          icon="leads"
          name={t.cards.leads.name}
          blurb={t.cards.leads.blurb}
          open={t.open}
          urgent={outstanding > 0}
          stat={outstanding > 0 ? t.stats.waiting(outstanding) : t.stats.allHandled}
        />
        <HomeTile
          to="/admin/pipeline"
          icon="pipeline"
          name={t.cards.pipeline.name}
          blurb={t.cards.pipeline.blurb}
          open={t.open}
          stat={t.stats.deals(deals)}
        />
        <HomeTile
          to="/admin/reviews"
          icon="reviews"
          name={t.cards.reviews.name}
          blurb={t.cards.reviews.blurb}
          open={t.open}
          urgent={pending > 0}
          stat={pending > 0 ? t.stats.pending(pending) : t.stats.noPending}
        />
        <HomeTile
          to="/admin/gallery"
          icon="gallery"
          name={t.cards.gallery.name}
          blurb={t.cards.gallery.blurb}
          open={t.open}
          stat={`${t.stats.models(houses.length)} · ${houseDrafts > 0 ? t.stats.drafts(houseDrafts) : t.stats.published}`}
        />
        <HomeTile
          to="/admin/cases"
          icon="cases"
          name={t.cards.cases.name}
          blurb={t.cards.cases.blurb}
          open={t.open}
          stat={`${t.stats.cases(cases.length)} · ${caseDrafts > 0 ? t.stats.drafts(caseDrafts) : t.stats.published}`}
        />
      </div>

      {/* The three things colleagues have asked about most. Cheaper to answer here, once,
          than on the phone every time someone is unsure whether a change went live. */}
      <section className="adm-card adm-tips">
        <h2>{t.tipTitle}</h2>
        <ul>
          {t.tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </section>
    </AdminShell>
  )
}

const TILE_ICON = {
  leads: (
    <>
      <path d="M3.2 13.4h4.1l1.4 2.6h6.6l1.4-2.6h4.1" />
      <path d="M5.6 4.6h12.8l3 8.8V19a1.6 1.6 0 0 1-1.6 1.6H4.2A1.6 1.6 0 0 1 2.6 19v-5.6z" />
    </>
  ),
  pipeline: (
    <>
      <path d="M3.4 6.2a1.8 1.8 0 0 1 1.8-1.8h9.6a1.8 1.8 0 0 1 1.8 1.8v5a1.8 1.8 0 0 1-1.8 1.8H8.2l-3.4 2.8v-2.8a1.4 1.4 0 0 1-1.4-1.4z" />
      <path d="M19 9.4a1.6 1.6 0 0 1 1.6 1.6v4.4a1.6 1.6 0 0 1-1.6 1.6v2.4l-2.8-2.4h-3.6" />
    </>
  ),
  reviews: <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />,
  gallery: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.6" cy="10" r="1.8" />
      <path d="m3.6 17.4 4.8-4.3 4 3.4 3.2-2.6 4.4 3.6" />
    </>
  ),
  cases: (
    <>
      <rect x="2.8" y="7.4" width="18.4" height="12.6" rx="2.4" />
      <path d="M8.6 7.4V5.6a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.8M2.8 12.4h18.4" />
    </>
  ),
}

function HomeTile({ to, icon, name, blurb, stat, urgent, open }) {
  return (
    <Link to={to} className={urgent ? 'adm-tile is-urgent' : 'adm-tile'}>
      <span className="adm-tile-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {TILE_ICON[icon]}
        </svg>
      </span>
      <span className="adm-tile-body">
        <strong className="adm-tile-name">{name}</strong>
        <span className="adm-tile-blurb">{blurb}</span>
        <span className={urgent ? 'adm-tile-stat is-urgent' : 'adm-tile-stat'}>{stat}</span>
      </span>
      <span className="adm-tile-go" aria-hidden="true">
        <span className="adm-tile-go-text">{open}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  )
}

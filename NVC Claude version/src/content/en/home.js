// The map the visitor opens when they tap "Open in Maps". The query is the address as this
// locale prints it, percent-encoded so the string holds no place name a copy audit would
// read as a word on the page.
const MAPS_HREF = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Marikostinovo, 2850 Petrich, Bulgaria')}`

export default {
  header: {
    primaryNavAria: 'Primary',
    brand: { short: 'NVC', full: 'Home4You' },
    servicesSummary: 'Homes & services',
    nav: {
      gallery: 'Gallery',
      prices: 'Prices',
      cases: 'Cases',
      faq: 'FAQ',
      about: 'About Us',
      partner: 'Partners',
      planner: 'Planner',
      quote: 'Get a Quote',
      boxConfigurator: "Configurator",
      // The desktop dropdown that holds the planner and the configurator.
      plannerGroup: 'Planning',
      call: 'Call us',
      catalogues: 'Catalogues (PDF)',
    },
    servicesMenu: {
      columns: [
        {
          title: 'Container & Prefab Homes',
          items: [
            { pathKey: 'modularBuilds', label: 'Container units' },
            { pathKey: 'modularHouses', label: 'Modular houses' },
            { pathKey: 'steelHouses', label: 'Steel-frame prefab houses to your plan' },
          ],
        },
        {
          title: 'Delivery',
          items: [
            { pathKey: 'delivery', label: 'Delivery and assembly' },
          ],
        },
        {
          title: 'Materials, Furniture & Renovations',
          items: [
            { pathKey: 'interiors', label: 'Interiors' },
            { pathKey: 'doors', label: 'Internal doors' },
          ],
        },
      ],
    },
    theme: {
      label: 'Theme',
      ariaLabel: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'Match device',
    },
    language: {
      label: 'Language',
      ariaLabel: 'Language',
      options: [
        { value: 'en', label: 'English' },
        { value: 'bg', label: 'Български' },
        { value: 'el', label: 'Ελληνικά' },
      ],
    },
    mobileMenuButtonAria: 'Open menu',
  },
  home: {
    hero: {
      eyebrow: 'Prefab & container homes',
      title: 'Because a <g>home</g> shouldn\'t be an expense',
      // {price} is the gallery's cheapest container (VAT and assembly in), read from
      // /api/home/photos through euro(), never typed here. Until it is known the hero prints
      // leadNoPrice, the same sentence without a figure.
      lead: 'Prefab and container homes from {price}, VAT included. Based in Petrich, Bulgaria — delivered across the EU.',
      leadNoPrice: 'Prefab and container homes with clear prices. Based in Petrich, Bulgaria — delivered across the EU.',
      primaryCta: 'Get a Quote',
      pricesCta: 'See models & prices',
      facts: ['87 homes delivered', 'Prices include VAT', 'Building homes since 2022'],
      slidesLabel: 'Hero photos',
      photoLabelPattern: 'Photo {n} of {total}: {label}',
      showcase: {
        openLabel: 'Open',
        slidesLabel: 'Hero photos',
        // The five default slides; the admin's hero slots replace them when set.
        slides: [
          { src: '/api/img/content/bukcsfwf9-rdg-eg-vb.webp', alt: 'Container units', pathKey: 'modularBuilds', frame: { position: '30% 50%', scale: 1.22 } },
          { src: '/api/img/content/bukcsfwf9-rdf-eg-vb.webp', alt: 'Modular houses', pathKey: 'modularHouses' },
          { src: '/api/img/content/bvk4n834b-rbu-eg-vb.webp', alt: 'Container units', pathKey: 'modularBuilds' },
          { src: '/api/img/content/bvk4n834b-r7-eg-vb.webp', alt: 'Steel-frame prefab houses to your plan', pathKey: 'steelHouses' },
          { src: '/api/img/content/bvk4n834b-rcz-eg-vb.webp', alt: 'Interiors', pathKey: 'interiors' },
        ],
      },
    },
    band: {
      visitTitle: 'Visit us',
      address: 'Marikostinovo, 2850 Petrich',
      mapsLabel: 'Open in Maps →',
      mapsHref: MAPS_HREF,
      callTitle: 'Call or WhatsApp',
      hours: 'Mon–Fri 07:00–19:00',
      writeTitle: 'Write',
      replyNote: 'We answer within 24 hours',
    },
    strip: {
      kicker: 'Prices',
      titlePattern: '{count} models from {price} — build yours online',
      lead: 'Pick a model and see the price at every step: plan, windows, bathroom, kitchen.',
      from: 'from',
      incl: 'incl. VAT, assembly extra',
      cta: 'Start with this one →',
      all: 'All prices →',
      planner: 'Plan the layout →',
      paperPrefix: 'Prefer paper?',
      paperLink: 'Download the catalogue (PDF)',
      paperOr: 'or',
      paperAll: 'see all six catalogues',
    },
    serviceTiles: {
      ariaLabel: 'What we build',
      heading: 'What we build',
      subheading: 'From a 14 m² cabin to a family house — and the bathrooms and kitchens inside.',
      button: 'Explore →',
      items: [
        {
          key: 'modularBuilds',
          pathKey: 'modularBuilds',
          title: 'Container units · 14–30 m²',
          desc: 'Ready-made container modules — cabin, guest house, office or shop — delivered and assembled by us.',
          icon: 'layers',
          img: '/api/img/content/bvk4n834b-rbp-eg-vb.webp',
        },
        {
          key: 'modularHouses',
          pathKey: 'modularHouses',
          title: 'Modular houses · 18–74 m²',
          desc: 'Homes from 18 to 74 m²: expandable Box houses and Space capsules, with your layout and finishes.',
          icon: 'home',
          img: '/api/img/content/bvk4n834b-rdb-eg-vd.webp',
        },
        {
          key: 'steelHouses',
          pathKey: 'steelHouses',
          title: 'Steel-frame prefab houses to your plan',
          desc: 'Steel-frame houses built to your own project — or we prepare the project for you.',
          icon: 'steel',
          img: '/api/img/content/bvk4n834b-rdc-eg-vb.webp',
        },
        {
          key: 'interiors',
          pathKey: 'interiors',
          title: 'Interiors',
          desc: 'Bathrooms and kitchens renovated with a clear plan and transparent pricing.',
          icon: 'interior',
          img: '/api/img/content/bvk4n834b-rce-eg-vb.webp',
        },
      ],
    },
    catalogues: {
      heading: 'Take a catalogue with you',
      subheading: 'Six PDFs with every model, size and finish. Open one in a new tab, print it, or send it to whoever you are deciding with.',
      items: [
        { brochureSlug: 'modular-builds', label: 'General catalogue', note: 'Modular builds, all ranges' },
        { brochureSlug: 'standard-containers', label: 'Standard containers', note: '14–30 m² units' },
        { brochureSlug: 'villa-office', label: 'Villa / Office', note: 'Living and working modules' },
        { brochureSlug: 'sloped-roof', label: 'Sloped roof', note: 'Retail and sloped-roof units' },
        { brochureSlug: 'box-house', label: 'Box houses', note: '37 / 58 / 73 m² expandable homes' },
        { brochureSlug: 'space-capsules', label: 'Space capsules', note: 'Capsule homes' },
      ],
    },
    glideServices: {
      ariaLabel: 'Service highlights',
      subheading: 'Swipe or tap any card to open the page',
      prevAria: 'Previous slide',
      nextAria: 'Next slide',
      dotsAria: 'Slide navigation',
      slides: [
        { key: 'steelHouse0', pathKey: 'steelHouses', title: 'Steel houses', img: '/api/img/content/bvk4n834b-rdd-eg-vb.webp' },
        { key: 'steelHouse7', pathKey: 'steelHouses', title: 'Steel houses', img: '/api/img/content/bvk4n834b-rde-eg-vb.webp' },
        { key: 'modularHouse0', pathKey: 'modularHouses', title: 'Modular houses', img: '/api/img/content/bvk4n834b-rdf-eg-vb.webp' },
        { key: 'steelHouse1', pathKey: 'steelHouses', title: 'Steel houses', img: '/api/img/content/bvk4n834b-rcf-eg-vb.webp' },
        { key: 'steelHouse2', pathKey: 'steelHouses', title: 'Steel houses', img: '/api/img/content/bvk4n834b-rm-eg-vb.webp' },
        { key: 'modularHouse1', pathKey: 'modularHouses', title: 'Modular houses', img: '/api/img/content/bvk4n834b-rb9-eg-vb.webp' },
        { key: 'modularHouse2', pathKey: 'modularHouses', title: 'Modular houses', img: '/api/img/content/bvk4n834b-r2-eg-vb.webp' },
        { key: 'modularHouse3', pathKey: 'modularHouses', title: 'Modular houses', img: '/api/img/content/bvk4n834b-rq-eg-vb.webp' },
        { key: 'steelHouse3', pathKey: 'steelHouses', title: 'Steel houses', img: '/api/img/content/bvk4n834b-rr-eg-vb.webp' },
        { key: 'steelHouse4', pathKey: 'steelHouses', title: 'Steel houses', img: '/api/img/content/bvk4n834b-r4-eg-vb.webp' },
      ],
    },
    stats: {
      heading: 'Our track record',
      items: [
        { label: 'Homes delivered', value: 87 },
        { label: 'On-time delivery rate (days)', value: 5 },
        { label: 'Avg. assembly time', value: 7 },
      ],
    },
    whyUs: {
      heading: 'Why families in Bulgaria and the EU choose us',
      items: [
        { icon: 'qa', title: 'No hidden costs', desc: 'Every price is listed with its specs and finishes itemised.' },
        { icon: 'person', title: 'A real person answers', desc: 'Call, write or visit us near Petrich — we reply within 24 hours.' },
        { icon: 'truck', pathKey: 'delivery', title: 'Delivered across the EU', desc: 'In-house logistics and turn-key handover, anywhere in the EU.' },
      ],
    },
    steps: {
      heading: 'From first call to handover in 6 steps',
      items: [
        {
          title: 'Discovery',
          long: 'We start by understanding your use case, timeline, budget and preferred model, so we can recommend the right direction from day one.',
        },
        {
          title: 'Design & specs',
          long: 'Once the concept is clear, we lock the layout, equipment and finish package so pricing and production move forward without guesswork.',
        },
        {
          title: 'Confirm & schedule',
          long: 'You get a clear commercial and scheduling checkpoint before production and transport are finalised.',
        },
        {
          title: 'Preparation & paperwork',
          long: 'Documentation, insurance, transport planning and a practical site-readiness checklist.',
        },
        {
          title: 'Delivery & assembly',
          long: 'The unit arrives on site, installation is coordinated, and the build is finished around the agreed scope.',
        },
        {
          title: 'Aftercare',
          long: 'After handover we stay available for warranty support, replacement parts and future upgrades.',
        },
      ],
    },
    mobileDock: {
      closeLabel: 'Close',
      title: 'NVC Home4You',
      description: 'Get a no-obligation quote or ask us anything. We respond within 24 hours.',
      primaryCta: 'Get a Quote',
    },
    testimonials: {
      take: 3,
      heading: 'What our customers say',
      subheading: 'In their own words, in the language they wrote them.',
      aggregateAria: 'Average customer rating',
      aggregatePattern: '{score} from {count} verified reviews',
      countLabel: '{count} verified reviews',
      verified: 'Verified',
      customerFallback: 'Customer',
      reviewIn: { bg: 'Review in Bulgarian', en: 'Review in English', el: 'Review in Greek' },
      ctaLabel: 'Read all reviews →',
    },
    finalCta: {
      title: 'Shall we talk about your home?',
      desc: 'Get a no-obligation quote or ask us anything. We respond within 24 hours.',
      primaryCta: 'Get a Quote',
      secondaryCta: 'Ask a Question',
      phone: '+359 87 935 5269',
      email: 'contact@nvc-home4you.eu',
      where: 'Mon–Fri 07:00–19:00 · Marikostinovo, Petrich, Bulgaria',
    },
    // What the page prints and what LocalBusinessJSONLD publishes, from one object.
    localBusiness: {
      url: 'https://nvc-home4you.eu/',
      email: 'contact@nvc-home4you.eu',
      telephone: '+359879355269',
      mapsHref: MAPS_HREF,
      address: {
        streetAddress: 'Marikostinovo',
        addressLocality: 'Petrich',
        addressRegion: 'Blagoevgrad',
        postalCode: '2850',
        addressCountry: 'BG',
      },
      hours: {
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '19:00',
      },
    },
  },
  // `servicesPage` removed 2026-08-17 with the page that read it — see routes/paths.js.
  common: {
    close: 'Close',
    open: 'Open',
    viberChatLabel: 'Open Viber chat',
    whatsAppChatLabel: 'Open WhatsApp chat',
    contactLabel: 'Call or chat',
    callLabel: 'Call',
    // What a screen reader announces as the KIND of widget on every image carousel
    // (aria-roledescription). bg has no key yet and keeps this English word as its fallback.
    carouselRoleDescription: 'carousel',
    lightbox: {
      closeLabel: 'Close',
      prevLabel: 'Prev',
      nextLabel: 'Next',
      descriptionHeading: 'Description',
      fromLabel: 'from',
      requestLabel: 'Request this model',
      thumbnailsLabel: 'Thumbnails',
      imageAltPattern: 'Image {current} of {total}',
      thumbnailAltPattern: 'Thumbnail {current} of {total}',
    },
    banner: {
      sending: 'Sending…',
      retrying: 'Retrying',
      retry: 'Try again',
    },
    toast: {
      successTitle: 'Success',
      errorTitle: 'Error',
      offerSuccess: 'Your request has been sent!',
      offerError: 'Failed to submit offer',
      questionSuccess: 'Your question has been sent!',
      questionError: 'Failed to submit question',
    },
  },
  forms: {
    offer: {
      title: 'Request a Quote',
      fields: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        project: 'Project details',
      },
      // Labels the line naming the gallery model an offer was requested for.
      model: 'Model',
      submit: 'Submit',
    },
    question: {
      title: 'Ask a Question',
      fields: {
        name: 'Name',
        email: 'Email',
        question: 'Your question',
      },
      submit: 'Send',
    },
  },
}

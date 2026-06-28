export default {
  header: {
    primaryNavAria: 'Primary',
    brand: { short: 'NVC', full: 'Home4You' },
    servicesSummary: 'Our Products & Services',
    nav: {
      gallery: 'Gallery',
      cases: 'Cases',
      faq: 'FAQ',
      about: 'About Us',
      partner: 'Partner',
      planner: 'Planner',
      quote: 'Get a Quote',
      boxConfigurator: "Configurator"
    },
    servicesMenu: {
      columns: [
        {
          title: 'Container & Prefab Homes',
          items: [
            { pathKey: 'modularBuilds', label: 'Modular builds' },
            { pathKey: 'modularHouses', label: 'Modular houses' },
            { pathKey: 'steelHouses', label: 'Steel houses' },
          ],
        },
        {
          title: 'Logistics & Site',
          items: [
            { pathKey: 'delivery', label: 'Door-to-door delivery' },
            { pathKey: 'logistics', label: 'Logistics' },
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
      system: 'System',
    },
    language: {
      label: 'Language',
      ariaLabel: 'Language',
      options: [
        { value: 'en', label: 'EN' },
        { value: 'bg', label: 'BG' },
        { value: 'el', label: 'EL' },
      ],
    },
    mobileMenuButtonAria: 'Open menu',
  },
  home: {
    hero: {
      title: "Because a home <g>shouldn't</g> be an expense",
      lead: 'Prefab and container homes delivered across Europe.',
      primaryCta: 'Get an Offer',
      secondaryCta: 'Ask a Question',
      motto: 'Trust & Security',
      badges: ['Delivered across the EU', 'Turn-key handover', 'In-house logistics'],
      showcase: {
        openLabel: 'Open',
        slidesLabel: 'Hero slides',
        slides: [
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdg/eg/vb', alt: 'Modular builds', pathKey: 'modularBuilds' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdf/eg/vb', alt: 'Modular houses', pathKey: 'modularHouses' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rde/eg/vb', alt: 'Steel houses', pathKey: 'steelHouses' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdc/eg/vb', alt: 'Interiors', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbx/eg/vb', alt: 'Interiors', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r7/eg/vb', alt: 'Interiors', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbu/eg/vb', alt: 'Interiors', pathKey: 'interiors' },
        ],
      },
    },
    serviceTiles: {
      ariaLabel: 'Our services',
      heading: 'Explore our services',
      subheading: 'Hover to reveal details, tap to open the page',
      button: 'Explore →',
      items: [
        {
          key: 'modularBuilds',
          pathKey: 'modularBuilds',
          title: 'Modular builds',
          desc: 'Ready-to-install modular units for living, office or retail—fast assembly, long-term use.',
          icon: 'layers',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbp/eg/vb',
        },
        {
          key: 'modularHouses',
          pathKey: 'modularHouses',
          title: 'Modular houses',
          desc: 'Permanent modular homes with flexible layouts and finishes.',
          icon: 'home',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdb/eg/vd',
        },
        {
          key: 'steelHouses',
          pathKey: 'steelHouses',
          title: 'Steel houses',
          desc: 'Light, strong steel-frame houses—smart on timelines and cost.',
          icon: 'steel',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdc/eg/vb',
        },
        {
          key: 'interiors',
          pathKey: 'interiors',
          title: 'Interiors',
          desc: 'Renovation of bathrooms and kitchens with a clear plan and transparent pricing.',
          icon: 'interior',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rce/eg/vb',
        },
      ],
    },
    glideServices: {
      ariaLabel: 'Our services',
      subheading: 'Swipe or tap any card to open the page',
      prevAria: 'Previous slide',
      nextAria: 'Next slide',
      dotsAria: 'Slide navigation',
      slides: [
        { key: 'steelHouse0', pathKey: 'steelHouses', title: 'Steel houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdd/eg/vb' },
        { key: 'steelHouse7', pathKey: 'steelHouses', title: 'Steel houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rde/eg/vb' },
        { key: 'modularHouse0', pathKey: 'modularHouses', title: 'Modular houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdf/eg/vb' },
        { key: 'steelHouse1', pathKey: 'steelHouses', title: 'Steel houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcf/eg/vb' },
        { key: 'steelHouse2', pathKey: 'steelHouses', title: 'Steel houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rm/eg/vb' },
        { key: 'modularHouse1', pathKey: 'modularHouses', title: 'Modular houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rb9/eg/vb' },
        { key: 'modularHouse2', pathKey: 'modularHouses', title: 'Modular houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r2/eg/vb' },
        { key: 'modularHouse3', pathKey: 'modularHouses', title: 'Modular houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rq/eg/vb' },
        { key: 'steelHouse3', pathKey: 'steelHouses', title: 'Steel houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rr/eg/vb' },
        { key: 'steelHouse4', pathKey: 'steelHouses', title: 'Steel houses', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r4/eg/vb' },
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
      heading: 'Why choose us',
      subheading: 'Outstanding homes, exceptional service.',
      items: [
        { icon: 'qa', title: 'Radical Transparency', desc: 'All prices are listed with specs and finishes itemized, with no hidden fees.' },
        { icon: 'paper', title: '24/7 Support', desc: 'Meet in person or remotely while we keep everything documented and transparent.' },
        { icon: 'truck', title: 'Clear Planning', desc: 'You will know your delivery and assembly dates from day one.' },
        { icon: 'star', title: 'Best value in Bulgaria', desc: 'Competitive pricing for container and prefab homes in Bulgaria.' },
      ],
    },
    steps: {
      heading: 'How we do it',
      progressLabel: 'Progress',
      stepOfPattern: 'Step {current} of {total}',
      items: [
        {
          title: '1. Discovery',
          short: 'Choose from our catalogue, email us, or visit us to discuss the right home for your project.',
          long: 'We start by understanding your use case, timeline, budget, and preferred model so we can recommend the right direction from day one.',
        },
        {
          title: '2. Design & Specs',
          short: 'Choose your layout, specs, and finishes while we organise the technical details.',
          long: 'Once the concept is clear, we lock the layout, equipment, and finish package so pricing and production can move forward without guesswork.',
        },
        {
          title: '3. Confirm & Schedule',
          short: 'We confirm the selection, the price, and the delivery window.',
          long: 'You receive a clear commercial and scheduling checkpoint before production and transport are finalized.',
        },
        {
          title: '4. Preparation & Paperwork',
          short: 'We prepare the documents, insurance, and transport, and share a site-readiness checklist.',
          long: 'This stage covers the logistics stack: documentation, insurance, transport planning, and the practical checklist for your site.',
        },
        {
          title: '5. Delivery & Assembly',
          short: 'We deliver, assemble, and finalize your new home.',
          long: 'The unit arrives on site, installation is coordinated, and the build is finalized around the agreed scope.',
        },
        {
          title: '6. Aftercare',
          short: 'Warranty support, spare parts, and upgrades keep your asset in top shape.',
          long: 'After handover, we remain available for warranty support, replacement parts, and future upgrades when needed.',
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
      subheading: 'Verified reviews from homeowners across Europe.',
      aggregateAria: 'Average customer rating',
      countLabel: '{count} verified reviews',
      verified: 'Verified',
      customerFallback: 'Customer',
      ctaLabel: 'Read all reviews →',
    },
    finalCta: {
      title: 'Ready to start your project?',
      desc: 'Get a no-obligation quote or ask us anything. We respond within 24 hours.',
      primaryCta: 'Get an Offer',
      secondaryCta: 'Ask a Question',
      phone: '+359 87 935 5269',
      email: 'contact@nvc-home4you.eu',
    },
    localBusiness: {
      url: 'https://nvc-home4you.eu/',
      email: 'contact@nvc-home4you.eu',
      telephone: '+359879355269',
    },
  },
  servicesPage: {
    heading: 'Our Services',
    subheading: 'Three categories, each with three specialized offerings.',
    categories: [
      {
        title: 'Container & Prefab Homes',
        items: [
          { title: 'Modular homes', desc: 'Flexible modules, quick assembly, modern finishes.' },
          { title: 'Light-steel houses', desc: 'Metal-frame homes with high insulation and long life.' },
          { title: 'Capsule & Apple cabins', desc: 'Sleek, plug-and-play design pods with panoramic glass; ideal for a studio and guest room.' },
        ],
      },
      {
        title: 'Logistics & Site',
        items: [
          { title: 'Door-to-door delivery', desc: 'Logistics, insurance, and EU customs handled.' },
          { title: 'Consolidation & Packing', desc: 'Combine homes and materials in one shipment.' },
          { title: 'Install coordination', desc: 'Trusted local partners for install and utility hookups.' },
        ],
      },
      {
        title: 'Materials, Furniture & Renovations',
        items: [
          { title: 'Bathrooms', desc: 'Showers, toilets, vanities, and fittings.' },
          { title: 'Walls & Floors', desc: 'Wall panels, flooring, and decking.' },
          { title: 'Interior renovations', desc: 'Kitchens, bathrooms, full fit-out, and furniture packs.' },
        ],
      },
    ],
  },
  common: {
    close: 'Close',
    open: 'Open',
    viberChatLabel: 'Open Viber chat',
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
      title: 'Request an Offer',
      fields: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        project: 'Project details',
      },
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

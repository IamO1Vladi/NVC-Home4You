export default {
  seo: {
    title: 'Bathroom and kitchen renovations | NVC Home4You',
    description:
      'Bathroom and kitchen renovations with a clear scope, configuration-based planning, transparent pricing logic, and practical before/after examples.',
    url: 'https://nvc-home4you.eu/en/interiors',
  },
  breadcrumbs: [
    { name: 'Home', url: 'https://nvc-home4you.eu/en' },
    { name: 'Interiors', url: 'https://nvc-home4you.eu/en/interiors' },
  ],
  title: 'Interior renovations',
  lead: 'Bathroom and kitchen renovation services with a clear scope, configurable work packages, and better control over timing and budget.',
  getOffer: 'Get an offer',
  askQuestion: 'Ask a question',
  hero: {
    quick: {
      h: 'At a glance',
      items: [
        'Planning and timeline from the start of the project',
        'Transparent pricing and a clearly defined scope',
        'Contract structure, coordination, and finish options',
      ],
      brochure: {
        file: 'modular-builds/modular-builds.pdf',
        page: 4,
        label: 'Open brochure (p. 4)',
      },
    },
  },
  tabs: {
    label: 'Interior renovation categories',
    bath: 'Bathroom',
    kitchen: 'Kitchen',
  },
  beforeAfterLabels: {
    comparisonAria: 'Before and after renovation comparison',
    revealLabel: 'Comparison slider',
    rangeLabel: 'Reveal amount',
    before: 'Before',
    after: 'After',
  },
  calculator: {
    heading: 'Choose the work scope',
    complexityLabel: 'Complexity',
    timelineLabel: 'Estimated timeline',
    cta: 'Send enquiry',
    baseScore: 1,
    levels: {
      low: { maxScore: 4, label: 'Low', timeline: 'up to 1 week' },
      medium: { maxScore: 8, label: 'Medium', timeline: '1–2 weeks' },
      high: { label: 'High', timeline: '2+ weeks' },
    },
  },
  bath: {
    h: 'Bathroom renovation',
    p: 'Combine preparatory, installation, and finishing work depending on the project requirements and the desired final standard.',
    options: [
      { key: 'bath_demo', label: 'Demolition and removal', weight: 2 },
      { key: 'bath_plumbing', label: 'Plumbing changes', weight: 3 },
      { key: 'bath_electrical', label: 'Electrical work', weight: 2 },
      { key: 'bath_tiles', label: 'Premium tiles', weight: 2 },
      { key: 'bath_underfloor', label: 'Underfloor heating', weight: 2 },
      { key: 'bath_grout', label: 'Grouting and silicone', weight: 1 },
      { key: 'bath_accessories', label: 'Mirrors and accessories', weight: 1 },
    ],
    beforeAfter: {
      before: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc2/eg/vb',
      after: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc4/eg/vb',
      altBefore: 'Bathroom before renovation',
      altAfter: 'Bathroom after renovation',
    },
  },
  kitchen: {
    h: 'Kitchen renovation',
    p: 'Plan the main kitchen workstream - site preparation, utilities, installation, and finishing - around the actual project scope.',
    options: [
      { key: 'kitchen_design', label: 'Planning and design', weight: 1 },
      { key: 'kitchen_prep', label: 'Site preparation', weight: 2 },
      { key: 'kitchen_utils', label: 'Utilities and outlets', weight: 3 },
      { key: 'kitchen_install', label: 'Kitchen installation', weight: 3 },
      { key: 'kitchen_finish', label: 'Final finishes', weight: 1 },
    ],
    beforeAfter: {
      before: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc3/eg/vb',
      after: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcz/eg/vb',
      altBefore: 'Kitchen before renovation',
      altAfter: 'Kitchen after renovation',
    },
  },
  why: {
    h: 'Why work with us',
    items: [
      'A clear scope and structured process before work begins.',
      'Flexible configuration options based on budget, timing, and finish standard.',
      'Coordination of finishes, deliveries, and final execution under one plan.',
    ],
  },
}

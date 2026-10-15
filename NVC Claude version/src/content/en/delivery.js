import { euro } from '../../lib/euro.js'
import { DELIVERY_BASES, DELIVERY_RATES } from '../shared/deliveryRates.js'

// The estimator still computes one rate, the container's, from Marikostinovo; the heading
// above it names both products. Every figure comes from deliveryRates.js.
const CONTAINER = DELIVERY_RATES.products.container
const BOX = DELIVERY_RATES.products.box

export default {
  seo: {
    title: 'Door-to-door delivery for modular and prefab homes | NVC Home4You',
    description:
      'Door-to-door delivery for modular, prefab, and container homes with route planning, tracking, customs support, and an interactive delivery estimator.',
    url: 'https://nvc-home4you.eu/en/delivery',
  },
  breadcrumbs: [
    { name: 'Home', url: 'https://nvc-home4you.eu/en' },
    { name: 'Delivery', url: 'https://nvc-home4you.eu/en/delivery' },
  ],
  hero: {
    title: 'Door-to-door delivery',
    getOffer: 'Get an Offer',
    askQuestion: 'Ask a Question',
    image: {
      src: '/api/img/content/bvk4n834b-rcd-eg-vb.webp',
    },
  },
  process: {
    segmentMs: 1500,
    lead: 'We manage delivery from order confirmation to unloading on site, with a clear process and coordination at every stage.',
    bullets: [
      'Shipment tracking and route coordination.',
      'Support for cargo insurance and unloading planning.',
      'Document preparation and assistance with customs procedures.',
    ],
    replay: 'Replay',
    steps: [
      {
        key: 'order',
        heading: 'Order confirmation',
        body: 'We confirm the model, delivery address, timeline, and transport conditions so the route is planned correctly from the start.',
        meta: 'Planning and coordination',
      },
      {
        key: 'prod',
        heading: 'Production and preparation',
        body: 'We coordinate loading, packaging, and site readiness before the shipment leaves.',
        meta: 'Shipment prep',
      },
      {
        key: 'export',
        heading: 'Export and dispatch',
        body: 'The shipment departs with the required paperwork in place and the client receives progress updates.',
        meta: 'Documents and departure',
      },
      {
        key: 'import',
        heading: 'Import and customs',
        body: 'We coordinate import formalities and local logistics for a smooth handover into the destination market.',
        meta: 'Customs support',
      },
      {
        key: 'door',
        heading: 'Delivery to address',
        body: 'We follow the final stage through to unloading and handover according to the agreed plan.',
        meta: 'Final delivery',
      },
    ],
    // No lead-time chips: the owner is still confirming lead times (2026-10-15).
  },
  estimator: {
    locale: 'en-GB',
    acceptLanguage: 'en,bg',
    base: DELIVERY_BASES.marikostinovo,
    ratePerKm: CONTAINER.perKm,
    strings: {
      heading: 'Estimated delivery price',
      subheading: `Container: ${euro(CONTAINER.perKm, 'en')}/km from Marikostinovo, counted both ways. Box house: about ${euro(BOX.perKm, 'en')}/km, counted both ways, from Marikostinovo or Varna (whichever is closer), plus a crane, about ${euro(BOX.crane.about, 'en')}, or more depending on the location. Prices exclude VAT.`,
      // Owner, 2026-10-15: abroad only Greece so far, at the same rates; other countries on request.
      countriesNote: 'Bulgaria and Greece, same rates. Other countries: on request.',
      placeholder: 'Enter an address (example: Sofia, Cherni Vrah Blvd 1)',
      buttonIdle: 'Calculate',
      buttonLoading: 'Searching…',
      addressLabel: 'Address:',
      oneWayLabel: 'One-way distance:',
      billableLabel: 'Billable distance:',
      estimateLabel: 'Estimated price for a container:',
      vatLabel: 'excl. VAT',
      searchNote: 'Fallback straight-line estimate shown when road routing is unavailable.',
      helpText: 'Enter an address or click the map to drop a destination pin.',
      droppedPin: 'Dropped pin',
      geocodeError: 'Geocoding failed',
      notFoundError: 'Address not found',
      // A map pin outside the countries above gets this in place of a price.
      outsideError: 'Outside Bulgaria and Greece, delivery is quoted on request.',
      genericError: 'Something went wrong',
      emptyValue: '—',
      km: 'km',
    },
  },
}

// src/content/en/faq.js
import { euro } from '../../lib/euro.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../shared/deliveryRates.js'

// The crane and lead-time answers quote the owner's figures (2026-10-15) from deliveryRates.js.
const { container: CONTAINER, box: BOX } = DELIVERY_RATES.products
const crane = (product) => euro(product.crane.about, 'en')

export default {
  seo: {
    title: 'Frequently Asked Questions about Modular Homes and Containers | NVC Home4You',
    description:
      'Answers to frequently asked questions about lead times, logistics, payments, delivery, and customization for modular homes and container solutions.',
    url: 'https://nvc-home4you.eu/en/faq',
  },
  heading: 'Frequently Asked Questions',
  allLabel: 'All',
  categoryLabel: 'Category',
  categoryFallbackPrefix: 'Category',
  categoriesAria: 'FAQ categories',
  searchPlaceholder: 'Search questions...',
  searchAria: 'Search FAQ',
  noResultsText: 'No results.',
  groups: [
    {
      title: 'Ordering',
      items: [
        {
          q: 'What is the typical timeline?',
          a: `A container in stock is delivered within ${LEAD_TIMES.containerInStockDays} days. A Box house takes up to ${LEAD_TIMES.boxProductionDays} days to make and reaches your address in about ${LEAD_TIMES.boxToAddressMonths} months. For containers made to order and custom houses, ask us.`,
        },
        {
          q: 'Can I customize finishes?',
          a: 'Yes, we provide curated finish packs and custom options on request.',
        },
      ],
    },
    {
      title: 'Logistics',
      items: [
        {
          q: 'Do you handle customs?',
          a: 'Yes. We manage declarations, duties, and import compliance.',
        },
        {
          q: 'Do I need a crane, and what does it cost?',
          a: `It depends on the product. A Box house needs one: about ${crane(BOX)} excl. VAT, or more depending on the location. For a container it is your choice and at your cost, about ${crane(CONTAINER)} excl. VAT; we then assemble it in our warehouse and it arrives finished, with no travel or accommodation for workers to pay. Without a crane, two of our workers assemble the container on site. They stay ${CONTAINER.noCrane.nights} nights, and you arrange their accommodation; depending on the location, their travel adds up to ${euro(CONTAINER.noCrane.travelMax, 'en')} excl. VAT.`,
        },
      ],
    },
    {
      title: 'Payments',
      items: [
        {
          q: 'What payment terms are available?',
          a: 'Milestone-based payments matched to production and delivery.',
        },
        {
          q: 'Do you offer financing?',
          a: 'We can introduce financing partners depending on the project.',
        },
      ],
    },
  ],
}

export default {
  locale: 'en-GB',
  api: {
    casesPageEndpoint: '/api/cases-page',
    reviewsEndpoint: '/api/reviews',
  },
  seo: {
    // The title and description are routeMeta.js's (META.cases), read by the cases routes.
    url: 'https://nvc-home4you.eu/en/cases',
  },
  breadcrumbs: [
    { name: 'Home', url: 'https://nvc-home4you.eu/en' },
    { name: 'Cases & Reviews', url: 'https://nvc-home4you.eu/en/cases' },
  ],
  copy: {
    heroTitle: 'Cases & Reviews',
    heroLead:
      'Deliveries to our customers and their reviews: what they bought, where it went, photos and ratings from 1 to 5 stars.',
    heroPoints: [
      'Published cases with company, product, and location',
      'Visible customer ratings and written reviews',
      'A short 1–5 star form for new customer reviews',
    ],
    ctaPrimary: 'Get an Offer',
    ctaSecondary: 'Ask a Question',
    panelTitle: 'What you will find here',
    stats: {
      cases: 'Published cases',
      rating: 'Average rating',
      reviews: 'Customer reviews',
      countries: 'Countries served',
    },
    buyersTitle: 'Who buys from us',
    buyersLead:
      'Companies and sectors that buy from us.',
    buyersEmpty:
      'No published buyer companies yet.',
    casesTitle: 'Recent cases',
    casesLead:
      'What we delivered, to whom and where, with the customer\'s own review.',
    filters: {
      all: 'All',
      modularBuilds: 'Container units',
      modularHouses: 'Modular houses',
      steelHouses: 'Steel-frame prefab houses to your plan',
      interiors: 'Interiors',
      delivery: 'Delivery',
      logistics: 'Logistics',
      other: 'Other',
    },
    // Each case card's link to its product page, by the card's category (CasesPage.jsx
    // CASE_PAGE). A category with no line here (interiors, logistics, other) gets no link.
    productLinks: {
      modularBuilds: 'More about the containers →',
      modularHouses: 'More about the Box houses →',
      steelHouses: 'More about the houses built to a plan →',
      delivery: 'More about delivery and assembly →',
    },
    labels: {
      buyer: 'Buyer',
      product: 'Product',
      location: 'Location',
      scope: 'Scope',
      result: 'Result',
      year: 'Year',
      units: 'Units',
      sector: 'Sector',
      approved: 'Approved',
      purchased: 'Purchased',
      company: 'Company',
      customer: 'Customer',
    },
    featured: 'Featured',
    photosLabel: 'Photos',
    similarCta: 'Ask for something similar',
    noCases:
      'No published cases yet.',
    reviewsTitle: 'Ratings & reviews',
    reviewsLead:
      'Real ratings and reviews from our customers.',
    breakdownTitle: 'Rating breakdown',
    noRatings: 'No public ratings yet.',
    formTitle: 'Leave a review',
    formLead:
      'Leave your rating and a short comment about your experience with us.',
    moderation: 'New reviews appear shortly after they are submitted.',
    placeholders: {
      name: 'Name',
      company: 'Company',
      email: 'Email',
      location: 'City / country',
      product: 'What did you buy?',
      comment: 'Write a short review about delivery, product quality, or communication',
    },
    submit: 'Submit review',
    sending: 'Sending…',
    success:
      'Thank you. Your review was received and will appear shortly.',
    error:
      'The review could not be submitted right now. Please try again later.',
    noReviewsCard:
      'When reviews are available, they will appear here as public testimonials.',
  },
  lightbox: {
    closeLabel: 'Close',
    prevLabel: 'Prev',
    nextLabel: 'Next',
    descriptionHeading: 'Description',
    thumbnailsLabel: 'Thumbnails',
    imageAltPattern: 'Image {current} of {total}',
    thumbnailAltPattern: 'Thumbnail {current} of {total}',
  },
}

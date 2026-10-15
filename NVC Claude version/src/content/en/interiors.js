// /en/interiors: the English twin of bg/interiors.js, the same facts and nothing more (see
// the notes there). No prices, no durations, a warranty "under the contract" with no years.
export default {
  home: 'Home',
  breadcrumb: 'Interior renovations',
  service: {
    name: 'Bathroom and kitchen renovation',
    serviceType: 'Interior renovations',
  },

  hero: {
    eyebrow: 'Interior renovations · Sofia to Petrich',
    h1: 'Bathroom and kitchen renovation by our own team',
    lead: 'Our builders do the whole renovation, from the demolition to fitting the kitchen, in the area from Sofia to Petrich. First we come for a free site visit; then you get a written offer, we sign a contract and the work comes with a warranty.',
    primary: 'Book a free site visit',
    call: 'Call us',
    facts: [
      'Free site visit',
      'Written offer and a contract',
      'Warranty under the contract',
      'Materials from us or from you',
    ],
    photoAlt: 'Bathroom in black marble and wood-look tiles: black shower set, basin on a wooden vanity unit, window',
    photoCaption: 'A bathroom renovated by our team',
  },

  works: {
    heading: 'What we do',
    sub: 'One team does all the work on your bathroom or kitchen: ours. You do not have to find and coordinate separate tradespeople.',
    items: [
      { key: 'demolition', title: 'Demolition and strip-out', text: 'We take out the old tiles, sanitary ware and cabinets, so the renovation starts from a clean room.' },
      { key: 'plumbing', title: 'Plumbing', text: 'New pipes, outlets and drainage for the bathroom and the kitchen.' },
      { key: 'electrics', title: 'Electrics', text: 'New cables, sockets, switches and points for the lighting.' },
      { key: 'tiling', title: 'Tiling', text: 'Wall and floor tiles in the bathroom and the kitchen.' },
      { key: 'plasterboard', title: 'Plasterboard', text: 'Partition walls, wall linings and suspended ceilings.' },
      { key: 'painting', title: 'Painting', text: 'Filling, smoothing and painting of the walls and ceilings.' },
      { key: 'flooring', title: 'Flooring', text: 'We prepare the base and lay the new floor.' },
      { key: 'kitchenFitting', title: 'Kitchen fitting', text: 'We assemble and fit the cabinets and the worktop on site.' },
    ],
  },

  materials: {
    heading: 'Materials: ours or yours',
    ours: {
      title: 'We supply the materials',
      text: 'Tiles, sanitary ware, cables, pipes and everything else the renovation needs: we supply them and include them in the offer.',
    },
    yours: {
      title: 'You provide the materials',
      text: 'If you have already chosen or bought the materials, our team puts them in.',
    },
    note: 'Tell us at the site visit which you prefer.',
  },

  jobs: {
    heading: 'Our renovations',
    sub: 'Photos and short videos from our team’s own jobs, not catalogue pictures.',
    clips: [
      { key: 'bathBlack', title: 'Black marble bathroom', text: 'A basin on a wooden vanity under the window and a black shower set on wood-look tiles.' },
      { key: 'bathWhite', title: 'White tiled bathroom', text: 'Lit niches in a wood-look tile column, a glass screen and a chrome shower set.' },
    ],
    photos: [
      { key: 'kitchen', title: 'The kitchen after fitting', alt: 'The apartment kitchen after the cabinets were fitted: fridge, tall unit, white wall cabinets and dark base units with washing machine and oven' },
      { key: 'kitchenFitting', title: 'Fitting the cabinets', alt: 'Fitting the kitchen cabinets: open wall units, a stepladder, the worktop being finished' },
    ],
    pairsHeading: 'Before and after',
    pairs: [
      {
        key: 'bathroom',
        title: 'Bathroom',
        before: { label: 'Before', alt: 'The bathroom after demolition: bare walls and rubble on the floor' },
        after: { label: 'After', alt: 'The same bathroom after the renovation: marble-look tiles, a basin on a wooden top, a wall-hung toilet' },
      },
      {
        key: 'kitchen',
        title: 'Kitchen',
        before: { label: 'During fitting', alt: 'The kitchen during fitting: some doors not yet on, packaging on the floor' },
        after: { label: 'Finished', alt: 'The same kitchen along its full length, after fitting' },
      },
    ],
  },

  process: {
    heading: 'How we work',
    sub: 'From the first call to the finished room. The price comes after the site visit, in the written offer.',
    steps: [
      { title: 'Enquiry', text: 'Write to us with the form below or call us: what you want renovated, and where.' },
      { title: 'Free site visit', text: 'We come to the property, look at the room and agree with you what is to be done and with which materials.' },
      { title: 'Written offer and contract', text: 'You get a written offer for the agreed work. Once you accept it, we sign a contract.' },
      { title: 'The renovation', text: 'Our team does the agreed work, from the demolition to the fitting.' },
      { title: 'Handover with a warranty', text: 'We hand the finished room over to you. The work carries a warranty under the contract.' },
    ],
  },

  area: {
    heading: 'Where we work',
    place: 'From Sofia to Petrich',
    text: 'We renovate in the area from Sofia to Petrich, in Bulgaria. Tell us where the property is and we will get back to you.',
    from: 'Sofia',
    to: 'Petrich',
    mapLabel: 'The area we work in: from Sofia in the north to Petrich in the south',
    termsHeading: 'At a glance',
    terms: [
      { key: 'area', label: 'Area', text: 'From Sofia to Petrich' },
      { key: 'team', label: 'Who does the work', text: 'Our own team of builders' },
      { key: 'visit', label: 'Site visit', text: 'Free, at the property' },
      { key: 'price', label: 'Price', text: 'In the written offer after the visit, depending on the work and materials' },
      { key: 'contract', label: 'Contract', text: 'Signed before we start' },
      { key: 'warranty', label: 'Warranty', text: 'Under the contract' },
      { key: 'materials', label: 'Materials', text: 'Supplied by us or provided by you' },
    ],
  },

  form: {
    heading: 'Book a free site visit',
    sub: 'Tell us briefly what you want renovated. We will contact you to arrange the visit.',
    optional: 'optional',
    invalid: 'Please fill in the marked fields.',
    service: {
      legend: 'What are you renovating',
      options: { bathroom: 'Bathroom', kitchen: 'Kitchen', other: 'Something else' },
      error: 'Choose bathroom, kitchen or something else.',
    },
    works: {
      legend: 'What needs doing',
      hint: 'Tick what you know; we will settle the rest at the site visit.',
    },
    materials: {
      legend: 'Materials',
      options: { ours: 'Please supply them', yours: 'I will provide them', unsure: 'Not sure yet' },
    },
    town: { label: 'Town or village', error: 'Tell us where the property is.' },
    timing: {
      label: 'When would you like us to start',
      placeholder: 'Choose',
      options: { asap: 'As soon as possible', months: 'In the next few months', later: 'Later on', exploring: 'Just looking for now' },
    },
    name: { label: 'Name', error: 'Please write your name.' },
    phone: { label: 'Phone', error: 'Please give a phone number, so we can arrange the visit.' },
    email: { label: 'Email', error: 'Please give an email address we can write to.' },
    message: { label: 'Message', placeholder: 'The size of the room, what you dislike about it now, what you would like…' },
    // The labels of the summary the form writes above the message (InteriorsEnquiry
    // composeProject); the answers are the form's own words. The Bulgarian page uses STAFF_LINES.
    summary: { service: 'Renovating', works: 'Work needed', materials: 'Materials', town: 'Town', timing: 'When' },
    privacy: 'We use your details only to answer your enquiry.',
    privacyLink: 'Privacy',
    submit: 'Send the enquiry',
  },

  faq: {
    heading: 'Frequently asked questions',
    items: [
      { q: 'How much does a renovation cost?', a: 'The price depends on the work and the materials, so we give it after the free site visit, in a written offer.' },
      { q: 'Do you charge for the site visit?', a: 'No, the site visit is free. After it you get a written offer.' },
      { q: 'Where do you work?', a: 'In the area from Sofia to Petrich, in Bulgaria. Tell us where the property is and we will get back to you.' },
      { q: 'Who does the renovation?', a: 'Our own team of builders: from the demolition, plumbing and electrics to the tiles, the paint, the floors and fitting the kitchen.' },
      { q: 'Who provides the materials?', a: 'As you prefer: we can supply them, or you provide them and our team puts them in.' },
      { q: 'Is there a contract and a warranty?', a: 'Yes. We sign a contract before we start, and the work carries a warranty under the contract.' },
      { q: 'How long does a renovation take?', a: 'It depends on the work, so we do not give a time in advance. We discuss it with you after the site visit.' },
    ],
  },

  siblings: {
    heading: 'More from NVC',
    go: 'Take a look →',
    doors: { label: 'Internal doors', desc: 'Doors as a set with frame, hinges, handle and trims, and fitting if you want it.' },
    about: { label: 'About us', desc: 'Who we are, where we work from and what we do.' },
    containers: { label: 'Living containers', desc: 'Containers for living and for offices, delivered to your plot.' },
  },

  finalTitle: 'Shall we look at your bathroom or kitchen?',
  finalDesc: 'The site visit is free. Call us or write to us.',
}

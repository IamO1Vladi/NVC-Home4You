// /en/steel-houses — "Steel-frame prefab houses to your plan". The same page as
// /bg/sglobqemi-kyshti, in English; see src/content/bg/steelHouses.js for where each fact
// comes from, why there are no fixed figures, and what the pictures are. No price is typed
// here: the sibling cards' figures come from the gallery rows.
export default {
  hero: {
    eyebrow: 'To your plan',
    h1: 'Prefab houses with a steel frame',
    lead:
      'Houses on a galvanised steel frame, each one to its own project. Send us your plan and we will quote it, or, if you have none, we will draw it up for you.',
    // The offer form takes words, not files, so the button asks for a quote; the plan itself
    // goes by email (how.filesLead).
    cta: 'Request a quote for your project',
    call: 'Call us',
    // Read only when the admin set a photo but left its description empty.
    photoAlt: 'A prefab house with a steel frame',
  },

  // What a project decides, in place of the old "technical data", and nothing with a figure.
  decide: {
    title: 'What your project decides',
    items: ['Floor area and floors', 'Layout', 'Facade', 'Roof', 'Insulation', 'Interior finish'],
    note: 'All of it follows your project and your choices: every house is a project of its own.',
    frameLabel: 'Frame',
    frame: 'galvanised steel, sized to the project',
  },

  how: {
    h2: 'How we work from your plan',
    sub: 'Two ways to start, depending on whether you already have a plan.',
    routes: [
      {
        h: 'You have a plan or a sketch',
        p: 'Send it to us: an architect’s design, a floor plan or a sketch. We will prepare a quote for it.',
      },
      {
        h: 'You have no plan yet',
        p: 'We will draw it up. Tell us the floor area, the number of floors and the number of bedrooms you have in mind; we prepare the design and send you a quote for it.',
      },
    ],
    filesLead: 'If your plan is in a file, you can also email it to',
  },

  // The five stages and their pictures, as in the Bulgarian file.
  process: {
    h2: 'How a project goes',
    sub: 'Five steps from the idea to the finished house. The pictures show one example house at each stage.',
    steps: [
      {
        title: 'Design and layout',
        text: 'We start from your plan or sketch, or, if you have none, we draw the project up with you: floor area, floors, rooms and how the house will look.',
        image: {
          src: '/api/img/content/bvk4n834b-rcn-eg-vb.webp',
          alt: 'Render of a two-storey house with a triangular roof, a glazed gable and a timber deck',
          caption: 'A render of the house from the project',
        },
      },
      {
        title: 'Structural drawings and details',
        text: 'From the layout we calculate the steel frame and draw every beam, joint and opening, so the house goes together exactly as designed.',
        image: {
          src: '/api/img/content/bvk4n834b-rcj-eg-vb.webp',
          alt: 'Render of the steel frame of a two-storey house with a triangular roof on a timber platform',
          caption: 'The steel frame from the structural drawings',
        },
      },
      {
        title: 'Manufacturing and finishing materials',
        text: 'We make the steel parts to the drawings and prepare the materials for the facade, roof and interior you have chosen.',
        image: {
          src: '/api/img/content/bvk4n834b-rw-eg-vb.jpg',
          alt: 'Render of steel floor and wall panels laid out before assembly',
          caption: 'The steel floor and wall panels',
        },
      },
      {
        title: 'Delivery and customs',
        text: 'We deliver the parts to your plot and handle the customs clearance. On site the frame is assembled and closed with boards.',
        link: { pathKey: 'delivery', label: 'How we quote delivery →' },
        image: {
          src: '/api/img/content/bvk4n834b-rck-eg-vb.webp',
          alt: 'Render of the assembled steel frame closed with boards on the walls and roof',
          caption: 'The frame closed with boards',
        },
      },
      {
        title: 'Assembly on site and handover',
        text: 'We fit the cladding, windows and roof, finish the details and hand the house over to you.',
        image: {
          src: '/api/img/content/bvk4n834b-rcm-eg-vb.webp',
          alt: 'Render of the house with cladding, large windows and canopies over the decks',
          caption: 'Cladding, windows and canopies',
        },
      },
    ],
  },


  price: {
    h2: 'Price of a house built to your plan',
    link: 'Prices of the ready models →',
    // The gallery has the containers and the Box houses, not steel-frame houses, and the
    // words say so.
    galleryLink: 'Photos of the ready models in the gallery →',
  },

  ready: {
    h2: 'Looking for a ready model with a clear price?',
    go: 'Take a look →',
    from: 'from',
    containers: {
      label: 'Container units',
      desc: 'Living and office containers of 6×3, 7×3 and 8×3 m, delivered and assembled by us.',
      basis: 'incl. VAT and assembly',
    },
    houses: {
      label: 'Modular houses',
      desc: 'Expandable Box houses from 18 to 74 m² that arrive folded and are unfolded on site.',
      basis: 'incl. VAT, without assembly',
    },
  },

  final: {
    title: 'Have a plan or a sketch?',
    desc: 'Send it over or tell us what you have in mind; if you have no plan, we will draw one up. We respond within 24 hours.',
  },
}

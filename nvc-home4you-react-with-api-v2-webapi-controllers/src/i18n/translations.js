export const dictionaries = {
  en: {
    brand: { name: 'NVC Home4You', motto: 'Trust & Security' },
    nav: {
      services: 'Our Services', product: {
      price: 'Price',
      from: 'from',
      description: 'Description',
      request: 'Request this model'
    },
    gallery: 'Gallery', faq: 'FAQ', about: 'About Us', quote: 'Get a Quote',
      getOffer: 'Get an Offer', askQuestion: 'Ask a Question',
      theme: { light: 'Light', dark: 'Dark', system: 'System' }, lang: 'Language'
    },
    hero: {
      title: 'Prefab homes delivered <g>turnkey</g> across Eastern Europe',
      lead: 'End-to-end import services: supplier sourcing, quality control, shipping, and customs for Bulgaria, Romania, Greece, and beyond.',
      bullets: ['Supplier sourcing & quality assurance','Freight management & EU compliance','Efficient delivery to your location']
    },
    steps: {
      heading: 'How we work',
      labels: [
        { t: '1. Discovery', d: 'We listen, align on goals, timeline, and budget, then determine scope.' },
        { t: '2. Design & Spec', d: 'We refine layouts, materials, and finishes; confirm technical requirements.' },
        { t: '3. Sourcing & QA', d: 'We vet suppliers, inspect factory output, and secure schedules & pricing.' },
        { t: '4. Shipping & Customs', d: 'We handle freight, insurance, and EU customs documentation end-to-end.' },
        { t: '5. Delivery & Install', d: 'We coordinate on-site delivery, assembly, and final checks with your team.' },
        { t: '6. Aftercare', d: 'Warranty support, spare parts, and upgrades to keep your asset in top shape.' }
      ],
      progress: 'Progress'
    },
    home: {
      whyH: 'Why choose us',
      whyS: 'We take care of headaches so you can focus on the build.',
      why: [
        ['Factory QA', 'Independent inspections before shipping.'],
        ['Paperwork handled', 'Customs, declarations, CE docs.'],
        ['Predictable logistics', 'Slots locked; proactive tracking.'],
        ['Local aftercare', 'Warranty, parts, upgrades.']
      ],
      statsH: 'Our track record',
      stats: [
        ['Projects delivered', 120],
        ['Avg. lead time (weeks)', 8],
        ['Countries served', 6]
      ]
    },
    product: {
      price: 'Price',
      from: 'from',
      description: 'Description',
      request: 'Request this model'
    },
    gallery: { heading: 'Gallery', sub: 'Browse product types. Click to open a detail view with more photos.', open: 'Open to view images' },
    faq: {
      heading: 'Frequently Asked Questions',
      search: 'Search questions...', noResults: 'No results',
      groups: [
        { title:'Ordering', items:[
          { q:'What is the typical timeline?', a:'6–10 weeks depending on configuration and location.'},
          { q:'Can I customize finishes?', a:'Yes, we provide curated finish packs and custom options on request.'}
        ]},
        { title:'Logistics', items:[
          { q:'Do you handle customs?', a:'Yes. We manage declarations, duties, and import compliance.'},
          { q:'Who arranges cranes?', a:'We can coordinate cranes and site access as part of delivery.'}
        ]},
        { title:'Payments', items:[
          { q:'What payment terms are available?', a:'Milestone-based payments matched to production and delivery.'},
          { q:'Do you offer financing?', a:'We can introduce financing partners depending on the project.'}
        ]}
      ]
    },
    about: {
      heading: 'About Us',
      missionH: 'Our Mission',
      missionP: 'We bring together vetted manufacturers, reliable logistics, and local expertise so your project runs smoothly. One accountable partner—from specs and factory QA to freight, customs, and on-site delivery.',
      principlesH: 'Our Principles',
      principles: ['Transparency over surprises', 'Quality over shortcuts', 'Service over transactions'],
      timelineH: 'Our Timeline',
      timeline: [
        { y:'2019', h:'Founded', p:'Started with prefab site cabins for construction partners.' },
        { y:'2021', h:'Expanded Logistics', p:'Added full freight & customs handling for clients in BG/RO/GR.' },
        { y:'2024', h:'Quality Network', p:'Formalized QA checks at factories and introduced aftercare.' }
      ]
    },
    cta: { title: 'Ready to start your project?', desc: 'Get a no-obligation quote or ask us anything. We respond within 24 hours.' },
    services: {
      heading: 'Our Services', sub: 'Three categories, each with three specialized offerings.',
      categories: [
        { h:'Prefab Homes', items:[
          ['Modular homes', 'Flexible modules, quick assembly, modern finishes.'],
          ['Tiny homes', 'Compact, efficient living spaces for sites and retreats.'],
          ['Site cabins', 'Durable on-site offices and accommodation.']
        ]},
        { h:'Logistics & Site', items:[
          ['Freight & customs', 'Door-to-door shipping with EU customs handled for you.'],
          ['On-site delivery', 'Scheduling, crane coordination, access planning.'],
          ['Install coordination', 'Trusted local partners for install and utility hookups.']
        ]},
        { h:'Aftercare', items:[
          ['Warranty support', 'We facilitate resolutions quickly with manufacturers.'],
          ['Spare parts', 'Fast sourcing of components and finishes.'],
          ['Upgrades', 'Add solar, insulation, decks, and more over time.']
        ]}
      ]
    },
    forms: { offer:'Request an Offer', question:'Ask a Question', name:'Name', email:'Email', phone:'Phone', project:'Project details', submit:'Submit', send:'Send' },
    footer: { copyright: 'NVC Home4You — Trust & Security' }
  ,
    
    routes: {
      heading: 'Logistics Routes (illustrative)',
      aria: 'Logistics route',
      grp1: { title: 'Greece → Bulgaria → All around Bulgaria' },
      grp2: { title: 'Greece → Macedonia' },
      grp3: { title: 'Greece → Bulgaria → Macedonia' },
      grp4: { title: 'Greece → Bulgaria → Serbia' },
      grp5: { title: 'Greece → Bulgaria → Romania' },
      nodes: {
        gr:'Greece', bg:'Bulgaria', mk:'Macedonia', rs:'Serbia', ro:'Romania', bg_all:'All around Bulgaria',
        start:'Start hub', staging:'Staging & customs', final_bg:'Final delivery across BG',
        direct:'Direct route', transit:'Transit / staging', delivery:'Delivery'
      }
    }
  },
  bg: {
    brand: { name: 'NVC Home4You', motto: 'Доверие и сигурност' },
    nav: {
      services: 'Нашите услуги', product: {
      price: 'Цена',
      from: 'от',
      description: 'Описание',
      request: 'Заяви този модел'
    },
    gallery: 'Галерия', faq: 'Въпроси', about: 'За нас', quote: 'Заяви оферта',
      getOffer: 'Получи оферта', askQuestion: 'Задай въпрос',
      theme: { light: 'Светла', dark: 'Тъмна', system: 'Система' }, lang: 'Език'
    },
    hero: {
      title: 'Модулни домове <g>до ключ</g> в цяла Източна Европа',
      lead: 'Пълен цикъл: намиране на доставчик, контрол на качеството, транспорт и митници за България, Румъния, Гърция и др.',
      bullets: ['Одит на доставчици и контрол на качеството','Логистика и съответствие с ЕС','Бърза доставка до вашия обект']
    },
    steps: {
      heading: 'Как работим',
      labels: [
        { t: '1. Откриване', d: 'Изясняваме цели, срокове и бюджет и определяме обхвата.' },
        { t: '2. Проект & спецификация', d: 'Уточняваме разпределения, материали и технически изисквания.' },
        { t: '3. Доставчици & контрол', d: 'Одобряваме доставчици, инспектираме продукция и фиксираме графици и цени.' },
        { t: '4. Транспорт & митници', d: 'Организираме транспорт, застраховка и документи по митница за ЕС.' },
        { t: '5. Доставка & монтаж', d: 'Координираме доставка на място, монтаж и финални проверки.' },
        { t: '6. Поддръжка', d: 'Гаранционно обслужване, резервни части и ъпгрейди.' }
      ],
      progress: 'Прогрес'
    },
    home: {
      whyH: 'Защо с нас',
      whyS: 'Ние поемаме сложното, за да строите спокойно.',
      why: [
        ['Фабричен контрол', 'Независими проверки преди транспорт.'],
        ['Документация', 'Митница, декларации, CE документи.'],
        ['Предвидима логистика', 'Резервирани слотове и проследяване.'],
        ['Местна поддръжка', 'Гаранция, части, ъпгрейди.']
      ],
      statsH: 'Нашите резултати',
      stats: [
        ['Доставени проекта', 120],
        ['Среден срок (седмици)', 8],
        ['Държави', 6]
      ]
    },
    product: {
      price: 'Цена',
      from: 'от',
      description: 'Описание',
      request: 'Заяви този модел'
    },
    gallery: { heading: 'Галерия', sub: 'Разгледайте типовете продукти. Клик за повече снимки.', open: 'Отвори галерията' },
    faq: {
      heading: 'Често задавани въпроси',
      search: 'Търсене...', noResults: 'Няма резултати',
      groups: [
        { title:'Поръчки', items:[
          { q:'Какъв е срокът за изпълнение?', a:'6–10 седмици според конфигурацията и локацията.'},
          { q:'Мога ли да променям финалите?', a:'Да, предлагаме пакети и индивидуални решения.'}
        ]},
        { title:'Логистика', items:[
          { q:'Вие ли се занимавате с митницата?', a:'Да. Ние поемаме декларации, такси и съответствие.'},
          { q:'Кой осигурява кран?', a:'Можем да координираме кран и достъп до обекта.'}
        ]},
        { title:'Плащания', items:[
          { q:'Какви са условията на плащане?', a:'Плащания по етапи според производството и доставката.'},
          { q:'Има ли финансиране?', a:'Можем да ви свържем с партньори за финансиране.'}
        ]}
      ]
    },
    about: {
      heading: 'За нас',
      missionH: 'Нашата мисия',
      missionP: 'Свързваме проверени производители, надеждна логистика и местен опит, за да протече проектът гладко. Един отговорен партньор — от спецификации и фабричен контрол до транспорт, митници и доставка на място.',
      principlesH: 'Нашите принципи',
      principles: ['Прозрачност вместо изненади', 'Качество вместо компромиси', 'Сервиз вместо транзакции'],
      timelineH: 'Нашата хронология',
      timeline: [
        { y:'2019', h:'Старт', p:'Започнахме със строителни фургони за партньори.' },
        { y:'2021', h:'Логистика', p:'Добавихме пълен транспорт и митница за BG/RO/GR.' },
        { y:'2024', h:'Качество', p:'Формализирахме QA във фабрики и добавихме поддръжка.' }
      ]
    },
    cta: { title: 'Готови ли сте да започнем?', desc: 'Поискайте оферта или задайте въпрос. Отговаряме до 24 часа.' },
    services: {
      heading: 'Нашите услуги', sub: 'Три категории, всяка с по три решения.',
      categories: [
        { h:'Модулни домове', items:[ ['Модули', 'Гъвкави модули, бърз монтаж, модерни довършителни работи.'], ['Тайни къщи', 'Компактни и ефективни жилища за обекти и отдих.'], ['Сайт фургони', 'Здрави офис фургони и настаняване на обект.'] ]},
        { h:'Логистика и обект', items:[ ['Транспорт и митници', 'От врата до врата с уредени митници.'], ['Доставка на място', 'График, координация на кран и достъп.'], ['Координация на монтаж', 'Доверени местни партньори за монтаж и връзки.'] ]},
        { h:'Поддръжка', items:[ ['Гаранционно обслужване', 'Бързи решения с производителите.'], ['Резервни части', 'Експресно намиране на компоненти и финали.'], ['Ъпгрейди', 'Слънчеви панели, изолация, тераси и др.'] ]}
      ]
    },
    forms: { offer:'Заяви оферта', question:'Задай въпрос', name:'Име', email:'Имейл', phone:'Телефон', project:'Детайли за проекта', submit:'Изпрати', send:'Изпрати' },
    footer: { copyright: 'NVC Home4You — Доверие и сигурност' }
  ,
    
    routes: {
      heading:'Логистични маршрути (илюстративни)',
      aria:'Логистичен маршрут',
      grp1:{ title:'Гърция → България → В цяла България' },
      grp2:{ title:'Гърция → Македония' },
      grp3:{ title:'Гърция → България → Македония' },
      grp4:{ title:'Гърция → България → Сърбия' },
      grp5:{ title:'Гърция → България → Румъния' },
      nodes:{
        gr:'Гърция', bg:'България', mk:'Македония', rs:'Сърбия', ro:'Румъния', bg_all:'В цяла България',
        start:'Начална точка', staging:'Събиране и митници', final_bg:'Доставка в цяла България',
        direct:'Директен маршрут', transit:'Транзит/етап', delivery:'Доставка'
      }
    }
  }
}
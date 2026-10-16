// /bg/sglobqemi-kyshti — „Сглобяеми къщи по проект“: custom houses on a steel frame, priced
// per project. The page's one job is to get a project or a sketch from the visitor, or to
// offer to draw the project up when they have none (the owner, 2026-10-12: "We can quote it
// based on their project, or we can make the project for them").
//
// WHERE THE FACTS COME FROM. The owner, 2026-10-12: every steel-frame house is a custom
// project, so there are NO standard figures — no area range, no number of floors or
// bedrooms, no profile thickness, no fixed facade, roof or insulation. The only constant is
// the galvanised steel frame, which the site has always said. So the hero lists
// what is decided per project instead of a spec. The two ways of working are the owner's
// answer above. The five process steps are the owner's five stages from the old page
// („Проектиране и разпределение“ … „Монтаж на място и предаване“), each paired with the one
// of the five stage pictures that actually shows it; the pictures are renders of a single
// example house, which the section says. There is no price here and no lead time: these
// houses have no catalogue price, and the sibling cards' figures are computed by the page
// from the gallery rows, so this file holds only the words around them ("от", "с ДДС и
// монтаж").
//
// NO EXAMPLE GALLERY. The owner (2026-10-12) asked for the process steps with their pictures
// back, and said explicitly not to bring back the old seven example visualisations, as a
// gallery, a carousel or at all. The five stage renders below are the only pictures here.
//
// What this file no longer has, on purpose: the seo block (the route reads routeMeta.js),
// the process ticker whose pictures did not match its captions, the disabled
// import-logistics block, and the brochure button.
export default {
  hero: {
    eyebrow: 'По ваш проект',
    h1: 'Сглобяеми къщи със стоманена конструкция',
    lead:
      'Къщи върху поцинкована стоманена рамка, всяка по отделен проект. Изпратете ни своя проект и ще ви направим оферта по него, а ако нямате проект, ще го изготвим за вас.',
    // The offer form takes words, not files, so the button asks for a quote; the plan itself
    // goes by email (how.filesLead).
    cta: 'Поискайте оферта по проект',
    call: 'Обадете се',
    // Read only when the admin set a photo but left its description empty.
    photoAlt: 'Сглобяема къща със стоманена конструкция',
  },

  // What a project decides, in place of the old "technical data", and nothing with a figure.
  // It was a seven-row table whose six answers all said "по проект" or "по ваш избор", which
  // on a phone filled the first screen with the same words; now the six are one list with
  // one sentence for all of them, and the frame, the one thing every house shares, has its
  // own line.
  decide: {
    title: 'Какво решаваме по проект',
    items: ['Площ и етажи', 'Разпределение', 'Фасада', 'Покрив', 'Изолация', 'Вътрешни довършителни работи'],
    note: 'Всичко това се решава по вашия проект и по ваш избор: всяка къща е отделен проект.',
    frameLabel: 'Конструкция',
    frame: 'поцинкована стоманена рамка, оразмерена по проекта',
  },

  // The owner's two routes, and nothing about how long either takes or what permits it
  // needs: neither has been stated, so neither is written.
  how: {
    h2: 'Как работим по вашия проект',
    sub: 'Два начина да започнем — според това дали вече имате проект.',
    routes: [
      {
        h: 'Имате проект или скица',
        p: 'Изпратете ни го — архитектурен проект, разпределение или скица. Ще ви направим оферта по него.',
      },
      {
        h: 'Нямате проект',
        p: 'Ще го изготвим ние. Кажете ни каква площ, колко етажа и колко спални търсите — ще подготвим проекта и ще ви изпратим оферта по него.',
      },
    ],
    // The offer form takes words, not files, so a project on paper or in a drawing file
    // goes by email; the address itself comes from home.localBusiness.
    filesLead: 'Ако проектът ви е във файл, можете да го изпратите и на',
  },

  // The five stages, in order. The pictures are one example house drawn at each stage: the
  // finished render is what a project produces first, the bare frame is the structural
  // model, the flat panels are what is made, the frame closed with boards is the house going
  // up on its platform, and the clad house with its windows is the finishing. No step names
  // a duration, a permit or a guarantee.
  //
  // Each stage is also a slot of "Снимки на сайта" (steel-step-1..5), for a photo of a real
  // project of the owner's. Under such a photo the stage takes adminAlt (his own description
  // on this page, when he types one), a caption that calls the picture a render gives way
  // (adminCaption), and so does one that names what only the render has (step 5's canopies).
  // The sub drops the sentence about one example house, which a real project's photo would make
  // untrue: adminSub when every stage is a photo, mixedSub ("where there is no project photo,
  // the picture is a render") while some still are renders, so those stay marked as renders.
  process: {
    h2: 'Как протича проектът',
    sub: 'Пет стъпки от идеята до готовата къща. Картините показват една примерна къща на всеки етап.',
    adminSub: 'Пет стъпки от идеята до готовата къща.',
    mixedSub: 'Пет стъпки от идеята до готовата къща. Където няма снимка от проект, картината е визуализация на една примерна къща.',
    steps: [
      {
        title: 'Проектиране и разпределение',
        text: 'Започваме от вашия проект или скица, а ако нямате — изготвяме проекта с вас: площ, етажи, стаи и как ще изглежда къщата.',
        image: {
          src: '/api/img/content/bvk4n834b-rcn-eg-vb.webp',
          adminAlt: 'Проект на къща със стоманена конструкция',
          alt: 'Визуализация на двуетажна къща с триъгълен покрив, остъклен фронтон и дървена тераса',
          caption: 'Визуализация на къщата от проекта',
          // It calls the picture a render, which an owner's photo is not: none under a photo.
          adminCaption: '',
        },
      },
      {
        title: 'Конструктивни чертежи и детайли',
        text: 'По разпределението изчисляваме стоманената рамка и чертаем всяка греда, връзка и отвор, така че къщата да се сглоби точно по проекта.',
        image: {
          src: '/api/img/content/bvk4n834b-rcj-eg-vb.webp',
          adminAlt: 'Стоманената рамка на къща по проект',
          alt: 'Визуализация на стоманената рамка на двуетажна къща с триъгълен покрив върху дървена платформа',
          caption: 'Стоманената рамка по конструктивните чертежи',
        },
      },
      {
        title: 'Производство и довършителни работи',
        text: 'Изработваме стоманените елементи по чертежите и подготвяме материалите за фасадата, покрива и интериора, които сте избрали.',
        image: {
          src: '/api/img/content/bvk4n834b-rw-eg-vb.jpg',
          adminAlt: 'Стоманени елементи на къща по проект преди сглобяване',
          alt: 'Визуализация на стоманени панели за пода и стените, подредени преди сглобяване',
          caption: 'Стоманените панели на пода и стените',
        },
      },
      {
        title: 'Доставка и митница',
        text: 'Доставяме елементите до вашия парцел и поемаме митническото оформяне. Рамката се сглобява на място и се затваря с плоскости.',
        link: { pathKey: 'delivery', label: 'Как оферираме доставката →' },
        image: {
          src: '/api/img/content/bvk4n834b-rck-eg-vb.webp',
          adminAlt: 'Рамката на къща по проект, затворена с плоскости',
          alt: 'Визуализация на сглобената стоманена рамка, затворена с плоскости по стените и покрива',
          caption: 'Рамката, затворена с плоскости',
        },
      },
      {
        title: 'Монтаж на място и предаване',
        text: 'Поставяме облицовката, дограмата и покрива, довършваме детайлите и ви предаваме къщата.',
        image: {
          src: '/api/img/content/bvk4n834b-rcm-eg-vb.webp',
          adminAlt: 'Къща по проект с облицовка и дограма',
          alt: 'Визуализация на къщата с облицовка, големи прозорци и козирки над терасите',
          caption: 'Облицовка, дограма и козирки',
          // The canopies are the render's; a real project may have none, so a photo gets the step's own words.
          adminCaption: 'Облицовка, дограма и покрив',
        },
      },
    ],
  },


  // The paragraph under this heading is the prices page's card for this line (pricesCopy.js
  // customBody), which the page reads itself so the two say the same thing.
  price: {
    h2: 'Цена на къща по проект',
    link: 'Цени на готовите модели →',
    // The gallery has the containers and the Box houses, not steel-frame houses, and the
    // words say so.
    galleryLink: 'Снимки на готовите модели в галерията →',
    // To the partner form (#zapitvane). The owner, 2026-10-17 (Q18): partner prices apply to
    // steel-frame houses too, once the project has been discussed, and the words say so.
    partnerLink: 'Партньорски цени и за къщи по проект — след като обсъдим проекта →',
  },

  // The page's questions (lib/productQuestions.js), marked up here and gathered by the FAQ hub
  // under „Стоманени къщи". The price and the delivery moved here from the hub (2026-10-17);
  // the factory, the paid documentation and the architectural project ({projectFee},
  // prices.js), the warranty and the timeline depending on the project, the partner prices and
  // customs inside the quote are the owner's answers of 2026-10-17. No warranty term and no
  // duration is stated: both depend on the project. ONE factory, ours, in China, never named.
  faq: {
    heading: 'Въпроси',
    // To the hub's steel-frame houses topic (#t-steel).
    more: 'Още въпроси →',
    items: [
      {
        id: 'steel-price',
        q: 'Колко струва къща със стоманена конструкция?',
        a: 'Всяка къща е отделен проект, затова няма каталожна цена. Изпратете ни своя проект или скица и ще ви направим оферта по него, а ако нямате проект, ще го изготвим за вас.',
        link: { pathKey: 'steelHouses', label: 'Как работим по вашия проект →' },
      },
      {
        id: 'steel-project',
        q: 'Колко струва проектът, ако го изготвите вие?',
        a: 'Пълната документация е платена услуга. Архитектурният проект струва {projectFee}.',
      },
      {
        id: 'steel-factory',
        q: 'Къде се прави стоманената конструкция?',
        a: 'В нашата фабрика в Китай.',
      },
      {
        id: 'steel-warranty-time',
        q: 'Каква е гаранцията и колко време отнема къща по проект?',
        a: 'И двете зависят от проекта.',
      },
      {
        id: 'steel-delivery',
        q: 'Поемате ли доставката и митницата на къща по проект?',
        a: 'Да. Доставяме елементите до вашия парцел и поемаме митническото оформяне. Доставката и митницата са включени в офертата за проекта.',
        link: { pathKey: 'steelHouses', hash: 'pp-process', label: 'Стъпките от проекта до предаването →' },
      },
      {
        id: 'steel-partner',
        q: 'Важат ли партньорските цени за къщи по проект?',
        a: 'Да, и за къщите със стоманена конструкция, след като обсъдим проекта.',
      },
    ],
  },

  // The two priced lines, for a visitor who wants a figure today. The names are the other
  // two pages' breadcrumb names; the prices are filled in by the page from the gallery.
  ready: {
    h2: 'Търсите готов модел с ясна цена?',
    go: 'Разгледайте →',
    from: 'от',
    containers: {
      label: 'Контейнерни модули',
      desc: 'Жилищни и офис контейнери 6×3, 7×3 и 8×3 м, доставени и сглобени от нас.',
      basis: 'с ДДС и монтаж',
    },
    houses: {
      label: 'Модулни къщи',
      desc: 'Разгъваеми Бокс къщи от 18 до 74 м², които пристигат сгънати и се разгъват на място.',
      basis: 'с ДДС, без монтаж',
    },
  },

  final: {
    title: 'Имате проект или скица?',
    desc: 'Изпратете ни го или ни опишете какво търсите — ако нямате проект, ще го изготвим ние. Отговаряме до 24 часа.',
  },
}

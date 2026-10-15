// Картата, която посетителят отваря от „Отвори в Карти“. Адресът е този, който страницата
// печата, кодиран в URL, за да не стои като дума в текста.
const MAPS_HREF = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Марикостиново, 2850 Петрич, България')}`

export default {
  header: {
    primaryNavAria: 'Основна навигация',
    brand: { short: 'NVC', full: 'Home4You' },
    servicesSummary: 'Нашите услуги',
    nav: {
      gallery: 'Галерия',
      prices: 'Цени',
      cases: 'Казуси',
      faq: 'Въпроси',
      about: 'За нас',
      partner: 'Партньори',
      planner: 'Планер',
      quote: 'Заяви оферта',
      boxConfigurator: "Конфигуратор",
      plannerGroup: 'Планиране',
      call: 'Обадете ни се',
      catalogues: 'Каталози (PDF)',
    },
    servicesMenu: {
      columns: [
        {
          title: 'Контейнерни и сглобяеми къщи',
          items: [
            { pathKey: 'modularBuilds', label: 'Контейнерни модули' },
            { pathKey: 'modularHouses', label: 'Модулни къщи' },
            { pathKey: 'steelHouses', label: 'Сглобяеми къщи по проект' },
          ],
        },
        {
          title: 'Доставка',
          items: [
            { pathKey: 'delivery', label: 'Доставка и монтаж' },
          ],
        },
        {
          title: 'Материали, мебели и ремонти',
          items: [
            { pathKey: 'interiors', label: 'Вътрешни ремонти' },
            { pathKey: 'doors', label: 'Интериорни врати' },
          ],
        },
      ],
    },
    theme: {
      label: 'Тема',
      ariaLabel: 'Тема',
      light: 'Светла',
      dark: 'Тъмна',
      system: 'Като устройството',
    },
    language: {
      label: 'Език',
      ariaLabel: 'Език',
      options: [
        { value: 'en', label: 'English' },
        { value: 'bg', label: 'Български' },
        { value: 'el', label: 'Ελληνικά' },
      ],
    },
    mobileMenuButtonAria: 'Отвори меню',
  },
  home: {
    hero: {
      eyebrow: 'Сглобяеми и контейнерни домове',
      title: 'Защото <g>домът</g> не трябва да е лукс',
      // {price} е най-евтиният контейнер в галерията (с ДДС и монтаж), който идва от
      // /api/home/photos през euro(); никога не се изписва тук. Докато не е известен, героят
      // показва leadNoPrice — същото изречение без сума.
      lead: 'Сглобяеми и контейнерни домове от {price} с ДДС. Базирани в Петрич, доставяме в целия ЕС.',
      leadNoPrice: 'Сглобяеми и контейнерни домове с ясни цени. Базирани в Петрич, доставяме в целия ЕС.',
      primaryCta: 'Заяви оферта',
      pricesCta: 'Виж моделите и цените',
      facts: ['87 доставени дома', 'Цените са с ДДС', 'Строим домове от 2022 г.'],
      slidesLabel: 'Снимки в началото',
      photoLabelPattern: 'Снимка {n} от {total}: {label}',
      showcase: {
        openLabel: 'Отвори',
        slidesLabel: 'Снимки в началото',
        slides: [
          { src: '/api/img/content/bukcsfwf9-rdg-eg-vb.webp', alt: 'Контейнерни модули', pathKey: 'modularBuilds', frame: { position: '30% 50%', scale: 1.22 } },
          { src: '/api/img/content/bukcsfwf9-rdf-eg-vb.webp', alt: 'Модулни къщи', pathKey: 'modularHouses' },
          { src: '/api/img/content/bvk4n834b-rbu-eg-vb.webp', alt: 'Контейнерни модули', pathKey: 'modularBuilds' },
          { src: '/api/img/content/bvk4n834b-r7-eg-vb.webp', alt: 'Сглобяеми къщи по проект', pathKey: 'steelHouses' },
          { src: '/api/img/content/bvk4n834b-rcz-eg-vb.webp', alt: 'Вътрешни ремонти', pathKey: 'interiors' },
        ],
      },
    },
    band: {
      visitTitle: 'Посетете ни',
      address: 'Марикостиново, 2850 Петрич',
      mapsLabel: 'Отвори в Карти →',
      mapsHref: MAPS_HREF,
      callTitle: 'Обадете се или пишете в WhatsApp',
      hours: 'пон–пет 07:00–19:00',
      writeTitle: 'Пишете ни',
      replyNote: 'Отговаряме до 24 часа',
    },
    strip: {
      kicker: 'Цени',
      titlePattern: '{count} модела от {price} — сглобете своя онлайн',
      lead: 'Изберете модел и вижте цената на всяка стъпка: план, дограма, баня, кухня.',
      from: 'от',
      incl: 'с ДДС, без монтаж',
      cta: 'Започни с този →',
      all: 'Всички цени →',
      planner: 'Планирай разпределението →',
      paperPrefix: 'Предпочитате на хартия?',
      paperLink: 'Свалете каталога (PDF)',
      paperOr: 'или',
      paperAll: 'вижте всичките шест каталога',
    },
    serviceTiles: {
      ariaLabel: 'Какво правим',
      heading: 'Какво правим',
      subheading: 'От 14 м² бунгало до семейна къща — и баните и кухните вътре.',
      button: 'Разгледай →',
      items: [
        {
          key: 'modularBuilds',
          pathKey: 'modularBuilds',
          title: 'Контейнерни модули · 14–30 м²',
          desc: 'Готови контейнерни модули — бунгало, къща за гости, офис или магазин — доставени и монтирани от нас.',
          icon: 'layers',
          img: '/api/img/content/bvk4n834b-rbp-eg-vb.webp',
        },
        {
          key: 'modularHouses',
          pathKey: 'modularHouses',
          title: 'Модулни къщи · 18–74 м²',
          desc: 'Домове от 18 до 74 м²: разгъваеми Box къщи и Space капсули с вашето разпределение и довършване.',
          icon: 'home',
          img: '/api/img/content/bvk4n834b-rdb-eg-vd.webp',
        },
        {
          key: 'steelHouses',
          pathKey: 'steelHouses',
          title: 'Сглобяеми къщи по проект',
          desc: 'Къщи със стоманена конструкция по вашия проект — или ние изготвяме проекта вместо вас.',
          icon: 'steel',
          img: '/api/img/content/bvk4n834b-rdc-eg-vb.webp',
        },
        {
          key: 'interiors',
          pathKey: 'interiors',
          title: 'Вътрешни ремонти',
          desc: 'Ремонти на бани и кухни с ясен план и прозрачно ценообразуване.',
          icon: 'interior',
          img: '/api/img/content/bvk4n834b-rce-eg-vb.webp',
        },
      ],
    },
    catalogues: {
      heading: 'Вземете каталог със себе си',
      subheading: 'Шест PDF каталога с всеки модел, размер и довършване. Отворете го в нов раздел, разпечатайте го или го изпратете на този, с когото решавате.',
      items: [
        { brochureSlug: 'modular-builds', label: 'Общ каталог', note: 'Модулни постройки, всички серии' },
        { brochureSlug: 'standard-containers', label: 'Стандартни контейнери', note: 'Модули 14–30 м²' },
        { brochureSlug: 'villa-office', label: 'Вила / Офис', note: 'Модули за живеене и работа' },
        { brochureSlug: 'sloped-roof', label: 'Скатен покрив', note: 'Търговски модули и модули със скатен покрив' },
        { brochureSlug: 'box-house', label: 'Box къщи', note: 'Разгъваеми домове 37 / 58 / 73 м²' },
        { brochureSlug: 'space-capsules', label: 'Space капсули', note: 'Домове капсули' },
      ],
    },
    glideServices: {
      ariaLabel: 'Акценти от услугите',
      subheading: 'Плъзнете или натиснете карта, за да отворите страницата',
      prevAria: 'Предишен слайд',
      nextAria: 'Следващ слайд',
      dotsAria: 'Навигация на слайдовете',
      slides: [
        { key: 'steelHouse0', pathKey: 'steelHouses', title: 'Стоманени къщи', img: '/api/img/content/bvk4n834b-rdd-eg-vb.webp' },
        { key: 'steelHouse7', pathKey: 'steelHouses', title: 'Стоманени къщи', img: '/api/img/content/bvk4n834b-rde-eg-vb.webp' },
        { key: 'modularHouse0', pathKey: 'modularHouses', title: 'Модулни къщи', img: '/api/img/content/bvk4n834b-rdf-eg-vb.webp' },
        { key: 'steelHouse1', pathKey: 'steelHouses', title: 'Стоманени къщи', img: '/api/img/content/bvk4n834b-rcf-eg-vb.webp' },
        { key: 'steelHouse2', pathKey: 'steelHouses', title: 'Стоманени къщи', img: '/api/img/content/bvk4n834b-rm-eg-vb.webp' },
        { key: 'modularHouse1', pathKey: 'modularHouses', title: 'Модулни къщи', img: '/api/img/content/bvk4n834b-rb9-eg-vb.webp' },
        { key: 'modularHouse2', pathKey: 'modularHouses', title: 'Модулни къщи', img: '/api/img/content/bvk4n834b-r2-eg-vb.webp' },
        { key: 'modularHouse3', pathKey: 'modularHouses', title: 'Модулни къщи', img: '/api/img/content/bvk4n834b-rq-eg-vb.webp' },
        { key: 'steelHouse3', pathKey: 'steelHouses', title: 'Стоманени къщи', img: '/api/img/content/bvk4n834b-rr-eg-vb.webp' },
        { key: 'steelHouse4', pathKey: 'steelHouses', title: 'Стоманени къщи', img: '/api/img/content/bvk4n834b-r4-eg-vb.webp' },
      ],
    },
    stats: {
      heading: 'Нашите резултати',
      items: [
        { label: 'Направени доставки', value: 87 },
        { label: 'Време за доставка (дни)', value: 5 },
        { label: 'Средно време за монтаж', value: 7 },
      ],
    },
    whyUs: {
      heading: 'Защо семейства в България и ЕС избират нас',
      items: [
        { icon: 'qa', title: 'Без скрити разходи', desc: 'Всяка цена е посочена със спецификациите и довършителните елементи.' },
        { icon: 'person', title: 'Отговаря истински човек', desc: 'Обадете се, пишете или ни посетете край Петрич — отговаряме до 24 часа.' },
        { icon: 'truck', pathKey: 'delivery', title: 'Доставка в целия ЕС', desc: 'Собствена логистика и предаване до ключ навсякъде в ЕС.' },
      ],
    },
    steps: {
      heading: 'От първия разговор до предаването в 6 стъпки',
      items: [
        {
          title: 'Консултация',
          long: 'Започваме с реалните нужди на проекта - приложение, срок, бюджет и предпочитан модел, за да насочим избора още в началото.',
        },
        {
          title: 'Проектиране и спецификации',
          long: 'След като посоката е ясна, заключваме конфигурацията, спецификациите и довършителния пакет, за да се движим уверено към оферта и производство.',
        },
        {
          title: 'Потвърждение и план график',
          long: 'Получавате ясен търговски и организационен етап, преди да бъдат финализирани производството и транспортът.',
        },
        {
          title: 'Подготовка и документи',
          long: 'Тук подреждаме логистичния пакет - документи, застраховка, транспортен план и практическа подготовка за обекта.',
        },
        {
          title: 'Доставка и монтаж',
          long: 'Модулът пристига на обекта, монтажът се координира и изпълнението се довежда до финализиране според договорения обхват.',
        },
        {
          title: 'Поддръжка',
          long: 'След предаването оставаме на разположение за гаранционна поддръжка, части и бъдещи ъпгрейди.',
        },
      ],
    },
    mobileDock: {
      closeLabel: 'Затвори',
      title: 'NVC Home4You',
      description: 'Поискайте оферта или задайте въпрос. Отговаряме до 24 часа.',
      primaryCta: 'Заяви оферта',
    },
    testimonials: {
      take: 3,
      heading: 'Какво казват клиентите ни',
      subheading: 'С техните думи, на езика, на който са ги написали.',
      aggregateAria: 'Средна оценка от клиенти',
      aggregatePattern: '{score} от {count} потвърдени отзива',
      countLabel: '{count} потвърдени отзива',
      verified: 'Потвърден',
      customerFallback: 'Клиент',
      reviewIn: { bg: 'Отзив на български', en: 'Отзив на английски', el: 'Отзив на гръцки' },
      ctaLabel: 'Виж всички отзиви →',
    },
    finalCta: {
      title: 'Да поговорим за вашия дом?',
      desc: 'Поискайте оферта или задайте въпрос. Отговаряме до 24 часа.',
      primaryCta: 'Заяви оферта',
      secondaryCta: 'Задай въпрос',
      phone: '+359 87 935 5269',
      email: 'contact@nvc-home4you.eu',
      where: 'пон–пет 07:00–19:00 · Марикостиново, Петрич, България',
    },
    // Това, което страницата печата, и това, което LocalBusinessJSONLD публикува — от един обект.
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
    close: 'Затвори',
    open: 'Отвори',
    viberChatLabel: 'Отвори чат във Viber',
    whatsAppChatLabel: 'Отвори чат в WhatsApp',
    contactLabel: 'Обади се или пиши',
    callLabel: 'Обади се',
    lightbox: {
      closeLabel: 'Затвори',
      prevLabel: 'Назад',
      nextLabel: 'Напред',
      descriptionHeading: 'Описание',
      fromLabel: 'от',
      requestLabel: 'Заяви този модел',
      thumbnailsLabel: 'Миниатюри',
      imageAltPattern: 'Изображение {current} от {total}',
      thumbnailAltPattern: 'Миниатюра {current} от {total}',
    },
    banner: {
      sending: 'Изпращане…',
      retrying: 'Повторен опит',
      retry: 'Опитай пак',
    },
    toast: {
      successTitle: 'Успех',
      errorTitle: 'Грешка',
      offerSuccess: 'Запитването е изпратено успешно!',
      offerError: 'Неуспешно изпращане на запитването',
      questionSuccess: 'Въпросът е изпратен успешно!',
      questionError: 'Неуспешно изпращане на въпроса',
    },
  },
  forms: {
    offer: {
      title: 'Заявка за оферта',
      fields: {
        name: 'Име',
        email: 'Имейл',
        phone: 'Телефон',
        project: 'Детайли за проекта',
      },
      // Labels the line naming the gallery model an offer was requested for.
      model: 'Модел',
      submit: 'Изпрати',
    },
    question: {
      title: 'Задай въпрос',
      fields: {
        name: 'Име',
        email: 'Имейл',
        question: 'Вашият въпрос',
      },
      submit: 'Изпрати',
    },
  },
}

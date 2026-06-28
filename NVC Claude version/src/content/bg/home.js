export default {
  header: {
    primaryNavAria: 'Основна навигация',
    brand: { short: 'NVC', full: 'Home4You' },
    servicesSummary: 'Нашите услуги',
    nav: {
      gallery: 'Галерия',
      cases: 'Казуси',
      faq: 'Въпроси',
      about: 'За нас',
      partner: 'Партньор',
      planner: 'Планер',
      quote: 'Заяви оферта',
      boxConfigurator: "Конфигуратор"
    },
    servicesMenu: {
      columns: [
        {
          title: 'Контейнерни и сглобяеми къщи',
          items: [
            { pathKey: 'modularBuilds', label: 'Модулни постройки' },
            { pathKey: 'modularHouses', label: 'Модулни къщи' },
            { pathKey: 'steelHouses', label: 'Стоманени къщи' },
          ],
        },
        {
          title: 'Логистика',
          items: [
            { pathKey: 'delivery', label: 'Доставка до вратата' },
            { pathKey: 'logistics', label: 'Логистика' },
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
      system: 'Система',
    },
    language: {
      label: 'Език',
      ariaLabel: 'Език',
      options: [
        { value: 'en', label: 'EN' },
        { value: 'bg', label: 'BG' },
        { value: 'el', label: 'EL' },
      ],
    },
    mobileMenuButtonAria: 'Отвори меню',
  },
  home: {
    hero: {
      title: 'Защото домът <g>не трябва</g> да е лукс',
      lead: 'Сглобяеми и контейнерни домове, доставени в цяла Европа.',
      primaryCta: 'Получи оферта',
      secondaryCta: 'Задай въпрос',
      motto: 'Доверие и Сигурност',
      badges: ['Доставка в целия ЕС', 'Предаване до ключ', 'Собствена логистика'],
      showcase: {
        openLabel: 'Отвори',
        slidesLabel: 'Слайдове в началния екран',
        slides: [
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdg/eg/vb', alt: 'Модулни постройки', pathKey: 'modularBuilds' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdf/eg/vb', alt: 'Модулни къщи', pathKey: 'modularHouses' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rde/eg/vb', alt: 'Стоманени къщи', pathKey: 'steelHouses' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdc/eg/vb', alt: 'Вътрешни ремонти', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbx/eg/vb', alt: 'Вътрешни ремонти', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r7/eg/vb', alt: 'Вътрешни ремонти', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbu/eg/vb', alt: 'Вътрешни ремонти', pathKey: 'interiors' },
        ],
      },
    },
    serviceTiles: {
      ariaLabel: 'Нашите услуги',
      heading: 'Разгледайте услугите ни',
      subheading: 'Задръжте за детайли, натиснете за отваряне',
      button: 'Разгледай →',
      items: [
        {
          key: 'modularBuilds',
          pathKey: 'modularBuilds',
          title: 'Модулни постройки',
          desc: 'Готови за монтаж модули за живеене, офис или обект с бърз монтаж и дълъг живот.',
          icon: 'layers',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbp/eg/vb',
        },
        {
          key: 'modularHouses',
          pathKey: 'modularHouses',
          title: 'Модулни къщи',
          desc: 'Модулни къщи за постоянно обитаване с гъвкави разпределения и довършителни опции.',
          icon: 'home',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdb/eg/vd',
        },
        {
          key: 'steelHouses',
          pathKey: 'steelHouses',
          title: 'Стоманени къщи',
          desc: 'Къщи с метална конструкция, висока устойчивост и добър баланс между цена и срок.',
          icon: 'steel',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdc/eg/vb',
        },
        {
          key: 'interiors',
          pathKey: 'interiors',
          title: 'Вътрешни ремонти',
          desc: 'Ремонти на бани и кухни с ясен план, прозрачно ценообразуване и контрол на изпълнението.',
          icon: 'interior',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rce/eg/vb',
        },
      ],
    },
    glideServices: {
      ariaLabel: 'Нашите услуги',
      subheading: 'Плъзнете или натиснете карта, за да отворите страницата',
      prevAria: 'Предишен слайд',
      nextAria: 'Следващ слайд',
      dotsAria: 'Навигация на слайдовете',
      slides: [
        { key: 'steelHouse0', pathKey: 'steelHouses', title: 'Стоманени къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdd/eg/vb' },
        { key: 'steelHouse7', pathKey: 'steelHouses', title: 'Стоманени къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rde/eg/vb' },
        { key: 'modularHouse0', pathKey: 'modularHouses', title: 'Модулни къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdf/eg/vb' },
        { key: 'steelHouse1', pathKey: 'steelHouses', title: 'Стоманени къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcf/eg/vb' },
        { key: 'steelHouse2', pathKey: 'steelHouses', title: 'Стоманени къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rm/eg/vb' },
        { key: 'modularHouse1', pathKey: 'modularHouses', title: 'Модулни къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rb9/eg/vb' },
        { key: 'modularHouse2', pathKey: 'modularHouses', title: 'Модулни къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r2/eg/vb' },
        { key: 'modularHouse3', pathKey: 'modularHouses', title: 'Модулни къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rq/eg/vb' },
        { key: 'steelHouse3', pathKey: 'steelHouses', title: 'Стоманени къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rr/eg/vb' },
        { key: 'steelHouse4', pathKey: 'steelHouses', title: 'Стоманени къщи', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r4/eg/vb' },
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
      heading: 'Защо нас',
      subheading: 'Отлични домове, безупречно обслужване.',
      items: [
        { icon: 'qa', title: 'Пълна прозрачност', desc: 'Всички цени са описани с детайли за спецификации и довършителни елементи, без скрити такси.' },
        { icon: 'paper', title: '24/7 обслужване', desc: 'Среща на място или дистанционно, без чакане и без неясни стъпки по процеса.' },
        { icon: 'truck', title: 'Ясно планиране', desc: 'Още от първия ден ще знаете сроковете за доставка и монтаж.' },
        { icon: 'star', title: 'Най-добра стойност в България', desc: 'Конкурентни условия за контейнерни и сглобяеми домове в България.' },
      ],
    },
    steps: {
      heading: 'Как работим',
      progressLabel: 'Прогрес',
      stepOfPattern: 'Стъпка {current} от {total}',
      items: [
        {
          title: '1. Консултация',
          short: 'Изберете модел от каталога или се свържете с нас, за да обсъдим правилното решение за вашия проект.',
          long: 'Започваме с реалните нужди на проекта - приложение, срок, бюджет и предпочитан модел, за да насочим избора още в началото.',
        },
        {
          title: '2. Проектиране и спецификации',
          short: 'Избирате разпределение, оборудване и довършителни решения, а ние подреждаме техническите детайли.',
          long: 'След като посоката е ясна, заключваме конфигурацията, спецификациите и довършителния пакет, за да се движим уверено към оферта и производство.',
        },
        {
          title: '3. Потвърждение и план график',
          short: 'Потвърждаваме избора, цената и времевия прозорец за доставка.',
          long: 'Получавате ясен търговски и организационен етап, преди да бъдат финализирани производството и транспортът.',
        },
        {
          title: '4. Подготовка и документи',
          short: 'Подготвяме документацията, застраховката и транспорта и споделяме чеклист за готовност на обекта.',
          long: 'Тук подреждаме логистичния пакет - документи, застраховка, транспортен план и практическа подготовка за обекта.',
        },
        {
          title: '5. Доставка и монтаж',
          short: 'Доставяме, монтираме и финализираме новия ви дом.',
          long: 'Модулът пристига на обекта, монтажът се координира и изпълнението се довежда до финализиране според договорения обхват.',
        },
        {
          title: '6. Поддръжка',
          short: 'Гаранционно обслужване, резервни части и бъдещи подобрения при необходимост.',
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
      subheading: 'Реални отзиви от собственици на домове в цяла Европа.',
      aggregateAria: 'Средна оценка от клиенти',
      countLabel: '{count} потвърдени отзива',
      verified: 'Потвърден',
      customerFallback: 'Клиент',
      ctaLabel: 'Виж всички отзиви →',
    },
    finalCta: {
      title: 'Готови ли сте да започнем?',
      desc: 'Поискайте оферта или задайте въпрос. Отговаряме до 24 часа.',
      primaryCta: 'Получи оферта',
      secondaryCta: 'Задай въпрос',
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
    heading: 'Нашите услуги',
    subheading: 'Три категории, всяка с по три решения.',
    categories: [
      {
        title: 'Контейнерни и сглобяеми къщи',
        items: [
          { title: 'Жилищни контейнери', desc: 'Надеждни и бързи решения за вили, офиси и търговски обекти.' },
          { title: 'Къщи от стоманена конструкция', desc: 'Къщи с метална конструкция, висока изолация и дълъг живот.' },
          { title: 'Кабини', desc: 'Комбинация от стил и иновации за гъвкави жилищни и бизнес приложения.' },
        ],
      },
      {
        title: 'Логистика',
        items: [
          { title: 'Доставка до вратата', desc: 'Логистика, застраховка и митнически услуги за ЕС.' },
          { title: 'Консолидиране и опаковане', desc: 'Комбиниране на къщи и материали в една пратка.' },
          { title: 'Сглобяване и инсталация', desc: 'Пълна координация за доставка, монтаж и въвеждане в експлоатация.' },
        ],
      },
      {
        title: 'Материали, мебели и ремонти',
        items: [
          { title: 'Бани', desc: 'Душове, тоалетни, мивки, шкафове и аксесоари.' },
          { title: 'Стени и подове', desc: 'Стенни панели, подови настилки и декинг.' },
          { title: 'Вътрешни ремонти', desc: 'Кухни, бани, цялостно оборудване и мебели за дома.' },
        ],
      },
    ],
  },
  common: {
    close: 'Затвори',
    open: 'Отвори',
    viberChatLabel: 'Отвори чат във Viber',
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
      title: 'Заяви оферта',
      fields: {
        name: 'Име',
        email: 'Имейл',
        phone: 'Телефон',
        project: 'Детайли за проекта',
      },
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

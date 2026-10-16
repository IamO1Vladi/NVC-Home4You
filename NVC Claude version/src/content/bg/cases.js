export default {
  locale: 'bg-BG',
  api: {
    casesPageEndpoint: '/api/cases-page',
    reviewsEndpoint: '/api/reviews',
  },
  seo: {
    // The title and description are routeMeta.js's (META.cases), read by the cases routes.
    url: 'https://nvc-home4you.eu/bg/kazusi-i-otzivi',
  },
  breadcrumbs: [
    { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
    { name: 'Казуси и отзиви', url: 'https://nvc-home4you.eu/bg/kazusi-i-otzivi' },
  ],
  copy: {
    heroTitle: 'Казуси и отзиви',
    heroLead:
      'Доставки при наши клиенти и техните отзиви: какво са купили, къде е доставено, снимки и оценки от 1 до 5 звезди.',
    heroPoints: [
      'Публикувани казуси с фирма, продукт и локация',
      'Видими клиентски оценки и текстови отзиви',
      'Кратка форма с рейтинг от 1 до 5 звезди',
    ],
    ctaPrimary: 'Получи оферта',
    ctaSecondary: 'Задай въпрос',
    panelTitle: 'Какво ще намерите тук',
    stats: {
      cases: 'Публикувани казуси',
      rating: 'Среден рейтинг',
      reviews: 'Клиентски отзиви',
      countries: 'Обслужени държави',
    },
    buyersTitle: 'Кой купува от нас',
    buyersLead:
      'Фирми и сектори, които купуват от нас.',
    buyersEmpty:
      'Все още няма публикувани фирми клиенти.',
    casesTitle: 'Последни казуси',
    casesLead:
      'Какво сме доставили, на кого и къде, с отзива на клиента.',
    filters: {
      all: 'Всички',
      modularBuilds: 'Контейнерни модули',
      modularHouses: 'Модулни къщи',
      steelHouses: 'Сглобяеми къщи по проект',
      interiors: 'Интериори',
      delivery: 'Доставка',
      logistics: 'Логистика',
      other: 'Други',
    },
    // Each case card's link to its product page, by the card's category (CasesPage.jsx
    // CASE_PAGE). A category with no line here (interiors, logistics, other) gets no link.
    productLinks: {
      modularBuilds: 'Още за контейнерите →',
      modularHouses: 'Още за Бокс къщите →',
      steelHouses: 'Още за къщите по проект →',
      delivery: 'Още за доставката и монтажа →',
    },
    labels: {
      buyer: 'Клиент',
      product: 'Продукт',
      location: 'Локация',
      scope: 'Обхват',
      result: 'Резултат',
      year: 'Година',
      units: 'Брой',
      sector: 'Сектор',
      approved: 'Одобрен',
      purchased: 'Закупено',
      company: 'Компания',
      customer: 'Клиент',
    },
    featured: 'Избрано',
    photosLabel: 'Снимки',
    similarCta: 'Попитай за подобно решение',
    noCases:
      'Все още няма публикувани казуси.',
    reviewsTitle: 'Оценки и отзиви',
    reviewsLead:
      'Реални оценки и отзиви от наши клиенти.',
    breakdownTitle: 'Разбивка по рейтинг',
    noRatings: 'Все още няма публични оценки.',
    formTitle: 'Оставете отзив',
    formLead:
      'Оставете вашата оценка и кратък отзив за вашето преживяване с нас.',
    moderation: 'Новите отзиви се показват скоро след изпращане.',
    placeholders: {
      name: 'Име',
      company: 'Компания',
      email: 'Имейл',
      location: 'Град / държава',
      product: 'Какво закупихте?',
      comment: 'Напишете кратък отзив за доставката, качеството или комуникацията',
    },
    submit: 'Изпрати отзив',
    sending: 'Изпращане…',
    success:
      'Благодарим. Вашият отзив е получен и ще се появи скоро.',
    error:
      'Отзивът не можа да бъде изпратен в момента. Моля, опитайте отново по-късно.',
    noReviewsCard:
      'Когато има отзиви, те ще се покажат тук като публични препоръки.',
  },
  lightbox: {
    closeLabel: 'Затвори',
    prevLabel: 'Назад',
    nextLabel: 'Напред',
    descriptionHeading: 'Описание',
    thumbnailsLabel: 'Миниатюри',
    imageAltPattern: 'Изображение {current} от {total}',
    thumbnailAltPattern: 'Миниатюра {current} от {total}',
  },
}

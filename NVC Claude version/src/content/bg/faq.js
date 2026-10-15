// src/content/bg/faq.js
import { euro } from '../../lib/euro.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../shared/deliveryRates.js'

// The crane and lead-time answers quote the owner's figures (2026-10-15) from deliveryRates.js.
const { container: CONTAINER, box: BOX } = DELIVERY_RATES.products
const crane = (product) => euro(product.crane.about, 'bg')

export default {
  seo: {
    title: 'Често задавани въпроси за модулни къщи и контейнери | NVC Home4You',
    description:
      'Отговори на често задавани въпроси за срокове, логистика, плащания, доставка и персонализация на модулни къщи и контейнери.',
    url: 'https://nvc-home4you.eu/bg/chesto-zadavani-vyprosi',
  },
  heading: 'Често задавани въпроси',
  allLabel: 'Всички',
  categoryLabel: 'Категория',
  categoryFallbackPrefix: 'Категория',
  categoriesAria: 'Категории ЧЗВ',
  searchPlaceholder: 'Търсене...',
  searchAria: 'Търси в ЧЗВ',
  noResultsText: 'Няма резултати.',
  groups: [
    {
      title: 'Поръчки',
      items: [
        {
          q: 'Какъв е срокът за изпълнение?',
          a: `Контейнер от наличност доставяме до ${LEAD_TIMES.containerInStockDays} дни. Бокс къща се произвежда до ${LEAD_TIMES.boxProductionDays} дни и пристига на вашия адрес за около ${LEAD_TIMES.boxToAddressMonths} месеца. За контейнери по поръчка и къщи по проект — попитайте ни.`,
        },
        {
          q: 'Мога ли да променям финалите?',
          a: 'Да, предлагаме пакети и индивидуални решения.',
        },
      ],
    },
    {
      title: 'Логистика',
      items: [
        {
          q: 'Вие ли се занимавате с митницата?',
          a: 'Да. Ние поемаме декларации, такси и съответствие.',
        },
        {
          q: 'Нужен ли е кран и колко струва?',
          a: `Зависи от продукта. За Бокс къща кранът е задължителен: около ${crane(BOX)} без ДДС, а според мястото може и повече. За контейнер е по ваш избор и за ваша сметка, около ${crane(CONTAINER)} без ДДС; тогава го сглобяваме в нашия склад и пристига готов, без разходи за път и нощувки на работници. Без кран двама наши работници сглобяват контейнера на място. Работата изисква ${CONTAINER.noCrane.nights} нощувки, които им осигурявате вие, а според мястото пътуването им струва до ${euro(CONTAINER.noCrane.travelMax, 'bg')} без ДДС.`,
        },
      ],
    },
    {
      title: 'Плащания',
      items: [
        {
          q: 'Какви са условията на плащане?',
          a: 'Плащания по етапи според производството и доставката.',
        },
        {
          q: 'Има ли финансиране?',
          a: 'Можем да ви свържем с партньори за финансиране.',
        },
      ],
    },
  ],
}

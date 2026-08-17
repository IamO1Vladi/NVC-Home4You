// src/seo/routeMeta.js
// Centralized per-route SEO copy (title + description) for every page, in all
// locales. Rendered once from AppShell so every route ships a unique title,
// description, canonical URL, hreflang set and Open Graph tags.
import { paths, getPageKeyByPath, getLocaleFromPath } from '../routes/paths.js'

const SITE_URL = 'https://nvc-home4you.eu'

const META = {
  home: {
    en: {
      title: 'NVC Home4You | Modular & Prefab Homes — Design, Build & EU Delivery',
      description:
        'Modular and prefabricated homes designed, built and delivered across Bulgaria and the EU. Container houses, steel houses, interiors and door-to-door logistics.',
    },
    bg: {
      title: 'NVC Home4You | Модулни и сглобяеми къщи — проектиране, изграждане и доставка в ЕС',
      description:
        'Модулни и сглобяеми къщи — проектиране, изграждане и доставка в България и ЕС. Контейнерни къщи, стоманени къщи, интериори и логистика до врата.',
    },
    el: {
      title: 'NVC Home4You | Δομικά & Προκατασκευασμένα Σπίτια — Σχεδιασμός, Κατασκευή & Παράδοση στην ΕΕ',
      description:
        'Δομικά και προκατασκευασμένα σπίτια — σχεδιασμός, κατασκευή και παράδοση σε Βουλγαρία και ΕΕ. Σπίτια-κοντέινερ, μεταλλικά σπίτια, εσωτερικοί χώροι και logistics έως την πόρτα σας.',
    },
  },
  modularBuilds: {
    en: {
      title: 'Modular Builds | NVC Home4You',
      description:
        'Custom modular and container building solutions — fast, durable and delivered across the EU by NVC Home4You.',
    },
    bg: {
      title: 'Модулни постройки | NVC Home4You',
      description:
        'Модулни и контейнерни решения за строителство — бързо, надеждно и с доставка в целия ЕС от NVC Home4You.',
    },
    el: {
      title: 'Δομικές Κατασκευές | NVC Home4You',
      description:
        'Εξατομικευμένες δομικές και container λύσεις κατασκευής — γρήγορα, ανθεκτικά και με παράδοση σε όλη την ΕΕ από την NVC Home4You.',
    },
  },
  modularHouses: {
    en: {
      title: 'Modular Houses | NVC Home4You',
      description:
        'Turn-key modular houses built to order and delivered across Bulgaria and the EU. Explore designs, sizes and finishes.',
    },
    bg: {
      title: 'Модулни къщи | NVC Home4You',
      description:
        'Модулни къщи до ключ, изработени по поръчка и доставени в България и ЕС. Разгледайте проекти, размери и довършителни решения.',
    },
    el: {
      title: 'Δομικά Σπίτια | NVC Home4You',
      description:
        'Δομικά σπίτια «με το κλειδί στο χέρι», κατασκευασμένα κατά παραγγελία και παραδοτέα σε Βουλγαρία και ΕΕ. Δείτε σχέδια, μεγέθη και φινιρίσματα.',
    },
  },
  steelHouses: {
    en: {
      title: 'Steel Houses | NVC Home4You',
      description:
        'Strong, energy-efficient steel-frame houses designed and delivered by NVC Home4You across the EU.',
    },
    bg: {
      title: 'Стоманени къщи | NVC Home4You',
      description:
        'Здрави и енергийно ефективни къщи със стоманена конструкция, проектирани и доставяни от NVC Home4You в ЕС.',
    },
    el: {
      title: 'Μεταλλικά Σπίτια | NVC Home4You',
      description:
        'Ανθεκτικά και ενεργειακά αποδοτικά σπίτια με μεταλλικό σκελετό, σχεδιασμένα και παραδοτέα από την NVC Home4You σε όλη την ΕΕ.',
    },
  },
  faq: {
    en: {
      title: 'FAQ | NVC Home4You',
      description:
        'Answers to common questions about modular homes, pricing, delivery and installation from NVC Home4You.',
    },
    bg: {
      title: 'Често задавани въпроси | NVC Home4You',
      description:
        'Отговори на често задавани въпроси за модулни къщи, цени, доставка и монтаж от NVC Home4You.',
    },
    el: {
      title: 'Συχνές Ερωτήσεις | NVC Home4You',
      description:
        'Απαντήσεις σε συχνές ερωτήσεις για δομικά σπίτια, τιμές, παράδοση και τοποθέτηση από την NVC Home4You.',
    },
  },
  about: {
    en: {
      title: 'About Us | NVC Home4You',
      description:
        'Learn about NVC Home4You — our team, craftsmanship and approach to modular and prefab home building across the EU.',
    },
    bg: {
      title: 'За нас | NVC Home4You',
      description:
        'Научете повече за NVC Home4You — нашия екип, майсторство и подход към модулното и сглобяемо строителство в ЕС.',
    },
    el: {
      title: 'Σχετικά με Εμάς | NVC Home4You',
      description:
        'Μάθετε για την NVC Home4You — την ομάδα μας, τη μαστοριά μας και την προσέγγισή μας στη δομική και προκατασκευασμένη κατασκευή σε όλη την ΕΕ.',
    },
  },
  gallery: {
    en: {
      title: 'Gallery | NVC Home4You',
      description:
        'Browse completed modular homes, container houses and projects delivered by NVC Home4You across Bulgaria and the EU.',
    },
    bg: {
      title: 'Галерия | NVC Home4You',
      description:
        'Разгледайте завършени модулни къщи, контейнерни домове и проекти, реализирани от NVC Home4You в България и ЕС.',
    },
    el: {
      title: 'Γκαλερί | NVC Home4You',
      description:
        'Δείτε ολοκληρωμένα δομικά σπίτια, σπίτια-κοντέινερ και έργα που παραδόθηκαν από την NVC Home4You σε Βουλγαρία και ΕΕ.',
    },
  },
  interiors: {
    en: {
      title: 'Interiors & Renovations | NVC Home4You',
      description:
        'Interior fit-out, materials and renovation services for modular and traditional homes from NVC Home4You.',
    },
    bg: {
      title: 'Интериори и ремонти | NVC Home4You',
      description:
        'Интериорно обзавеждане, материали и ремонтни услуги за модулни и традиционни домове от NVC Home4You.',
    },
    el: {
      title: 'Εσωτερικοί Χώροι & Ανακαινίσεις | NVC Home4You',
      description:
        'Διαμόρφωση εσωτερικών χώρων, υλικά και υπηρεσίες ανακαίνισης για δομικά και παραδοσιακά σπίτια από την NVC Home4You.',
    },
  },
  delivery: {
    en: {
      title: 'Door-to-Door Delivery | NVC Home4You',
      description:
        'Door-to-door delivery and installation of modular homes across Bulgaria and the EU. See how delivery works.',
    },
    bg: {
      title: 'Доставка до врата | NVC Home4You',
      description:
        'Доставка до врата и монтаж на модулни къщи в България и ЕС. Вижте как протича доставката.',
    },
    el: {
      title: 'Παράδοση έως την Πόρτα | NVC Home4You',
      description:
        'Παράδοση έως την πόρτα και τοποθέτηση δομικών σπιτιών σε Βουλγαρία και ΕΕ. Δείτε πώς λειτουργεί η παράδοση.',
    },
  },
  logistics: {
    en: {
      title: 'International Logistics | NVC Home4You',
      description:
        'Cross-border logistics for modular and prefab structures throughout the EU, handled end to end by NVC Home4You.',
    },
    bg: {
      title: 'Международна логистика | NVC Home4You',
      description:
        'Трансгранична логистика за модулни и сглобяеми конструкции в целия ЕС, изцяло организирана от NVC Home4You.',
    },
    el: {
      title: 'Διεθνής Εφοδιαστική (Logistics) | NVC Home4You',
      description:
        'Διασυνοριακή μεταφορά για δομικές και προκατασκευασμένες κατασκευές σε όλη την ΕΕ, με ολοκληρωμένη διαχείριση από την NVC Home4You.',
    },
  },
  partner: {
    en: {
      title: 'Become a Partner | NVC Home4You',
      description:
        'Partner with NVC Home4You — distribution and collaboration opportunities in modular and prefab construction.',
    },
    bg: {
      title: 'Станете партньор | NVC Home4You',
      description:
        'Партнирайте си с NVC Home4You — възможности за дистрибуция и сътрудничество в модулното строителство.',
    },
    el: {
      title: 'Γίνετε Συνεργάτης | NVC Home4You',
      description:
        'Συνεργαστείτε με την NVC Home4You — ευκαιρίες διανομής και συνεργασίας στη δομική και προκατασκευασμένη κατασκευή.',
    },
  },
  planner: {
    en: {
      title: 'Floor Planner | NVC Home4You',
      description:
        'Plan your modular home layout online with the NVC Home4You floor planner. Design rooms, sizes and flow.',
    },
    bg: {
      title: 'Планиране на разпределение | NVC Home4You',
      description:
        'Планирайте разпределението на своята модулна къща онлайн с инструмента на NVC Home4You.',
    },
    el: {
      title: 'Σχεδιασμός Κάτοψης | NVC Home4You',
      description:
        'Σχεδιάστε online την κάτοψη του δομικού σας σπιτιού με το εργαλείο της NVC Home4You. Σχεδιάστε δωμάτια, μεγέθη και ροή.',
    },
  },
  boxConfigurator: {
    en: {
      title: 'Box House Configurator | NVC Home4You',
      description:
        'Configure your box house online — choose layout, kitchen, bathroom and finishes with NVC Home4You.',
    },
    bg: {
      title: 'Конфигуратор на Box къщи | NVC Home4You',
      description:
        'Конфигурирайте своята box къща онлайн — изберете разпределение, кухня, баня и довършване с NVC Home4You.',
    },
    el: {
      title: 'Διαμορφωτής Box Σπιτιού | NVC Home4You',
      description:
        'Διαμορφώστε online το box σπίτι σας — επιλέξτε κάτοψη, κουζίνα, μπάνιο και φινιρίσματα με την NVC Home4You.',
    },
  },
  doors: {
    en: {
      title: 'Internal Doors | NVC Home4You',
      description:
        'Quality internal doors for modular and traditional homes, supplied and fitted by NVC Home4You.',
    },
    bg: {
      title: 'Интериорни врати | NVC Home4You',
      description:
        'Качествени интериорни врати за модулни и традиционни домове, доставени и монтирани от NVC Home4You.',
    },
    el: {
      title: 'Εσωτερικές Πόρτες | NVC Home4You',
      description:
        'Ποιοτικές εσωτερικές πόρτες για δομικά και παραδοσιακά σπίτια, με προμήθεια και τοποθέτηση από την NVC Home4You.',
    },
  },
  cases: {
    en: {
      title: 'Cases & Reviews | NVC Home4You',
      description:
        'Real projects and customer reviews from NVC Home4You modular and prefab home builds across the EU.',
    },
    bg: {
      title: 'Казуси и отзиви | NVC Home4You',
      description:
        'Реални проекти и отзиви от клиенти за модулните и сглобяеми къщи на NVC Home4You в ЕС.',
    },
    el: {
      title: 'Έργα & Κριτικές | NVC Home4You',
      description:
        'Πραγματικά έργα και κριτικές πελατών από τις δομικές και προκατασκευασμένες κατασκευές της NVC Home4You σε όλη την ΕΕ.',
    },
  },
  services: {
    en: {
      title: 'Services | NVC Home4You',
      description:
        'Explore the full range of products and services from NVC Home4You — modular homes, interiors, doors, delivery and more.',
    },
    bg: {
      title: 'Услуги | NVC Home4You',
      description:
        'Разгледайте пълната гама продукти и услуги на NVC Home4You — модулни къщи, интериори, врати, доставка и още.',
    },
    el: {
      title: 'Υπηρεσίες | NVC Home4You',
      description:
        'Δείτε όλη τη γκάμα προϊόντων και υπηρεσιών της NVC Home4You — δομικά σπίτια, εσωτερικοί χώροι, πόρτες, παράδοση και άλλα.',
    },
  },
  // The one page that targets a transactional query head-on. Competitors all rank for
  // "цени" with a price list; the title leads with the number because a search result
  // showing a real starting price is what earns the click.
  prices: {
    en: {
      title: 'Prefab House Prices 2026 | From €14,840 incl. VAT | NVC Home4You',
      description:
        'What a finished box house costs: unit price, on-site assembly and VAT for the 37, 58 and 73 m² models. Transparent totals, and what is not included.',
    },
    bg: {
      title: 'Цени на сглобяеми къщи 2026 | От 14 840 € с ДДС | NVC Home4You',
      description:
        'Колко струва завършена сглобяема къща: цена на модула, монтаж на място и ДДС за моделите 37, 58 и 73 м². Ясни крайни суми и какво не е включено.',
    },
    el: {
      title: 'Τιμές προκατασκευασμένων σπιτιών 2026 | Από 14.840 € με ΦΠΑ | NVC Home4You',
      description:
        'Πόσο κοστίζει ένα ολοκληρωμένο σπίτι: τιμή μονάδας, συναρμολόγηση και ΦΠΑ για τα μοντέλα 37, 58 και 73 τ.μ. Καθαρά σύνολα και τι δεν περιλαμβάνεται.',
    },
  },
  privacy: {
    en: {
      title: 'Privacy & Cookie Policy | NVC Home4You',
      description:
        'How NVC Home4You collects, uses and protects your personal data, including data kept to prepare your offer, and how to manage cookies — GDPR compliant.',
    },
    bg: {
      title: 'Политика за поверителност и бисквитки | NVC Home4You',
      description:
        'Как NVC Home4You събира, използва и защитава личните Ви данни, включително данните за изготвяне на оферта, и как да управлявате бисквитките — съгласно GDPR.',
    },
    el: {
      title: 'Πολιτική Απορρήτου & Cookies | NVC Home4You',
      description:
        'Πώς η NVC Home4You συλλέγει, χρησιμοποιεί και προστατεύει τα προσωπικά σας δεδομένα, συμπεριλαμβανομένων όσων τηρούμε για τη δημιουργία προσφοράς, και πώς να διαχειρίζεστε τα cookies — σύμφωνα με τον GDPR.',
    },
  },
}

function absolute(path) {
  if (!path) return undefined
  return `${SITE_URL}${path}`
}

export function buildHreflangs(pageKey) {
  const localized = paths[pageKey]
  if (!localized) return []
  const arr = []
  if (localized.bg) arr.push({ hrefLang: 'bg', href: absolute(localized.bg) })
  if (localized.en) arr.push({ hrefLang: 'en', href: absolute(localized.en) })
  if (localized.el) arr.push({ hrefLang: 'el', href: absolute(localized.el) })
  if (localized.en) arr.push({ hrefLang: 'x-default', href: absolute(localized.en) })
  return arr
}

/**
 * Resolve SEO data for a given pathname.
 * Returns null when the path has no managed metadata (e.g. dynamic gallery
 * detail pages, which render their own <SEO>).
 */
export function getRouteSeo(pathname, fallbackLocale = 'en') {
  const pageKey = getPageKeyByPath(pathname)
  if (!pageKey || !META[pageKey]) return null

  const locale = getLocaleFromPath(pathname) || fallbackLocale || 'en'
  const entry = META[pageKey][locale] || META[pageKey].en
  if (!entry) return null

  const localized = paths[pageKey] || {}
  const url = absolute(localized[locale] || localized.en) || SITE_URL

  return {
    title: entry.title,
    description: entry.description,
    url,
    canonical: url,
    locale,
    hreflangs: buildHreflangs(pageKey),
  }
}

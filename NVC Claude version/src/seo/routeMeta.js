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
  // The three product pages. Each URL has one job and one head query, and the title names
  // that query rather than the menu label: "контейнери за живеене" for the containers,
  // "модулни къщи" for the ready houses, "сглобяеми къщи със стоманена конструкция" for the
  // steel-frame line, which finally makes the /sglobqemi-kyshti slug, the query and the page
  // agree. The route files read these through getRouteSeo() and no longer carry their own,
  // so the two can never disagree again (they did, and the content files' versions won).
  // Each H1 carries the same head term, and the description the secondary ones
  // ("жилищни контейнери", "разгъваеми Бокс къщи", "по проект"). The houses' title also
  // names Bulgaria, as the old page's did in all three languages: "модулни къщи България" is
  // a query of its own, and the page's arrival copy says where the houses are delivered.
  //
  // No price in any of them. The pages print live prices from /api/gallery and publish
  // them as Product markup; a price typed here goes stale the day an admin edits one, which
  // is exactly what happened to the prices title below. The sizes they name (6×3 to 8×3 m,
  // 18 to 74 m², 38 m²) are the ones the pages' own leads state. The steel description names
  // no figure at all: the owner (2026-10-12) has every steel-frame house as its own project,
  // with no standard area, floors or profile. The descriptions promise only what the pages
  // show: priced units and the sizes on order, the sizes and the configurator, a house built
  // to your project or one we design for you, and the five steps from one to the other.
  modularBuilds: {
    en: {
      title: 'Residential Containers for Living and Office | NVC Home4You',
      description:
        'Residential and office containers, 6×3, 7×3 and 8×3 m, with a bathroom, electrics and plumbing. Every model priced with VAT and assembly; other sizes to order.',
    },
    bg: {
      title: 'Контейнери за живеене и модулни постройки | NVC Home4You',
      description:
        'Жилищни и офис контейнери 6×3, 7×3 и 8×3 м с баня, ел. и ВиК инсталация. Всеки модел е с цена с ДДС и монтаж, а други размери изработваме по поръчка.',
    },
    el: {
      title: 'Οικίσκοι κοντέινερ για κατοικία και γραφείο | NVC Home4You',
      description:
        'Κοντέινερ κατοικίας και γραφείου 6×3, 7×3 και 8×3 m με μπάνιο, ηλεκτρολογικά και υδραυλικά. Τιμές με ΦΠΑ και συναρμολόγηση· άλλα μεγέθη κατόπιν παραγγελίας.',
    },
  },
  modularHouses: {
    en: {
      title: 'Expandable Modular Houses in Bulgaria | NVC Home4You',
      description:
        'Modular houses that arrive folded: expandable Box houses from 18 to 74 m² and a 38 m² capsule, priced with VAT. Pick a size and build it in our configurator.',
    },
    bg: {
      title: 'Модулни къщи в България: разгъваеми Бокс къщи | NVC Home4You',
      description:
        'Модулни къщи, които пристигат сгънати: разгъваеми Бокс къщи от 18 до 74 м² и капсула от 38 м², всяка с цена с ДДС. Изберете размер и я сглобете онлайн.',
    },
    el: {
      title: 'Αναπτυσσόμενα δομικά σπίτια στη Βουλγαρία | NVC Home4You',
      description:
        'Δομικά προκάτ σπίτια που φτάνουν διπλωμένα: αναπτυσσόμενα σπίτια Box από 18 έως 74 m² και κάψουλα 38 m², με τιμή με ΦΠΑ. Διαμορφώστε το δικό σας online.',
    },
  },
  steelHouses: {
    en: {
      title: 'Steel-Frame Prefab Houses Built to Your Plan | NVC Home4You',
      description:
        'Prefab houses on a galvanised steel frame, built to your plan, or we draw up the project for you. See the five steps from design to handover and get a quote.',
    },
    bg: {
      title: 'Сглобяеми къщи със стоманена конструкция | NVC Home4You',
      description:
        'Сглобяеми къщи със стоманена конструкция по вашия проект, а ако нямате проект, ще го изготвим ние. Вижте петте стъпки до готовата къща и поискайте оферта.',
    },
    el: {
      title: 'Προκατασκευασμένα σπίτια με μεταλλικό σκελετό | NVC Home4You',
      description:
        'Προκατασκευασμένα σπίτια με γαλβανισμένο μεταλλικό σκελετό, με βάση τη μελέτη σας ή μια μελέτη που εκπονούμε εμείς. Δείτε τα πέντε βήματα, ζητήστε προσφορά.',
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
  // The floor planner. The route files read these through getRouteSeo(), as the product
  // routes do; the content files' own seo.title, which disagreed with this one, is gone. The
  // head term ("разпределение", "layout", "κάτοψη") is in the page's H1 too. The sizes are the
  // catalogue's Box houses the page's templates are drawn for; no price, as everywhere here.
  planner: {
    en: {
      title: 'Box House Layout Planner | NVC Home4You',
      description:
        'Start from a catalogue layout for the 37, 58 or 73 m² Box house, or draw your own online. The bathroom stays in its fixed place. Send us the plan for an offer.',
    },
    bg: {
      title: 'Планер за разпределение на Бокс къща | NVC Home4You',
      description:
        'Изберете готово разпределение от каталога на Бокс къщите 37, 58 и 73 м² или начертайте свое онлайн. Банята е на мястото си. Изпратете плана за оферта.',
    },
    el: {
      title: 'Σχεδιασμός κάτοψης για σπίτι Box | NVC Home4You',
      description:
        'Ξεκινήστε από μια κάτοψη του καταλόγου για σπίτι Box 37, 58 ή 73 m² ή σχεδιάστε τη δική σας διαδικτυακά. Το μπάνιο μένει στη θέση του. Στείλτε μας το σχέδιο.',
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
  // `services` removed 2026-08-17 with the page itself — see paths.js.
  //
  // The one page that targets a transactional query head-on. Competitors all rank for
  // "цени" with a price list; the title leads with the number because a search result
  // showing a real starting price is what earns the click.
  //
  // The one figure typed into this file, and only because it has to be: the SEO manifest
  // generator runs this module in plain Node, which cannot load the configurator catalogue
  // that startingPrice() reads. So the number is pinned instead — PricesPage.test.jsx fails
  // the moment it stops equalling euro(startingPrice(locale), locale), which is also the
  // figure the page itself prints under its H1.
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

// The picture a shared link to each product page shows (og:image and twitter:image), in place
// of the site-wide /og/default.jpg: the photo the page itself opens on, so the preview is
// something the visitor then finds on the page. The containers' and the houses' are their
// content files' default hero photos; the steel page has no hero photo of its own (NVC has
// no photograph of a steel build yet), so it is the render of its first process step, which
// the page shows and labels a render. Not one of the old example visualisations: the owner
// (2026-10-12) wants none of those seven on the steel page. The alts are the content files'
// alts for the same pictures.
// routeMeta.test.js fails the moment either drifts from its content file.
//
// The URLs are the plain /api/img originals, not ?w=1200: the resizer only narrows and
// never crops, and all three originals are under 1200px, so the width and height below are
// the files' own (measured 2026-10-12). /api/img serves WebP, hence the type. The houses'
// photo is portrait; Facebook and LinkedIn crop it to the middle band, where the house is.
//
// An admin photo set for a page's hero does not change this: the admin panel stores no
// size for it, and this module runs in plain Node at build time (the SEO manifest), where
// the live slot cannot be read.
const PAGE_IMAGES = {
  modularBuilds: {
    url: `${SITE_URL}/api/img/gallery/3/37755aa751c74bb5bbcd9848842c3a1e.webp`,
    width: 1024,
    height: 1024,
    type: 'image/webp',
    alt: {
      bg: 'Контейнер 8 × 3 м с двускатен покрив, отвътре',
      en: 'Inside an 8 × 3 m container with a gable roof',
      el: 'Εσωτερικό κοντέινερ 8 × 3 m με δίρριχτη στέγη',
    },
  },
  modularHouses: {
    url: `${SITE_URL}/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp`,
    width: 1086,
    height: 1448,
    type: 'image/webp',
    alt: {
      bg: 'Разгъваема къща от 58 м² с веранда, доставена в Паралия Кариани, Гърция',
      en: 'A 58 m² expandable house with a veranda, delivered to Paralia Kariani, Greece',
      el: 'Αναπτυσσόμενο σπίτι 58 m² με βεράντα, παραδομένο στην Παραλία Καριανής, Ελλάδα',
    },
  },
  steelHouses: {
    url: `${SITE_URL}/api/img/content/bvk4n834b-rcn-eg-vb.webp`,
    width: 940,
    height: 788,
    type: 'image/webp',
    alt: {
      bg: 'Визуализация на двуетажна къща с триъгълен покрив, остъклен фронтон и дървена тераса',
      en: 'Render of a two-storey house with a triangular roof, a glazed gable and a timber deck',
      el: 'Απεικόνιση διώροφου σπιτιού με τριγωνική στέγη, τζαμαρία στο αέτωμα και ξύλινη βεράντα',
    },
  },
}

/** The share picture for a page in a locale, as SEO.jsx's props, or {} for the default. */
export function pageImage(pageKey, locale = 'en') {
  const image = PAGE_IMAGES[pageKey]
  if (!image) return {}
  return {
    image: image.url,
    imageWidth: image.width,
    imageHeight: image.height,
    imageType: image.type,
    imageAlt: image.alt[locale] || image.alt.en,
  }
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
    ...pageImage(pageKey, locale),
  }
}

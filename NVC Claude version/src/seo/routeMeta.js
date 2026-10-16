// src/seo/routeMeta.js
// Centralized per-route SEO copy (title + description) for every page, in all
// locales. Rendered once from AppShell so every route ships a unique title,
// description, canonical URL, hreflang set and Open Graph tags.
import { paths, getPageKeyByPath, getLocaleFromPath } from '../routes/paths.js'
import { DELIVERY_RATES } from '../content/shared/deliveryRates.js'
import { PARTNER_MIN_UNITS } from '../content/shared/partnerTerms.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'

const SITE_URL = 'https://nvc-home4you.eu'

const { container: CONTAINER, box: BOX } = DELIVERY_RATES.products

// EVERY public route reads its head from here through getRouteSeo() (2026-10-16): the home,
// gallery, cases and configurator routes used to set their own copy, so the server manifest
// (built from this file) and the prerendered page (built from the route) carried two titles
// for the same URL. seoUrls.test.js fails the moment a route file sets its own again.
const META = {
  // The copy the live snapshots served (the route files' own until 2026-10-16), moved here so
  // the manifest agrees with them. The Bulgarian title stays word for word; the English and
  // Greek ones name the same three lines in their buyers' words ("Modular builds" was the
  // English page key, "Δομικές κατασκευές" the Greek one), within 62 characters. No claim is
  // added: the same countries and the same offer as before, plus the prices page.
  home: {
    en: {
      title: 'Container Homes, Modular and Prefab Houses | NVC Home4You',
      description:
        'Container homes, modular houses and prefab homes in Bulgaria and Europe. Explore models, prices, delivery and custom solutions from NVC Home4You.',
    },
    bg: {
      title: 'Контейнери за живеене, модулни и сглобяеми къщи | NVC Home4You',
      description:
        'Контейнери за живеене, модулни и сглобяеми къщи в България. Разгледайте модели, цени, доставка и индивидуални решения от NVC Home4You.',
    },
    el: {
      title: 'Προκατασκευασμένα σπίτια και σπίτια-κοντέινερ | NVC Home4You',
      description:
        'Προκατασκευασμένα σπίτια και σπίτια-κοντέινερ σε Βουλγαρία και Ευρώπη. Δείτε μοντέλα, τιμές, παράδοση και εξατομικευμένες λύσεις από την NVC Home4You.',
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
      // The page's own H1 ("Containers for living, office and site use"), title-cased.
      title: 'Containers for Living, Office and Site Use | NVC Home4You',
      description:
        'Residential and office containers, 6×3, 7×3 and 8×3 m, with a bathroom, electrics and plumbing. Every model priced with VAT and assembly; other sizes to order.',
    },
    bg: {
      title: 'Контейнери за живеене и модулни постройки | NVC Home4You',
      description:
        // "фургони": five of the six cards are titled "Жилищен фургон", and the prices page
        // heads the section "Фургони и контейнери".
        'Жилищни и офис контейнери (фургони) 6×3, 7×3 и 8×3 м с баня, ел. и ВиК инсталация. Цени с ДДС и монтаж; другите размери можем да ги поръчаме за вас.',
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
        'Modular houses: expandable Box houses from 18 to 74 m² that arrive folded, and a 38 m² capsule, priced with VAT. Pick a size and build it in our configurator.',
    },
    bg: {
      title: 'Модулни къщи в България: разгъваеми Бокс къщи | NVC Home4You',
      description:
        'Модулни къщи: разгъваеми Бокс къщи от 18 до 74 м², които пристигат сгънати, и капсула от 38 м², всяка с цена с ДДС. Изберете размер и я сглобете онлайн.',
    },
    el: {
      title: 'Αναπτυσσόμενα δομικά σπίτια στη Βουλγαρία | NVC Home4You',
      description:
        'Δομικά προκάτ σπίτια: αναπτυσσόμενα σπίτια Box από 18 έως 74 m² που φτάνουν διπλωμένα, και κάψουλα 38 m², με τιμή με ΦΠΑ. Διαμορφώστε το δικό σας online.',
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
  // The FAQ hub (rebuilt 2026-10-16). The FAQ routes read this through getRouteSeo() and their
  // content files no longer carry an seo block. The description names only what the hub answers
  // (its own questions and the ones it gathers from the delivery, partner, doors and interiors
  // pages), 130–160 characters; no figure, so nothing here can go stale. The titles name the
  // two product lines most of its answers are about (release A shipped the bare "FAQ | brand",
  // which no one searches for), within 70 characters.
  faq: {
    en: {
      title: 'FAQ About Containers and Box Houses | NVC Home4You',
      description:
        'Answers about prices and VAT, delivery and the crane, the warranty, customs, documents and visits, plus partner terms, internal doors and interior renovations.',
    },
    bg: {
      title: 'Често задавани въпроси за контейнери и Бокс къщи | NVC Home4You',
      description:
        'Отговори за цените с ДДС, доставката и крана, гаранцията, митницата, документите и посещенията при нас, както и за партньорите, интериорните врати и ремонтите.',
    },
    el: {
      title: 'Συχνές ερωτήσεις για κοντέινερ και σπίτια Box | NVC Home4You',
      description:
        'Απαντήσεις για τιμές και ΦΠΑ, παράδοση και γερανό, εγγύηση, εκτελωνισμό, έγγραφα και επισκέψεις, καθώς και για συνεργάτες, εσωτερικές πόρτες και ανακαινίσεις.',
    },
  },
  // The About page (rebuilt 2026-10-15). The place, what we sell and why it is safe to buy:
  // our factory (ONE, never named), customs ours, the warranty's years read from warranty.js
  // and said of the structure only, delivery in the EU as the home page words it (the Greek one
  // names Greece, where we have delivered). No "craftsmanship" and no homes count (still
  // unconfirmed); the founding year, the team and the VAT number are on the page itself.
  about: {
    en: {
      title: 'About Us: Containers and Box Houses, Petrich | NVC Home4You',
      description:
        `NVC Home4You of Marikostinovo, Petrich: containers and Box houses from our own factory, customs handled by us, a ${WARRANTY_YEARS.structure}-year structural warranty, EU delivery.`,
    },
    bg: {
      title: 'За нас: контейнери и Бокс къщи от Петрич | NVC Home4You',
      description:
        `NVC Home4You от Марикостиново, Петрич: контейнери и Бокс къщи от нашата фабрика, митницата е наша грижа, гаранция ${WARRANTY_YEARS.structure} години на конструкцията, доставка в ЕС.`,
    },
    el: {
      title: 'Σχετικά με εμάς: κοντέινερ και σπίτια Box, Πέτριτς | NVC Home4You',
      description:
        `NVC Home4You, Μαρικοστίνοβο Πέτριτς: κοντέινερ και σπίτια Box από το εργοστάσιό μας, εκτελωνισμός από εμάς, εγγύηση ${WARRANTY_YEARS.structure} ετών στον σκελετό, παράδοση στην Ελλάδα.`,
    },
  },
  // The gallery is the priced catalogue, in its four lines (the index's chips, 2026-10-17): the
  // containers, the Box houses, the space capsule and the steel-frame houses ("Сглобяеми къщи",
  // the projects a customer can ask for one like), each with photos and a price with VAT (a
  // project's too, the owner said, when its card carries one; it may not). A house like a
  // project is priced per project, which the descriptions say in the card's own words.
  // Not "completed projects", and no garages: the old content-file copy promised both.
  //
  // The titles name all four lines and keep "с цени" / prices, the page's query; the brand fits
  // only without "Галерия", which the H1 keeps (content/*/gallery.js heading). The capsule is
  // "капсули" here and "космически капсули" in the H1 and its chip. The sizes are the ones the
  // containers' and the houses' snippets above already name.
  gallery: {
    en: {
      title: 'Container, Box, Capsule and Steel-Frame Houses: Prices | NVC Home4You',
      description:
        'Photos and prices incl. VAT: containers 6×3, 7×3 and 8×3 m, Box houses from 18 to 74 m², a space capsule and steel-frame houses priced per project. Get a quote.',
    },
    bg: {
      title: 'Контейнери, Бокс къщи, капсули и сглобяеми къщи с цени | NVC Home4You',
      description:
        'Снимки и цени с ДДС: контейнери 6×3, 7×3 и 8×3 м, Бокс къщи от 18 до 74 м², космическа капсула и сглобяеми къщи с цена по проект. Поискайте оферта.',
    },
    el: {
      // "Box και μεταλλικά σπίτια": the one order that names all four lines within 70 characters
      // and still reads as Greek.
      title: 'Κοντέινερ, κάψουλες, Box και μεταλλικά σπίτια με τιμές | NVC Home4You',
      description:
        'Φωτογραφίες και τιμές με ΦΠΑ: κοντέινερ 6×3, 7×3 και 8×3 m, σπίτια Box από 18 έως 74 m², κάψουλα χώρου και μεταλλικά σπίτια με τιμή ανά έργο. Ζητήστε προσφορά.',
    },
  },
  // The interiors page: bathroom and kitchen renovations by NVC's own builders, from Sofia to
  // Petrich (the owner, 2026-10-15). No price and no duration, here or on the page: the price
  // comes after the free site visit. The head term ("ремонт на баня", "renovation",
  // "ανακαίνιση") is in the page's H1 too; titles within 70 characters, descriptions within 160
  // (InteriorsPage.test.jsx).
  interiors: {
    en: {
      title: 'Bathroom and Kitchen Renovation, Sofia to Petrich | NVC Home4You',
      description:
        'Bathroom and kitchen renovation by our own builders, from demolition to tiling and kitchen fitting. Free site visit, written offer, contract and warranty.',
    },
    bg: {
      title: 'Ремонт на баня и кухня от София до Петрич | NVC Home4You',
      description:
        'Ремонт на баня и кухня от нашия екип: от къртенето до плочките и монтажа на кухнята. Безплатен оглед, писмена оферта, договор и гаранция.',
    },
    el: {
      title: 'Ανακαίνιση μπάνιου και κουζίνας, Σόφια έως Πέτριτς | NVC Home4You',
      description:
        'Ανακαίνιση μπάνιου και κουζίνας από τη δική μας ομάδα: από την καθαίρεση έως τα πλακάκια και την κουζίνα. Δωρεάν αυτοψία, γραπτή προσφορά, σύμβαση, εγγύηση.',
    },
  },
  // The delivery page, the one place that answers "what does it cost to get it onto my
  // plot". Its route files read this through getRouteSeo(), as the product routes do, so
  // there is one title per locale. Unlike the product pages it DOES name its
  // figures: the per-km rate and the crane are what people search for, and no seller in
  // those results publishes one. They are composed from deliveryRates.js, never typed, so a
  // new rate changes the snippet in the same commit (a few hundred bytes in the main chunk).
  // Every one is excl. VAT and says so; the logistics page's searches ("международна
  // логистика") are no longer targeted, its URLs 301 here (Program.cs retiredPages). The
  // titles stay within 70 characters so the brand is not cut off, and the crane sits with the
  // Box house, the one product that cannot do without it.
  delivery: {
    en: {
      title: 'Container and Box House Delivery: Price per km | NVC Home4You',
      description:
        `Container: €${CONTAINER.perKm}/km. Box house: about €${BOX.perKm}/km plus a crane of about €${BOX.crane.about}. Km counted both ways, excl. VAT. Work out delivery to your town in Bulgaria or Greece.`,
    },
    bg: {
      title: 'Доставка на контейнери и Бокс къщи — цена на км и кран | NVC Home4You',
      description:
        `Контейнер: ${CONTAINER.perKm} €/км. Бокс къща: около ${BOX.perKm} €/км и кран около ${BOX.crane.about} €. Км в двете посоки, без ДДС. Изчислете доставката до вашето място в България или Гърция.`,
    },
    el: {
      title: 'Παράδοση κοντέινερ και σπιτιών Box: τιμή ανά χλμ | NVC Home4You',
      description:
        `Κοντέινερ: ${CONTAINER.perKm} €/χλμ. Σπίτι Box: περίπου ${BOX.perKm} €/χλμ + γερανός περίπου ${BOX.crane.about} €. Και στις δύο κατευθύνσεις, χωρίς ΦΠΑ. Υπολογίστε την παράδοση σε Βουλγαρία ή Ελλάδα.`,
    },
  },
  // The partner page, for resellers and bulk buyers. Its routes read this through
  // getRouteSeo(), as the delivery routes do, so the head the server injects and the snapshot
  // agree (the content files' own seo blocks, which disagreed with it, are gone). The quantity
  // thresholds are partnerTerms.js's, never typed; no price, no percentage. The titles stay
  // within 70 characters and the descriptions within 160 (routeMeta.test.js). "на едро" /
  // "wholesale" / "χονδρικώς" is the search term the owner's 2026-10-15 answer now backs:
  // partners get a lower price by quantity.
  partner: {
    en: {
      title: 'Wholesale Containers and Box Houses for Resellers | NVC Home4You',
      description:
        `Reselling or buying several? Lower prices by quantity: containers from ${PARTNER_MIN_UNITS.container} units, Box houses from ${PARTNER_MIN_UNITS.box}. In stock in Bulgaria, customs handled, delivery anywhere.`,
    },
    bg: {
      title: 'Контейнери и Бокс къщи на едро – за търговци | NVC Home4You',
      description:
        `Препродавате или купувате на едро? По-ниски цени според броя: контейнери от ${PARTNER_MIN_UNITS.container}, Бокс къщи от ${PARTNER_MIN_UNITS.box} бр. Контейнери на склад, поемаме митницата, доставка навсякъде.`,
    },
    el: {
      title: 'Κοντέινερ και σπίτια Box χονδρικώς – για μεταπωλητές | NVC Home4You',
      description:
        `Μεταπωλείτε ή αγοράζετε αρκετά τεμάχια; Χαμηλότερη τιμή ανά ποσότητα: κοντέινερ από ${PARTNER_MIN_UNITS.container}, σπίτια Box από ${PARTNER_MIN_UNITS.box}. Εκτελωνισμός από εμάς, παράδοση και στην Ελλάδα.`,
    },
  },
  // The floor planner. The route files read these through getRouteSeo(), as the product
  // routes do; the content files' own seo.title, which disagreed with this one, is gone. The
  // head term ("разпределение", "layout", "κάτοψη") is in the page's H1 too. The sizes are the
  // catalogue's Box houses the page's templates are drawn for; no price, as everywhere here.
  planner: {
    en: {
      title: 'Box House Layout Planner: 37, 58 and 73 m² | NVC Home4You',
      description:
        'Start from a catalogue layout for the 37, 58 or 73 m² Box house, or draw your own online. The bathroom stays in its fixed place. Send us the plan for an offer.',
    },
    bg: {
      title: 'Планер за разпределение на Бокс къща | NVC Home4You',
      description:
        'Изберете готово разпределение от каталога на Бокс къщите 37, 58 и 73 м² или начертайте свое онлайн. Банята е на мястото си. Изпратете плана за оферта.',
    },
    el: {
      title: 'Σχεδιασμός κάτοψης για σπίτι Box 37, 58 ή 73 m² | NVC Home4You',
      description:
        'Ξεκινήστε από μια κάτοψη του καταλόγου για σπίτι Box 37, 58 ή 73 m² ή σχεδιάστε τη δική σας διαδικτυακά. Το μπάνιο μένει στη θέση του. Στείλτε μας το σχέδιο.',
    },
  },
  // The configurator: the catalogue's three Box models (boxConfiguratorCatalog.js) and its own
  // steps, in the order the page walks them, ending in the offer request it sends. Its route
  // files read this; the content files' seo block keeps only the url and the breadcrumb.
  boxConfigurator: {
    en: {
      title: 'Box House Configurator: 37, 58 and 73 m² | NVC Home4You',
      description:
        'Configure a 37, 58 or 73 m² NVC Box house online: model, layout, exterior, interior, heating, panoramic windows and sockets, then send it to us for an offer.',
    },
    bg: {
      title: 'Конфигуратор за Бокс къщи 37, 58 и 73 м² | NVC Home4You',
      description:
        'Конфигурирайте онлайн Бокс къща от 37, 58 или 73 м²: модел, разпределение, екстериор, интериор, отопление, панорамни прозорци и контакти. Изпратете я за оферта.',
    },
    el: {
      title: 'Διαμορφωτής σπιτιού Box 37, 58 και 73 m² | NVC Home4You',
      description:
        'Διαμορφώστε online σπίτι Box 37, 58 ή 73 m²: μοντέλο, διάταξη, εξωτερικό, εσωτερικό, θέρμανση, πανοραμικά παράθυρα και πρίζες. Στείλτε το για προσφορά.',
    },
  },
  // The internal doors page (rebuilt 2026-10-15): a separate product, sold on its own. The four
  // types, WPC, the complete set, fitting on request and the price by quantity, all the owner's;
  // no figure, since none is published.
  doors: {
    en: {
      title: 'Internal WPC Doors, Supplied as a Set | NVC Home4You',
      description:
        'Internal WPC doors with decorative or metal lines, concealed or with glass. Supplied as a set with frame and hardware, fitting on request, priced by quantity.',
    },
    bg: {
      title: 'Интериорни врати от WPC в комплект | NVC Home4You',
      description:
        'Интериорни врати от WPC: с декоративни или метални линии, тапетни или със стъкло. В комплект с каса и обков, монтаж по желание, цена според количеството.',
    },
    el: {
      title: 'Εσωτερικές πόρτες WPC σε πλήρες σετ | NVC Home4You',
      description:
        'Εσωτερικές πόρτες WPC με γραμμές, αφανείς ή με τζάμι. Σε σετ με κάσα και εξαρτήματα, τοποθέτηση κατόπιν αιτήματος, τιμή ανάλογα με την ποσότητα.',
    },
  },
  // The cases page: what it shows whatever the admin publishes next (the customers' reviews and
  // ratings, the published cases with product, place and photos, the 1–5 star form). No company
  // buyers (none is published), no logistics and no interiors promised, as the content files'
  // old copy did; the title keeps the page's H1 ("Казуси и отзиви").
  cases: {
    en: {
      title: 'Cases and Reviews from Our Customers | NVC Home4You',
      description:
        'Reviews and ratings from our customers, and published cases with the product, place and photos. Bought from us? Leave a review and a rating from 1 to 5 stars.',
    },
    bg: {
      title: 'Казуси и отзиви от наши клиенти | NVC Home4You',
      description:
        'Отзиви и оценки от наши клиенти и публикувани казуси с продукт, място и снимки. Купили сте от нас? Оставете своя отзив и оценка от 1 до 5 звезди.',
    },
    el: {
      title: 'Έργα και κριτικές από τους πελάτες μας | NVC Home4You',
      description:
        'Κριτικές και αξιολογήσεις πελατών μας και δημοσιευμένα έργα με προϊόν, τοποθεσία και φωτογραφίες. Αγοράσατε από εμάς; Αφήστε κριτική και 1 έως 5 αστέρια.',
    },
  },
  // `services` removed 2026-08-17 with the page itself — see paths.js.
  //
  // The one page that targets a transactional query head-on. Competitors all rank for
  // "цени" with a price list; the title leads with the number because a search result
  // showing a real starting price is what earns the click.
  //
  // The one figure typed into this file, and only because it has to be: the SEO manifest
  // generator runs this module in plain Node, which cannot load the gallery or the catalogue.
  // It is the figure the page prints under its H1, the cheapest finished house: since the 18 m²
  // house got its assembly price (owner, 2026-10-17) that is the 18 m² one, its gallery price
  // (10,500) plus its assembly with VAT (1,200). PricesPage.test.jsx pins the title to what the
  // page prints from live-shaped gallery rows; if the 18 m² price changes in the admin panel,
  // change these three titles with it.
  prices: {
    en: {
      title: 'Prefab House Prices 2026 | From €11,700 incl. VAT | NVC Home4You',
      description:
        'What a finished box house costs: unit price, on-site assembly and VAT for every model from 18 to 74 m². Transparent totals, and what is not included.',
    },
    bg: {
      title: 'Цени на сглобяеми къщи 2026 | От 11 700 € с ДДС | NVC Home4You',
      description:
        'Колко струва завършена сглобяема къща: цена на модула, монтаж на място и ДДС за моделите от 18 до 74 м². Ясни крайни суми и какво не е включено.',
    },
    el: {
      // "προκάτ", the Greek buyer's word (the houses' description uses it too): the long form
      // made this 74 characters, past the 70 every other title keeps to.
      title: 'Τιμές προκάτ σπιτιών 2026 | Από 11.700 € με ΦΠΑ | NVC Home4You',
      description:
        'Πόσο κοστίζει ένα ολοκληρωμένο σπίτι: τιμή μονάδας, συναρμολόγηση και ΦΠΑ για τα μοντέλα από 18 έως 74 τ.μ. Καθαρά σύνολα και τι δεν περιλαμβάνεται.',
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
        'Πώς η NVC Home4You συλλέγει, χρησιμοποιεί και προστατεύει τα δεδομένα σας, όσα τηρούμε για την προσφορά σας και πώς διαχειρίζεστε τα cookies (GDPR).',
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
  // The delivery page's own photo (PAGE_PHOTO_DEFAULTS.delivery), with its alt from the
  // delivery content's prepare.photoAlt.
  delivery: {
    url: `${SITE_URL}/delivery/crane-lift-1500.webp`,
    width: 1500,
    height: 1125,
    type: 'image/webp',
    alt: {
      bg: 'Кран сваля дълъг модул от камион върху бетонна площадка',
      en: 'A crane lifting a long module off a truck onto a concrete yard',
      el: 'Γερανός κατεβάζει μια μακριά μονάδα από φορτηγό σε τσιμεντένιο προαύλιο',
    },
  },
  // The partner page borrows the same photo (PAGE_PHOTO_DEFAULTS.partner) until the owner
  // uploads one of the yard; its alt is the partner content's hero.photoAlt.
  partner: {
    url: `${SITE_URL}/delivery/crane-lift-1500.webp`,
    width: 1500,
    height: 1125,
    type: 'image/webp',
    alt: {
      bg: 'Кран сваля дълъг модул от камион върху бетонна площадка',
      en: 'A crane lifting a long module off a truck onto a concrete yard',
      el: 'Γερανός κατεβάζει μια μακριά μονάδα από φορτηγό σε τσιμεντένιο προαύλιο',
    },
  },
  // The About page opens on the same crane lift (AboutPage.jsx ABOUT_PHOTO), with its alt
  // from the about content's hero.photoAlt.
  about: {
    url: `${SITE_URL}/delivery/crane-lift-1500.webp`,
    width: 1500,
    height: 1125,
    type: 'image/webp',
    alt: {
      bg: 'Кран сваля дълъг модул от камион върху бетонна площадка',
      en: 'A crane lifting a long module off a truck onto a concrete yard',
      el: 'Γερανός κατεβάζει μια μακριά μονάδα από φορτηγό σε τσιμεντένιο προαύλιο',
    },
  },
  // The interiors page opens on the owner's black-marble bathroom (interiorsMedia.js
  // INTERIORS_PHOTOS.bathBlack, its 1200 wide crop), with the interiors content's hero.photoAlt.
  // Portrait: a share card crops it to the middle band, the basin and the window.
  interiors: {
    url: `${SITE_URL}/interiors/bath-black-1200.webp`,
    width: 1200,
    height: 1500,
    type: 'image/webp',
    alt: {
      bg: 'Баня с черен мрамор и плочки имитация на дърво: черен душ комплект, мивка върху дървен шкаф, прозорец',
      en: 'Bathroom in black marble and wood-look tiles: black shower set, basin on a wooden vanity unit, window',
      el: 'Μπάνιο με μαύρο μάρμαρο και πλακάκια όψης ξύλου: μαύρο σετ ντους, νιπτήρας σε ξύλινο έπιπλο, παράθυρο',
    },
  },
  // The doors page opens on its catalogue's cover (doorsCatalogue.js DOORS_COVER), with its alt.
  doors: {
    url: `${SITE_URL}/internal-doors/catalogue/rooms/cover.webp`,
    width: 1120,
    height: 960,
    type: 'image/webp',
    alt: {
      bg: 'Хол с бяла врата с декоративни линии',
      en: 'A living room with a white door with decorative lines',
      el: 'Σαλόνι με λευκή πόρτα με διακοσμητικές γραμμές',
    },
  },
  // The containers page opens on the owner's delivered container (since 2026-10-17). The share
  // card takes the same photo's 16:10 crop (deliveredMedia.js DELIVERED_CONTAINER_WIDE), which a
  // 1.91:1 card trims far less than the hero's 4:3, with the content's hero.photo.alt.
  modularBuilds: {
    url: `${SITE_URL}/delivered/container-lakeside-16x10-1600.webp`,
    width: 1600,
    height: 1000,
    type: 'image/webp',
    alt: {
      bg: 'Контейнер, доставен на парцела на клиент',
      en: "A container delivered to a customer's plot",
      el: 'Κοντέινερ παραδομένο στο οικόπεδο πελάτη',
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

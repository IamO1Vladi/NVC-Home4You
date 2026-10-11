# Making the NVC Home4You home page feel welcoming

Design review of https://nvc-home4you.eu (home page, en/bg/el, light and dark, desktop 1440 and phone 390), captured 2026-10-05, reviewed 2026-10-10. Every line reference below was re-checked against the repository on the day of writing; the mobile drawer, which no capture shows, was read from the live DOM on the same day.

> Verification note (2026-10-11): the hero click-target bug in change 1 (every click opened `/interiors`) was reproduced in a real browser and fixed in `HeroShowcase.jsx`/`HeroShowcase.css` (only the visible slide is clickable and focusable); the production HTML for all three locales was found to ship with `data-theme="dark"` baked in, which strengthens the "light first" quick win in section 5.

## 1. The verdict

Today the page reads as a software launch, not a home: a 70 px slogan with a gradient word, a grey container with a porthole shown inside a tablet bezel (which glows white on the dark theme), glass cards, a rotating sheen, a mouse tilt, a fake "Progress: 17 %" bar and a black cookie strip.
It is silent on the three things a family wants in the first three seconds: a price (the first one is at 58 % of the page), a place (never; the address exists only in the JSON-LD) and a person (24 photographs, no face; the phone number is plain text in the last card).
The photographs are good enough to carry warmth, but they are shown through bezels, hover wipes, a 50 % fog on phones and three factory floors.
On a phone, roughly 29 % of every screen is chrome: a 98 px sticky header with a bordered "System / EN" box and a logo touching the left edge, a quote dock that repeats the brand name and truncates its own sentence, and a chat bubble floating on top of both.
"Welcoming" here means: warm paper instead of glass, the home seen whole in daylight, "from €14,840" in the first sentence, "Petrich, Bulgaria" and a number you can tap on screen one, and nothing that moves unless the visitor moves it.
Most of that is subtraction and copy; the code work is a few days; the photography is the owner's, and it is what decides whether the page becomes warm or merely clean.

## 2. The direction

Three candidate directions were scored by two judges. Judge A: Front Porch 31, Open House (warm paper) 29, Open House (white) 24. Judge B: Open House (warm paper) 31, Front Porch 30, Open House (white) 24. Combined, **Front Porch wins 61 to 60**, and both judges' graft lists converge on the same page: Front Porch's *content* (a named person who answers the phone, the town and the distance to the Greek border, the phone as a first-class element in five places, prices stated as complete, reviews framed as neighbours with their towns) on Open House's *visual system* (warm paper tokens defined once for both themes, a properly specified dark palette, 600-weight humanist type, photographs shown whole, 1 px hairlines instead of blur and shadow). Open House (white) was set aside: it names Pazardzhik as the company's town (a reviewer's town; the company is in Marikostinovo, Petrich), leaves the dark theme blue-black, and white + Inter + hairlines is the template look the brief calls cold. The winning direction, "Front Porch on warm paper", is a page a Thessaloniki or Plovdiv couple opens on a phone and sees, in order: a whole house in daylight, the slogan, "from €14,840, VAT and assembly included", "based in Petrich", a number that dials when tapped, and three homes with prices on the next screen.

### Signature moves

**1. A person, a place, a number.** A greeting line above the lead with a 40 px photo of whoever answers the phone: EN "Hi, I'm {Name}. Call or write — I'm the one who answers." / BG "Здравейте, аз съм {Име}. Обадете се или пишете — аз отговарям." / EL "Γεια σας, είμαι {Όνομα}. Καλέστε ή γράψτε μας — εγώ απαντώ." (ships as text if there is no photo; never an illustration; "Call" and "write" are the `tel:` and `mailto:` links). A place stamp, EN "Marikostinovo, Petrich · 10 km from the Greek border" / BG "Марикостиново, Петрич · 10 км от ГКПП Кулата" / EL "Μαρικοστίνοβο, Πέτριτς · 10 χλμ από τον Προμαχώνα" (the Greek spelling the site already uses in `el/privacy.js` l.22 and `el/delivery.js` l.77; the distance is on the owner's confirm list, section 6), with a 3 KB inline SVG outline of Bulgaria and a clay pin, under the hero and in the contact card. One `PhoneLink` component (one number constant, `tel:` + 20 px handset icon) used in the header, the greeting line, the drawer, the contact card and the phone pill; the footer carries the address, not the number (change 8). Hours and address come from the same object `LocalBusinessJSONLD` reads, so page and schema cannot disagree.

**2. Warm paper, defined once.** Tokens on `:root` (light) and `:root[data-theme='dark']`, aliased onto the existing names (`--night` → bg, `--anth` → surface, `--text`, `--muted`) so the 1,568-line `index.css` keeps working during the migration; delete the per-component theme blocks in `HeroShowcase.css` l.1-6, `ServiceTiles.css` l.1-6, `GlideServices.css` l.1-6.

| Token | Light | Dark |
|---|---|---|
| `--bg` (`--night`) | `#FAF7F2` warm linen | `#1A1816` warm charcoal |
| `--surface` (`--anth`) | `#FFFFFF` | `#242120` |
| `--surface-2` (bands, chips, cookie card) | `#F3EEE6` | `#2C2825` |
| `--text` | `#1F2A37` (13.6:1) | `#F1ECE4` (15:1) |
| `--muted` | `#5B6573` (5.5:1 on bg, 5.1:1 on `--surface-2`) | `#B5ACA1` (7.9:1) |
| `--line` (all 1 px borders) | `#E6DFD5` | `#3A352F` |
| `--accent` button fill, both themes | `#2B63C9`, white text 5.6:1 | `#2B63C9`, white text 5.6:1 |
| `--accent-text` links | `#2B63C9` (5.3:1 on bg) | `#8DB8FF` (8.8:1) |
| `--clay` H1 emphasis word, eyebrows, map pin | `#A5532D` (5.1:1) | `#D98B63` (6.6:1) |
| `--sage` "Verified", ticks | `#3E7C59` | `#7FC19A` |
| `--star` (decorative, aria-hidden) | `#E6A23C` | `#F0B454` |

For comparison, today: white on `#39B5D5` 2.4:1, white on `#4C8DF5` 3.3:1, the gradient "shouldn't" on `#f7f8fa` 2.3:1; axe reports zero because `background-clip:text` is not evaluated.

**3. One accent; the gradient retires to the logo.** Every link, button, focus ring and the slogan's `<g>` word becomes solid (`--accent` for actions, `--clay` for the slogan word). The teal→blue gradient leaves `.btn`, `.chip`, `.bubble`, `.feature-icon`, `.grad-text`, the header "NVC" and the light `.brand-logo`; `#39B5D5`/`#4C8DF5` survive only in the logo square and favicon. `--clay` is used on exactly three things — the slogan's `<g>` word, the single eyebrow of each section, and the map pin — and never on a button, link, chip, price or star; so no viewport shows more than two clay elements (slogan word + eyebrow on screen one, eyebrow + pin on the contact card). Until the redesign ships, the ink-gradient quick win in section 5 fixes contrast without changing the look.

**4. Type: one humanist family, nothing heavier than 600.** Phase 1 (this month): keep the system stack, apply the scale. Phase 2: Commissioner variable (SIL OFL, designed in Greece, native Latin, Cyrillic and Greek), self-hosted as three `unicode-range` woff2 subsets (30-60 KB each), `font-display: swap` with `size-adjust`/`ascent-override` on the fallback, only the current locale's subset preloaded through the per-route head the API already injects between SEO-START/SEO-END; ship only if CLS stays ≤ 0.05 on the prerendered page. Optional after a Bulgarian `locl` check on Windows Chrome and iOS Safari: Source Serif 4 600 for H1 and H2 only. Scale (the one H1 scale used everywhere in this report, including the quick win): H1 `clamp(34px, 1.6rem + 2.8vw, 60px)` / 1.08 / 600 / `-0.015em` (36.5 px at 390, 60 px from 1,230 px up), `text-wrap: balance`, the `<g>` span `white-space: nowrap`; H2 `clamp(26px, 1.1rem + 1.5vw, 34px)` / 1.15 / 600; H3 20 px / 1.3 / 600; lead 18-20 px / 1.5 in `--text`; body 17 px / 1.6 (16 px under 768 px); captions 14 px / 1.45; eyebrows 13 px / 600 (uppercase with `.08em` tracking in Latin and Cyrillic, plain 600 in Greek); prices 28 px / 600 `tabular-nums`; buttons 16 px / 600, 48 px tall, `min-width: 160px` for Greek labels. The 800-weight tile titles and the 900-weight brand soften with no other change.

**5. Shape and shadow.** Radii on a scale: `--r-s: 10px` (chips, inputs, caption chips), `--r-m: 16px` (cards, tiles, buttons), `--r-l: 20px` (hero photo, full-width panels); anything nested uses `border-radius: inherit` or parent minus padding, so a 20 px frame never sits inside a 16 px wrapper again. Every border is `1px solid var(--line)`. No `backdrop-filter` anywhere (the sticky header may stay 97 % opaque without blur). Two shadow tokens only: `--shadow-1: 0 1px 2px rgba(31,42,55,.06)` for the sticky header; `--shadow-2: 0 12px 32px rgba(15,23,42,.12)` for the hero photograph and the floating cookie card. Buttons get `0 6px 14px rgba(43,99,201,.25)` at most; delete `.btn::after` (index.css l.59-64) and `.feature-card::before` (l.320-325). In dark, every photograph gets a 1 px `--line` edge so it does not float.

**6. Photographs shown whole, captioned with a place.** Daylight, standing height, people in frame wherever consent allows; no factory floor, no render, no neon above the fold; at most one dusk shot per page. Every photo is a plain rounded rectangle at full opacity in every state (no hover wipe, no 50 % fog, no Ken Burns, no glass caption pill). Each carries a 12-13 px chip in `--surface` at 92 % with a 1 px `--line` border: "{model} · {town} · {year}" (e.g. "37 m² · Карлово · 2025"), the same format in all three locales because it is numbers and proper nouns. Hero 16:10 on desktop, 16:11 on phones; served through `/api/img` with `srcset`. Customer houses and faces only with written consent, first names only.

**Motion policy (part of every move above).** At rest the only self-driven motion on the home page is the hero crossfade: 7 s per slide, paused off-screen (the existing IntersectionObserver), paused on hover, focus-within and any dot click. Everything else moves only in response to the visitor and finishes within 300 ms. No autoplay without a way to stop it. `prefers-reduced-motion` keeps killing everything, as `index.css` l.268-270 does today; gate the framer-motion animations on it too (appendix C).

## 3. The ten changes that matter most

Ranked by welcome-impact per effort. "Now" describes the production captures.

### 1. The hero photograph: one frame, no gadget

**Now.** The photo sits inside a `<figure>` whose browser margin (1em 40px) was never reset, inside a `#e5e7eb` viewport, inside a 20 px frame with a 48 px shadow, inside a bordered, padded 16 px `.hero-visual` wrapper. On desktop that is a 40 px grey band left and right and 16 px on top, with the pager dot sitting in the margin; on the dark theme the band is a near-white slab, the brightest object on the page; on a phone the photo is ~250 px wide in a 330 px frame. Around it: a conic sheen rotating every 4.6 s with `mix-blend-mode: screen`, a ±3°/±4° mouse tilt, an indigo (`#4f46e5`, not a brand colour) inset glow, a Ken Burns pan of 7.4 s cut at 5.6 s so every slide is interrupted mid-zoom and slides 1, 6 and 7 sit frozen zoomed-in on later loops, a green-to-indigo progress bar, and seven stacked slides that stay clickable while invisible, so clicking the house you see opens `/interiors`. In light theme only the active dot is visible.

**Change to.**
- `HeroShowcase.css` l.26: `.hs-shot{ margin:0; visibility:hidden; transition: opacity .7s ease, visibility 0s linear .7s }` and `.hs-shot.is-active{ visibility:visible; transition-delay:0s }` (one rule fixes hit-testing, tab order and reading order).
- l.19 and l.29: `background:#e5e7eb` → `transparent`; l.22: delete the glow line, keep `inset 0 0 0 1px var(--hs-border)`; delete the `--hs-glow` tokens at l.2 and l.5.
- Delete the sheen (`HeroShowcase.jsx` l.134; css l.46-52 and l.72), the tilt (jsx l.74-97; css l.10 `perspective`, l.16 `.hs-tilt`) and Ken Burns (css l.30-43 and l.71).
- `.hs-frame{ border:1px solid var(--hs-border); background:var(--hs-card); box-shadow:0 12px 32px rgba(15,23,42,.12); border-radius:16px }`, `.hs-viewport{ border-radius:16px }`; progress bar l.60 → `linear-gradient(90deg,var(--brand-teal),var(--brand-blue))` or delete it (jsx l.150).
- `index.css` l.178 `.hero-visual{ border:0; padding:0; background:none; height:auto }`; l.179-181 drop `overflow:hidden`, `border-radius:12px`, `height:100%`; delete `height:380px` at l.260.
- Dots: 24 × 24 px buttons (`padding:0; background:none; border:0`) with an 8 px `::before` disc; inactive `rgba(0,0,0,.5)` light / `rgba(255,255,255,.65)` dark, active `currentColor`; keep role=tab and labels.
- `Hero.jsx` l.68 `durationMs` 5600 → 7000; hold `playing` in a `useRef` read by the interval, set false on dot click and on pointerenter/focusin, and pause the progress bar with `animation-play-state: paused` while stopped.

**Why.** The first and largest picture of a home grows ~20 % on desktop and ~50 % on phones with nothing added; the hero stops being a tilting glass device; a click lands where the visitor is looking; keyboard users pass one link, not seven; the only remaining motion is one slow crossfade.

**Where.** `src/components/HeroShowcase.css` l.2, 5, 9-23, 26-52, 57, 60, 70-72; `src/components/HeroShowcase.jsx` l.74-97, 122-134, 150; `src/index.css` l.178-181, 260; `src/components/Hero.jsx` l.68.

**Effort.** Small (half a day). Pure CSS/JS deletions; prerender, locales and the reduced-motion block are unaffected.

### 2. The cookie bar becomes a quiet card

**Now.** A fixed full-width `#111` strip with white text, a white-outlined "Reject" and a browser-default grey, square "Accept", `zIndex: 10000`, identical in both themes. On a light first paint it is the only black object on the screen: 72 px tall at the foot of the 900 px desktop viewport in EN and BG alike. On phones the captures show it in Bulgarian (from y≈703 of 844, ~141 px tall: the hero photo starts at y≈495, so the house stays visible down to its steps) and in Greek (from y≈681, ~163 px: the photo starts at y≈534, so only sky, roof and the upper facade remain). The English phone first paint carries no banner at all (it is the same frame as the y0 slice), so the BG and EL first paints are the only evidence for the banner on phones.

**Change to.** Move the inline styles to a `.consent` class in `index.css`: `position:fixed; left:16px; right:16px; bottom:16px; max-width:440px; margin-left:auto; padding:16px 18px; border-radius:16px; background:var(--anth); color:var(--text); border:1px solid color-mix(in srgb,var(--text) 12%,transparent); box-shadow:0 12px 32px rgba(15,23,42,.12); font-size:14px; line-height:1.5`. `margin-left:auto` resolves the over-constrained left/right/max-width, so the card sits bottom-right on desktop and spans the width between the gutters on phones. Accept = `className="btn"`, Reject = `className="btn ghost"`, both `height:40px; padding:0 16px`, equal width; policy link `color:var(--muted); text-decoration:underline`. Keep `role="region"`, `aria-label` and `data-nosnippet` (l.110); no entry animation. Stacking: keep `z-index:10000` (the card must sit above the offer modal and the drawer scrim). The chat launcher (`.contact-dock{ right:16px; bottom:76px; z-index:90 }`, `index.css` l.582-586) would share the phone's bottom band with the card, so while the banner is mounted `ConsentBanner.jsx` sets `document.documentElement.dataset.consentOpen = ''` (removed on unmount) and `:root[data-consent-open] .contact-dock{ display:none }`; the launcher appears only after the cookie choice, at `bottom:16px` once change 5 lands. Copy unchanged; the card stays ~140-165 px tall on BG/EL phones unless the text is shortened, which is a copy decision (section 6).

**Why.** The first thing a new visitor sees at the bottom of the screen stops being a black legal strip with unstyled buttons and becomes a small card in the site's own tokens, and nothing else floats in its band.

**Where.** `src/components/ConsentBanner.jsx` l.110-118, 123-149; `src/index.css` (new block beside `.btn` at l.47, plus the `.contact-dock` rule at l.582).

**Effort.** Small (one hour). The banner is client-only and never prerendered.

### 3. Hero copy: the price and the place in the first sentence, facts in the chips, one name for the form

**Now.** Under the 70 px slogan the only explanation is "Prefab and container homes delivered across Europe." in 16 px grey. Three 13 px chips say "Delivered across the EU / Turn-key handover / In-house logistics" (two rows on EN/BG phones, three on Greek). The primary button says "Get an Offer" while the header, the drawer and the phone dock say "Get a Quote" and the modal says "Request an Offer". The first price is at y≈3,100 of 5,333 on desktop; "Bulgaria" first appears in a why-us card; the address never appears.

**Change to.**
- Lead, with `{price}` filled from `startingPrice(locale)` (`src/content/shared/prices.js` l.75-77, the same `row.standard.total` basis the strip prints, i.e. €14,000 house + €840 assembly, so it cannot drift):
  EN "Prefab and container homes from **{price}**, VAT and assembly included. Based in Petrich, Bulgaria — delivered across the EU."
  BG "Сглобяеми и контейнерни домове от **{price}** с ДДС и монтаж. Базирани в Петрич, доставяме в целия ЕС."
  EL "Προκατασκευασμένα σπίτια και σπίτια-κοντέινερ από **{price}** με ΦΠΑ και συναρμολόγηση. Με έδρα το Πέτριτς Βουλγαρίας, παραδίδουμε σε όλη την ΕΕ."
  Do not write "built in Petrich": the repository confirms only a registered address, and `src/content/en/logistics.js` names China, Vietnam and Thailand as origin countries (l.41-51) and Shanghai, Ho Chi Minh and Laem Chabang as the route-map origins (l.112-114). Keep "Πέτριτς" in Greek (`greekCopy.test.js` l.79 rejects Latin place names).
- `Hero.jsx` l.36 style: `fontSize:'clamp(17px, 1rem + .35vw, 20px)', lineHeight:1.5, color:'var(--text)', opacity:.85, maxWidth:'40ch'`, the price inside `<strong>`.
- Chips (`en/home.js` l.70, `bg` l.69, `el` l.69), shortest first: EN `['87 homes delivered', 'Prices include VAT', 'Building homes since 2022']`; BG `['87 доставени дома', 'Цените са с ДДС', 'Строим домове от 2022 г.']`; EL `['87 σπίτια παραδόθηκαν', 'Τιμές με ΦΠΑ', 'Σπίτια από το 2022']`. The year follows the site's own About timeline (`src/content/en/about.js` l.23-25: 2019 founded as an interior-renovation company, 2022 modular and container homes, 2024 prefab houses); "since 2019" next to "87 homes" would claim seven years of homes. Petrich is already in the lead, so the chip does not repeat it. Keep the static 13 px markup. Do not claim assembly here: the Prices page lists assembly separately and "on request" for some products; the inclusion is true only for the strip's totals, which is why it lives in the lead next to that number. Delete `home.stats` (en l.145-150 and the bg/el equivalents) and the orphaned `src/components/Stats.jsx`. The owner confirms 87 and the 2022 start before shipping.
- One label for one form: EN l.67 and l.218 "Get an Offer" → "Get a Quote", modal title l.266 "Request an Offer" → "Request a Quote"; BG l.66 and l.217 "Получи оферта" → "Заяви оферта"; EL l.66 and l.217 "Λάβετε προσφορά" → "Ζητήστε προσφορά". Keep Title Case (it matches "Ask a Question"); no modal subtitle needed. The hero primary stays the gradient "Get a Quote" in every variant of this report: on phones the header button does not exist (`.nav-links` is `display:none` below 768 px, `index.css` l.98/255), so the hero primary, the drawer CTA (`Header.jsx` l.390) and the final card are the quote form's only routes once the dock goes (change 5).
- Second button: `hero.secondaryCta` "Ask a Question" leaves the hero and becomes a new key `hero.pricesCta` rendered as `<a href="#configurator" className="btn ghost">`: EN "See models & prices" / BG "Виж моделите и цените" / EL "Δείτε μοντέλα & τιμές"; `id="configurator"` and `.cfg-strip{ scroll-margin-top:96px }` on the strip so the jump does not land under the sticky header; no smooth scroll. "Ask a Question" stays in the final card (`finalCta.secondaryCta`), and questions also reach the company through the Call/chat pill (change 5). Keeping "Ask a Question" in the hero instead is the owner's call (section 6).

**Why.** A family learns "how much" and "where" within three seconds instead of 2,700 px down; the chips become checkable facts instead of the company describing its operations to itself; one word for one form; the second button answers the next question ("which ones, at what price") instead of opening a second form.

**Where.** `src/content/{en,bg,el}/home.js` l.64-70, 145-150, 203, 216-218, 266 (bg l.262, el l.263); `src/components/Hero.jsx` l.34-50; `src/components/ConfiguratorStrip.jsx` l.64; `src/content/shared/prices.js` l.75-77; `euro()` in `boxConfiguratorCatalog.js` l.54.

**Effort.** Small. All strings are static, so the prerender keeps them; the price is a build-time constant.

### 4. New section order, and the carousel goes

**Now.** `HomePage.jsx` renders Hero → ServiceTiles (1,208 px) → GlideServices (777 px desktop, 795 px = one full phone screen) → ConfiguratorStrip → Steps → WhyUs → Testimonials → final card. The carousel has no heading, repeats the two destinations of the tiles above it with ten cards captioned only "Steel houses" or "Modular houses", auto-advances every 3.8 s, re-arms on every mouseleave/touchend so a dot click never truly pauses it, and its only text is "Swipe or tap any card to open the page". The first 2,567 px of desktop show 21 photographs and zero numbers; the reviews arrive at 82 %; the phone number at 97 %.

**Change to.**
- `HomePage.jsx` l.20-26 → Hero → ConfiguratorStrip → ServiceTiles → Testimonials → Steps → WhyUs → final card. Delete `<GlideServices …/>` (l.22) and its import (l.5); keep the component file (`productPagesGreek.test.jsx` l.36-40 renders it); drop only the `glideServices.subheading` strings.
- `Testimonials.jsx` l.51/91: the section returns `null` while `loading`, which is invisible at 82 % of the page but will shift content on screen 2-3 after the move. Reserve the measured heights: `.testimonials{ min-height:469px }` at ≥ 640 px and `min-height:1019px` below (desktop-light-metrics.json and mobile-light-metrics.json, three cards in a row and three stacked respectively), or render the heading row, the aggregate line and three placeholder `.cs-review-card`s (`min-height:190px` in the row, `min-height:240px` stacked) plus the CTA row while loading, which lands within ±30 px of the loaded state; keep returning `null` once the fetch resolves empty. Re-measure after the `take=9` locale sort in section 4 ships.
- Phone: the strip is 1,533 px of three stacked factory-floor photos, which must not be the first thing scrolled into. Under 640 px make each card a row: `.cfg-strip-card{ grid-template-columns:120px 1fr; align-items:center }`, `.cfg-strip-card img{ aspect-ratio:4/3; height:100% }`, body padding `10px 14px`, so all three sizes and prices share one screen (~600 px instead of 1,533).
- Fold "Plan the layout →" (`ConfiguratorStrip.jsx` l.106-108) into `.cfg-strip-head` beside "All prices →" (l.74) as a second `white-space:nowrap` link; delete `.cfg-strip-planner`.
- If the carousel's two best houses should still be seen, use them as hero slides (section 5) rather than a new section.

**Why.** The first price lands at y≈1,000 desktop / ≈1,200 phone instead of 3,100 / 3,600; reviews on screen 3 (desktop); one autoplaying widget fewer; the page loses 777 / 795 px of duplicate links and one instruction line; the owner's configurator entry point moves one screen closer to the top.

**Where.** `src/pages/HomePage.jsx` l.5, 20-26; `src/components/Testimonials.jsx` l.51, 91; `src/components/ConfiguratorStrip.jsx` l.74, 106-108; `src/index.css` l.1534-1558.

**Effort.** Small. Heading order stays all-h2; prerender is unaffected by a reorder.

### 5. Phone chrome: the dock goes, "Call" arrives

**Now.** From 260 px of scroll a fixed card says "NVC Home4You" (already in the sticky header above it) over "Get a no-obligation quote or ask …" cut by an ellipsis by design (`nowrap` at index.css l.388), with a bare ✖ that has no 44 px box and a fourth copy of the quote button; the dark chat bubble floats 76 px above it. Dock plus bubble reach ~128 px up the screen, the header takes ~98 px, so ~29 % of an 844 px viewport is chrome; the bubble covers review text ("с турските") and the footer ("reserved"); on the last screen two gradient buttons with two labels share one viewport.

**Change to.**
- Delete the mount (`App.jsx` l.505), `MobileDock.jsx`, the `.mobile-dock*`/`.dock-*` rules (`index.css` l.359-389) and the now-dead override in `src/style/BoxHouseConfigurator.css` l.2423-2426; `body{ padding-bottom }` at l.368 → `calc(84px + env(safe-area-inset-bottom))`.
- `ContactDock.jsx`: add `<a className="contact-action contact-action--call" href="tel:+359879355269">` with a phone SVG and the label "Call" / "Обади се" / "Κλήση" as the first item (before l.61); `.contact-dock{ bottom:16px }`; make the launcher (l.86) a 44 px pill with a visible label "Call or chat" / "Обади се или пиши" / "Κλήση ή chat", `padding:0 16px; background:var(--anth); color:var(--text); border:1px solid color-mix(in srgb,var(--text) 14%,transparent)`. Keep `aria-expanded`, the aria-labels (the launcher already has one, "Chat with us", `App.jsx` l.503 / `en/home.js` l.235; it is unlabelled only visually) and the Escape/outside-click handling.
- The drawer gets the same Call beside its quote button (section 4, "Drawer").
- If a persistent quote action is wanted: one 56 px bar with three equal 44 px targets "Call · Chat · Get a Quote", no title, no description, hidden by an IntersectionObserver while the hero button row or `#final-cta` is on screen.

**Why.** The bottom 15 % of every phone screen comes back; the brand name is not shown twice; no truncated promise; the one device that can place a call gets a Call button, which is the natural first move for an older Bulgarian or Greek buyer. The quote form stays reachable from the hero primary on screen one, from the drawer and from the final card; the header button is not an option on phones because `.nav-links` is hidden below 768 px.

**Where.** `src/App.jsx` l.505; `src/components/MobileDock.jsx`; `src/index.css` l.359-389, 582-604; `src/components/ContactDock.jsx` l.6-8, 61, 86; `src/style/BoxHouseConfigurator.css` l.2423-2426.

**Effort.** Small. Removing a sub-44 px target and a spring animation cannot regress the axe baseline.

### 6. Phone hero: the picture first

**Now.** A phone visitor passes a 98 px header, a three-line headline, a two-line lead, two buttons and two (Greek: three) rows of chips before any house appears. The frame starts at y≈510 inside a fixed 220 px box that needs ~248 px for its 16/11 ratio, so the bottom ~28 px is clipped: no dot row, no bottom corners, the chat bubble on its corner; under the Greek cookie bar (top edge y≈681) only sky and roof remain, under the Bulgarian one (y≈703) the house is whole but the frame is cut; the English phone banner was not captured.

**Change to.** One mobile-only block:
```css
@media (max-width:767px){
  .hero{ padding-top:16px }
  .hero-grid > div:last-child{ order:-1 }
  .hero-visual{ height:auto; padding:0; border:0; background:none }
  .hero-visual > div{ height:auto; overflow:visible }
}
```
Leave the desktop rule at l.260 to change 1. The showcase then sizes itself to ~358 × 247 px directly under the header (~68 px after change 9); H1, lead and the primary button follow at roughly y 330-600, above the cookie card's top edge as captured (703 px BG, 681 px EL). H1 stays first in the DOM (prerender and heading order unchanged); the visual swap means tab order reaches the buttons before the dots, which is acceptable for a hero and not flagged by axe.

**Why.** A company selling homes shows a whole home on the first phone screen instead of a sliced one.

**Where.** `src/index.css`, new block after l.181; `src/components/Hero.jsx` unchanged.

**Effort.** Small.

### 7. Service tiles: photographs seen whole, no instructions

**Now.** At rest the four tiles (sunset module, porch, forest A-frame, bathroom) are the warmest thing on the page. The moment a mouse leans in, the photo is wiped to a point by a `clip-path` and a grey panel with icon, paragraph and "Explore →" replaces it, which is why the section carries the line "Hover to reveal details, tap to open the page", served to phones that cannot hover and 70 characters long in Greek. On phones every tile is fixed at 50 % opacity under a dark-plus-indigo gradient; the white body copy measures 1.9-2.5:1 on the Interiors and Modular builds tiles, and axe cannot see it because it is text over an image. `--tile-h: clamp(360px, 56vw, 520px)` makes the section 1,208 px on desktop and 1,672 px on a phone. The first two titles, "Modular builds" and "Modular houses", differ by one word and nothing on the tile tells them apart, while the product the company is known for, the container, is named on no tile.

**Change to.**
- `ServiceTiles.css`: delete l.29-30 (`--mx/--my`), l.37-39 (clip-path), l.59-72 (hover wipe and the `hover:none` 50 % veil), l.80-110 (desktop-only duplicate label). `ServiceTiles.jsx`: delete `onMove` (l.52-59), `onMouseMove` (l.75), the `.svx-bl-label` div (l.87); hide `.svx-icon`.
- `.svx-info{ justify-content:flex-end; opacity:1; transform:none; border:0; padding:72px 20px 18px; gap:6px; color:#fff; background:linear-gradient(180deg, rgba(17,24,39,0) 0, rgba(17,24,39,.9) 56px, rgba(17,24,39,.9) 100%) }`: the text sits inside the solid `.9` ink band, which is why no per-photo check is needed — even over a pure white photo the band is 6.6:1 for white and 5.3:1 for `#e5e7eb`, and the Interiors bathroom is the worst case on the page. `.svx-p{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:15px }` so BG/EL copy cannot climb into the transparent part. Add `.svx-card:focus-visible{ outline:3px solid var(--text); outline-offset:2px }` because the deleted hover rule held the only focus state. Hover: `transform:translateY(-2px)` only.
- Heights: desktop `--tile-h: clamp(300px, 26vw, 380px)` (section ≈ 800 px); phones `aspect-ratio:4/3; height:auto` (≈ 1,250 px).
- Copy: delete the instruction subheadings at `en/home.js` l.88 and l.127 (bg l.87 / l.126, el l.87 / l.126). Heading l.87 "Explore our services" → "What we build" with the subheading "From a 14 m² cabin to a family house — and the bathrooms and kitchens inside." BG "Какво правим" / "От 14 м² бунгало до семейна къща — и баните и кухните вътре." EL "Τι κατασκευάζουμε" / "Από ένα δωμάτιο 14 τ.μ. μέχρι οικογενειακό σπίτι — και τα μπάνια και οι κουζίνες μέσα." (14 m² is the smallest size at `modularBuilds.js` l.15.)
- Tile titles by what they are and by size: l.94 "Container units · 14–30 m²", l.102 "Modular houses · from 37 m²"; BG l.93 "Контейнерни модули · 14–30 м²" / "Модулни къщи · от 37 м²"; EL l.93 "Μονάδες-κοντέινερ · 14–30 m²" / "Προκάτ σπίτια · από 37 m²". Descriptions: l.95 "Ready-made container modules — cabin, guest house, office or shop — delivered and assembled by us."; l.103 "Permanent homes from 37 m²: expandable Box houses and Space capsules, with your layout and finishes." Use the same label in `servicesMenu` (l.24), in `modularBuilds.js` title/heroLead/seo (l.4, l.12) and `routeMeta.js` l.29 so the word on the tile is the word on the landing page; keep the URL slug (slug history 301s). Do not use "Container homes": the Box houses are container-built too and the line also sells offices and shops.

**Why.** The photographs stay visible in every state, device and theme; the contrast failure disappears by construction; the page no longer needs to explain how to use itself; the two look-alike tiles differ on the thing a buyer cares about.

**Where.** `src/components/ServiceTiles.css`, `src/components/ServiceTiles.jsx` l.52-59, 67, 75, 87; `src/content/{en,bg,el}/home.js` l.24, 86-88, 94-95, 102-103, 127; `src/content/{en,bg,el}/modularBuilds.js` l.4, 12; `src/seo/routeMeta.js` l.29.

**Effort.** Small for the CSS and the two subheadings; small-to-medium for the rename if carried through to the landing page, SEO titles and the cases filters (≈15 files) plus a prerender refresh. The SEO keyword change is an owner decision (section 6).

### 8. The contact card and the footer: a number you can tap, a place, hours

**Now.** The one place the page says how to reach a human prints "📞 +359 87 935 5269" and "✉️ contact@nvc-home4you.eu" as plain `<div>`s at 80 % opacity, with a pink handset and lilac envelope from the system emoji font; a tap does nothing, a click does nothing, a screen reader says "telephone receiver". No place, no hours. The footer is one line, "© 2026 NVC Home4You — All rights reserved · Privacy & Cookies · Cookie settings"; the address (Marikostinovo, 2850 Petrich), the Mon-Fri 07:00-19:00 hours and the Facebook page exist only in the JSON-LD; `privacy.js` l.23 still says the EIK is "to be completed".

**Change to.**
- `HomePage.jsx` l.37-40 → two links: `<a href={`tel:${content.localBusiness.telephone}`} className="contact-pill">` showing `content.finalCta.phone`, and `<a href={`mailto:${content.localBusiness.email}`} className="contact-pill">`, each with an 18 px `aria-hidden` stroke SVG instead of emoji; `.contact-pill{ display:inline-flex; align-items:center; gap:8px; min-height:44px; padding:0 16px; border-radius:999px; border:1px solid color-mix(in srgb,var(--text) 14%,transparent); color:var(--text); font-weight:600 }`; remove the `opacity:.8` wrapper.
- Beneath, one muted line from new `localBusiness.hours` and `localBusiness.address` strings in all three bundles: EN "Mon–Fri 07:00–19:00 · Marikostinovo, Petrich, Bulgaria"; BG "пон–пет 07:00–19:00 · Марикостиново, Петрич"; EL "Δευ–Παρ 07:00–19:00 · Μαρικοστίνοβο, Πέτριτς". Pass the same object into `LocalBusinessJSONLD` so page and schema share one source. The hours exist today only as a developer default in `StructuredData.jsx` l.31-37; the owner confirms them before they are printed.
- Title l.216 "Ready to start your project?" → "Shall we talk about your home?" (BG "Да поговорим за вашия дом?"; EL "Να μιλήσουμε για το σπίτι σας;"). Give the section `id="final-cta"`.
- Footer, kept slim because the phone and email now sit 150 px above it: row 1 "NVC Home4You · Marikostinovo, 2850 Petrich, Bulgaria" as a Google Maps link, "· Mon–Fri 07:00–19:00", "· Facebook" (the `sameAs` URL), and "EIK …" once supplied (fill `privacy.js` l.23 in the same change); row 2 the existing © line plus "Privacy & Cookies" and "Cookie settings" in one link style, and the theme select from change 9. No phone, email, WhatsApp or sitemap repeated here. Do not delete `footer{…}` at `index.css` l.252: it is live, supplies the footer's padding and styles the `<footer>` on the configurator and privacy pages; rename it to `.site-footer` if touched.

**Why.** "I know where they are and how to talk to them" is answered where visitors look for it, and on the device most families use the number works. The page stops ending on a cookie control.

**Where.** `src/pages/HomePage.jsx` l.28-42; `src/content/{en,bg,el}/home.js` l.216-226; `src/components/StructuredData.jsx` l.12-19, 31-37; `src/components/SiteFooter.jsx` l.8-12, 49-67; `src/content/{en,bg,el}/privacy.js` l.23.

**Effort.** Small. Links inherit `var(--text)` and the existing focus ring; nothing moves.

### 9. Header: lose the select card, one language control, Greek on one line

**Now.** Two utility selects sit inside `<div className="card p-4">`, so three nested borders with no chevrons read as two buttons; "System" is a developer setting that means nothing to a family. On a 390 px phone the box is ~130 × 74 px, taller than the logo, parked in the prime centre spot, and the bar is 98 px tall and sticky across all ten screens. In Greek at 1,440 px the brand wraps "NVC / Home4You", "Τα Προϊόντα & οι Υπηρεσίες μας" takes two lines, the ▾ carets under "Σχετικά" and "Σχεδιασμός" drop to their own line, and "Ζητήστε προσφορά" is a two-line pill, so the first Greek screen looks broken before a word is read.

**Change to.**
- `Header.jsx` l.296: remove the `card p-4` wrapper and its inline style so the controls sit directly in `.header-actions`.
- Keep only `#langSelect` in the bar, wrapped in `<span className="select-wrap">`: `.header-select{ appearance:none; border:0; background:transparent; font-size:14px; height:36px; padding:0 28px 0 10px }` (44 px under 640 px); the chevron is the wrapper's pseudo-element, so it follows `currentColor` in both themes (a `mask-image` on the `<select>` itself would mask its text): `.select-wrap{ position:relative; display:inline-flex }` and `.select-wrap::after{ content:""; position:absolute; right:10px; top:50%; width:12px; height:12px; translate:0 -50%; pointer-events:none; background:currentColor; mask:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M6 9l6 6 6-6' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/contain no-repeat }`; keep `:focus-visible`. Options as native names in all three content files l.55-57: "English" / "Български" / "Ελληνικά". Fit at 390 px with the gutters restored (350 px of content): logo 36 + 12 + wordmark ~126 + select ~98 ("Ελληνικά" at 14 px plus 38 px padding) + hamburger 44 + two 8 px gaps = ~332 px, ~18 px spare; under 360 px add `.header-select{ font-size:13px; padding:0 24px 0 8px }` (~12 px back).
- Move the theme select once, into `SiteFooter.jsx` beside "Cookie settings", keeping `id="themeSelect"`, label, aria-label and the three options (lift `theme`/`setTheme` from `useTheme`); do not also put it in the drawer, or a phone with the drawer open carries two identical ids. Relabel "System" → "Match device" / "Като устройството" / "Όπως η συσκευή" in `header.theme.system` of `src/content/{en,bg,el}/home.js` (en l.50, bg l.49, el l.49): the header reads `ui.header` from `getHomeContent()` (`App.jsx` l.134, l.361), and `src/i18n/translations.js` holds only dead copies of these strings (its `dictionaries` are read by `I18nContext` for `lang`/`setLang`; no component calls `t()` for the theme labels), so editing them there changes nothing.
- Greek: `Header.jsx` l.167/212/257 render `{label}{' '}▾` (or a 14 px inline chevron SVG with `display:inline-flex; gap:4px`); `.brand{ white-space:nowrap }` (`index.css` l.95); `white-space:nowrap` on the quote `.btn`; nowrap on `nav .link-btn` only inside `@media (min-width:1100px)` so the 768-1,024 px range cannot overflow the sticky bar; `el/home.js` l.5 servicesSummary → "Σπίτια & υπηρεσίες", l.14 quote → "Προσφορά"; EN "Our Products & Services" → "Homes & services" is optional (EN already fits). Keep "Planning ▾" (it is the header's route to the configurator); moving "Partner" into the About dropdown is an owner call.
- Expected bar: ≈64 px desktop, ≈68 px phone. Re-run axe on both viewports.

**Why.** The loudest object in the bar is currently a developer control; phones get ~30 px back on every sticky screen; Greek visitors stop meeting a broken header.

**Where.** `src/components/Header.jsx` l.151, 167, 212, 257, 296-321; `src/index.css` l.94-95, 99, 416-425, 482-483, 524-536; `src/content/{en,bg,el}/home.js` l.5, 14, 49-50, 55-57; `src/components/SiteFooter.jsx`.

**Effort.** Small.

### 10. Mid-page calm: steps as a list, three honest reasons

**Now.** "How we do it" opens with "Progress: 17 %" and a one-sixth-filled gradient bar although the visitor has done nothing; the active number bobs 5 px every 1.8 s; the six tiles are `<button>`s with no `font: inherit`, so their text renders in the browser's 13.33 px default, visibly smaller and in a different face than the paragraph below; a second card repeats "STEP 1 OF 6 / 1. Discovery"; on phones tapping step 4 changes a card 300-700 px further down; only step 1's long text is in the prerendered HTML. The section is 613 px on desktop and 1,161 px on a phone. "Why choose us" shows four cards in a three-column grid with "Best value in Bulgaria" alone on a second row, two screens under "delivered across Europe"; "24/7 Support" contradicts the published Mon-Fri 07:00-19:00 and its own body (which is about meeting in person with documentation); "Radical Transparency" is start-up vocabulary; "Clear Planning" repeats step 3; the subheading "Outstanding homes, exceptional service." is self-praise.

**Change to.**
- `Steps.jsx`: delete the progress row and bar (l.27-31) and the detail card (l.43-53); render the six items as a plain `<ol>` of non-interactive `<li>` in the existing 3 × 2 grid, title plus the `long` sentence (the warmer one); `.step{ font:inherit; line-height:1.45; border:1px solid var(--line) }`, `.step strong{ font-size:17px }`; remove `animation:float` (`index.css` l.196-198) and `layout` (l.35). Heading l.163 → "From first call to handover in 6 steps" (BG "От първия разговор до предаването в 6 стъпки"; EL "Από το πρώτο τηλεφώνημα έως την παράδοση σε 6 βήματα"). Result ≈ 380 px desktop / ≈ 750 px phone, all six steps prerendered, six fewer buttons, two fewer live regions.
- `WhyUs.jsx` l.24 `grid cols-2 md-cols-3` → `grid md-cols-3` (single column on phones, no orphan at any width); drop the subheading div at l.22 and set the string to `''` in the three bundles. Three items using only claims the site already publishes:
  1. "No hidden costs" / "Every price is listed with its specs and finishes itemised."
  2. "A real person answers" / "Call, write or visit us near Petrich — we reply within 24 hours."
  3. "Delivered across the EU" / "In-house logistics and turn-key handover, anywhere in the EU."
  BG "Без скрити разходи" / "Отговаря истински човек" / "Доставка в целия ЕС"; EL "Χωρίς κρυφά κόστη" / "Σας απαντά πραγματικός άνθρωπος" / "Παράδοση σε όλη την ΕΕ". Heading l.153 → "Why families in Bulgaria and the EU choose us" (BG "Защо семейства в България и ЕС избират нас"; EL "Γιατί μας επιλέγουν οικογένειες στη Βουλγαρία και την ΕΕ"). Do not write "VAT and assembly included", "WhatsApp any time" or "assembled by our own team" here; none of these is published anywhere on the site today. Add the hours only once confirmed.

**Why.** A fake meter and a bobbing number are gamified pressure; mismatched fonts and a duplicate card read as unfinished; the trust section stops contradicting the hero and the schema.

**Where.** `src/components/Steps.jsx` l.14-17, 27-31, 35, 43-53; `src/index.css` l.190-198; `src/components/WhyUs.jsx` l.22-24; `src/content/{en,bg,el}/home.js` l.153-159, 163, 168-195.

**Effort.** Small (two components, mostly deletions).

## 4. Section by section

**Proposed order:** Header → Hero → *(phase 2: contact band)* → Configurator strip → Service tiles → Testimonials → Steps → Why us → Contact card → Footer. Chrome: cookie card, chat pill with Call, the drawer. Cut: Glide carousel, MobileDock. Future, content-permitting: a "Homes we have handed over" strip between the tiles and the reviews.

**Header — keep, quieten.** Change 9, plus the gutter quick win (section 5: the logo touches the phone's left edge today). Additionally, on desktop ≥ 1,280 px add a `tel:` link with a 16 px handset and the number in `.header-actions` before the language control (14 px/600, `var(--text)`), icon-only with `aria-label` from a new `nav.call` string below 1,280 px — EN "Call us" / BG "Обадете ни се" / EL "Καλέστε μας"; never inside `.nav-links`, which has ~40 px of slack in Bulgarian at 1,440 px. Drop the gradient square behind the house glyph (`index.css` l.284-287 → `background:none; box-shadow:none`, glyph in `var(--brand-blue)`) so the bar has one gradient object (the button) instead of two, until the real logo mark arrives as an SVG.

**Drawer — keep, reorder, add Call.** Not in the capture set; read from the live DOM on 2026-10-10 (a visual capture failed: the hidden pane paused its entry animation). Behind the hamburger it lists, in 48 px rows at 16 px/600 (`index.css` l.130-136): Gallery, Prices, About Us, Cases, FAQ, Partner, Planner, Configurator, then a collapsed "Our Products & Services" group holding Modular builds, Modular houses, Steel houses, Door-to-door delivery, Logistics and Interiors, then a full-width gradient "Get a Quote" (`Header.jsx` l.60-67 build the list, l.345-390 render it). So on a phone the homes — the reason anyone is here — sit one tap deeper than FAQ and Partner, there is no phone number, and after change 5 this CTA is one of only three quote routes. Change: `mobileItems` → the three home links and Interiors flat at the top (with the renamed labels from change 7), then Prices, Gallery, Cases, About Us, FAQ, Partner, Planner, Configurator; the `<details>` keeps only Door-to-door delivery and Logistics under `servicesMenu.columns[1].title`. Replace the single button at l.390 with `<div className="drawer-cta-row">` holding `<a className="btn ghost" href="tel:+359879355269">` labelled with the number (`aria-label` = `nav.call`) and the existing `btn` "Get a Quote"; `.drawer-cta-row{ position:sticky; bottom:0; display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:10px 0 4px; background:var(--anth) }` so both stay visible while the twelve rows scroll inside the drawer's existing `max-height` (l.122). The theme select does not go here (change 9).

**Cookie bar — keep (legal), restyle.** Change 2.

**Hero — keep, rebuild.** Changes 1, 3 and 6, plus the quick wins for the slide deck, the H1 class and the gradient ink. The button pair is [Get a Quote] [See models & prices] in every phase. Phase 2 adds the greeting line above the lead, whose "Call" and "write" are `tel:` and `mailto:` links. The slogan is untouched in words; only its size, wrapping, weight and the colour of the emphasised word change.

**Contact band — new, phase 2.** A 72 px strip on `--surface-2` directly under the hero, replacing the ~110 px of empty gradient the hero leaves above the fold on desktop: the Bulgaria outline with the pin, "Visit us: Marikostinovo, 2850 Petrich · Open in Maps →", "Call or WhatsApp: +359 87 935 5269 · {hours}", "Write: contact@nvc-home4you.eu — we answer within 24 h". All static text, so it prerenders. Phone: a three-row list card under the hero photo. Ship only once the hours and the visitability of the yard are confirmed.

**Configurator strip — keep, move to second, warm.** Change 4. Kicker "CONFIGURATOR" → "Prices" / "Цени" / "Τιμές" with `.cfg-strip-kicker{ font-size:14px; text-transform:none; letter-spacing:0 }` (`index.css` l.1536); under each price a 13 px muted line "incl. VAT and assembly" / "с ДДС и монтаж" / "με ΦΠΑ και συναρμολόγηση" (true for these three totals, `ConfiguratorStrip.jsx` l.97); card action "Configure →" → "Start with this one →" / "Започни с този →" / "Ξεκινήστε με αυτό →"; title → "{count} models from {price} — build yours online" with `count = rows.length` and `price = euro(Math.min(...rows.map(r => r.standard.total)), locale)` so the heading equals the lowest card beneath it. Price as the largest text on the card (22-28 px/600 `tabular-nums`). The three photos are warehouse interiors; see section 6 for the shoot. Stop-gap: `object-position:50% 60%` on `.cfg-strip-card img` (l.1552) at most; the sources are 1,024 × 1,024 and the 73 m² roofline sits at ~27 % of the frame, so stronger values clip it.

**Service tiles — keep, simplify.** Change 7. The sunset shot on tile 1 shows sky and treetops in the ~140 px visible above the desktop fold; view the file before choosing an `object-position`, or replace it with a facade-forward crop (section 6).

**Glide carousel — cut.** Change 4. Its two best houses (bvk4n834b-rdd A-frame, bvk4n834b-rb9) can replace slides 3 and 4 of the re-cut hero deck if wanted; do not grow the deck past five.

**Testimonials — keep, move to fourth, present as neighbours.** Keep the API source and hide-when-empty. Aggregate inline under the heading as a sentence, "4.8 ★ from 12 verified reviews", instead of a boxed widget (`Testimonials.jsx` l.104-110). Cards on `--surface` with a 1 px `--line` border instead of the 4.5 % grey wash (`CasesPage.css` l.364-370), quote first at 18 px/1.5, then name, then "{product} · {town}" with a small pin. Set `lang` on the quote and the name from the script (`/\p{Script=Cyrillic}/u` → bg, `/\p{Script=Greek}/u` → el), request `take=9` and stable-sort so reviews in the page's locale come first (the EN page opens with two Cyrillic quotes today), and when a quote is in another language add a muted "Review in Bulgarian" / "Отзив на английски" / "Κριτική στα βουλγαρικά". Subheading "homeowners across Europe" → "In their own words, in the language they wrote them." / "С техните думи, на езика, на който са ги написали." / "Με τα δικά τους λόγια, στη γλώσσα που τα έγραψαν." Reserve height while loading (change 4). The honest 4-star "a bit slow" review is the most credible line on the page; keep it.

**Steps — keep, flatten.** Change 10. The timeline CSS at `index.css` l.208-218 already exists if a vertical list is preferred on phones. The copy itself ("use case", "logistics stack", "your asset") is consultancy language and never says how long anything takes; a first-person rewrite with durations is in appendix C and needs the owner's lead times.

**Why us — keep three reasons, or merge.** Change 10. Optional merge, owner's call: `Steps.jsx` renders `<div className="container steps-layout">` with the `<ol className="steps-grid">` and an `<aside className="steps-aside">` carrying an h3 "What you can count on" / "На какво можете да разчитате" / "Σε τι μπορείτε να βασίζεστε" and the three reasons as a plain list; `index.css`: `@media (min-width:1024px){ .steps-layout{ display:grid; grid-template-columns:minmax(0,2fr) minmax(280px,1fr); gap:24px; align-items:start } .steps-layout .steps-grid{ grid-template-columns:repeat(2,1fr) } }`; below 1,024 px the aside stacks under the list. `WhyUs.jsx` then leaves `HomePage.jsx`; one h2 and ~250 px of desktop height go with it.

**Contact card — keep, humanise.** Change 8. Phase 2: a two-column card at ≥ 768 px with a 3:2 photograph of the team or the yard on the left (`object-fit:cover`, inside the radius), text and links on the right, stacked on phones with the photo on top. Until that photo exists the card stays text-only; do not use stock.

**Footer — keep, two rows.** Change 8, plus the theme select from change 9.

**Phone dock — cut.** Change 5.

**Chat bubble — keep, give it a visible name and a Call.** Change 5. Dark disc `#1f2937` → `--surface` pill with a label; `bottom:16px` once the dock is gone; hidden while the cookie card is up (change 2).

## 5. Quick wins for this week

- Restore the header gutter: `.nav-inner{ padding:12px 20px }` (`src/index.css` l.94). `.nav-inner` sits on the same element as `.container` (`Header.jsx` l.143 `className="container nav-inner"`), and its `padding:12px 0` overrides the container's `0 20px` (l.24): every phone capture shows the logo square starting at x = 0 (mobile-light-01-y0.png), and on desktop the header content starts at x = 120 while the hero and every section start at x = 140. One value fixes both.
- Ink the gradient: add `--brand-teal-ink:#1f7b93; --brand-blue-ink:#146af2` (`src/index.css` l.1-10); `.btn{ background-image:linear-gradient(90deg,var(--brand-teal-ink),var(--brand-blue-ink)) }` (white 4.9/4.8:1, both themes); `:root[data-theme='light'] .grad-text{ background-image: same }` (4.6/4.5:1, fixes "shouldn't"/"не трябва", the "NVC" wordmark, the active step title and the mega-menu titles at once); `--brand-ink: var(--brand-blue)` in `:root` and `var(--brand-blue-ink)` under light; `.feature-icon, .bubble{ background:color-mix(in srgb,var(--brand-blue) 12%,var(--anth)); color:var(--brand-ink) }`. Never swap the spans to solid `var(--brand-blue)` (3.1:1 in light). `src/index.css` l.36-39, 47-55, 191, 196, 326-329.
- Light first for new visitors: `ThemeContext.jsx` l.6 `|| 'system'` → `|| 'light'` (a stored choice still wins), plus a 3-line inline script in `index.html` `<head>` that reads `localStorage.theme` (resolving 'system' via `matchMedia`) and sets `data-theme` and `style.colorScheme` before first paint, which also removes the dark-then-light flash light-preference visitors get today: the live prerendered HTML for all three locales carries `data-theme="dark"` (checked 2026-10-11). Do not flip the `:root` tokens: the light theme is 95 override rules across 15 files. `src/context/ThemeContext.jsx` l.6; `index.html`.
- Re-cut the hero deck to five truthful daylight slides in `src/content/{en,bg,el}/home.js` l.75-81: (1) bukcsfwf9-rdg "Modular builds" → modularBuilds; (2) bukcsfwf9-rdf "Modular houses" → modularHouses; (3) bvk4n834b-rbu "Modular builds" → modularBuilds; (4) bvk4n834b-r7 A-frame "Steel houses" → steelHouses; (5) bvk4n834b-rcz kitchen (2,048 × 1,360, fills 16:10) "Interiors" → interiors. Remove bukcsfwf9-rde (night crane hall), bukcsfwf9-rdc (bare wall panel) and bvk4n834b-rbx (pixel-identical to carousel card rcf). Do not use the portrait bathroom rc4 in a 16:10 frame.
- H1 to a class, at the section 2 scale: `.hero h1{ font-size:clamp(34px, 1.6rem + 2.8vw, 60px); line-height:1.08; font-weight:600; letter-spacing:-0.015em; text-wrap:balance; margin:0 }` and `.hero h1 .grad-text{ white-space:nowrap }`; no `max-width` in `ch` (it breaks "Because a home" into four lines). Gives "Because a home / shouldn't be / an expense", "Защото домът / не трябва / да е лукс", and keeps "δεν πρέπει" whole on Greek phones at 36.5 px. `src/components/Hero.jsx` l.20 → `src/index.css`.
- Hero second button → prices (change 3): `<a href="#configurator" className="btn ghost">` with the new `hero.pricesCta` string in the three locales, the gradient "Get a Quote" stays primary, `id="configurator"` and `.cfg-strip{ scroll-margin-top:96px }` on the strip. `src/components/Hero.jsx` l.44-51; `src/components/ConfiguratorStrip.jsx` l.64.
- Strip title with live numbers: "{count} models from {price} — build yours online" / "{count} модела от {price} — сглобете своя онлайн" / "{count} μοντέλα από {price} — φτιάξτε το δικό σας online", count and price from the rendered rows, not `startingPrice()`. `src/components/ConfiguratorStrip.jsx` STRIP_COPY, l.34, 69.
- Strip card copy: kicker "Prices", action "Start with this one →", 13 px "incl. VAT and assembly" under each price (strings in the three locales above). `src/components/ConfiguratorStrip.jsx` l.96-99; `src/index.css` l.1536.
- One CTA label everywhere (strings in change 3). `src/content/{en,bg,el}/home.js` l.66-67, 217-218, 262-266.
- Delete both instruction subheadings and the empty `.gl-head` block even if the carousel briefly stays. `src/content/{en,bg,el}/home.js` l.88/127 (bg/el l.87/126); `src/components/ServiceTiles.jsx` l.67; `src/components/GlideServices.jsx` l.111-115.
- Final-card phone and email as `tel:`/`mailto:` links with SVG icons (change 8, first half) even before the hours line is confirmed. `src/pages/HomePage.jsx` l.37-40.
- Carousel dots visible and tappable: 24 × 24 px hit areas, inactive `rgba(0,0,0,.5)` light / `rgba(255,255,255,.65)` dark. `src/components/HeroShowcase.css` l.57.
- Remove `home.stats` from the three bundles (en l.145-150) and `src/components/Stats.jsx` (imported nowhere; its label "On-time delivery rate (days): 5" is self-contradictory), so "87" lives in one place.
- Greek header one-liners: non-breaking space before each ▾, `.brand{ white-space:nowrap }`, el `servicesSummary` "Σπίτια & υπηρεσίες", el `quote` "Προσφορά". `src/components/Header.jsx` l.167, 212, 257; `src/index.css` l.95; `src/content/el/home.js` l.5, 14.
- Configurator image stop-gap: `object-position:50% 60%` on `.cfg-strip-card img`. `src/index.css` l.1552.

## 6. What only the owner can supply

**Photography (shot list; every item is a content ask, not code).** Daylight, natural colour, no staging, no stock people; if a shot cannot be obtained, leave the slot as it is.
1. **Hero:** one delivered NVC home in Bulgaria, three-quarter view from the door side, standing height, late-afternoon light, people in frame (a family on the step or the crew handing over keys), landscape 16:10, ≥ 2,400 × 1,500. Replaces the grey porthole unit beside the railway and the towers.
2. **The three models (37 / 58 / 73 m²):** each installed on a plot, same time of day and weather, three-quarter from the door side, lens ~1.5 m, sky above and grass or gravel below, a chair or a person on the step, 16:10 at 1,600 × 1,000; replace `public/box-config/models/model-37|58|73-standard.webp` under the same names so no code changes. The balcony variants on disk are also indoor shots, so nothing in the repo can substitute.
3. **A handover:** owners and the NVC crew in front of a just-delivered unit; ask the Карлово, Rila and Пазарджик reviewers; written GDPR consent; first names only in captions.
4. **The team:** three to six people beside a finished module at the yard in Marikostinovo.
5. **An inhabited interior:** someone at the kitchen counter of a delivered 58 m², landscape, for the Interiors tile.
6. **The person who answers the phone:** head and shoulders, daylight, for the greeting line (optional; the line ships as text without it).
7. **Re-crops:** a left-anchored crop of the current first slide (keep the left ~72 % of the width) to lose the fence, tracks and tower blocks; a facade-forward crop or replacement of the sunset tile; a landscape crop of the bathroom bvk4n834b-rc4 if a bathroom rather than the kitchen is wanted in the hero.
8. **Delivered homes with facts:** three or four photos with model, town and year, for a "Homes we have handed over" strip; skip the section if fewer than three can be vouched for.
9. **The logo mark** as SVG or transparent PNG (the house glyph alone, from `public/logo3.jpg`'s designer) to replace the generic gradient-square icon.

**Facts to confirm before they are printed.**
- Which phone number is real: `+359 87 935 5269` (page, `StructuredData.jsx` l.10, `ContactDock.jsx` l.6, all three bundles) or `+359 89 245 6245` (`index.html` l.50 Organization JSON-LD).
- Opening hours: the JSON-LD default says Mon-Fri 07:00-19:00 and was written by a developer; one of the directions assumed 9-18.
- The address, Marikostinovo, 2850 Petrich: is it a yard or showroom visitors may come to, and when?
- The distance to the border for the place stamp: Marikostinovo to the Kulata–Promachonas crossing is roughly 10 km by the E79; the owner gives the figure from the yard gate, in km, and the stamp prints that.
- Where the houses are manufactured. The logistics copy lists China, Vietnam and Thailand (ports Shanghai, Ho Chi Minh, Laem Chabang) as origins; until confirmed in writing the page says "based in Petrich", never "built in".
- "87 homes delivered": the current number, and that it counts from 2022, when the About timeline says modular and container homes began (the company itself dates from 2019; prefab houses from 2024). The chip says "Building homes since 2022"; change the year only if the timeline is wrong.
- EIK / company registration number, for `privacy.js` l.23 and the footer.
- VAT and assembly: the strip's three totals include both (e.g. €14,000 + €840 gross assembly); the Prices page lists assembly separately and "on request" for some products. Confirm the exact statement allowed for each surface.
- Lead times for the steps captions: the JSON-LD says 14-60 days production and 1-7 days transit.
- Team names, roles and languages spoken (BG · EN · EL), and who answers the phone.

**Copy and product decisions.**
- Move the slogan's emphasis from "shouldn't" / "не трябва" / "δεν πρέπει" to "home" / "домът" / "σπίτι" (text unchanged, only the `<g>` tag moves; the negation stops being the brightest word).
- Hero second button: "See models & prices" (recommended) or keep "Ask a Question" beside "Get a Quote".
- Rename "Modular builds" → "Container units · 14-30 m²" including the landing page title and SEO description (a keyword change).
- Keep "Partner" in the top bar or move it into the About dropdown.
- A persistent quote action on phones: none (recommended; hero primary, drawer and final card remain) or the slim three-target bar.
- Light as the default theme for first-time visitors; whether to migrate returning visitors who have "system" stored.
- Theme control label: "System" → "Match device".
- Web font: Commissioner (one family, three scripts) yes/no; Source Serif 4 for headings as an option after the Bulgarian `locl` check.
- Testimonials heading: keep "What our customers say" or "Neighbours who have already moved in" / "Съседи, които вече се нанесоха" / "Γείτονες που ήδη μετακόμισαν".
- Cookie text length on BG/EL phones (the only way to reclaim hero space under the card).
- Steps and Why-us: two sections, or the merged layout in section 4.

## 7. Appendix — set aside

### A. Weakened findings: what the verifiers struck, and what the sections above use instead

| Finding | Struck | Used instead |
|---|---|---|
| Final CTA tel/mailto | "Source hours from the JSON-LD object" (it holds only url/email/telephone); dock-hiding via `#final-cta` bundled in | Add `hours`/`address` strings to the three bundles and feed them to the JSON-LD; dock handled separately (change 5) |
| Header select card | Theme select in drawer *and* footer (duplicate ids); single-colour data-URI chevron (vanishes in one theme); 64 px phone estimate; label edited in `translations.js` (dead strings) | Footer only; wrapper `::after` with `mask` + `currentColor`; ≈68 px phone; `header.theme.system` in the three `home.js` files |
| Hero lead | "Built in Petrich" (unsupported; logistics copy names Asian origins); `max-width:34ch` (Greek wraps to 5 lines) | "Based in Petrich"; `40ch` |
| Theme default | Flipping `:root` tokens (95 rules, contrast risk). The verifier also called the "dark until hydration" claim false, but a direct check on 2026-10-11 shows the live prerendered HTML for /en, /bg and /el all carry `data-theme="dark"`, so light-preference visitors DO get a dark first paint until the app boots | Fallback `'light'` + inline bootstrap in `index.html`; CSS untouched |
| Section order | Dropped GlideServices silently; claimed Testimonials' hide-when-empty was unaffected (it unmounts while loading, now on screen 2-3); "screen 2-3" on phones (really ~5) | Order stated explicitly; reserved height from the measured 469 / 1,019 px; strip cards as rows on phones |
| Hero slide deck | Slide 5 = portrait bathroom rc4 (cover-cropped to a sink strip at 16:10); "CSS assumes five slides" (extra slides fall back harmlessly) | Landscape kitchen rcz; CSS note dropped |
| Phone hero photo-first | Deleted the desktop `height:380px` inside a mobile fix; "350 × 219" used the desktop ratio; a 681 px "cookie line" quoted for EN, which was never captured on a phone | Scoped to `max-width:767px`; ~358 × 247 at 16/11; BG 703 / EL 681 as measured, EN phone banner stated as uncaptured |
| Why-us cards | "VAT and assembly included", "WhatsApp and Viber any time", "our own team" (none published on the site); three items leave an orphan on phones (`cols-2`) | Only published claims; `grid md-cols-3` |
| Service tiles | `--tile-h: clamp(220px,…)` (caption covers half the photo on phones with BG/EL copy); gradient reaching 5.6:1 only at the very bottom; "verify on the Interiors photo" with no action on failure | 4/3 on phones, 300-380 px desktop; text inside a solid `.9` ink band (≥ 5.3:1 on any photo), two-line clamp, explicit focus ring |
| Instruction subheadings | `object-position:50% 65%` on tile 1 chosen without viewing the image (near-square tile crops horizontally) | Look at the file or re-crop; copy change stands |
| Hero chips | "Prices include VAT and assembly" (false site-wide); "keep at 14px" (they are 13 px); Greek still stacks three rows; "Since 2019" beside "87 homes" (homes date from 2022 in the About timeline) | "Prices include VAT"; 13 px kept; three short rows accepted in Greek; "Building homes since 2022" |
| Gradient contrast | Solid `var(--brand-blue)` for "NVC", step title and bubble digits (3.1-3.3:1, still failing) | `--brand-ink` token (ink in light); the light `.grad-text` override already fixes the spans |
| Carousel visibility/pause | "Reduced-motion block zeroes the transition" (it does not); `playing=false` on a closure variable; 36 px pause button adds chrome; `rgba(0,0,0,.4)` dot ≈2.9:1 | `useRef`; pause on hover/focus/dot click without a button; `.5` |
| Hero sheen/tilt/glow | "Nothing moves but the crossfade" (Ken Burns stays unless removed too); `.hs-frame{ border:0; background:none }` with a drop shadow around nothing; progress bar left green→indigo | Ken Burns removed in the same change; frame keeps a surface; bar recoloured |
| Ken Burns | Omitted the sheen; optional drift variant could re-introduce the frozen-slide bug | Sheen deleted with it; single keyframe rule if a drift is ever wanted |
| Headings scan | Products H2 repeated the hero lead and mislabelled the tiles; "Three models from {price}" hard-coded the count and used a different price basis than the cards | "What we build"; `{count}` and `min(row.standard.total)` |
| Modular builds rename | "Container homes" (the Box houses are container-built too; the line sells offices and shops); rename not carried to the landing page | "Container units · 14-30 m²", carried through title/SEO/routeMeta |
| Hero button → prices | Replacing the *primary* with a prices link (left phones with no quote action above the final card once the dock goes, since `.nav-links` is hidden below 768 px); `className="btn"` is itself the gradient; no `scroll-margin-top` under a sticky header | The *second* button becomes `btn ghost` "See models & prices"; the gradient "Get a Quote" stays primary; `scroll-margin-top:96px` |
| Footer | "Finds nothing" (phone and email sit 150 px above); "dock covers the © line" (body reserves 132 px); delete `footer{}` at l.252 (live, styles two other pages) | Two slim rows with address/hours/Facebook/EIK; rule kept or renamed |
| Phone in header | Text link inside `.nav-links` (overflows in BG/EL below ~1,280 px); icon button without an accessible name; phone half depends on the header-card change | Icon button in `.header-actions` with `aria-label` (`nav.call`, three locales), number text ≥ 1,280 px; Call in the pill and the drawer; `tel:` on the final card first |
| Configurator photos | `object-position:50% 75%` (clips the 73 m² roof); "3:2 frame" vs 1,600 × 1,000 deliverable | `50% 60%` at most; 16:10 deliverable; the shoot is the fix |
| People in photos | "Beside the final CTA is a URL swap" (the card has no image slot); handover photo as hero slide 1 under sheen/tilt; no consent note | Two-column card variant; faces only after the hero is calmed; written consent, no stock |
| H1 typesetting | `max-width:13ch` ("Because a home" is ~14 ch, would force four lines); "~40 px back" (really ~20); two competing scales in one report | No `ch` cap; balance + nowrap; one scale, `clamp(34px, 1.6rem + 2.8vw, 60px)` / 600 / `-0.015em` |
| CTA labels | Sentence case ("Get a quote" next to Title Case "Ask a Question"); modal subtitle (new slot, duplicated copy) | Title Case "Get a Quote"; no subtitle |
| Greek header | Dropped "Planning ▾" silently; `nowrap` on all `nav .link-btn` from 768 px (overflow on tablets); the 60 px hero shift misattributed to the header (it is the chip row) | Planning kept; nowrap ≥ 1,100 px; chips handled in change 3 |
| Cookie card | "Check its z-index against the bubble" with no value; left/right/max-width over-constrained (lands bottom-left by accident); "hides everything but the roof on BG and EL phones" (true only of EL) | Card stays 10000, launcher hidden while the card is mounted; `margin-left:auto`; BG and EL measured separately |

### B. Refuted

None. All 27 contested findings survived in a corrected form; no finding was thrown out.

### C. Unverified (never reached a verifier because of the cap; treat as proposals to check, not confirmed defects)

*Hero*
- Progress bar animates `width` every frame in emerald→indigo: delete it (`HeroShowcase.jsx` l.150; `HeroShowcase.css` l.59-61, 73) or animate `transform: scaleX` in brand colours.
- First slide's right third is a fence, tracks and tower blocks: left-anchored re-crop (section 6).
- Trust chips wrap to 2-3 bordered rows on phones: under 768 px render them as one quiet text line, `.hero-trust-chip{ padding:0; border:0; background:none; font-size:14px; color:var(--muted) }` (`index.css` l.372-377).

*Configurator strip*
- Three ~320 px cards stack on phones so the three prices are never in view together: 120 px-photo rows under 640 px (used in change 4, unverified in its specifics).
- Kicker "CONFIGURATOR" and "Configure →" are software words; the price never says it is complete (used in section 4; the inclusion itself is verified by the price finding).

*Steps and why-us*
- Why-us squeezes 16 px prose into two 150 px columns on phones and wraps its own heading (moot with `grid md-cols-3`).
- Active step tile is the only one with no visible fill or border in light theme (moot once the steps are a static list; `.step{ border:1px solid var(--line); background:var(--surface-2) }` if kept).
- Step copy reads like a statement of work ("use case", "logistics stack", "your asset") and gives no durations: first-person rewrite with a `time` caption per step ("We talk" / "You choose the layout and finishes" (1-2 weeks) / "We confirm the price and the dates" / "We handle the paperwork" (2-8 weeks production) / "We deliver and assemble" (1-7 days transit, 1-2 days on site) / "We stay in touch"); BG "Говорим / Избирате разпределение и довършителни работи / Потвърждаваме цена и срок / Поемаме документите / Доставяме и монтираме / Оставаме на връзка"; EL "Μιλάμε / Διαλέγετε κάτοψη και φινιρίσματα / Επιβεβαιώνουμε τιμή και ημερομηνίες / Αναλαμβάνουμε τα χαρτιά / Παραδίδουμε και συναρμολογούμε / Μένουμε σε επαφή". Durations need the owner (section 6).

*Testimonials*
- "Homeowners across Europe" above three Bulgarian towns; two Cyrillic quotes on /en with no `lang` or cue (used in section 4).

*Chrome*
- Floating chat bubble is a dark disc with WhatsApp/Viber only and no Call, labelled for screen readers ("Chat with us") but not visually (used in change 5).
- Header brand mark is a generic gradient house glyph, not the company's logo (section 6, item 9).
- A Bulgarian or Greek visitor landing on /en is never told the site exists in their language: a client-only, dismissible one-line strip under the header when `navigator.language` maps to bg/el and no `lang` choice is stored; dismiss writes `localStorage.lang`.
- If the carousel stays: portrait crops of landscape photos, baked-in white bands, 40 px arrows over a caption, invisible dots (moot once cut).
- (The header gutter finding that sat here is verified by the captures and has moved to section 5.)

*Visual system (all moot under the direction's tokens; listed as the interim fixes they were)*
- `backdrop-filter` glass on the header, every `.card`, the dock and ten carousel captions; dark theme reads as a translucent dashboard: solid surfaces one step lighter (`--night:#15171c; --anth:#1c2027; --line:#2a303a`), `backdrop-filter:none` (`index.css` l.43, 76, 381).
- Dark-theme smoke shadows and conic hover halos under light-theme buttons and cards: two themed shadow tokens; delete `.btn::after` (l.59-64) and `.feature-card::before` (l.320-325).
- Light theme alternates white, grey and faint-grey card surfaces section by section: `--surface` / `--surface-2` tokens; delete the `currentColor 4.5%` and `rgba(128,128,128,…)` recipes (`CasesPage.css` l.368, `Testimonials.css` l.20, `index.css` l.1545-1546).
- Section titles in four sizes, two weights and five subheading placements: `--fs-h2: clamp(24px, 1.1rem + 1.3vw, 30px)`, 700, subheading always under the title.
- Body text has no `line-height` and "muted" is seven opacities: `body{ line-height:1.55 }`, `--text-2`/`--text-3` tokens, replace inline `opacity:` on text in `Steps.jsx`, `WhyUs.jsx`, `HomePage.jsx`.
- Every neutral is cool slate; the only warmth is in the photographs: warm neutral tokens (superseded by section 2).
- Borders and radii not on a scale; nested radii inverted: `--line`, `--r-s/-m/-l` (superseded by section 2).
- Five icon styles on one page (stroke, filled-in-squares, text ✓, raw ✖ ‹ › ▾, colour emoji): one 20 px / 1.75 px stroke set in `currentColor`; no emoji in chrome.
- Trust claims and state labels at 12-13 px: a 14 px floor for anything that carries a claim or a state.

*Accessibility and motion (improvements, not regressions; worth doing)*
- Focus ring on every primary button is a 60 %-alpha blue halo at 1.2-1.9:1: `.btn:focus-visible{ outline:3px solid var(--text); outline-offset:3px; box-shadow:none }`, same for `.header-select`, `.gl-arrow`, both dot sets; delete `--ring` (`index.css` l.9, 56, 1054).
- framer-motion ignores reduced motion and re-animates the prerendered headline on hydration: `<MotionConfig reducedMotion="user">` beside `LazyMotion` (`App.jsx` l.515); in `Hero.jsx` render plain `h1`/`p` or `initial={false}` so the prerendered slogan is never hidden and re-shown. A live 375 px load on 2026-10-10 in a background pane showed the slogan and lead still at roughly 20 % opacity three seconds after load; a hidden tab pausing the entry animation is the likely cause, and `initial={false}` removes the risk either way.
- Tap targets under 44 px: `.btn{ min-height:44px }` under 768 px, 24 px dot hit boxes, 44 px close controls.

*Imagery*
- The one interior on the page (Interiors tile) is a CGI bathroom while the Interiors page has real rooms: point the tile at bvk4n834b-rcz with `object-position:50% 60%`.
- No consistent colour key in the first three screens (cold exhibition lot, hot sunset, dark aerial, grey render, cyan pod, blue snow, three warehouses); dark theme swallows the dusk shots: curate by one rule, daylight / warm cladding / green ground / soft sky, one dusk picture per page at most.
- The lower 2,000 px has no photograph and the closing card is the barest moment on the page: two-column contact card with a photo (used in section 4 as phase 2).

// The words around the unfolding house, in the three languages. The planner page passes
// its own copy in (from content/{bg,en,el}/floorPlanner.js) and may start from these; any
// key it leaves out falls back to the string here.
//
// Placeholders are filled from the configurator catalogue, never typed: {area}, {length},
// {width} and {foldedWidth} (metres), {terrace} (the standard deck in the base price,
// "6230 × 2000") and {veranda} (the roof-and-veranda house's veranda, "6260 × 2000": the
// house's open width by the deck's depth, as the catalogue's spec cards print it).
// Sizes read length × width, the catalogue's order, as the planner's own figures do.
// The last base stage deliberately says nothing about connecting power or water.
// A unit is tied to its number with \u00a0 (a no-break space), so "6,26 м" never splits
// across two lines of the caption.
export const UNFOLD_CONTENT = {
  bg: {
    eyebrow: 'Как се разгъва',
    stages: [
      { label: 'Доставка в сгънат вид', note: 'Пристига на камион — {length}\u00a0×\u00a0{foldedWidth}\u00a0м, с размера на стандартен контейнер.' },
      { label: 'Покривът се разгъва', note: 'Покривните панели се отварят встрани и застават хоризонтално.' },
      { label: 'Подът се спуска', note: 'Подовите панели слизат надолу до нивото на сърцевината.' },
      { label: 'Стените се изправят', note: 'Външните стени се вдигат от ръба на пода до покрива.' },
      { label: 'Челата се затварят', note: 'Страничните стени се завъртат и затварят крилата.' },
      { label: 'Готова къща', note: 'Разгъната до пълната си площ: {area}\u00a0м², {length}\u00a0×\u00a0{width}\u00a0м, с включената тераса {terrace}\u00a0мм.' },
      { label: 'Двускатен покрив', note: 'Скосеният покрив на стоманена рамка ляга върху къщата и продължава над верандата.' },
      { label: 'Веранда', note: 'Под покрива терасата става веранда с декинг {veranda}\u00a0мм на късата страна, с парапет.' },
    ],
    variantLabel: 'Вариант',
    variants: { base: 'Базов модел', roof: 'С покрив и веранда' },
    modelLabel: 'Модел',
    modelOption: '{area}\u00a0м²',
    play: 'Пусни',
    pause: 'Пауза',
    replay: 'Пусни отначало',
    scrubber: 'Етап на разгъване',
    stageAria: 'Етап {n}: {label}',
    stepCount: '{n} / {total}',
    canvasAlt: 'Триизмерна анимация: Бокс къща {area}\u00a0м² се разгъва от сгънат контейнер до готова къща.',
    canvasAltRoof: 'Триизмерна анимация: Бокс къща {area}\u00a0м² се разгъва, после получава двускатен покрив и веранда.',
    posterAlt: 'Бокс къща {area}\u00a0м², разгъната — {length}\u00a0×\u00a0{width}\u00a0м, с терасата.',
    posterAltRoof: 'Бокс къща {area}\u00a0м² с двускатен покрив и веранда.',
    dragHint: 'Плъзнете с мишката, за да завъртите къщата.',
  },
  en: {
    eyebrow: 'How it unfolds',
    stages: [
      { label: 'Delivered folded', note: 'It arrives on a truck at {length}\u00a0×\u00a0{foldedWidth}\u00a0m, the size of a standard container.' },
      { label: 'The roof opens out', note: 'The roof panels swing out to the sides and settle level.' },
      { label: 'The floor comes down', note: 'The floor panels lower to the level of the core.' },
      { label: 'The walls stand up', note: 'The outer walls rise from the edge of the floor to the roof.' },
      { label: 'The ends close', note: 'The side walls swing round and close the wings.' },
      { label: 'The finished house', note: 'Unfolded to its full area: {area}\u00a0m², {length}\u00a0×\u00a0{width}\u00a0m, with the included {terrace}\u00a0mm terrace.' },
      { label: 'Pitched roof', note: 'The sloped roof on its steel frame comes down over the house and carries on over the veranda.' },
      { label: 'Veranda', note: 'Under the roof the deck becomes a {veranda}\u00a0mm veranda on the short side, with a railing.' },
    ],
    variantLabel: 'Version',
    variants: { base: 'Base model', roof: 'With roof and veranda' },
    modelLabel: 'Model',
    modelOption: '{area}\u00a0m²',
    play: 'Play',
    pause: 'Pause',
    replay: 'Play again',
    scrubber: 'Unfolding stage',
    stageAria: 'Stage {n}: {label}',
    stepCount: '{n} / {total}',
    canvasAlt: '3D animation: a {area}\u00a0m² Box house unfolds from a folded container into a finished house.',
    canvasAltRoof: '3D animation: a {area}\u00a0m² Box house unfolds, then gets a pitched roof and a veranda.',
    posterAlt: 'A {area}\u00a0m² Box house, unfolded: {length}\u00a0×\u00a0{width}\u00a0m, with its terrace.',
    posterAltRoof: 'A {area}\u00a0m² Box house with a pitched roof and a veranda.',
    dragHint: 'Drag with the mouse to turn the house.',
  },
  el: {
    eyebrow: 'Πώς ανοίγει',
    stages: [
      { label: 'Παράδοση διπλωμένο', note: 'Φτάνει με φορτηγό, {length}\u00a0×\u00a0{foldedWidth}\u00a0m, στο μέγεθος ενός τυπικού κοντέινερ.' },
      { label: 'Η στέγη ανοίγει', note: 'Τα πάνελ της στέγης ανοίγουν προς τα πλάγια και στέκονται οριζόντια.' },
      { label: 'Το δάπεδο κατεβαίνει', note: 'Τα πάνελ του δαπέδου κατεβαίνουν στο ύψος του κεντρικού τμήματος.' },
      { label: 'Οι τοίχοι σηκώνονται', note: 'Οι εξωτερικοί τοίχοι σηκώνονται από την άκρη του δαπέδου ως τη στέγη.' },
      { label: 'Τα πλαϊνά κλείνουν', note: 'Οι πλαϊνοί τοίχοι περιστρέφονται και κλείνουν τα φτερά.' },
      { label: 'Το σπίτι είναι έτοιμο', note: 'Ανοιγμένο σε όλη του την επιφάνεια: {area}\u00a0m², {length}\u00a0×\u00a0{width}\u00a0m, με τη βεράντα {terrace}\u00a0mm που περιλαμβάνεται.' },
      { label: 'Δίριχτη στέγη', note: 'Η κεκλιμένη στέγη με τον μεταλλικό σκελετό κατεβαίνει πάνω στο σπίτι και συνεχίζει πάνω από τη βεράντα.' },
      { label: 'Βεράντα', note: 'Κάτω από τη στέγη το deck γίνεται βεράντα {veranda}\u00a0mm στη μικρή πλευρά, με κάγκελο.' },
    ],
    variantLabel: 'Έκδοση',
    variants: { base: 'Βασικό μοντέλο', roof: 'Με στέγη και βεράντα' },
    modelLabel: 'Μοντέλο',
    modelOption: '{area}\u00a0m²',
    play: 'Αναπαραγωγή',
    pause: 'Παύση',
    replay: 'Ξανά από την αρχή',
    scrubber: 'Στάδιο ανοίγματος',
    stageAria: 'Στάδιο {n}: {label}',
    stepCount: '{n} / {total}',
    canvasAlt: 'Τρισδιάστατη κίνηση: ένα σπίτι Box {area}\u00a0m² ανοίγει από διπλωμένο κοντέινερ σε έτοιμο σπίτι.',
    canvasAltRoof: 'Τρισδιάστατη κίνηση: ένα σπίτι Box {area}\u00a0m² ανοίγει και έπειτα αποκτά δίριχτη στέγη και βεράντα.',
    posterAlt: 'Σπίτι Box {area}\u00a0m², ανοιγμένο: {length}\u00a0×\u00a0{width}\u00a0m, με τη βεράντα του.',
    posterAltRoof: 'Σπίτι Box {area}\u00a0m² με δίριχτη στέγη και βεράντα.',
    dragHint: 'Σύρετε με το ποντίκι για να γυρίσετε το σπίτι.',
  },
}

/** The page's copy over the defaults, key by key (stages entry by entry). */
export function unfoldText(locale, content) {
  const base = UNFOLD_CONTENT[locale] || UNFOLD_CONTENT.bg
  if (!content) return base
  const stages = base.stages.map((stage, i) => ({ ...stage, ...(content.stages?.[i] || {}) }))
  return { ...base, ...content, variants: { ...base.variants, ...(content.variants || {}) }, stages }
}

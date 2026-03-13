import React from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import './InternalDoors.css'


// Local (component-scoped) bilingual fallbacks for this page.
// If you later add these keys to /i18n/translations.js, the global dictionary will override these.
const INTERNAL_DOORS_FALLBACK = {
  en: {
    'common.close': 'Close',

    'internalDoors.title': 'Internal doors',
    'internalDoors.lead':
      'Modern internal doors with curated finishes. Switch door type and preview colour presets instantly.',
    'internalDoors.heroBanner.aria': 'Door features overview',

    'internalDoors.hero.fire.h': 'Fire resistance',
    'internalDoors.hero.fire.p':
      'Options with enhanced fire resistance are available depending on the configuration and the applicable certifications/classes.',

    'internalDoors.hero.sound.h': 'Sound insulation',
    'internalDoors.hero.sound.p':
      'The construction provides good sound insulation for more comfort at home and in the office.',

    'internalDoors.hero.water.h': 'Water resistant',
    'internalDoors.hero.water.p':
      'The WPC material is water-resistant, making the doors suitable for rooms with higher humidity.',

    'internalDoors.hero.coating.h': 'Coating options',
    'internalDoors.hero.coating.p': 'Available in different colours, decors and textures.',
    'internalDoors.hero.coating.aria': 'Example finishes',

    'internalDoors.hero.kit.h': 'Complete set',
    'internalDoors.hero.kit.p': 'Delivered as a set with frame, fittings and trims.',

    'internalDoors.hero.kit.mediaAlt': 'Frame, fittings and trims illustration',

    'internalDoors.hero.wpc.h': 'WPC material',
    'internalDoors.hero.wpc.p': 'Wood–polymer composite with high durability and long service life.',

    'internalDoors.types.h': 'Door type',
    'internalDoors.types.aria': 'Door type',

    'internalDoors.types.decorLines': 'Doors with decorative lines',
    'internalDoors.types.decorLinesDesc':
      'Interior doors with decorative milling/lines — suitable for bedrooms, bathrooms and offices.',
    'internalDoors.types.decorLinesFeat1': 'Leaf + frame (standard or concealed)',
    'internalDoors.types.decorLinesFeat2':
      'Solid / honeycomb / tubular chipboard (depending on model)',
    'internalDoors.types.decorLinesFeat3': 'Hardware set: hinges, handle, lock, seals',
    'internalDoors.types.decorLinesTag': 'Decorative lines',

    'internalDoors.types.wallpaper': 'Concealed (flush) doors',
    'internalDoors.types.wallpaperDesc':
      'Concealed/flush doors — for invisible openings and a seamless wall finish.',
    'internalDoors.types.wallpaperFeat1': 'Concealed frame + leaf for wall finish',
    'internalDoors.types.wallpaperFeat2': 'Can be painted / wallpapered / microcement',
    'internalDoors.types.wallpaperFeat3': 'Minimal gaps and clean line',
    'internalDoors.types.wallpaperTag': 'Concealed door',

    'internalDoors.types.metalLines': 'Doors with metal lines',
    'internalDoors.types.metalLinesDesc':
      'Interior doors with metal inlays/lines — a modern look for corridors and living rooms.',
    'internalDoors.types.metalLinesFeat1': 'Leaf with metal lines (depending on model)',
    'internalDoors.types.metalLinesFeat2': 'Various finishes and colours',
    'internalDoors.types.metalLinesFeat3': 'Compatible handles and locks of choice',
    'internalDoors.types.metalLinesTag': 'Metal lines',

    'internalDoors.types.glass': 'Doors with glass',
    'internalDoors.types.glassDesc':
      'Interior doors with glass — more light between rooms without compromising the design.',
    'internalDoors.types.glassFeat1': 'Glass: clear / frosted / bronze / graphite (on request)',
    'internalDoors.types.glassFeat2': 'Different glass layouts available',
    'internalDoors.types.glassFeat3': 'Optional hardware set (handle, lock, trims)',
    'internalDoors.types.glassTag': 'Glass',

    'internalDoors.preview.h': 'Choose your door',
    'internalDoors.preview.p2':
      'Use the Door Type toggle to swap styles. Then use the swatches on the image to change the finish.',
    'internalDoors.preview.alt': 'Internal door preview',
    'internalDoors.preview.ariaDoor': 'Door colour',
    'internalDoors.preview.ariaPanel': 'Panel finish',

    'internalDoors.colors.white': 'White',
    'internalDoors.colors.charcoal': 'Charcoal',
    'internalDoors.colors.sage': 'Sage',

    'internalDoors.panels.light': 'Light',
    'internalDoors.panels.smoked': 'Smoked',
    'internalDoors.panels.dark': 'Dark',

    'internalDoors.selected.h': 'Selected finish',
    'internalDoors.selected.meta': 'More colours available on request.',

    'internalDoors.details.h': "What's included",

    'internalDoors.hardware.h': 'Hardware & trims',
    'internalDoors.hardware.p':
      'Choose a frame, handle, trims and lock. (Images are examples — replace them with your own.)',

    'internalDoors.hardware.frame.h': 'Frame',
    'internalDoors.hardware.frame.hint': 'Frame size / width',
    'internalDoors.hardware.frame.aria': 'Frame selection',
    'internalDoors.hardware.frame.70': '70 mm',
    'internalDoors.hardware.frame.90': '90 mm',
    'internalDoors.hardware.frame.100': '100 mm',
    'internalDoors.hardware.frame.120': '120 mm',
    'internalDoors.hardware.frame.140': '140 mm',
    'internalDoors.hardware.frame.160': '160 mm',
    'internalDoors.hardware.frame.180': '180 mm',

    'internalDoors.hardware.handle.h': 'Handle',
    'internalDoors.hardware.handle.hint': 'Handle model',
    'internalDoors.hardware.handle.aria': 'Handle selection',
    'internalDoors.hardware.handle.h1': 'Handle 1',
    'internalDoors.hardware.handle.h2': 'Handle 2',
    'internalDoors.hardware.handle.h3': 'Handle 3',
    'internalDoors.hardware.handle.h4': 'Handle 4',
    'internalDoors.hardware.handle.h5': 'Handle 5',
    'internalDoors.hardware.handle.h6': 'Handle 6',

    'internalDoors.hardware.trim.h': 'Trim models',
    'internalDoors.hardware.trim.hint': 'Trim style (casing)',
    'internalDoors.hardware.trim.aria': 'Trim selection',
    'internalDoors.hardware.trim.p1': 'Trim 1',
    'internalDoors.hardware.trim.p2': 'Trim 2',
    'internalDoors.hardware.trim.p3': 'Trim 3',
    'internalDoors.hardware.trim.p4': 'Trim 4',
    'internalDoors.hardware.trim.p5': 'Trim 5',
    'internalDoors.hardware.trim.p6': 'Trim 6',
    'internalDoors.hardware.trim.p7': 'Trim 7',
    'internalDoors.hardware.trim.p8': 'Trim 8',

    'internalDoors.hardware.lock.h': 'Lock',
    'internalDoors.hardware.lock.hint': 'Lock type',
    'internalDoors.hardware.lock.aria': 'Lock selection',
    'internalDoors.hardware.lock.l1': 'Lock 1',
    'internalDoors.hardware.lock.l2': 'Lock 2',
    'internalDoors.hardware.lock.l3': 'Lock 3',
    'internalDoors.hardware.lock.l4': 'Lock 4',

    'internalDoors.hardware.summaryAria': 'Selected options',
    'internalDoors.hardware.summary.frame': 'Frame',
    'internalDoors.hardware.summary.handle': 'Handle',
    'internalDoors.hardware.summary.trim': 'Trim',
    'internalDoors.hardware.summary.lock': 'Lock',

    'internalDoors.hardware.cta': 'Send enquiry with the selected options',

    'internalDoors.cta': 'Request a doors quote',
    'internalDoors.hint2':
      'Tip: Add more colours by adding objects to the relevant options array (see comments in InternalDoors.jsx).',

    'internalDoors.why.h': 'Why source doors through us',
    'internalDoors.why.li1': 'Matched finishes across floors, panels, and furniture packs.',
    'internalDoors.why.li2': 'Lead time coordination with delivery & installation.',
    'internalDoors.why.li3': 'Clear specs: hinges, locks, fire rating, acoustics.',
  },
  bg: {
    'common.close': 'Затвори',

    'internalDoors.title': 'Интериорни врати',
    'internalDoors.lead':
      'Модерни интериорни врати с подбрани покрития. Сменете типа врата и визуализирайте цветовите варианти моментално.',
    'internalDoors.heroBanner.aria': 'Преглед на характеристиките на вратите',

    'internalDoors.hero.fire.h': 'Пожароустойчивост',
    'internalDoors.hero.fire.p':
      'Предлагат се решения с повишена пожароустойчивост според конкретната конфигурация и наличните сертификати/класове.',

    'internalDoors.hero.sound.h': 'Шумоизолация',
    'internalDoors.hero.sound.p':
      'Конструкцията осигурява добра шумоизолация за повече комфорт у дома и в офиса.',

    'internalDoors.hero.water.h': 'Водоустойчив',
    'internalDoors.hero.water.p':
      'WPC материалът е водоустойчив, което прави вратите подходящи и за помещения с по-висока влажност.',

    'internalDoors.hero.coating.h': 'Опции за покритие',
    'internalDoors.hero.coating.p': 'Предлагат се в различни цветове и декори и текстури.',
    'internalDoors.hero.coating.aria': 'Примерни покрития',

    'internalDoors.hero.kit.h': 'Комплектовка',
    'internalDoors.hero.kit.p': 'Доставят се в комплект с каса, обков и первази.',

    'internalDoors.hero.kit.mediaAlt': 'Илюстрация: каса, обков и первази',

    'internalDoors.hero.wpc.h': 'WPC материал',
    'internalDoors.hero.wpc.p': 'Дървесно-полимерен композит с висока устойчивост и дълъг живот.',

    'internalDoors.types.h': 'Тип врата',
    'internalDoors.types.aria': 'Тип врата',

    'internalDoors.types.decorLines': 'Врати с декоративни линии',
    'internalDoors.types.decorLinesDesc':
      'Интериорни врати с декоративни фрезовки/линии — подходящи за спални, бани и офиси.',
    'internalDoors.types.decorLinesFeat1': 'Крило + каса (стандартна или скрита)',
    'internalDoors.types.decorLinesFeat2': 'Плътно / пчелна пита / тръбно ПДЧ (спрямо модела)',
    'internalDoors.types.decorLinesFeat3': 'Окомплектовка: панти, дръжка, брава, уплътнения',
    'internalDoors.types.decorLinesTag': 'Декоративни линии',

    'internalDoors.types.wallpaper': 'Тапетни врати',
    'internalDoors.types.wallpaperDesc':
      'Тапетни/скрити врати (flush) — за невидими отвори и завършена стена.',
    'internalDoors.types.wallpaperFeat1': 'Скрита каса + крило за стенен финиш',
    'internalDoors.types.wallpaperFeat2': 'Възможност за боядисване/тапет/микроцимент',
    'internalDoors.types.wallpaperFeat3': 'Минимални фуги и чиста линия',
    'internalDoors.types.wallpaperTag': 'Тапетна врата',

    'internalDoors.types.metalLines': 'Врати с метални линии',
    'internalDoors.types.metalLinesDesc':
      'Интериорни врати с метални инкрустации/линии — модерна визия за коридори и дневни.',
    'internalDoors.types.metalLinesFeat1': 'Крило с метални линии (спрямо модела)',
    'internalDoors.types.metalLinesFeat2': 'Различни финиши и цветове',
    'internalDoors.types.metalLinesFeat3': 'Съвместими дръжки и брави по избор',
    'internalDoors.types.metalLinesTag': 'Метални линии',

    'internalDoors.types.glass': 'Врати със стъкло',
    'internalDoors.types.glassDesc':
      'Интериорни врати със стъкло — повече светлина между помещенията, без компромис с дизайна.',
    'internalDoors.types.glassFeat1': 'Стъкло: прозрачно / мат / бронз / графит (по заявка)',
    'internalDoors.types.glassFeat2': 'Възможност за различни разпределения на стъклото',
    'internalDoors.types.glassFeat3': 'Окомплектовка по избор (дръжка, брава, первази)',
    'internalDoors.types.glassTag': 'Стъкло',

    'internalDoors.preview.h': 'Избери врата',
    'internalDoors.preview.p2':
      'Използвайте превключвателя „Тип врата“, за да смените стила. След това използвайте цветовите мостри върху изображението, за да промените финиша.',
    'internalDoors.preview.alt': 'Визуализация на интериорна врата',
    'internalDoors.preview.ariaDoor': 'Цвят на врата',
    'internalDoors.preview.ariaPanel': 'Покритие на панела',

    'internalDoors.colors.white': 'Бяло',
    'internalDoors.colors.charcoal': 'Антрацит',
    'internalDoors.colors.sage': 'Салвия',

    'internalDoors.panels.light': 'Светъл',
    'internalDoors.panels.smoked': 'Опушен',
    'internalDoors.panels.dark': 'Тъмен',

    'internalDoors.selected.h': 'Избран финиш',
    'internalDoors.selected.meta': 'Възможни са още цветове по запитване.',

    'internalDoors.details.h': 'Какво е включено',

    'internalDoors.hardware.h': 'Окомплектовка',
    'internalDoors.hardware.p':
      'Изберете каса, дръжка, первази и брава. (Снимките са примерни — заменете ги с вашите изображения.)',

    'internalDoors.hardware.frame.h': 'Каса',
    'internalDoors.hardware.frame.hint': 'Размер / ширина на касата',
    'internalDoors.hardware.frame.aria': 'Избор на каса',
    'internalDoors.hardware.frame.70': '70 мм',
    'internalDoors.hardware.frame.90': '90 мм',
    'internalDoors.hardware.frame.100': '100 мм',
    'internalDoors.hardware.frame.120': '120 мм',
    'internalDoors.hardware.frame.140': '140 мм',
    'internalDoors.hardware.frame.160': '160 мм',
    'internalDoors.hardware.frame.180': '180 мм',

    'internalDoors.hardware.handle.h': 'Дръжка',
    'internalDoors.hardware.handle.hint': 'Модел на дръжката',
    'internalDoors.hardware.handle.aria': 'Избор на дръжка',
    'internalDoors.hardware.handle.h1': 'Дръжка 1',
    'internalDoors.hardware.handle.h2': 'Дръжка 2',
    'internalDoors.hardware.handle.h3': 'Дръжка 3',
    'internalDoors.hardware.handle.h4': 'Дръжка 4',
    'internalDoors.hardware.handle.h5': 'Дръжка 5',
    'internalDoors.hardware.handle.h6': 'Дръжка 6',

    'internalDoors.hardware.trim.h': 'Перваз модели',
    'internalDoors.hardware.trim.hint': 'Модел на перваза (обкантване)',
    'internalDoors.hardware.trim.aria': 'Избор на перваз',
    'internalDoors.hardware.trim.p1': 'Перваз 1',
    'internalDoors.hardware.trim.p2': 'Перваз 2',
    'internalDoors.hardware.trim.p3': 'Перваз 3',
    'internalDoors.hardware.trim.p4': 'Перваз 4',
    'internalDoors.hardware.trim.p5': 'Перваз 5',
    'internalDoors.hardware.trim.p6': 'Перваз 6',
    'internalDoors.hardware.trim.p7': 'Перваз 7',
    'internalDoors.hardware.trim.p8': 'Перваз 8',

    'internalDoors.hardware.lock.h': 'Брава',
    'internalDoors.hardware.lock.hint': 'Тип заключване',
    'internalDoors.hardware.lock.aria': 'Избор на брава',
    'internalDoors.hardware.lock.l1': 'Брава 1',
    'internalDoors.hardware.lock.l2': 'Брава 2',
    'internalDoors.hardware.lock.l3': 'Брава 3',
    'internalDoors.hardware.lock.l4': 'Брава 4',

    'internalDoors.hardware.summaryAria': 'Избрани опции',
    'internalDoors.hardware.summary.frame': 'Каса',
    'internalDoors.hardware.summary.handle': 'Дръжка',
    'internalDoors.hardware.summary.trim': 'Перваз',
    'internalDoors.hardware.summary.lock': 'Брава',

    'internalDoors.hardware.cta': 'Изпрати запитване с избраните опции',

    'internalDoors.cta': 'Запитване за оферта за врати',
    'internalDoors.hint2':
      'Съвет: Добавете още цветове като добавите обекти към съответния масив с опции (вижте коментарите в InternalDoors.jsx).',

    'internalDoors.why.h': 'Защо да поръчате врати чрез нас',
    'internalDoors.why.li1': 'Съгласувани финиши с подове, панели и мебелни пакети.',
    'internalDoors.why.li2': 'Координация на срокове с доставка и монтаж.',
    'internalDoors.why.li3': 'Ясна спецификация: панти, брави, пожароустойчивост, шумоизолация.',
  },
}

function useText() {
  const { t, lang } = useI18n()

  return React.useCallback(
    (key, fallback) => {
      const v = t(key)
      if (typeof v === 'string') return v

      // Local fallback dictionary (so the BG/EN switch works even without translation entries).
      const isBg = String(lang || 'en')
        .toLowerCase()
        .startsWith('bg')
      const local = isBg ? INTERNAL_DOORS_FALLBACK.bg : INTERNAL_DOORS_FALLBACK.en
      if (local && Object.prototype.hasOwnProperty.call(local, key)) return local[key]

      // Optional: allow passing { en, bg } as a fallback.
      if (fallback && typeof fallback === 'object') {
        return isBg ? fallback.bg ?? fallback.en ?? '' : fallback.en ?? fallback.bg ?? ''
      }

      return fallback
    },
    [t, lang]
  )
}


function TypeTabs({ items, value, onChange, ariaLabel = 'Door type' }) {
  return (
    <div className="id-type-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((it) => {
        const active = it.key === value
        return (
          <button
            key={it.key}
            type="button"
            className={['id-type-tab', active && 'is-active'].filter(Boolean).join(' ')}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function ColorPicker({
  options,
  value,
  onChange,
  pillBg = 'rgba(255,255,255,.75)',
  ariaLabel = 'Finish',
  position = 'bottom-right', // 'top-right' | 'bottom-right'
}) {
  const refs = React.useRef([])

  const move = (dir) => {
    const idx = Math.max(0, options.findIndex((o) => o.key === value))
    const next = (idx + dir + options.length) % options.length
    const nextKey = options[next]?.key
    if (!nextKey) return
    onChange(nextKey)
    window.requestAnimationFrame(() => refs.current[next]?.focus())
  }

  return (
    <div
      className={['id-picker', position === 'bottom-right' && 'is-bottom'].filter(Boolean).join(' ')}
      style={{ '--pill': pillBg }}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt, i) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            className={['id-dot', active && 'is-active'].filter(Boolean).join(' ')}
            style={{ '--dot': opt.swatch }}
            onClick={() => onChange(opt.key)}
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                move(-1)
              }
              if (e.key === 'ArrowRight') {
                e.preventDefault()
                move(1)
              }
            }}
          />
        )
      })}
    </div>
  )
}

function ThumbGrid({ options, value, onChange, ariaLabel, fallbackSrc }) {
  const refs = React.useRef([])

  const move = (dir) => {
    const idx = Math.max(0, options.findIndex((o) => o.key === value))
    const next = (idx + dir + options.length) % options.length
    const nextKey = options[next]?.key
    if (!nextKey) return
    onChange(nextKey)
    window.requestAnimationFrame(() => refs.current[next]?.focus())
  }

  return (
    <div className="id-opt-grid" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt, i) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            className={['id-opt', active && 'is-active'].filter(Boolean).join(' ')}
            onClick={() => onChange(opt.key)}
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1)
              }
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(1)
              }
            }}
          >
            <img
              className="id-opt-img"
              src={opt.img}
              alt=""
              loading="lazy"
              onError={(e) => {
                if (fallbackSrc) e.currentTarget.src = fallbackSrc
              }}
            />
            <div className="id-opt-label">{opt.label}</div>
            {opt.meta ? <div className="id-opt-meta">{opt.meta}</div> : null}
          </button>
        )
      })}
    </div>
  )
}

function ConfigGroup({ title, hint, options, value, onChange, ariaLabel, fallbackSrc }) {
  const selected = options.find((o) => o.key === value) || options[0]

  return (
    <div className="id-group">
      <div className="id-group-h">{title}</div>
      {hint ? <div className="id-group-sub">{hint}</div> : null}

      <div className="id-choice">
        <div className="id-choice-preview" aria-label={`${title}: ${selected?.label || ''}`}>
          <img
            className="id-choice-img"
            src={selected?.img}
            alt=""
            loading="lazy"
            onError={(e) => {
              if (fallbackSrc) e.currentTarget.src = fallbackSrc
            }}
          />
          <div className="id-choice-name">{selected?.label}</div>
        </div>

        <ThumbGrid
          options={options}
          value={value}
          onChange={onChange}
          ariaLabel={ariaLabel || title}
          fallbackSrc={fallbackSrc}
        />
      </div>
    </div>
  )
}

export default function InternalDoors() {
  const { openOffer, openQuestion } = useModalActions()
  const txt = useText()
  const asset = React.useCallback((p) => `${import.meta.env.BASE_URL}${p}`, [])
  const fallback = asset('modular-builds/card.svg')

  // ---------------------------------------------------------------------------
  // DOOR TYPES + FINISHES
  // Tip: To add a new colour, add a new object to the relevant "...Options" array
  // with: { key, label, swatch, pillBg, img } and add the image under /public.
  // ---------------------------------------------------------------------------

  // TYPE 1: Врати с декоративни линии
  const decorLinesOptions = React.useMemo(
    () => [
      {
        key: 'white',
        label: txt('internalDoors.colors.white', 'White'),
        swatch: '#D1D5DB',
        pillBg: 'rgba(255,255,255,.78)',
        img: asset('internal-doors/door-white.png'),
      },
      {
        key: 'charcoal',
        label: txt('internalDoors.colors.charcoal', 'Charcoal'),
        swatch: '#4B5563',
        pillBg: 'rgba(31,41,55,.72)',
        img: asset('internal-doors/door-charcoal.png'),
      },
      {
        key: 'sage',
        label: txt('internalDoors.colors.sage', 'Sage'),
        swatch: '#A3B18A',
        pillBg: 'rgba(163,177,138,.70)',
        img: asset('internal-doors/door-sage.png'),
      },
    ],
    [txt, asset]
  )

  // TYPE 2: Тапетни врати (concealed / wallpaper / flush)
  const wallpaperOptions = React.useMemo(
    () => [
      {
        key: 'panelLight',
        label: txt('internalDoors.panels.light', 'Light'),
        swatch: '#B8B1A6',
        pillBg: 'rgba(255,255,255,.70)',
        img: asset('internal-doors/panels-light.png'),
      },
      {
        key: 'panelSmoked',
        label: txt('internalDoors.panels.smoked', 'Smoked'),
        swatch: '#6A6358',
        pillBg: 'rgba(17,24,39,.62)',
        img: asset('internal-doors/panels-mid.png'),
      },
      {
        key: 'panelDark',
        label: txt('internalDoors.panels.dark', 'Dark'),
        swatch: '#1F1B14',
        pillBg: 'rgba(17,24,39,.62)',
        img: asset('internal-doors/panels-dark.png'),
      },
    ],
    [txt, asset]
  )

  // TYPE 3: Врати с метални линии
  const metalLinesOptions = React.useMemo(
    () => [
      {
        key: 'white',
        label: txt('internalDoors.colors.white', 'White'),
        swatch: '#D1D5DB',
        pillBg: 'rgba(255,255,255,.78)',
        img: asset('internal-doors/door-white.png'),
      },
      {
        key: 'charcoal',
        label: txt('internalDoors.colors.charcoal', 'Charcoal'),
        swatch: '#4B5563',
        pillBg: 'rgba(31,41,55,.72)',
        img: asset('internal-doors/door-charcoal.png'),
      },
      {
        key: 'sage',
        label: txt('internalDoors.colors.sage', 'Sage'),
        swatch: '#A3B18A',
        pillBg: 'rgba(163,177,138,.70)',
        img: asset('internal-doors/door-sage.png'),
      },
    ],
    [txt, asset]
  )

  // TYPE 4: Врати със стъкло
  const glassOptions = React.useMemo(
    () => [
      {
        key: 'white',
        label: txt('internalDoors.colors.white', 'White'),
        swatch: '#D1D5DB',
        pillBg: 'rgba(255,255,255,.78)',
        img: asset('internal-doors/door-white.png'),
      },
      {
        key: 'charcoal',
        label: txt('internalDoors.colors.charcoal', 'Charcoal'),
        swatch: '#4B5563',
        pillBg: 'rgba(31,41,55,.72)',
        img: asset('internal-doors/door-charcoal.png'),
      },
      {
        key: 'sage',
        label: txt('internalDoors.colors.sage', 'Sage'),
        swatch: '#A3B18A',
        pillBg: 'rgba(163,177,138,.70)',
        img: asset('internal-doors/door-sage.png'),
      },
    ],
    [txt, asset]
  )

  const optionsByType = React.useMemo(
    () => ({
      decorLines: decorLinesOptions,
      wallpaper: wallpaperOptions,
      metalLines: metalLinesOptions,
      glass: glassOptions,
    }),
    [decorLinesOptions, wallpaperOptions, metalLinesOptions, glassOptions]
  )

  const typeItems = React.useMemo(
    () => [
      { key: 'decorLines', label: txt('internalDoors.types.decorLines', 'Врати с декоративни линии') },
      { key: 'wallpaper', label: txt('internalDoors.types.wallpaper', 'Тапетни врати') },
      { key: 'metalLines', label: txt('internalDoors.types.metalLines', 'Врати с метални линии') },
      { key: 'glass', label: txt('internalDoors.types.glass', 'Врати със стъкло') },
    ],
    [txt]
  )

  const typeCopy = React.useMemo(
    () => ({
      decorLines: {
        desc: txt(
          'internalDoors.types.decorLinesDesc',
          'Интериорни врати с декоративни фрезовки/линии — подходящи за спални, бани и офиси.'
        ),
        features: [
          txt('internalDoors.types.decorLinesFeat1', 'Крило + каса (стандартна или скрита)'),
          txt('internalDoors.types.decorLinesFeat2', 'Плътно / пчелна пита / тръбно ПДЧ (спрямо модела)'),
          txt('internalDoors.types.decorLinesFeat3', 'Окомплектовка: панти, дръжка, брава, уплътнения'),
        ],
        tag: txt('internalDoors.types.decorLinesTag', 'Декоративни линии'),
      },
      wallpaper: {
        desc: txt(
          'internalDoors.types.wallpaperDesc',
          'Тапетни/скрити врати (flush) — за невидими отвори и завършена стена.'
        ),
        features: [
          txt('internalDoors.types.wallpaperFeat1', 'Скрита каса + крило за стенен финиш'),
          txt('internalDoors.types.wallpaperFeat2', 'Възможност за боядисване/тапет/микроцимент'),
          txt('internalDoors.types.wallpaperFeat3', 'Минимални фуги и чиста линия'),
        ],
        tag: txt('internalDoors.types.wallpaperTag', 'Тапетна врата'),
      },
      metalLines: {
        desc: txt(
          'internalDoors.types.metalLinesDesc',
          'Интериорни врати с метални инкрустации/линии — модерна визия за коридори и дневни.'
        ),
        features: [
          txt('internalDoors.types.metalLinesFeat1', 'Крило с метални линии (спрямо модела)'),
          txt('internalDoors.types.metalLinesFeat2', 'Различни финиши и цветове'),
          txt('internalDoors.types.metalLinesFeat3', 'Съвместими дръжки и брави по избор'),
        ],
        tag: txt('internalDoors.types.metalLinesTag', 'Метални линии'),
      },
      glass: {
        desc: txt(
          'internalDoors.types.glassDesc',
          'Интериорни врати със стъкло — повече светлина между помещенията, без компромис с дизайна.'
        ),
        features: [
          txt('internalDoors.types.glassFeat1', 'Стъкло: прозрачно / мат / бронз / графит (по заявка)'),
          txt('internalDoors.types.glassFeat2', 'Възможност за различни разпределения на стъклото'),
          txt('internalDoors.types.glassFeat3', 'Окомплектовка по избор (дръжка, брава, первази)'),
        ],
        tag: txt('internalDoors.types.glassTag', 'Стъкло'),
      },
    }),
    [txt]
  )

  const [typeKey, setTypeKey] = React.useState('decorLines')

  // Keep a selected finish per type (so switching type keeps the last choice)
  const [finishByType, setFinishByType] = React.useState(() => ({
    decorLines: decorLinesOptions[0]?.key || 'white',
    wallpaper: wallpaperOptions.find((o) => o.key === 'panelDark')?.key || wallpaperOptions[0]?.key || 'panelDark',
    metalLines: metalLinesOptions[0]?.key || 'white',
    glass: glassOptions[0]?.key || 'white',
  }))

  // In case options change and a key disappears, recover gracefully
  React.useEffect(() => {
    setFinishByType((prev) => {
      const next = { ...prev }
      Object.entries(optionsByType).forEach(([tk, opts]) => {
        const cur = next[tk]
        const ok = opts.some((o) => o.key === cur)
        if (!ok) {
          if (tk === 'wallpaper') next[tk] = opts.find((o) => o.key === 'panelDark')?.key || opts[0]?.key
          else next[tk] = opts[0]?.key
        }
      })
      return next
    })
  }, [optionsByType])

  const activeOptions = optionsByType[typeKey] || decorLinesOptions
  const activeFinishKey = finishByType[typeKey]
  const selected = activeOptions.find((o) => o.key === activeFinishKey) || activeOptions[0]
  const activeImg = selected?.img

  const setActiveFinishKey = (k) => setFinishByType((prev) => ({ ...prev, [typeKey]: k }))

  // ---------------------------------------------------------------------------
  // HARDWARE CONFIG (Каса / Дръжка / Перваз / Брава)
  // ---------------------------------------------------------------------------

  // "Каса" = door frame (frame/jamb). Update labels/sizes to your real product list.
  const frameOptions = React.useMemo(
    () => [
      { key: '70', label: txt('internalDoors.hardware.frame.70', '70 мм'), img: asset('internal-doors/hardware/frame-70.png') },
      { key: '90', label: txt('internalDoors.hardware.frame.90', '90 мм'), img: asset('internal-doors/hardware/frame-90.png') },
      { key: '100', label: txt('internalDoors.hardware.frame.100', '100 мм'), img: asset('internal-doors/hardware/frame-100.png') },
      { key: '120', label: txt('internalDoors.hardware.frame.120', '120 мм'), img: asset('internal-doors/hardware/frame-120.png') },
      { key: '140', label: txt('internalDoors.hardware.frame.140', '140 мм'), img: asset('internal-doors/hardware/frame-140.png') },
      { key: '160', label: txt('internalDoors.hardware.frame.160', '160 мм'), img: asset('internal-doors/hardware/frame-160.png') },
      { key: '180', label: txt('internalDoors.hardware.frame.180', '180 мм'), img: asset('internal-doors/hardware/frame-180.png') },
    ],
    [txt, asset]
  )

  // 6 handle types (placeholder keys/labels)
  const handleOptions = React.useMemo(
    () => [
      { key: 'h1', label: txt('internalDoors.hardware.handle.h1', 'Дръжка 1'), img: asset('internal-doors/hardware/handle-1.png') },
      { key: 'h2', label: txt('internalDoors.hardware.handle.h2', 'Дръжка 2'), img: asset('internal-doors/hardware/handle-2.png') },
      { key: 'h3', label: txt('internalDoors.hardware.handle.h3', 'Дръжка 3'), img: asset('internal-doors/hardware/handle-3.png') },
      { key: 'h4', label: txt('internalDoors.hardware.handle.h4', 'Дръжка 4'), img: asset('internal-doors/hardware/handle-4.png') },
      { key: 'h5', label: txt('internalDoors.hardware.handle.h5', 'Дръжка 5'), img: asset('internal-doors/hardware/handle-5.png') },
      { key: 'h6', label: txt('internalDoors.hardware.handle.h6', 'Дръжка 6'), img: asset('internal-doors/hardware/handle-6.png') },
    ],
    [txt, asset]
  )

  // "Перваз" = architrave / casing / door trim. 8 models.
  const trimOptions = React.useMemo(
    () => [
      { key: 'p1', label: txt('internalDoors.hardware.trim.p1', 'Перваз 1'), img: asset('internal-doors/hardware/trim-1.png') },
      { key: 'p2', label: txt('internalDoors.hardware.trim.p2', 'Перваз 2'), img: asset('internal-doors/hardware/trim-2.png') },
      { key: 'p3', label: txt('internalDoors.hardware.trim.p3', 'Перваз 3'), img: asset('internal-doors/hardware/trim-3.png') },
      { key: 'p4', label: txt('internalDoors.hardware.trim.p4', 'Перваз 4'), img: asset('internal-doors/hardware/trim-4.png') },
      { key: 'p5', label: txt('internalDoors.hardware.trim.p5', 'Перваз 5'), img: asset('internal-doors/hardware/trim-5.png') },
      { key: 'p6', label: txt('internalDoors.hardware.trim.p6', 'Перваз 6'), img: asset('internal-doors/hardware/trim-6.png') },
      { key: 'p7', label: txt('internalDoors.hardware.trim.p7', 'Перваз 7'), img: asset('internal-doors/hardware/trim-7.png') },
      { key: 'p8', label: txt('internalDoors.hardware.trim.p8', 'Перваз 8'), img: asset('internal-doors/hardware/trim-8.png') },
    ],
    [txt, asset]
  )

  // "Брава" = lock. 4 types.
  const lockOptions = React.useMemo(
    () => [
      { key: 'l1', label: txt('internalDoors.hardware.lock.l1', 'Брава 1'), img: asset('internal-doors/hardware/lock-1.png') },
      { key: 'l2', label: txt('internalDoors.hardware.lock.l2', 'Брава 2'), img: asset('internal-doors/hardware/lock-2.png') },
      { key: 'l3', label: txt('internalDoors.hardware.lock.l3', 'Брава 3'), img: asset('internal-doors/hardware/lock-3.png') },
      { key: 'l4', label: txt('internalDoors.hardware.lock.l4', 'Брава 4'), img: asset('internal-doors/hardware/lock-4.png') },
    ],
    [txt, asset]
  )

  const [frameKey, setFrameKey] = React.useState(frameOptions[0]?.key || '70')
  const [handleKey, setHandleKey] = React.useState(handleOptions[0]?.key || 'h1')
  const [trimKey, setTrimKey] = React.useState(trimOptions[0]?.key || 'p1')
  const [lockKey, setLockKey] = React.useState(lockOptions[0]?.key || 'l1')

  const frameSelected = frameOptions.find((o) => o.key === frameKey) || frameOptions[0]
  const handleSelected = handleOptions.find((o) => o.key === handleKey) || handleOptions[0]
  const trimSelected = trimOptions.find((o) => o.key === trimKey) || trimOptions[0]
  const lockSelected = lockOptions.find((o) => o.key === lockKey) || lockOptions[0]

  // Fade-in on every src swap (type or colour)
  const [loaded, setLoaded] = React.useState(true)
  React.useEffect(() => {
    setLoaded(false)
  }, [activeImg])


  // --- HERO hotspots (clickable bubbles) -------------------------------------
  const heroHotspots = React.useMemo(
    () => [
      {
        id: 'fire',
        title: txt('internalDoors.hero.fire.h', 'Fire resistance'),
        body: txt(
          'internalDoors.hero.fire.p',
          'Higher fire rating options are available depending on configuration and certificates.'
        ),
      },
      {
        id: 'sound',
        title: txt('internalDoors.hero.sound.h', 'Sound insulation'),
        body: txt(
          'internalDoors.hero.sound.p',
          'Good acoustic performance for more comfort at home or in the office.'
        ),
      },
      {
        id: 'water',
        title: txt('internalDoors.hero.water.h', 'Moisture resistant'),
        body: txt(
          'internalDoors.hero.water.p',
          'Suitable for rooms with higher humidity (bathrooms, utility spaces).'
        ),
      },
      {
        id: 'coat',
        title: txt('internalDoors.hero.coating.h', 'Coating options'),
        body: txt(
          'internalDoors.hero.coating.p',
          'Available in different colours, decors and textures.'
        ),
        swatches: ['#E7E5E4', '#111827', '#C7A56B', '#D1D5DB', '#A3B18A', '#6B7280', '#F5F5F4'],
      },
      {
        id: 'kit',
        title: txt('internalDoors.hero.kit.h', 'Complete set'),
        body: txt(
          'internalDoors.hero.kit.p',
          'Delivered as a set with frame, fittings and trims.'
        ),
      },
      {
        id: 'wpc',
        title: txt('internalDoors.hero.wpc.h', 'WPC material'),
        body: txt(
          'internalDoors.hero.wpc.p',
          'Wood–polymer composite for high durability and long service life.'
        ),
      },
    ],
    [txt]
  )

  const [openHotspot, setOpenHotspot] = React.useState(null)

  // ESC closes any open hotspot
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenHotspot(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="id">
      {/* HERO (feature banner) */}
      <section className="id-intro">
        <div className="container id-wide">
          <div className="id-intro-head">
            <h1 className="id-title">{txt('internalDoors.title', 'Internal doors')}</h1>
            <p className="id-lead">
              {txt(
                'internalDoors.lead',
                'Modern internal doors with curated finishes. Switch door type and preview colour presets instantly.'
              )}
            </p>

            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>
                {txt('nav.getOffer', 'Get an Offer')}
              </button>
              <button className="btn ghost" onClick={openQuestion}>
                {txt('nav.askQuestion', 'Ask a Question')}
              </button>
            </div>
          </div>

          <div className="id-intro-banner" aria-label={txt('internalDoors.heroBanner.aria', 'Door features overview')}>
            <div className="id-intro-media">
              <img
                className="id-intro-bg"
                src={asset('internal-doors/clear.png')}
                alt=""
                aria-hidden="true"
                loading="eager"
                onError={(e) => {
                  const img = e.currentTarget
                  const step = Number(img.dataset.step || '0')

                  // Try a couple of common locations for the hero image before falling back.
                  if (step === 0) {
                    img.dataset.step = '1'
                    img.src = asset('clear.png')
                    return
                  }

                  img.onerror = null
                  img.src = activeImg || fallback
                }}
              />
              <div className="id-intro-shade" aria-hidden="true" />
            </div>

            <div
              className="id-intro-overlay"
              role="presentation"
              onClick={() => setOpenHotspot(null)}
            >
              {heroHotspots.map((h) => {
                const isOpen = openHotspot === h.id
                return (
                  <div
                    key={h.id}
                    className={[
                      'id-hotspot',
                      `id-hotspot--${h.id}`,
                      isOpen && 'is-open',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="id-bubble"
                      onClick={() => setOpenHotspot((cur) => (cur === h.id ? null : h.id))}
                      aria-expanded={isOpen}
                      aria-controls={`id-pop-${h.id}`}
                      title={h.title}
                    >
                      <span className="id-bubble-label">{h.title}</span>
                    </button>

                    {isOpen && (
                      <div
                        id={`id-pop-${h.id}`}
                        className="id-pop"
                        role="dialog"
                        aria-label={h.title}
                      >
                        <button
                          type="button"
                          className="id-pop-close"
                          aria-label={txt('common.close', 'Close')}
                          onClick={() => setOpenHotspot(null)}
                        >
                          ✕
                        </button>
                        <div className="id-pop-h">{h.title}</div>
                        <div className="id-pop-p">{h.body}</div>

                        {h.id === 'coat' && Array.isArray(h.swatches) && (
                          <div
                            className="id-intro-swatches"
                            aria-label={txt('internalDoors.hero.coating.aria', 'Example finishes')}
                          >
                            {h.swatches.map((c) => (
                              <span
                                key={c}
                                className="id-intro-swatch"
                                style={{ '--sw': c }}
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        )}

                        {h.id === 'kit' && (
                          <div className="id-pop-media">
                            <img
                              src={asset('internal-doors/kit.png')}
                              alt={txt('internalDoors.hero.kit.mediaAlt', 'Frame, fittings and trims illustration')}
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const step = Number(img.dataset.step || '0')
                                if (step === 0) {
                                  img.dataset.step = '1'
                                  img.src = asset('kit.png')
                                  return
                                }
                                img.onerror = null
                                img.src = fallback
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CONFIG + PREVIEW (Image LEFT, Info RIGHT) */}
      <section>
        <div className="container id-wide">
          <div className="id-pane">
            <h2 className="id-h2">{txt('internalDoors.preview.h', 'Choose your door')}</h2>
            <p className="id-muted">
              {txt(
                'internalDoors.preview.p2',
                'Use the Door Type toggle to swap styles. Then use the swatches on the image to change the finish.'
              )}
            </p>

            <div className="id-showcase" aria-label="Internal doors preview and configuration">
              {/* LEFT: big image */}
              <div className="id-showcase-media">
                <div className="id-preview id-preview--tall" aria-label="Door preview">
                  <img
                    className={['id-preview-img', loaded && 'is-loaded'].filter(Boolean).join(' ')}
                    src={activeImg}
                    alt={txt('internalDoors.preview.alt', 'Internal door preview')}
                    onLoad={() => setLoaded(true)}
                    onError={(e) => {
                      e.currentTarget.src = fallback
                    }}
                  />

                  <div className="id-preview-tag">{typeCopy[typeKey]?.tag}</div>

                  <ColorPicker
                    options={activeOptions}
                    value={activeFinishKey}
                    onChange={setActiveFinishKey}
                    pillBg={selected?.pillBg}
                    ariaLabel={
                      typeKey === 'wallpaper'
                        ? txt('internalDoors.preview.ariaPanel', 'Panel finish')
                        : txt('internalDoors.preview.ariaDoor', 'Door colour')
                    }
                    position="bottom-right"
                  />

                  <div className="id-preview-badge">{selected?.label}</div>
                </div>
              </div>
              {/* RIGHT (desktop) / BELOW IMAGE (mobile): door type */}
              <div className="id-showcase-controls">
                <div className="id-sub">{txt('internalDoors.types.h', 'Door type')}</div>
                <TypeTabs
                  items={typeItems}
                  value={typeKey}
                  onChange={(k) => setTypeKey(k)}
                  ariaLabel={txt('internalDoors.types.aria', 'Door type')}
                />
                <p className="id-type-desc">{typeCopy[typeKey]?.desc}</p>
              </div>

              {/* Details */}
              <div className="id-showcase-details">
                <div className="id-sub">{txt('internalDoors.details.h', 'What’s included')}</div>
                <ul className="id-list">
                  {(typeCopy[typeKey]?.features || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>

                <div className="id-sub mt-6">{txt('internalDoors.selected.h', 'Selected finish')}</div>
                <div className="id-selected">
                  <span className="id-swatch" style={{ '--sw': selected?.swatch }} aria-hidden="true" />
                  <div>
                    <div className="id-selected-name">{selected?.label}</div>
                    <div className="id-selected-meta">{txt('internalDoors.selected.meta', 'More colours available on request.')}</div>
                  </div>

                </div>

                <div className="row mt-6">
                  <button className="btn" onClick={openOffer}>
                    {txt('internalDoors.cta', 'Request a doors quote')}
                  </button>
                </div>

                <div className="id-hint">
                  {txt(
                    'internalDoors.hint2',
                    'Tip: Add more colours by adding objects to the relevant options array (see comments in InternalDoors.jsx).'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HARDWARE CONFIG (bottom section) */}
      <section>
        <div className="container id-wide">
          <div className="id-hw">
            <h2 className="id-h2">{txt('internalDoors.hardware.h', 'Окомплектовка')}</h2>
            <p className="id-muted">
              {txt(
                'internalDoors.hardware.p',
                'Изберете каса, дръжка, первази и брава. (Снимките са примерни — заменете ги с вашите изображения.)'
              )}
            </p>

            <div className="id-hw-grid">
              <ConfigGroup
                title={txt('internalDoors.hardware.frame.h', 'Каса')}
                hint={txt('internalDoors.hardware.frame.hint', 'Размер / ширина на касата')}
                options={frameOptions}
                value={frameKey}
                onChange={setFrameKey}
                ariaLabel={txt('internalDoors.hardware.frame.aria', 'Избор на каса')}
                fallbackSrc={fallback}
              />

              <ConfigGroup
                title={txt('internalDoors.hardware.handle.h', 'Дръжка')}
                hint={txt('internalDoors.hardware.handle.hint', 'Модел на дръжката')}
                options={handleOptions}
                value={handleKey}
                onChange={setHandleKey}
                ariaLabel={txt('internalDoors.hardware.handle.aria', 'Избор на дръжка')}
                fallbackSrc={fallback}
              />

              <ConfigGroup
                title={txt('internalDoors.hardware.trim.h', 'Перваз модели')}
                hint={txt('internalDoors.hardware.trim.hint', 'Модел на перваза (обкантване)')}
                options={trimOptions}
                value={trimKey}
                onChange={setTrimKey}
                ariaLabel={txt('internalDoors.hardware.trim.aria', 'Избор на перваз')}
                fallbackSrc={fallback}
              />

              <ConfigGroup
                title={txt('internalDoors.hardware.lock.h', 'Брава')}
                hint={txt('internalDoors.hardware.lock.hint', 'Тип заключване')}
                options={lockOptions}
                value={lockKey}
                onChange={setLockKey}
                ariaLabel={txt('internalDoors.hardware.lock.aria', 'Избор на брава')}
                fallbackSrc={fallback}
              />
            </div>

            <div className="id-hw-summary" aria-label={txt('internalDoors.hardware.summaryAria', 'Избрани опции')}
            >
              <div className="id-hw-pill">
                {txt('internalDoors.hardware.summary.frame', 'Каса')}: <strong>{frameSelected?.label}</strong>
              </div>
              <div className="id-hw-pill">
                {txt('internalDoors.hardware.summary.handle', 'Дръжка')}: <strong>{handleSelected?.label}</strong>
              </div>
              <div className="id-hw-pill">
                {txt('internalDoors.hardware.summary.trim', 'Перваз')}: <strong>{trimSelected?.label}</strong>
              </div>
              <div className="id-hw-pill">
                {txt('internalDoors.hardware.summary.lock', 'Брава')}: <strong>{lockSelected?.label}</strong>
              </div>
            </div>

            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>
                {txt('internalDoors.hardware.cta', 'Изпрати запитване с избраните опции')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section>
        <div className="container id-why">
          <div className="id-why-h">{txt('internalDoors.why.h', 'Why source doors through us')}</div>
          <ul className="id-why-list">
            <li>{txt('internalDoors.why.li1', 'Matched finishes across floors, panels, and furniture packs.')}</li>
            <li>{txt('internalDoors.why.li2', 'Lead time coordination with delivery & installation.')}</li>
            <li>{txt('internalDoors.why.li3', 'Clear specs: hinges, locks, fire rating, acoustics.')}</li>
          </ul>
        </div>
      </section>
    </main>
  )
}

// The delivery calculator's strings, in the three languages, as the tests render with them:
// the real content.calculator of src/content/{bg,en,el}/delivery.js, not a copy, so the
// calculator tests (and their "no figure is typed into the strings" guard) check what ships.
// The keys are documented at the top of DeliveryCalculator.jsx.
import bg from '../../content/bg/delivery.js'
import en from '../../content/en/delivery.js'
import el from '../../content/el/delivery.js'

export const CALCULATOR_STRINGS = { bg: bg.calculator, en: en.calculator, el: el.calculator }

# Catalogue → configurator pipeline

Rebuilds the Box house configurator's option data and thumbnails from the
printed catalogue PDF, so the site can never drift from the catalogue.

Run in order, from this directory, with the catalogue PDF path set at the top
of `extract.py` and `photos.py`:

```bash
python extract.py      # swatch grids -> extracted/, manifest.json
python photos.py       # product photography + PET colours -> manifest-photos.json
python install.py      # convert everything to webp under public/box-config/thumbs
python gen_catalog.py  # write src/content/shared/boxConfiguratorOptions.js
```

Requires `pymupdf` and `pillow`.

## Shipping the catalogue as a public download

The catalogue is also served from `public/modular-builds/` as the "Бокс" brochure
on the modular houses page. Do not put the Canva export there directly — it is
82.5MB, because Canva encodes photographs as lossless PNG (76MB of the file).

```bash
python compress_brochure.py "<source.pdf>" "../../public/modular-builds/Разгъваеми “Бокс” Къща.pdf"
```

That re-encodes the photography and leaves the drawings alone: 82.5MB -> 16.5MB
with no visible change. It renders every page before and after and reports any
that moved, because the two failure modes here are both visible and neither is
obvious in advance — flattening cut-outs onto white leaves rectangles on the
warm off-white pages, and JPEG rings around the dimension text on the drawing
pages.

## How the pairing works

Each swatch grid prints a code next to its artwork. `extract.py` matches images
to codes by global nearest-neighbour assignment on centre distance — labels sit
above the artwork on some pages and below it on others, so it can't assume a
side. Crops come from a high-DPI page render rather than the embedded image
streams, because several grids use soft masks (which extract onto black) and
the flooring and door art is placed through a transform.

`photos.py` covers the pages that carry no per-image code (bathrooms, kitchens,
vanities, sinks, doors, window systems). Those options are identified by their
position in the card layout, so its crop boxes are hand-read off the rendered
pages and listed explicitly.

## Known catalogue gaps

These are limitations of the source document, not of the pipeline:

- Bathroom and kitchen cards print `код ———` and placeholder body copy. Codes
  are ours: Б1–Б9 and К1–К5, following the К7 / К8 the catalogue already uses.
  Descriptions are still outstanding.
- Bathrooms 7–9: the section intro says they carry a surcharge, every card says
  `включено`, and no figure is printed. All nine are included — client confirmed.
- Kitchen variants 6 and 9 are named in headings but have no card, and do not
  exist — client confirmed. Seven kitchens ship (К1–К5, К7, К8).
- The PET colour page claims 43 colours and shows 38; the included vanity page
  claims 6 models and shows 4. The shipped counts follow the artwork.
- No price is printed for PET cabinet colours, interior IP panels, herringbone
  flooring, or vanity units over 600 mm. These carry `onRequest: true`.
- Flooring captions on p.46 wrap, which shifted four names by one column;
  corrected via `CODE_NAME_OVERRIDES` in `gen_catalog.py`.

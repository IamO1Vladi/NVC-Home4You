---
name: catalogue
description: How the printed house catalogue reaches the site — where the generated option data lives, how to answer questions about models, prices and finishes, and how to regenerate it from a new catalogue PDF edition. Use whenever a task touches box house models, prices, finishes, decors, configurator options, or the catalogue PDF itself.
---

# The catalogue

## Read this first: never open the PDF

The catalogue PDF is ~82MB and 57 pages. **You almost never need it.**
`scripts/catalogue/` already distilled it into two generated files, which are smaller,
structured, priced and translated:

| File | Size | Holds | Authored how |
|---|---|---|---|
| `src/content/shared/boxConfiguratorOptions.js` | 52KB | Finish swatches: facade decors, floors, UV panels, benchtops, interior panels, decking, PET colours | **Generated** by `gen_catalog.py` |
| `src/content/shared/boxConfiguratorCatalog.js` | 25KB | Models, prices, dimensions, floor plans, terrace and glazing options | **Hand-authored**, imports the above |

Answer from those. Opening the PDF to check a price is slower, and these files are what the
site actually serves — if the two ever disagree, the site is showing the file, not the PDF.

The distinction between them matters when editing:

- **`boxConfiguratorOptions.js` must never be hand-edited.** It carries a generated-file
  header; edit `scripts/catalogue/` and regenerate, or the next run silently reverts you.
- **`boxConfiguratorCatalog.js` is edited by hand**, but every value in it still comes from
  the printed catalogue. It is the model and pricing layer the generator does not produce.

## What is in there

Three models, in `boxConfiguratorCatalog.js`:

| Model | Area | Base | With roof + veranda | Frame | Weight | Plans |
|---|---|---|---|---|---|---|
| 37 | 37 m² | €14,000 | €16,700 | 3.0 mm | 6,000 kg | A1–A6 |
| 58 | 58 m² | €23,000 | €25,500 | 3.5 mm | 9,800 kg | B1–B6 |
| 73 | 73 m² | €26,500 | €28,000 | 4.0 mm | 12,000 kg | C1–C6 |

Finish counts, in `boxConfiguratorOptions.js` — useful as a checksum after regenerating:
135 facade decors (`D-*`), 30 UV panels (`UV-*`), 24 benchtops, 23 interior panels (`IP-*`),
21 vinyl floors, 6 herringbone (`YG*`), 8 decking (`T-*`), 38 PET cabinet colours.

Codes are the catalogue's own, so a code in a customer email (`D-1042`, `ВР-03`) can be
looked up directly.

## Answering a customer-facing question

Send the **narrow slice**, never the whole file. All 77KB is ~20k tokens, and it buries the
one model the customer asked about in a list of everything the company sells — that costs
answer quality before it costs money.

The lead already says which slice:

- `Lead.HouseId` → the exact `House` row in SQL (title, description, price). This is a real
  foreign key; see `LeadService.ResolveHouseIdAsync`.
- `Lead.CustomModel` and the `LeadActivity` thread → the free-text case, where no catalogue
  row exists.
- `Lead.Locale` → which language to answer in.

## Two catalogues, not one

Do not confuse them:

- **Box houses** — the configurator. Generated from the PDF into the two files above.
  Models are `37` / `58` / `73`, which are **square metres, not record ids**.
- **The gallery** — `House` rows in Azure SQL, served by `/api/gallery`, managed in the
  admin panel. Prefab houses, wagons, modular houses and garages.

A gallery house has a real id; a configurator model does not. This is why
`BoxHouseConfiguratorPage.jsx` deliberately sends **no** `modelId` on a configurator
enquiry — writing `37` there would link the lead to whichever house happens to hold record
id 37.

Related: a house's **public** id is `QuickbaseRecordId ?? Id` (`SqlGalleryService`), not its
SQL primary key. Anything mapping an id back to a house must invert that exactly.

## Regenerating from a new edition

Only when the client supplies a genuinely newer PDF. Check the file date first — the current
edition is dated **2026-08-09** and was integrated in commit `c614c14` on 2026-08-11.

From `scripts/catalogue/`, with the PDF path set at the top of `extract.py` and `photos.py`:

```bash
python extract.py      # swatch grids -> extracted/, manifest.json
python photos.py       # product photography + PET colours -> manifest-photos.json
python install.py      # convert everything to webp under public/box-config/thumbs
python gen_catalog.py  # write src/content/shared/boxConfiguratorOptions.js
```

Needs `pymupdf` and `pillow`.

This regenerates the **finishes only**. Model prices, dimensions and floor plans live in the
hand-authored `boxConfiguratorCatalog.js` and have to be reconciled against the new edition
by hand — a price change there will not appear on its own.

**`extract.py` hardcodes page numbers** (the `GROUPS` map, pages 24–57). A re-laid-out
edition moves them, and the failure is silent — it crops the wrong artwork rather than
erroring. After any regeneration, check the printed `matched=`/`unmatched=` counts against
the checksum table above before trusting the output.

`scripts/catalogue/README.md` documents the known gaps in the source document — placeholder
bathroom and kitchen codes, counts where the artwork disagrees with the printed heading, and
options with no printed price. Read it before concluding the pipeline has a bug; several
"wrong" outputs are faithful to a catalogue that contradicts itself.

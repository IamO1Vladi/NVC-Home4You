#!/usr/bin/env python
"""Crop the catalogue's product photography and sample its vector swatches.

Unlike the swatch grids these pages carry no per-image code, so options are
identified by their position in the card layout. Crop boxes are in PDF points,
read off the rendered pages; several of these images are placed through a
transform whose reported rect doesn't match what's drawn.
"""
import json
import os
import re
import sys

import pymupdf

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"C:/Users/kiril/Downloads/House catalogue NEW.pdf"
OUT = "extracted"
DPI = 300

# slug -> list of (page, code, crop rect in PDF points)
CROPS = {
    "window-type": [
        (25, "W-PVC-DOUBLE", (49, 120, 203, 250)),
        (25, "W-ALU-DOUBLE", (49, 252, 203, 378)),
        (25, "W-ALU-TRIPLE", (60, 380, 195, 515)),
    ],
    "window-system": [
        (26, "WS-65", (60, 90, 140, 205)),
        (26, "WS-70", (309, 90, 384, 205)),
        (26, "WS-80", (563, 90, 650, 205)),
    ],
    "glazing": [
        (27, "GZ-PANORAMA", (103, 133, 275, 326)),
        (27, "GZ-SLIDING", (344, 131, 492, 318)),
        (27, "GZ-BIFOLD", (608, 132, 743, 314)),
    ],
    "bathroom": [
        (28, "BA-1", (62, 126, 285, 380)), (28, "BA-2", (307, 102, 535, 362)),
        (28, "BA-3", (558, 121, 780, 385)),
        (29, "BA-4", (62, 128, 285, 377)), (29, "BA-5", (309, 108, 534, 362)),
        (29, "BA-6", (558, 125, 780, 379)),
        (30, "BA-7", (62, 123, 288, 390)), (30, "BA-8", (310, 128, 532, 385)),
        (30, "BA-9", (558, 128, 781, 386)),
    ],
    "vanity": [
        (32, "BV-01", (48, 80, 178, 338)), (32, "BV-02", (252, 80, 388, 338)),
        (32, "BV-03", (455, 80, 600, 338)), (32, "BV-04", (642, 80, 790, 338)),
        (33, "BV-05", (94, 79, 191, 245)), (33, "BV-06", (274, 79, 374, 245)),
        (33, "BV-07", (457, 79, 569, 245)), (33, "BV-08", (644, 79, 749, 245)),
        (33, "BV-09", (104, 288, 198, 454)), (33, "BV-10", (295, 288, 396, 454)),
    ],
    "vanity-size": [
        (34, "BVS-1", (50, 70, 303, 385)), (34, "BVS-2", (303, 77, 534, 386)),
        (34, "BVS-3", (543, 65, 790, 394)),
    ],
    "bathroom-door": [
        (35, "BD-01", (153, 86, 319, 410)), (35, "BD-02", (567, 85, 727, 409)),
        (36, "BD-03", (45, 77, 226, 349)), (36, "BD-04", (234, 80, 410, 344)),
        (36, "BD-05", (422, 81, 597, 344)), (36, "BD-06", (604, 74, 787, 349)),
    ],
    "kitchen": [
        (37, "K-1", (62, 166, 285, 338)), (37, "K-2", (310, 166, 533, 338)),
        (37, "K-3", (557, 166, 779, 338)),
        (38, "K-4", (32, 151, 305, 353)), (38, "K-5", (526, 151, 799, 353)),
        (39, "K-7", (39, 144, 333, 384)), (39, "K-8", (497, 144, 792, 384)),
    ],
    "kitchen-sink": [
        (42, "KS-1", (34, 107, 245, 266)), (42, "KS-2", (241, 110, 429, 266)),
        (42, "KS-3", (398, 110, 620, 275)), (42, "KS-4", (598, 107, 807, 266)),
    ],
    "exterior-door": [
        (54, "V-01", (144, 138, 279, 415)), (54, "V-02", (481, 144, 727, 414)),
    ],
}

# The nine window colour/decor swatches sit in one evenly pitched row.
WINDOW_COLOURS = [(26, f"WC-{i + 1}",
                   (27.4 + i * 87.8, 477, 27.4 + i * 87.8 + 77.7, 516))
                  for i in range(9)]


def sample_pet_colours(page):
    """PET cabinet colours are vector fills -- read them off the render."""
    pix = page.get_pixmap(dpi=DPI)
    scale = DPI / 72
    out = {}
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            text = "".join(s["text"] for s in line["spans"]).strip()
            m = re.match(r"^(\d{4})\s*(G|F|мет\.)$", text)
            if not m:
                continue
            x0, y0, x1, y1 = line["bbox"]
            px = int((x0 + 20) * scale)
            py = int((y0 - 25) * scale)          # swatch sits above its label
            r, g, b = pix.pixel(px, py)[:3]
            finish = {"G": "gloss", "F": "matte"}.get(m.group(2), "metallic")
            out[m.group(1)] = {"hex": "#%02x%02x%02x" % (r, g, b),
                               "finish": finish}
    return out


def trim_caption(page, rect):
    """Pull the bottom edge up above any caption the crop would include."""
    x0, y0, x1, y1 = rect
    mid = y0 + (y1 - y0) * 0.55
    tops = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            if not "".join(s["text"] for s in line["spans"]).strip():
                continue
            tx0, ty0, tx1, ty1 = line["bbox"]
            if ty0 > mid and ty0 < y1 and tx1 > x0 + 4 and tx0 < x1 - 4:
                tops.append(ty0)
    return (x0, y0, x1, min(y1, min(tops) - 3) if tops else y1)


def main():
    doc = pymupdf.open(PDF)
    manifest = {}
    jobs = dict(CROPS)
    jobs["window-colour"] = WINDOW_COLOURS

    for slug, items in jobs.items():
        folder = os.path.join(OUT, slug)
        os.makedirs(folder, exist_ok=True)
        for pno, code, rect in items:
            page = doc[pno - 1]
            rect = trim_caption(page, rect)
            pix = page.get_pixmap(dpi=DPI, clip=pymupdf.Rect(*rect) & page.rect)
            path = os.path.join(folder, f"{code}.png")
            pix.save(path)
            manifest.setdefault(slug, {})[code] = {
                "page": pno, "file": path.replace("\\", "/"),
                "w": pix.width, "h": pix.height}
        print(f"{slug:16s} {len(items):3d}")

    pet = sample_pet_colours(doc[39])
    manifest["pet-colour"] = pet
    print(f"{'pet-colour':16s} {len(pet):3d}")

    with open("manifest-photos.json", "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()

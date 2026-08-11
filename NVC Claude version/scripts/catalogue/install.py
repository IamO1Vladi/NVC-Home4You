#!/usr/bin/env python
"""Convert the extracted catalogue artwork to webp under public/box-config.

Everything comes from the catalogue except the kitchen sinks and bathroom
vanities, where the supplied photography is the same product at a higher
resolution and maps to a catalogue code unambiguously.
"""
import json
import os
import re
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:/NVCHome4Youfinalversion/NVCV5/NVC Claude version"
DEST = os.path.join(REPO, "public", "box-config", "thumbs")
SUPPLIED = r"C:/Users/kiril/Downloads/Уебсайт - конфигуратор снимки"

MAX_EDGE = 640
QUALITY = 82

# extracted group -> folder under thumbs/
FROM_CATALOGUE = {
    "panel": "panels",
    "uv": "uv",
    "bench": "kitchen-bench",
    "floor": "floor",
    "herringbone": "herringbone",
    "interior-panel": "interior-panels",
    "decking": "decking",
    "frame-colour": "frame-colours",
    "window-type": "windows",
    "window-system": "windows",
    "window-colour": "windows",
    "glazing": "windows",
    "bathroom": "bathroom",
    "kitchen": "kitchen",
    "bathroom-door": "bathroom-doors",
    "interior-door": "interior-doors",
    "armoured-door": "armoured-doors",
    "exterior-door": "exterior-doors",
}

# code -> file in the supplied photo folders, for the two categories where the
# supplied shot is the same product at higher resolution
SUPPLIED_MAP = {
    "kitchen-sinks": {
        "KS-1": ("Kitchen sinks", 0),   # double bowl, stainless -- standard
        "KS-2": ("Kitchen sinks", 3),   # single bowl, stainless -- standard
        "KS-3": ("Kitchen sinks", 1),   # double bowl, black -- +100 EUR
        "KS-4": ("Kitchen sinks", 2),   # single bowl, black -- +50 EUR
    },
    "vanity": {
        "BV-01": ("Bathroom sink with cabinets", 2),    # X1117 navy
        "BV-02": ("Bathroom sink with cabinets", 1),    # X1117 cream
        "BV-03": ("Bathroom sink with cabinets", 15),   # X1270 black
        "BV-04": ("Bathroom sink with cabinets", 3),    # X1270 white
        "BV-05": ("Bathroom sink with cabinets", 0),    # X1271
        "BV-06": ("Bathroom sink with cabinets", 7),    # X1270
        "BV-07": ("Bathroom sink with cabinets", 9),    # X1272
        "BV-08": ("Bathroom sink with cabinets", 8),    # X1212
        "BV-09": ("Bathroom sink with cabinets", 10),   # X1117 dark
        "BV-10": ("Bathroom sink with cabinets", 12),   # X1117 light
        "BVS-1": ("Bathroom sink with cabinets", 11),   # length variants
        "BVS-2": ("Bathroom sink with cabinets", 14),
        "BVS-3": ("Bathroom sink with cabinets", 13),
    },
}


# Cyrillic catalogue codes (БД-01, ВР-02, М-01, В-01) make brittle URLs, and
# mixing them with Latin filenames silently 404s. Filenames are always ASCII
# lowercase; the printed code stays on the label.
TRANSLIT = {"Б": "b", "Д": "d", "В": "v", "Р": "r", "М": "m", "К": "k", "Т": "t"}


def slug(code):
    out = "".join(TRANSLIT.get(ch, ch) for ch in code)
    return re.sub(r"[^A-Za-z0-9._-]+", "-", out).strip("-").lower()


def supplied_files(folder):
    path = os.path.join(SUPPLIED, folder)
    return [os.path.join(path, f) for f in sorted(os.listdir(path))
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]


def to_webp(src, dst):
    img = Image.open(src)
    if img.mode in ("RGBA", "LA", "P"):
        flat = Image.new("RGB", img.size, (255, 255, 255))
        img = img.convert("RGBA")
        flat.paste(img, mask=img.split()[-1])
        img = flat
    else:
        img = img.convert("RGB")
    if max(img.size) > MAX_EDGE:
        scale = MAX_EDGE / max(img.size)
        img = img.resize((max(1, round(img.width * scale)),
                          max(1, round(img.height * scale))), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    img.save(dst, "WEBP", quality=QUALITY, method=6)


def main():
    catalogue = json.load(open("manifest.json", encoding="utf-8"))
    photos = json.load(open("manifest-photos.json", encoding="utf-8"))
    both = {**catalogue, **photos}

    written = {}
    for group, folder in FROM_CATALOGUE.items():
        for code, meta in both.get(group, {}).items():
            dst = os.path.join(DEST, folder, f"{slug(code)}.webp")
            to_webp(meta["file"], dst)
            written.setdefault(folder, []).append(code)

    for folder, mapping in SUPPLIED_MAP.items():
        for code, (src_folder, index) in mapping.items():
            files = supplied_files(src_folder)
            dst = os.path.join(DEST, folder, f"{slug(code)}.webp")
            to_webp(files[index], dst)
            written.setdefault(folder, []).append(code)

    for folder in sorted(written):
        print(f"{folder:20s} {len(written[folder]):3d}")
    print("total", sum(len(v) for v in written.values()))


if __name__ == "__main__":
    main()

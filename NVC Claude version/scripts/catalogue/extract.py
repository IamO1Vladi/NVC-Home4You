#!/usr/bin/env python
"""Pull every catalogue swatch out of the PDF and pair it with its code.

Swatches are cropped out of a high-DPI page render rather than pulled from the
embedded image streams: several grids use soft masks (which extract onto black)
and the flooring/door art is placed with transforms, so the render is the only
source that matches what the catalogue actually shows.

Pairing is anchored on the code label printed with each swatch, matched to its
artwork by global nearest-neighbour assignment -- labels sit above the artwork
on some pages and below it on others.
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

# page -> (regex the code label must match, slug for the output folder)
GROUPS = {
    24: (r"^(Черно|Матовобяло|Светлосиво|Тъмносиво|Кафяво)$", "frame-colour"),
    31: (r"^(UV-\d+|ТЕРАЦО|[A-Z]{2}\d[\w\-]*)$", "uv"),
    41: (r"^(М-\d+|HF-\d+|JQL-\d+|JL-[\w\d]+|ZS-\d+.*)$", "bench"),
    43: (r"^D-\d+$", "panel"),
    44: (r"^D-\d+$", "panel"),
    45: (r"^D-\d+$", "panel"),
    46: (r"^D-\d+$", "panel"),
    47: (r"^D-\d+$", "panel"),
    48: (r"^D-\d+$", "panel"),
    49: (r"^D-\d+$", "panel"),
    50: (r"^D-\d+$", "panel"),
    51: (r"^\d{4}$", "floor"),
    52: (r"^YG\d+$", "herringbone"),
    53: (r"^ВР-\d+$", "interior-door"),
    55: (r"^БВ-\d+$", "armoured-door"),
    56: (r"^IP-\d+$", "interior-panel"),
}

# Pages whose artwork is placed through a transform, so the reported image
# rect is wrong. Cropped straight off the render instead: the swatch sits in a
# fixed box relative to its own label.
MANUAL = {
    57: ("decking", r"^T-\d+$", (0, -140, 59, -8)),
}


def code_lines(page, pattern):
    """Every text line on the page whose content is a code for this group."""
    found = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            text = "".join(s["text"] for s in line["spans"]).strip()
            # the PDF letter-spaces some labels; collapse before matching
            squashed = re.sub(r"\s+", "", text)
            if re.match(pattern, text) or re.match(pattern, squashed):
                x0, y0, x1, y1 = line["bbox"]
                found.append({"code": squashed, "x": (x0 + x1) / 2, "y": y0,
                              "x0": x0, "y0": y0})
    return found


def match(page, pattern):
    """Pair images with code labels by global nearest-neighbour assignment."""
    labels = code_lines(page, pattern)
    images = page.get_image_info(xrefs=True)

    texts = text_lines(page)

    costs = []
    for ii, info in enumerate(images):
        x0, y0, x1, y1 = info["bbox"]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        for li, lab in enumerate(labels):
            costs.append((abs(lab["x"] - cx) + abs(lab["y"] - cy), ii, li))
    costs.sort()

    taken_i, taken_l, pairs = set(), set(), []
    for _, ii, li in costs:
        if ii in taken_i or li in taken_l:
            continue
        taken_i.add(ii)
        taken_l.add(li)
        lab = labels[li]
        x0, y0, x1, y1 = images[ii]["bbox"]
        # Artwork routinely bleeds past its own caption, so trim the crop back
        # to the label rather than baking the code text into the swatch.
        if lab["y"] > (y0 + y1) / 2:
            y1 = min(y1, lab["y"] - 3)
            # ...and up into the row above, whose caption would otherwise sit
            # along the top edge. Clear any text the crop would still overlap
            # -- names wrap to two lines, so a fixed offset isn't enough.
            overlapping = [
                t["y1"] for t in texts
                if t["y1"] < y1 - 18 and t["y1"] > y0
                and t["x1"] > x0 + 4 and t["x0"] < x1 - 4
            ]
            if overlapping:
                y0 = max(y0, max(overlapping) + 2)
        else:
            y0 = max(y0, lab["y"] + 12)
        pairs.append((lab["code"], (x0, y0, x1, y1)))
    return pairs, [l["code"] for i, l in enumerate(labels) if i not in taken_l]


def text_lines(page):
    """Every text line on the page with its box, for clamping crops."""
    lines = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            text = "".join(s["text"] for s in line["spans"]).strip()
            if text:
                x0, y0, x1, y1 = line["bbox"]
                lines.append({"text": text, "x": (x0 + x1) / 2, "y": y0,
                              "x0": x0, "x1": x1, "y1": y1})
    return lines


def name_under(lines, code_x, code_y):
    """The colour name printed directly beneath a code label."""
    best, best_dy = None, None
    for ln in lines:
        dy = ln["y"] - code_y
        if not (4 < dy < 22) or abs(ln["x"] - code_x) > 60:
            continue
        if best_dy is None or dy < best_dy:
            best, best_dy = ln["text"], dy
    return best or ""


def save_crop(page, rect, path):
    """Crop the page render to `rect` (PDF points) and write a PNG."""
    pix = page.get_pixmap(dpi=DPI, clip=pymupdf.Rect(*rect))
    pix.save(path)
    return pix.width, pix.height


def main():
    doc = pymupdf.open(PDF)
    manifest = {}

    for pno, (pattern, slug) in sorted(GROUPS.items()):
        page = doc[pno - 1]
        pairs, orphans = match(page, pattern)
        folder = os.path.join(OUT, slug)
        os.makedirs(folder, exist_ok=True)
        lines = text_lines(page)
        labels = {l["code"]: l for l in code_lines(page, pattern)}
        for code, bbox in pairs:
            # clamp to the page so a bleeding placement can't blow up the crop
            rect = pymupdf.Rect(*bbox) & page.rect
            path = os.path.join(folder, f"{code.replace('/', '-')}.png")
            w, h = save_crop(page, rect, path)
            lab = labels[code]
            manifest.setdefault(slug, {})[code] = {
                "page": pno, "file": path.replace("\\", "/"), "w": w, "h": h,
                "name": name_under(lines, lab["x"], lab["y"])}
        print(f"p{pno:02d} {slug:16s} matched={len(pairs):3d} unmatched={orphans}")

    for pno, (slug, pattern, off) in sorted(MANUAL.items()):
        page = doc[pno - 1]
        folder = os.path.join(OUT, slug)
        os.makedirs(folder, exist_ok=True)
        labels = code_lines(page, pattern)
        for lab in labels:
            rect = (lab["x0"] + off[0], lab["y0"] + off[1],
                    lab["x0"] + off[2], lab["y0"] + off[3])
            path = os.path.join(folder, f"{lab['code']}.png")
            w, h = save_crop(page, rect, path)
            manifest.setdefault(slug, {})[lab["code"]] = {
                "page": pno, "file": path.replace("\\", "/"), "w": w, "h": h}
        print(f"p{pno:02d} {slug:16s} matched={len(labels):3d} (manual crop)")

    with open("manifest.json", "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print("\ntotals:", {k: len(v) for k, v in manifest.items()})


if __name__ == "__main__":
    main()

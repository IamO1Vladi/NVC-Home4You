#!/usr/bin/env python
"""Shrink a Canva-exported catalogue PDF for the public site, without changing
how a single page looks.

Canva exports photographs as lossless PNG. That is what makes the 2026 house
catalogue 82.5MB for 57 pages -- 76MB of it is PNG-encoded photography, against
4MB of actual JPEG. Re-encoding those photographs is nearly the whole win.

Two things make the naive version visibly wrong, and both were caught by the
verification pass below rather than by reasoning:

  - The pages are a warm off-white (245, 242, 239), not white. Flattening a
    cut-out onto white leaves a bright rectangle around every drawing. The
    background is therefore sampled per page from the page itself.
  - The drawing pages are line art. JPEG rings around thin lines and small
    dimension text, and PNG already stores line art efficiently, so converting
    it costs quality and saves almost nothing. Images with few distinct colours
    are left alone.

Every page is rendered before and after and compared; anything above
FAIL_MEAN is reported so it can be looked at rather than assumed fine.

    python compress_brochure.py <source.pdf> <output.pdf>

Requires pymupdf and pillow, same as the rest of this directory.
"""
import collections
import io
import os
import sys

import pymupdf
from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8")

QUALITY = 84
MIN_GAIN = 0.85          # only swap when the JPEG is meaningfully smaller
CHECK_DPI = 72           # enough to catch a white box, cheap enough for 57 pages
FAIL_MEAN = 1.0          # mean channel difference per page, 0-255
LINE_ART_COLOURS = 4096  # fewer distinct colours than this == not a photograph


def render(path, dpi):
    """Every page as a PIL image, for before/after comparison."""
    doc = pymupdf.open(path)
    pages = []
    for page in doc:
        pix = page.get_pixmap(dpi=dpi)
        pages.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    doc.close()
    return pages


def page_backgrounds(rendered):
    """The dominant colour of each page -- what a cut-out actually sits on."""
    backgrounds = []
    for img in rendered:
        small = img.resize((max(1, img.width // 4), max(1, img.height // 4)))
        backgrounds.append(collections.Counter(small.getdata()).most_common(1)[0][0])
    return backgrounds


def compress(src, out):
    print("rendering baseline...")
    before = render(src, CHECK_DPI)
    backgrounds = page_backgrounds(before)
    print(f"page background sampled, e.g. p1={backgrounds[0]}")

    doc = pymupdf.open(src)
    seen = set()
    photos = flattened = line_art = untouched = 0

    for pno in range(len(doc)):
        page = doc[pno]
        bg = backgrounds[pno]

        for info in page.get_images(full=True):
            xref = info[0]
            if xref in seen:
                continue
            seen.add(xref)

            try:
                img = doc.extract_image(xref)
            except Exception:
                continue
            if img["ext"] != "png":
                continue

            raw = img["image"]
            smask = img.get("smask", 0)

            try:
                if smask:
                    # Rebuild colour + alpha so the cut-out can be composited.
                    base = pymupdf.Pixmap(doc, xref)
                    mask = pymupdf.Pixmap(doc, smask)
                    rgba = pymupdf.Pixmap(base, mask)
                    pil = Image.frombytes("RGBA", (rgba.width, rgba.height), rgba.samples)
                    base = mask = rgba = None
                else:
                    pil = Image.open(io.BytesIO(raw))
            except Exception:
                untouched += 1
                continue

            if pil.convert("RGB").getcolors(maxcolors=LINE_ART_COLOURS) is not None:
                line_art += 1
                continue

            transparent = smask or pil.mode in ("RGBA", "LA") or (
                pil.mode == "P" and "transparency" in pil.info)

            if transparent:
                rgba = pil.convert("RGBA")
                canvas = Image.new("RGB", rgba.size, bg)
                canvas.paste(rgba, mask=rgba.split()[3])
                encoded = canvas
            else:
                encoded = pil.convert("RGB")

            buf = io.BytesIO()
            encoded.save(buf, format="JPEG", quality=QUALITY, optimize=True, progressive=True)
            new = buf.getvalue()

            if len(new) >= len(raw) * MIN_GAIN:
                untouched += 1
                continue

            try:
                page.replace_image(xref, stream=new)
            except Exception as exc:
                print(f"  replace failed on xref {xref}: {exc}")
                untouched += 1
                continue

            if transparent:
                flattened += 1
            else:
                photos += 1

    doc.save(out, garbage=4, deflate=True, clean=True)
    doc.close()

    print(f"photographs -> JPEG:   {photos}")
    print(f"cut-outs flattened:    {flattened}")
    print(f"line art left as PNG:  {line_art}")
    print(f"left alone:            {untouched}")
    print(f"\n{os.path.getsize(src)/1e6:.1f} MB -> {os.path.getsize(out)/1e6:.1f} MB")

    print("\nverifying every page against the original...")
    after = render(out, CHECK_DPI)

    scored = []
    for i, (a, b) in enumerate(zip(before, after), start=1):
        if a.size != b.size:
            scored.append((999.0, i))
            continue
        hist = ImageChops.difference(a, b).convert("L").histogram()
        total = sum(hist)
        scored.append((sum(v * c for v, c in enumerate(hist)) / total, i))

    scored.sort(reverse=True)
    print("worst 8 pages by mean pixel difference (0-255):")
    for mean, pno in scored[:8]:
        flag = "  <-- LOOK AT THIS PAGE" if mean > FAIL_MEAN else ""
        print(f"  p{pno:<3} {mean:6.3f}{flag}")

    over = [s for s in scored if s[0] > FAIL_MEAN]
    print(f"\npages over {FAIL_MEAN}: {len(over)}")
    if over:
        print("A page over the threshold is not automatically wrong -- a photo-heavy")
        print("page picks up JPEG noise. Render it and look before shipping.")
    return len(over)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    compress(sys.argv[1], sys.argv[2])

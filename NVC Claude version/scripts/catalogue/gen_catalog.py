#!/usr/bin/env python
"""Emit the configurator's option data from the extracted catalogue manifests.

Writes src/content/shared/boxConfiguratorOptions.js -- the long coded lists
(135 facade panels, 30 UV decors, 24 benchtops, ...) that would be unreadable
maintained by hand. Prices and inclusion live here too, straight off the
catalogue pages.
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

REPO = r"D:/NVCHome4Youfinalversion/NVCV5/NVC Claude version"
TARGET = os.path.join(REPO, "src", "content", "shared", "boxConfiguratorOptions.js")

# Cyrillic codes make brittle URLs, so thumbnails are stored under an ASCII
# slug of the code (see install.py, which writes them the same way).
TRANSLIT = {"Б": "b", "Д": "d", "В": "v", "Р": "r", "М": "m", "К": "k", "Т": "t"}


def slug(code):
    out = "".join(TRANSLIT.get(ch, ch) for ch in code)
    return re.sub(r"[^A-Za-z0-9._-]+", "-", out).strip("-").lower()


# Average colour per thumbnail. The flooring, UV, benchtop and interior-panel
# photographs are near-identical pale grey at swatch size, so the picker needs
# a colour chip alongside the image to be usable.
SWATCHES = json.load(open("swatches.json", encoding="utf-8"))


def swatch_for(folder, code):
    return SWATCHES.get(folder, {}).get(slug(code), "")

# names the extractor caught mid-wrap, plus one grid heading it mistook for a name
NAME_FIXES = {
    "Скандинавск": "Скандинавски дъб",
    "Опушено": "Опушено бежово",
    "Каменно сив": "Каменно сив дъб",
    "Червена тухла,": "Червена тухла, сива фуга",
    "Антрацитен": "Антрацитен дъб",
    "К В А Р Ц": "",
}

EN = {
    "Ангелско бяло": "Angel white", "Антична сива тухла": "Antique grey brick",
    "Антрацитен дъб": "Anthracite oak", "Бледо бежов пясък": "Pale beige sand",
    "Бледо бежово": "Pale beige", "Борово дърво": "Pine wood",
    "Бял мрамор": "White marble", "Венге": "Wenge",
    "Виетнамско дърво": "Vietnamese wood", "Гланцово бяло": "Gloss white",
    "Двойна линия, сусам": "Double line, sesame", "Джаз бял мрамор": "Jazz white marble",
    "Едноцветен камък": "Single-tone stone", "Едрослоен дъб": "Coarse-grain oak",
    "Жълто терацо": "Yellow terrazzo", "Зебрано": "Zebrano",
    "Златен гранит": "Golden granite", "Златен дъб": "Golden oak",
    "Златно венге": "Golden wenge", "Каменно сив дъб": "Stone grey oak",
    "Каре, ситен мрамор": "Check, fine marble", "Класически дъб": "Classic oak",
    "Кремав пясък": "Cream sand", "Кремаво бежово": "Cream beige",
    "Махагон": "Mahogany", "Многоцветна тухла": "Multicolour brick",
    "Мъглив дъб": "Misty oak", "Наситено синьо": "Deep blue",
    "Натурален дъб": "Natural oak", "Натурален камък": "Natural stone",
    "Нефрит": "Jade", "Опушен рустик": "Smoked rustic",
    "Опушено бежово": "Smoked beige", "Оранжево": "Orange",
    "Палисандър": "Rosewood", "Планински бор": "Mountain pine",
    "Полярно бяло": "Polar white", "Пустинно жълто": "Desert yellow",
    "Пясъчен ясен": "Sand ash", "Светло кафяв пясък": "Light brown sand",
    "Светло сиво": "Light grey", "Сива тухла, бяла фуга": "Grey brick, white grout",
    "Сиво 7006": "Grey 7006", "Ситен мрамор": "Fine marble",
    "Скандинавски дъб": "Scandinavian oak", "Слонова кост": "Ivory",
    "Сребрист металик": "Silver metallic", "Сребърен дъб": "Silver oak",
    "Старинно сиво": "Antique grey", "Сусамов мрамор": "Sesame marble",
    "Сусамови точки": "Sesame dots", "Терацо": "Terrazzo",
    "Тревисто зелено": "Grass green", "Тухлено червен пясък": "Brick red sand",
    "Тухлено червено": "Brick red", "Тъмен бетон": "Dark concrete",
    "Тъмен дъб": "Dark oak", "Тъмен орех": "Dark walnut",
    "Тъмна череша": "Dark cherry", "Тъмно венге": "Dark wenge",
    "Червен гранит": "Red granite", "Червена тухла, сива фуга": "Red brick, grey grout",
    "Черен пясък": "Black sand", "Черен шист": "Black schist",
    "Черешов мрамор": "Cherry marble", "Сребърен дракон": "Silver dragon",
    "Рибешко бяло": "Fish white", "Облачно сиво": "Cloud grey",
    "Чисто бяло": "Pure white", "Бял нефрит": "White jade",
    "Ариста бяло": "Arista white", "Медов дъб": "Honey oak",
    "Тъмен венге": "Dark wenge", "Опушено сиво": "Smoked grey",
    "Пясъчен дъб": "Sand oak", "Меден орех": "Copper walnut",
    "Сребриста топола": "Silver poplar",
}

# code range -> series heading, in catalogue order
PANEL_SERIES = [
    ((1, 12), "Seven brick", "Седем тухли"),
    ((13, 21), "Three brick", "Три тухли"),
    ((22, 48), "Spray render · flat", "Пръскана мазилка · плосък"),
    ((49, 53), "Spray render · centre bevelled groove", "Пръскана мазилка · среден скосен канал"),
    ((54, 60), "Spray render · centre straight groove", "Пръскана мазилка · среден прав канал"),
    ((61, 65), "Wood grain · flat", "Дървесен слой · плосък"),
    ((66, 68), "Wood grain · double straight groove", "Дървесен слой · двоен прав канал"),
    ((69, 80), "Wood grain · centre bevelled groove", "Дървесен слой · среден скосен канал"),
    ((81, 85), "Wood grain · centre straight groove", "Дървесен слой · среден прав канал"),
    ((86, 100), "Flat panel", "Плосък панел"),
    ((101, 104), "Flat · centre straight groove", "Плосък · среден прав канал"),
    ((105, 107), "Flat · centre bevelled groove", "Плосък · среден скосен канал"),
    ((108, 110), "Flat · double bevelled groove", "Плосък · двоен скосен канал"),
    ((111, 113), "Flat · double straight groove", "Плосък · двоен прав канал"),
    ((114, 119), "Stone strips", "Каменни ивици"),
    ((120, 130), "Slat panel", "Ламелен панел"),
    ((131, 132), "Wave", "Вълнообразен"),
    ((133, 135), "Oak grain", "Дъбов слой"),
]

FLOOR_SERIES = [
    ((7005, 7009), "7000 series · Warm wood", "Серия 7000 · Топло дърво"),
    ((8005, 8009), "8000 series · Classic wood", "Серия 8000 · Класическо дърво"),
    ((9005, 9012), "9000 series · Light and grey wood", "Серия 9000 · Светло и сиво дърво"),
    ((9013, 9016), "9000 series · Stone and marble", "Серия 9000 · Камък и мрамор"),
]

IP_SERIES = [
    ((1, 12), "Smooth and matte", "Гладки и матови"),
    ((13, 16), "Wood decors", "Дървесни декори"),
    ((17, 19), "Textured", "Структурни"),
    ((20, 23), "Solid colours", "Плътни цветове"),
]

MARBLE_NAMES = {
    "М-01": "Сребърен дракон", "М-02": "Рибешко бяло", "М-03": "Облачно сиво",
    "М-04": "Чисто бяло", "М-05": "Бял нефрит", "М-06": "Ариста бяло",
}

HERRINGBONE_NAMES = {
    "YG5716": "Медов дъб", "YG5711": "Тъмен венге", "YG5715": "Опушено сиво",
    "YG5713": "Златен дъб", "YG5712": "Пясъчен дъб", "YG5717": "Махагон",
}


# Two flooring captions sit close enough to their neighbour that the extractor
# picked up the wrong one; both verified against catalogue p.46.
CODE_NAME_OVERRIDES = {
    "7006": "Опушен рустик",
    "7007": "Меден орех",
    "9010": "Класически дъб",
    "9011": "Сребриста топола",
}


def clean(name, code=None):
    if code in CODE_NAME_OVERRIDES:
        return CODE_NAME_OVERRIDES[code]
    name = NAME_FIXES.get(name, name)
    return name.strip()


def trim_code(code):
    """Drop the qualifier some benchtop codes carry ("ZS-01 · без силика")."""
    return code.split("·")[0].strip()


def series_of(num, table):
    for (lo, hi), en, bg in table:
        if lo <= num <= hi:
            return en, bg
    return "", ""


def js(value, indent=0):
    """Minimal JS literal writer, so the emitted file stays diff-friendly."""
    pad = "  " * indent
    if isinstance(value, dict):
        inner = ", ".join(f"{k}: {js(v)}" for k, v in value.items())
        return "{ " + inner + " }"
    if isinstance(value, list):
        return "[\n" + "".join(f"{pad}  {js(v)},\n" for v in value) + pad + "]"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) or value is None:
        return "null" if value is None else str(value)
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def block(name, rows, comment=""):
    head = f"// {comment}\n" if comment else ""
    return f"{head}export const {name} = {js(rows, 0)}\n\n"


def main():
    cat = json.load(open("manifest.json", encoding="utf-8"))
    pho = json.load(open("manifest-photos.json", encoding="utf-8"))
    out = ['''// Generated from the NVC-HOME4YOU catalogue (2026 edition).
// Codes, names, prices and inclusion all follow the printed catalogue; the
// thumbnails are cropped from the same pages. Regenerate rather than edit.

''']

    # ---- facade panels -------------------------------------------------
    rows = []
    for code in sorted(cat["panel"], key=lambda c: int(c.split("-")[1])):
        num = int(code.split("-")[1])
        bg = clean(cat["panel"][code].get("name", ""))
        s_en, s_bg = series_of(num, PANEL_SERIES)
        rows.append({"key": code.lower(), "code": code,
                     "en": EN.get(bg, bg), "bg": bg,
                     "groupEn": s_en, "groupBg": s_bg,
                     "swatch": swatch_for("panels", code),
                     "thumb": f"thumbs/panels/{slug(code)}.webp"})
    out.append(block("FACADE_PANEL_OPTIONS", rows,
                     "135 decors, 16 mm polyurethane -- included in the house price"))

    # ---- flooring ------------------------------------------------------
    rows = []
    for code in sorted(cat["floor"], key=int):
        bg = clean(cat["floor"][code].get("name", ""), code)
        s_en, s_bg = series_of(int(code), FLOOR_SERIES)
        rows.append({"key": f"floor-{code}", "code": code,
                     "en": EN.get(bg, bg), "bg": bg,
                     "groupEn": s_en, "groupBg": s_bg,
                     "swatch": swatch_for("floor", code),
                     "thumb": f"thumbs/floor/{slug(code)}.webp"})
    out.append(block("VINYL_FLOOR_OPTIONS", rows, "21 vinyl decors -- included"))

    rows = [{"key": c.lower(), "code": c,
             "en": EN.get(HERRINGBONE_NAMES[c], ""), "bg": HERRINGBONE_NAMES[c],
             "swatch": swatch_for("herringbone", c),
             "thumb": f"thumbs/herringbone/{slug(c)}.webp"}
            for c in ["YG5716", "YG5711", "YG5715", "YG5713", "YG5712", "YG5717"]]
    out.append(block("HERRINGBONE_FLOOR_OPTIONS", rows,
                     "6 herringbone decors -- surcharge quoted on request"))

    # ---- UV panels -----------------------------------------------------
    rows = [{"key": re.sub(r"[^a-z0-9]+", "-", c.lower()).strip("-"), "code": c,
             "swatch": swatch_for("uv", c),
             "thumb": f"thumbs/uv/{slug(c)}.webp"} for c in sorted(cat["uv"])]
    out.append(block("UV_PANEL_OPTIONS", rows, "30 UV decors -- included"))

    # ---- benchtops -----------------------------------------------------
    rows = []
    for raw in sorted(cat["bench"], key=lambda c: (not c.startswith("М"), c)):
        code = trim_code(raw)
        marble = code.startswith("М")
        bg = MARBLE_NAMES.get(code, "")
        rows.append({"key": re.sub(r"[^a-z0-9]+", "-", code.lower()).strip("-"),
                     "code": code, "en": EN.get(bg, bg), "bg": bg,
                     "groupEn": "Marble" if marble else "Quartz",
                     "groupBg": "Мрамор" if marble else "Кварц",
                     "swatch": swatch_for("kitchen-bench", code),
                     "thumb": f"thumbs/kitchen-bench/{slug(code)}.webp"})
    out.append(block("KITCHEN_BENCH_OPTIONS", rows,
                     "24 decors: 6 marble + 18 quartz -- included"))

    # ---- interior decorative panels ------------------------------------
    rows = []
    for code in sorted(cat["interior-panel"], key=lambda c: int(c.split("-")[1])):
        s_en, s_bg = series_of(int(code.split("-")[1]), IP_SERIES)
        rows.append({"key": code.lower(), "code": code,
                     "groupEn": s_en, "groupBg": s_bg,
                     "swatch": swatch_for("interior-panels", code),
                     "thumb": f"thumbs/interior-panels/{slug(code)}.webp"})
    out.append(block("INTERIOR_PANEL_OPTIONS", rows,
                     "23 decors -- priced per selection, quoted on request"))

    # ---- PET cabinet colours -------------------------------------------
    rows = [{"key": f"pet-{c}", "code": c, "swatch": v["hex"], "finish": v["finish"]}
            for c, v in sorted(pho["pet-colour"].items())]
    out.append(block("KITCHEN_PET_COLOUR_OPTIONS", rows,
                     "PET cabinet colours -- surcharge quoted on request"))

    # ---- decking --------------------------------------------------------
    rows = [{"key": c.lower(), "code": c, "swatch": swatch_for("decking", c),
             "thumb": f"thumbs/decking/{slug(c)}.webp"}
            for c in sorted(cat["decking"])]
    out.append(block("DECKING_OPTIONS", rows,
                     "8 decking decors -- decor does not change the balcony price"))

    with open(TARGET, "w", encoding="utf-8") as fh:
        fh.write("".join(out))
    print("wrote", TARGET)
    for line in out[1:]:
        m = re.match(r"(?:// .*\n)?export const (\w+)", line)
        print("  ", m.group(1), line.count("key:"))


if __name__ == "__main__":
    main()

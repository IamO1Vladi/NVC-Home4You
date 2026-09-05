using System;

namespace Services;

// The width ladder for /api/img/{key}?w= — ROADMAP #9's server half.
//
// A QUANTIZER, not an allow-list. The site's markup asks for some thirty distinct widths
// across its srcsets, and pinning each of them here would mean two lists (one per language)
// that drift the day a component picks a new number. Instead any requested width snaps UP
// to the next rung, so a component is free to say what it means and the wire only ever
// carries ladder values.
//
// The ladder is what makes ?w= safe to expose at all: without it, /api/img?w=1..2560 is
// 2,560 cache entries per image for anyone bored enough to loop, and the ImageCache's
// eviction would spend its 64MB budget churning garbage. Thirteen rungs cap the worst case
// at thirteen variants per image, each earned by a real request shape.
//
// ~25% steps, because that is where the tradeoff sits: finer steps buy invisible byte
// savings and cost cache entries; coarser steps ship visibly oversized files to the
// smallest screens — the phones ROADMAP #9 exists for.
//
// MUST MIRROR the LADDER in src/lib/img.js. The frontend snaps the same way so a srcset
// descriptor ("640w") always names the width actually served; if the two ladders disagree,
// the browser's layout math is quietly lied to. Both test suites pin the same cases.
public static class ImageWidths
{
    public static readonly int[] Ladder =
        { 120, 160, 200, 240, 320, 400, 480, 640, 800, 1000, 1200, 1600, 2000 };

    /// <summary>
    /// The rung a request lands on: the smallest ladder width that covers it. Null — serve
    /// the original — for an absent or nonsense width, and for anything past the top rung,
    /// where the 2560px original is the honest answer rather than an upscale-shaped lie.
    /// </summary>
    public static int? Snap(int? requested)
    {
        if (requested is not > 0) return null;

        foreach (var rung in Ladder)
        {
            if (rung >= requested.Value) return rung;
        }

        return null;
    }
}

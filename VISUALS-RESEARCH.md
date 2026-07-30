# Visual Enhancement Research

## Current Architecture

The rendering pipeline works as follows:

1. **LLM generates attributes** — bodyPlan, colors, weapon, features, aura, pattern, etc. (not raw shapes)
2. **`RecipeAssembler.build()`** assembles a recipe from predefined `BODY_PLANS` functions + features + weapon + pattern modifiers, producing an array of shape objects (circle, rect, line, polygon, arc, ellipse)
3. **`SpriteRenderer.draw()`** renders shapes to canvas with: flat/gradient fill, optional per-shape outline (same color as shape), glow, surface patterns, drop shadow ellipse, skeletal joint animation, face/eyes

Key files:
- `@/Users/tassio/Downloads/promptshowdown/index.html:2452` — `_drawShapeRaw()` (per-shape canvas drawing)
- `@/Users/tassio/Downloads/promptshowdown/index.html:2548` — `draw()` (main unit render entry)
- `@/Users/tassio/Downloads/promptshowdown/index.html:1323` — `RecipeAssembler.build()` (recipe assembly)

**Current weaknesses:**
- Per-shape outlines use the shape's own color (`shape.oc || shape.c`) — not visible/contrasting
- Many shapes have no outline at all
- Flat fills look lifeless
- No silhouette-level outline — shapes blend into each other and the background
- Drop shadow is a hard ellipse (no blur)

---

## Proposed Techniques

### 1. Silhouette-Based Black Outline (HIGH PRIORITY)

**What:** Draw a clean black outline around the entire sprite silhouette, not per-shape.

**How — Offscreen canvas approach:**
1. Render all shapes to an offscreen canvas (same size, transparent bg)
2. Create a black silhouette: set `globalCompositeOperation = 'source-in'`, fill the offscreen canvas with `#000`
3. Draw the black silhouette onto the main canvas at 4–8 offset positions (1–2px in each direction: up, down, left, right, diagonals)
4. Draw the original colored sprite (offscreen canvas) on top

**Result:** A cartoon-style outline that traces the sprite's outer boundary, regardless of what shapes the LLM组合produced. Instantly improves readability against any background.

**Performance:** Offscreen canvas can be cached per recipe (not per frame). Animation joints transform shapes during render, so the offscreen needs to be re-rendered each frame — BUT the silhouette pass is just 4–8 `drawImage` calls, which is cheap.

**Alternative — Per-shape black stroke (simpler, less polished):**
- In `_drawShapeRaw`, default `strokeStyle` to `#000` and always stroke filled shapes with `lineWidth=1`
- Internal lines between shapes would be visible — looks more "sketched" but less clean
- One-line change, zero performance cost

**Recommendation:** Start with the per-shape black stroke (trivial, instant improvement), then upgrade to silhouette outline if it looks too busy.

---

### 2. Automatic Gradient Shading (MEDIUM PRIORITY)

**What:** Replace flat fills with automatic vertical gradients (lighter top → darker bottom) to simulate top-down lighting.

**How:**
- In `_drawShapeRaw`, when `shape.fill !== 'gradient'`, auto-create a gradient: `lighten(shape.c, 0.12)` at top → `darken(shape.c, 0.12)` at bottom
- Need to add a `darken()` function (only `lighten()` exists at `@/Users/tassio/Downloads/promptshowdown/index.html:851`)
- For circles: use radial gradient (light spot offset to top-left)
- For rects: linear gradient top-to-bottom
- For polygons/ellipses: bounding-box linear gradient

**Result:** Flat-colored shapes get instant depth and 3D feel. Works on anything the LLM produces without it needing to specify gradients.

**Cost:** Minimal — a few gradient creations per shape per frame. Could cache gradients per color if needed.

---

### 3. Soft Drop Shadow with Blur (MEDIUM PRIORITY)

**What:** Replace the current hard ellipse shadow with a blurred soft shadow.

**How:**
- Use `ctx.filter = 'blur(3px)'` before drawing the shadow ellipse, then reset `ctx.filter = 'none'`
- Or use `ctx.shadowBlur` + `ctx.shadowColor` on the ellipse itself

**Current code** at `@/Users/tassio/Downloads/promptshowdown/index.html:2581`:
```js
c.globalAlpha=0.25*alpha;
c.fillStyle="#000";
c.beginPath();
c.ellipse(u.x, u.y+(u.z||10)*0.8, (u.z||10)*0.9, (u.z||10)*0.3, 0, 0, Math.PI*2);
c.fill();
```

**Improved:**
```js
c.save();
c.filter='blur(3px)';
c.globalAlpha=0.3*alpha;
c.fillStyle="#000";
c.beginPath();
c.ellipse(u.x, u.y+(u.z||10)*0.8, (u.z||10)*1.0, (u.z||10)*0.35, 0, 0, Math.PI*2);
c.fill();
c.restore();
```

**Cost:** `ctx.filter` has some performance overhead but only one shape per unit.

---

### 4. Rim Light / Top Highlight (LOW PRIORITY)

**What:** Add a subtle bright edge on the top of each shape to simulate overhead lighting.

**How:**
- After filling each shape, stroke the top half with `lighten(shape.c, 0.3)` at `lineWidth=1`
- For circles: draw a small arc at the top
- For rects: draw a line across the top edge

**Result:** Adds a "lit from above" feel that makes sprites pop. Subtle but effective.

**Cost:** Moderate complexity per shape type. Lower priority since gradient shading (technique 2) achieves a similar effect more simply.

---

### 5. Canvas Post-Processing Filters (LOW PRIORITY)

**What:** Apply global contrast/saturation boost to the entire sprite.

**How:**
- Before drawing shapes: `c.filter = 'contrast(1.1) saturate(1.15)'`
- After: `c.filter = 'none'`

**Result:** Punchier colors, more visual energy. Subtle.

**Cost:** `ctx.filter` performance varies by browser. Could be a settings toggle.

**Caveat:** `ctx.filter` is not supported in Safari < 14 and some mobile browsers. Should be feature-detected.

---

### 6. Ground Decal / Team Ring (LOW PRIORITY)

**What:** Draw a colored ring or decal on the ground under each unit, colored by team.

**How:**
- Before drawing the sprite, draw a semi-transparent colored circle at the unit's feet
- Player team: blue/cyan tint, enemy team: red tint
- Could be a subtle gradient ring rather than a filled circle

**Result:** Improves unit visibility and team identification, especially when sprites are small or dark-colored.

**Cost:** One extra shape per unit per frame.

---

## Implementation Priority

| # | Technique | Effort | Impact | Priority |
|---|-----------|--------|--------|----------|
| 1 | Per-shape black stroke | 1 line | High | **Do first** |
| 1b | Silhouette outline | ~30 lines | High | Do second |
| 2 | Auto gradient shading | ~20 lines | Medium | Do third |
| 3 | Soft drop shadow | 2 lines | Medium | Do with #2 |
| 4 | Rim light | ~40 lines | Low | Optional |
| 5 | Canvas filters | 2 lines | Low | Settings toggle |
| 6 | Ground decal | ~10 lines | Low | Optional |

## Summary

The highest-ROI change is **technique 1** (black outline) — it directly addresses the user's request and can be implemented in a single line change to `_drawShapeRaw`. The silhouette-based version is a moderate upgrade that looks cleaner but requires offscreen canvas management.

**Technique 2** (auto gradients) is the next best bang-for-buck — it makes every flat-colored shape look more polished without any LLM changes.

**Technique 3** (soft shadow) is a 2-line change that adds polish for free.

All three can be implemented in under 60 lines total and work universally on anything the LLM produces.

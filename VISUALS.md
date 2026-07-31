# Prompt Showdown — Visual System

**How units are drawn on the canvas.** No image assets, no sprite sheets — every unit is rendered procedurally from a data-driven recipe using Canvas 2D primitives.

**File:** `index.html` (~9900 lines, single file)
**Date:** 2026-07-31

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model](#2-data-model)
3. [Color System](#3-color-system)
4. [Body Plans](#4-body-plans)
5. [Weapons](#5-weapons)
6. [Visual Modifiers](#6-visual-modifiers)
7. [RecipeAssembler](#7-recipeassembler)
8. [SpriteRenderer](#8-spriterenderer)
9. [Animation System](#9-animation-system)
10. [Joint System](#10-joint-system)
11. [Faces](#11-faces)
12. [Surface Patterns](#12-surface-patterns)
13. [Aura Particles](#13-aura-particles)
14. [Battle Canvas Overlays](#14-battle-canvas-overlays)
15. [Death FX](#15-death-fx)
16. [Fallback Path](#16-fallback-path)
17. [Accessibility](#17-accessibility)
18. [Preview Rendering](#18-preview-rendering)

---

## 1. Overview

The visual pipeline, from LLM output to pixels on screen:

```
LLM / Template
     │
     ▼
Unit attributes (24 fields: bodyPlan, weaponType, colors, 7 visual modifier categories, stats)
     │
     ▼
RecipeAssembler.build(attrs)          ← combines body plan + weapon + modifiers
     │
     ▼
Recipe { shapes[], animations{}, aura, eyeStyle, pattern, face }
     │
     ▼
SpriteRenderer.draw(c, u)             ← called every frame in the battle loop
     │
     ├── interpolate keyframes → channel values
     ├── draw team decal + drop shadow
     ├── for each shape: drawShape() → _drawShapeRaw()
     │     ├── sanitize colors
     │     ├── apply colorblind filter
     │     ├── create gradient fill or auto-gradient shading
     │     ├── draw primitive (rect/circle/ellipse/polygon/arc/line)
     │     └── draw surface pattern clipped to shape bounds
     ├── drawFace() — eyes that track targets, blink, widen on attack
     └── restore canvas state
     │
     ▼
Battle render loop adds overlays: status rings, HP bar, name, role dot, hit flash, ability flash
```

Key design principles:
- **Procedural, not asset-based** — every unit is drawn from shapes defined in data. No PNGs, no sprite sheets, no external images.
- **Composable** — a unit's appearance is the sum of independent layers: body plan + weapon + head feature + back feature + tail feature + pattern + aura + eyes.
- **Data-driven** — all visual definitions are plain JS objects/arrays. Adding a new body plan or weapon is a data change, not a code change.
- **Skeletal animation** — shapes are attached to named joints. Animations drive joint values over time via keyframe interpolation.

---

## 2. Data Model

A unit's visual data lives in two places:

### Unit Object Fields (line 985-1015)

Stored on the unit object itself, preserved through P2P serialization and cloning:

```javascript
{
  bodyPlan: "humanoid",      // 28 options
  weaponType: "sword",       // 14 options
  headFeature: "horns",      // 14 options
  backFeature: "wings_bat",  // 14 options
  tailFeature: "tail_long",  // 10 options
  aura: "fire",              // 12 options
  eyeStyle: "glowing",       // 12 options
  pattern: "scales",         // 12 options
  weaponStyle: "ornate",     // 10 options
  recipe: { ... }            // assembled recipe (null = role-coded fallback)
}
```

### Recipe Object (built by RecipeAssembler)

The compiled visual definition, stored as `u.recipe`:

```javascript
{
  shapes: [
    { t:"circle", cx:0, cy:-18, r:6, c:"#4a7", fill:"gradient", c2:"#48f" },
    { t:"rect", x:-5, y:-12, w:10, h:14, c:"#4a7", fill:"gradient", c2:"#a72", outline:1, oc:"#a72" },
    { t:"rect", x:-9, y:-10, w:4, h:10, c:"#4a7", joint:"arm_raise" },
    // ... up to 20 shapes
  ],
  animations: {
    idle:  [{ t:0, bob:0 }, { t:0.5, bob:1 }, { t:1, bob:0 }],
    move:  [{ t:0, leg_swing:0, bob:0 }, { t:0.5, leg_swing:1, bob:1 }, { t:1, leg_swing:0, bob:0 }],
    attack:[{ t:0, arm_raise:0 }, { t:0.3, arm_raise:1 }, { t:1, arm_raise:0 }],
    death: [{ t:0, alpha:1, rot:0 }, { t:1, alpha:0, rot:90 }]
  },
  aura: "fire",
  auraColor: "#f64",
  eyeStyle: "glowing",
  eyeColor: "#ff4",
  pattern: "scales",
  face: true
}
```

---

## 3. Color System

### COLOR_MAP (line 1178)

Named colors → hex values. The LLM picks from these names, not raw hex:

```javascript
const COLOR_MAP = {
  green:"#4a7", blue:"#48f", red:"#f44", purple:"#a4f",
  yellow:"#fd4", orange:"#f84", black:"#222", white:"#eee",
  brown:"#a72", gray:"#888", pink:"#f6c", cyan:"#0ff"
};
```

### Color Palette Construction (RecipeAssembler, line 1875-1879)

Each unit gets a 4-color palette derived from its attributes:

```javascript
const colors = {
  primary: COLOR_MAP[attrs.primaryColor] || "#888",   // main body color
  accent:  COLOR_MAP[attrs.accentColor]  || "#aaa",   // secondary color
  head:    lighten(primary, 0.2),                      // head is 20% lighter than body
  weapon:  WEAPON_COLOR[attrs.weaponType] || primary   // weapon color per type
};
```

### Color Utilities (line 1221-1240)

- **`sanitizeHex(hex)`** — normalizes to 6-char hex, handles 3-char shorthand, returns `"#888"` for invalid input. Prevents `addColorStop` crashes from malformed colors.
- **`lighten(hex, amt)`** — brightens a hex color by `amt` (0-1). Handles 3-char hex expansion. Rounds channels to avoid float-in-hex bug.
- **`darken(hex, amt)`** — darkens a hex color by `amt` (0-1).

### Auto-Gradient Shading (line 3211-3230)

When a shape has a color but no explicit `fill:"gradient"`, the renderer auto-applies gradient shading for depth:
- **Circles/ellipses**: radial gradient — lighter top-left, darker bottom-right
- **Rects/polygons**: linear gradient — lighter top, darker bottom

This gives every shape a 3D look without the body plans needing to specify gradients explicitly.

---

## 4. Body Plans

`BODY_PLANS` (line 1331-1762) — 28 body plans, each a function `(colors) => recipe`:

| Plan | Shapes | Joints | Description |
|------|--------|--------|-------------|
| humanoid | 6 (head, torso, 2 arms, 2 legs) | arm_raise, leg_swing | Standard bipedal |
| quadruped | 7 (body, head, 4 legs, tail) | leg_swing, tail_wag | Four-legged beast |
| dragon | 7 (body, head, 2 wings, 2 legs, tail) | arm_raise, leg_swing, tail_wag | Winged reptile |
| serpent | 4 (head, 3 body arcs) | tail_wag | Sinuous body |
| bird | 5 (body, head, beak, 2 wings) | arm_raise | Flying |
| insect | 8 (2 body segments, 4 legs, 2 antennae) | leg_swing, arm_raise | Six-legged |
| crab | 7 (body, 2 eyes, 2 claws, 2 legs) | arm_raise, leg_swing | Sideways walker |
| golem | 5 (body, head, 2 arms, core) | arm_raise | Rocky construct |
| ghost | 4 (wisp body, 2 arms, glow) | arm_raise | Translucent floater |
| fish | 5 (body, tail, fins, eye) | tail_wag | Aquatic |
| blob | 3 (body, 2 eyes) | — | Amorphous |
| flying | 5 (body, 2 wings, tail) | arm_raise, tail_wag | Winged |
| mechanical | 6 (body, head, 2 arms, 2 treads) | arm_raise | Robot |
| structure | 4 (base, body, top, eye) | — | Building |
| plant | 5 (stem, leaves, flower, roots) | — | Flora |
| undead | 6 (skeleton body, skull, 2 arms, 2 legs) | arm_raise, leg_swing | Zombie |
| demon | 7 (body, head, horns, 2 arms, 2 legs) | arm_raise, leg_swing | Fiend |
| beast-man | 6 (furry body, head, 2 arms, 2 legs) | arm_raise, leg_swing | Hybrid |
| aquatic | 5 (body, tail, fins, head) | tail_wag | Sea creature |
| monopod | 3 (body, eye, leg) | leg_swing | One-legged |
| centaur | 9 (human torso, horse body, 4 legs, 2 arms) | arm_raise, leg_swing | Hybrid |
| hydra | 8 (body, 3 heads, 2 legs, tail) | head_tilt, leg_swing, tail_wag | Multi-headed |
| elemental | 5 (body, 2 arms, core, aura) | arm_raise | Pure energy |
| aberration | 7 (irregular body, tentacles, eyes) | tail_wag | Eldritch |
| ooze | 3 (blob body, 2 eyes) | wobble | Gelatinous |
| crystal | 5 (faceted body, 2 arms, core, shards) | arm_raise | Geometric |
| construct | 5 (body, head, 2 arms, core) | arm_raise | Clockwork |
| angel | 6 (body, head, 2 legs, halo) | leg_swing | Divine |

Each body plan defines:
- **`shapes[]`** — array of shape primitives positioned relative to unit center (0,0)
- **`animations{}`** — keyframes for `idle`, `move`, `death` states

Example — `humanoid`:
```javascript
humanoid: c => ({
  shapes: [
    { t:"circle", cx:0, cy:-18, r:6, c:c.head, fill:"gradient", c2:c.primary },
    { t:"rect", x:-5, y:-12, w:10, h:14, c:c.primary, fill:"gradient", c2:c.accent, outline:1, oc:c.accent },
    { t:"rect", x:-9, y:-10, w:4, h:10, c:c.primary, joint:"arm_raise" },
    { t:"rect", x:5, y:-10, w:4, h:10, c:c.primary, joint:"arm_raise" },
    { t:"rect", x:-5, y:2, w:4, h:10, c:c.primary, joint:"leg_swing" },
    { t:"rect", x:1, y:2, w:4, h:10, c:c.primary, joint:"leg_swing" }
  ],
  animations: {
    idle: [{ t:0, bob:0 }, { t:0.5, bob:1 }, { t:1, bob:0 }],
    move: [{ t:0, leg_swing:0, bob:0 }, { t:0.5, leg_swing:1, bob:1 }, { t:1, leg_swing:0, bob:0 }],
    death:[{ t:0, alpha:1, rot:0 }, { t:1, alpha:0, rot:90 }]
  }
})
```

### Shape Primitives

| Type | Fields | Drawn with |
|------|--------|------------|
| `rect` | x, y, w, h | `c.rect()` |
| `circle` | cx, cy, r | `c.arc()` |
| `ellipse` | cx, cy, rx, ry | `c.ellipse()` |
| `polygon` | pts: [[x,y],...] | `c.moveTo/c.lineTo` |
| `arc` | cx, cy, r, start, end, w | `c.arc()` stroked |
| `line` | x1, y1, x2, y2, w | `c.moveTo/c.lineTo` stroked |

### Common Shape Fields

| Field | Purpose |
|-------|---------|
| `c` | Fill color |
| `c2` | Gradient end color (if `fill:"gradient"`) |
| `fill` | `"gradient"` for gradient fill, otherwise solid |
| `outline` | Outline width (px) |
| `oc` | Outline color |
| `alpha` | Per-shape opacity (0-1) |
| `glow` | `shadowBlur` value for glow effect |
| `joint` | Joint name for animation transform |
| `jointMode` | Override joint mode (rotate/translate/scale) |
| `jointAxis` | Override joint axis (x/y/both) |
| `jointRange` | Override joint range |
| `pattern` | Surface pattern name (stripes, spots, scales, etc.) |

---

## 5. Weapons

`WEAPONS` (line 1763-1786) — 14 weapon types, each adds a shape + an `attack` animation:

| Weapon | Shape | Attack Animation |
|--------|-------|-----------------|
| sword | line (blade) | arm_raise: 0→1→0 |
| bow | arc | bow_draw + arm_raise |
| staff | line (vertical) | arm_raise: 0→1→0 |
| dagger | short line | arm_raise: 0→1→0 |
| shield | rect | arm_raise: 0→0 (static) |
| hammer | rect (head) | arm_raise: 0→1→0 |
| claws | short line | arm_raise: 0→1→0 |
| breath | circle (glowing) | arm_raise: 0→1→0 |
| scythe | arc | arm_raise: 0→1→0 |
| whip | line | arm_raise: 0→1→0.5→0 (crack) |
| spear | long line | arm_raise: 0→1→0 |
| rifle | rect | arm_raise: 0→0.3→0 |
| wand | line (glowing) | arm_raise: 0→1→0 |
| none | (no shape) | (no animation) |

Each weapon also has an `fxType` for attack particles (`WEAPON_FX`, line 1184):
- `bow`, `rifle` → `"projectile"` (fires a moving projectile)
- `staff`, `shield`, `wand` → `"flash"` (instant flash at target)
- `hammer`, `breath` → `"burst"` (area burst at target)
- Others → `"none"` (melee hit)

### Weapon Styles (line 1868-1871)

`WEAPON_STYLE_MODIFIERS` applies visual modifiers to the weapon shape:

| Style | Effect |
|-------|--------|
| standard | (none) |
| ornate | `glow:2` |
| glowing | `glow:6` |
| cracked | `alpha:0.7` |
| pristine | (none) |
| battered | `alpha:0.6` |
| rusted | `alpha:0.5` |
| crystal | `glow:8` |
| bone | `alpha:0.8` |
| molten | `glow:6` |

---

## 6. Visual Modifiers

Seven categories of visual modifiers (Phase 25), each an enum of options that map to shape-generating functions:

### Head Features (line 1812-1827) — 14 options

| Option | Visual |
|--------|--------|
| none | (nothing) |
| horns | Polygon spikes on head |
| antlers | Branching lines |
| crest | Sawtooth polygon |
| halo | Glowing circle above head |
| crown | Jagged polygon |
| horns_curved | Curved polygon horns |
| ears_pointed | Triangle ears |
| mask | Face covering polygon |
| eyepatch | Dark polygon over eye |
| tiara | Arc + gem |
| antenna | Lines + glowing dots |
| frill | Semi-transparent polygon |
| beak | Orange triangle |

### Back Features (line 1828-1843) — 14 options

| Option | Visual |
|--------|--------|
| none | (nothing) |
| wings_bat | Polygon wings, `joint:"wing_flap"` |
| wings_feathered | White polygon wings, `joint:"wing_flap"` |
| wings_dragon | Large polygon wings, `joint:"wing_flap"` |
| cape | Rect, `joint:"recoil"` |
| shell | Rounded rect on back |
| spikes | Triangle row |
| aura_vent | Glowing circles |
| wings_insect | Translucent wings, `joint:"wing_flap"` |
| wings_angel | White glowing wings, `joint:"wing_flap"` |
| jetpack | Gray rects + orange glow |
| tentacles | Lines, `joint:"tail_wag"` |
| fins | Triangle side fins |
| crystal_growth | Glowing crystal polygons |

### Tail Features (line 1844-1855) — 10 options

| Option | Visual |
|--------|--------|
| none | (nothing) |
| tail_long | Line, `joint:"tail_wag"` |
| tail_spade | Line + triangle tip |
| tail_flame | Glowing triangle |
| tail_fin | Triangle fan |
| tail_prehensile | Curved line |
| tail_stinger | Line + pointed tip |
| tail_fluffy | Circle (soft) |
| tail_barbed | Line + side spikes |
| tail_split | Two diverging lines |

### Aura (line 1856-1858) — 12 options

Maps to a particle color. Does not add shapes — instead drives the per-frame aura particle emitter (see [Aura Particles](#13-aura-particles)).

| Aura | Particle Color |
|------|---------------|
| none | (no particles) |
| fire | `#f64` |
| frost | `#6cf` |
| poison | `#6f4` |
| lightning | `#ff4` |
| holy | `#fd8` |
| shadow | `#a4f` |
| arcane | `#a4f` |
| void | `#a0f` |
| nature | `#4f8` |
| blood | `#f44` |
| tech | `#0ff` |

### Eye Styles (line 1860-1862) — 12 options

Controls eye color and glow in `drawFace()`:

| Style | Eye Color | Glow |
|-------|-----------|------|
| normal | `#000` (or fxType-derived) | no |
| glowing | `#ff4` | yes |
| slit | `#0f0` | no |
| empty | `#000` | no |
| visorglow | `#0ff` | yes |
| compound | `#f44` | no |
| closed | (no eyes drawn) | — |
| star | `#ffd` | no |
| cross | `#fff` | no |
| spiral | `#a4f` | no |
| visor | `#0f0` | no |
| visor_red | `#f44` | no |

### Patterns (line 1864-1866) — 12 options

Surface textures drawn clipped to shape bounds (see [Surface Patterns](#12-surface-patterns)):

`none`, `stripes`, `spots`, `scales`, `runes`, `cracks`, `gradient_two_tone`, `circuit`, `tribal`, `stars`, `hexagons`, `marble`

### Weapon Styles — see [Weapons](#5-weapons)

### Combinatorics

With 28 body plans × 14 weapons × 14 head features × 14 back features × 10 tail features × 12 auras × 12 eye styles × 12 patterns × 10 weapon styles × 12 primary colors × 12 accent colors × 3 sizes = **~21 million visual combinations**.

---

## 7. RecipeAssembler

`RecipeAssembler.build(attrs)` (line 1873-1924) — combines all visual layers into a single recipe:

```
1. Resolve colors from COLOR_MAP
2. Compute head color = lighten(primary, 0.2)
3. Compute scale from SIZE_SCALE[sizeMod]  (small=0.7, medium=1.0, large=1.3)
4. Call body plan function → base shapes + animations
5. Scale all body shapes by `scale`
6. Apply pattern to body shapes (add pattern field + c2 for gradient)
7. Append weapon shape (scaled + weapon style modifiers applied)
8. Append head feature shapes (scaled)
9. Append back feature shapes (scaled)
10. Append tail feature shapes (scaled)
11. Cap at 20 shapes (drop lowest priority: tail → back → head)
12. Merge animations: body animations + weapon attack animation
13. Attach metadata: aura, auraColor, eyeStyle, eyeColor, pattern, face
14. Return recipe
```

The recipe is stored on `u.recipe` and persisted with the unit through save/load, P2P serialization, and cloning.

---

## 8. SpriteRenderer

`SpriteRenderer` (line 3096) — the render engine. Called every frame for every visible unit.

### `draw(c, u)` (line 3393) — Main Entry Point

```
1. If no recipe → fallback to _drawRoleShape() and return
2. Determine animation state: idle | move | attack | death
3. Compute normalized time t (0-1) within animation duration
4. Interpolate keyframes → channel values { arm_raise: 0.7, bob: 0.5, ... }
5. Apply reduced motion (skip bob/rot/squash/stretch/wobble)
6. Apply bob offset (vertical sine wave)
7. Apply death alpha + rotation
8. Apply hit reaction (recoil away from attacker)
9. Draw team-colored ground decal (flat ellipse at feet)
10. Draw drop shadow (blurred dark ellipse)
11. For each shape in recipe.shapes:
      drawShape(c, shape, channels, u)
12. Draw face (if recipe.face !== false and not death state)
13. Restore canvas state
```

### `drawShape(c, shape, channels, u)` (line 3128) — Per-Shape with Joint Transform

```
1. Look up shape.joint channel value (0-1) from interpolated channels
2. Look up JOINT_CONFIG[jointName] → { mode, axis, range }
3. Apply transform:
   - rotate: translate to pivot, rotate by chVal * maxAngle, translate back
   - translate: offset by chVal * range along axis
   - scale: scale by (1 + chVal * range) around center
4. Call _drawShapeRaw(c, shape, u) for actual drawing
5. Restore canvas state
```

### `_drawShapeRaw(c, shape, u)` (line 3179) — Primitive Drawing

```
1. Apply colorblind filter (if enabled)
2. Sanitize colors via sanitizeHex()
3. Apply high contrast (thicker outlines if enabled)
4. Set per-shape alpha
5. Create fill style:
   - If fill:"gradient" + c2: create radial/linear gradient
   - Else if solid color: auto-gradient shading (lighter top, darker bottom)
   - Else: no fill (stroke only)
6. Draw the primitive:
   - rect: c.fillRect() / c.strokeRect()
   - circle: c.arc() + fill/stroke
   - ellipse: c.ellipse() + fill/stroke
   - polygon: moveTo/lineTo path + fill/stroke
   - arc: c.arc() stroked
   - line: moveTo/lineTo stroked
7. Apply glow (shadowBlur + shadowColor) if shape.glow
8. Draw surface pattern (clipped to shape bounds) if shape.pattern
9. Reset shadowBlur, globalAlpha
```

---

## 9. Animation System

### Keyframe Format

Each animation state is an array of keyframes:

```javascript
idle: [
  { t:0,   bob:0 },
  { t:0.5, bob:1 },
  { t:1,   bob:0 }
]
```

- `t` — normalized time within the animation (0 = start, 1 = end)
- Other fields — channel values at that keyframe

### Interpolation (line 3099-3123)

`SpriteRenderer.interpolate(keyframes, t)`:
1. Clamp `t` to [0, 1]
2. Find the two surrounding keyframes
3. Compute local fraction `f = (t - prev.t) / (next.t - prev.t)`
4. Apply easing (if `next.ease` is set):
   - `"easeIn"`: `f = f²`
   - `"easeOut"`: `f = 1 - (1-f)²`
   - `"easeInOut"`: `f < 0.5 ? 2f² : 1 - (-2f+2)²/2`
5. Linear interpolate each channel: `out[ch] = prev[ch] + (next[ch] - prev[ch]) * f`

### Animation States (line 3094)

```javascript
const ANIM_DURATIONS = { idle:2.0, move:0.6, attack:0.4, death:0.5 };
```

| State | Duration | Trigger | Time Source |
|-------|----------|---------|-------------|
| idle | 2.0s | Default | `Battle.time / dur` (looping) |
| move | 0.6s | `u.movedThisFrame` | `Battle.time / dur` (looping) |
| attack | 0.4s | `u.attackT >= 0` | `u.attackT` (0→1 over duration, scaled by attack speed) |
| death | 0.5s | `u.h <= 0` | `u.deathT / dur` (one-shot, clamped to 1) |

### State Selection (line 4596-4599)

```javascript
if (u.h <= 0)              u.animState = "death";
else if (u.attackT >= 0)   u.animState = "attack";
else if (u.movedThisFrame) u.animState = "move";
else                       u.animState = "idle";
```

Attack animation speed scales with the unit's attack speed (`u.a`). Frenzy doubles it.

---

## 10. Joint System

Shapes are attached to named joints. The animation system drives joint values (0-1) each frame, and `drawShape()` applies the corresponding transform.

### JOINT_ANGLES (line 3078-3083) — Max Rotation

| Channel | Max Angle | Used By |
|---------|-----------|---------|
| arm_raise | 90° | Arms, wings, weapons |
| arm_swing | 60° | Arm swing |
| leg_swing | 30° | Legs |
| bow_draw | 15° | Bow drawing |
| head_tilt | 20° | Head |
| staff_raise | 70° | Staff |
| rot | 90° | Death rotation |
| tail_wag | 25° | Tails, tentacles |
| wing_flap | 30° | Wings (translate mode) |
| jaw_open | 20° | Jaw (translate mode) |
| recoil | 8px | Hit reaction (translate mode) |
| lunge | 12px | Attack lunge (translate mode) |

### JOINT_CONFIG (line 3085-3093) — Mode + Axis + Range

| Channel | Mode | Axis | Range | Description |
|---------|------|------|-------|-------------|
| arm_raise | rotate | — | 90° | Rotate around top of shape |
| arm_swing | rotate | — | 60° | Rotate around top of shape |
| leg_swing | rotate | — | 30° | Rotate around top of shape |
| bow_draw | rotate | — | 15° | Slight rotation |
| head_tilt | rotate | — | 20° | Head tilt |
| bob | translate | y | 2px | Vertical bob |
| staff_raise | rotate | — | 70° | Staff lift |
| rot | rotate | — | 90° | Full rotation (death) |
| tail_wag | rotate | — | 25° | Tail swing |
| wing_flap | translate | y | 6px | Wing flap (vertical) |
| jaw_open | translate | y | 4px | Jaw drop |
| recoil | translate | y | 5px | Knockback |
| lunge | translate | x | 4px | Forward lunge |
| squash | scale | y | 0.2 | Squash vertically |
| stretch | scale | x | 0.2 | Stretch horizontally |
| breathe | scale | both | 0.05 | Subtle breathing |
| wobble | scale | x | 0.1 | Horizontal wobble |

### How Joints Work in drawShape()

For **rotate** mode (e.g. `arm_raise`):
```javascript
// Pivot point = top-center of the shape
const px = shape.x + shape.w/2;  // (for rect)
const py = shape.y;
c.save();
c.translate(u.x + px, u.y + py);     // move to pivot in world space
c.rotate(chVal * maxAngle);           // rotate by chVal * 90°
c.translate(-px, -py);                // move back
_drawShapeRaw(c, shape, u);           // draw shape rotated
c.restore();
```

For **translate** mode (e.g. `bob`):
```javascript
const offset = chVal * range;         // chVal * 2px
c.save();
c.translate(0, offset);               // shift vertically
_drawShapeRaw(c, shape, u);
c.restore();
```

For **scale** mode (e.g. `squash`):
```javascript
const sx = 1 + chVal * 0.2;           // scale up to 1.2×
c.save();
c.translate(u.x + cx, u.y + cy);      // move to center
c.scale(sx, sy);                      // scale
c.translate(-cx, -cy);                // move back
_drawShapeRaw(c, shape, u);
c.restore();
```

---

## 11. Faces

`SpriteRenderer.drawFace(c, u, channels, state)` (line 3472) — draws eyes on humanoid-like units.

### Which Units Get Faces

```javascript
const facedPlans = ["humanoid","undead","demon","beast-man","ghost","flying","monopod"];
```

Units with `bodyPlan` not in this list don't get faces. Units with `eyeStyle:"closed"` or `recipe.face:false` also skip faces.

### Eye Behavior

| Behavior | Description |
|----------|-------------|
| **Target tracking** | Eyes shift toward `u.target` direction (up to 1.5px offset) |
| **Blink** | Every 3-5s, eyes scale Y to 0.1 for 100ms |
| **Widen on attack** | Eyes scale X to 1.3× during attack state |
| **Glow** | `shadowBlur` for glowing/visorglow styles, undead, shadow, arcane types |

### Eye Color Derivation (line 3483-3491)

1. If `recipe.eyeColor` is set → use it
2. Else if `bodyPlan === "undead"` → green (`#4f4`)
3. Else if `fxType === "shadow" || "arcane"` → magenta (`#f4f`)
4. Else → black (`#000`)

### Eye Drawing (line 3511-3522)

Two small ellipses (1.5×2px) positioned 3px apart, shifted by target tracking offset:

```javascript
c.ellipse(hx-3+dx, hy+dy, 1.5*eyeScaleX, 2*eyeScaleY, 0, 0, Math.PI*2);  // left
c.ellipse(hx+3+dx, hy+dy, 1.5*eyeScaleX, 2*eyeScaleY, 0, 0, Math.PI*2);  // right
```

---

## 12. Surface Patterns

Drawn inside `_drawShapeRaw()` after the shape is filled, clipped to the shape's bounds (line 3270-3387).

### For Rects

| Pattern | Drawing Method |
|---------|---------------|
| stripes | Horizontal lines every 4px |
| spots | Random dots |
| scales | Overlapping arcs (grid) |
| runes | Arc segments at 120° intervals |
| cracks | Lines radiating from center |
| circuit | Grid lines every 4px |
| tribal | Concentric arcs |
| stars | Random small circles |
| hexagons | Hex grid (clipped) |
| marble | Bezier curves with random control points |
| gradient_two_tone | (handled by gradient fill, no overlay) |

### For Circles

Same patterns but clipped to `c.arc()` bounds. Spots are placed at 90° intervals, scales in a hex grid, stars at 60° intervals, etc.

### Pattern + Gradient Interaction

When a pattern is applied, the shape also gets `c2 = lighten(primary, 0.15)` for a subtle two-tone gradient under the pattern overlay.

---

## 13. Aura Particles

`BattleFX.unitAura(u, dt)` (line 3833) — per-frame particle emitter for unit auras.

### How It Works

1. Skip if unit is dead, low quality, or reduced motion
2. Determine aura color:
   - Prefer `u.recipe.auraColor` (set by RecipeAssembler from `AURA_MAP_VISUAL`)
   - Fall back to `AURA_MAP[deriveFxType(u)]`
   - Fall back to `AURA_MAP[u.recipe.aura]`
3. If no color found, skip
4. Spawn 1-2 particles per frame near the unit, capped by `MAX_PARTICLES` (60)
5. Particles drift upward with slight horizontal spread, 0.4-0.6s lifetime

### `deriveFxType(u)` (line 3752-3763)

Derives an elemental type from unit attributes for aura color:

| Condition | fxType |
|-----------|--------|
| ability=ramp + weapon=breath | fire |
| ability=poison | poison |
| ability=heal / heal_burst | heal_glow |
| ability=explode | explosion |
| ability=shield | holy |
| weapon=staff | arcane |
| bodyPlan=ghost / undead | shadow |
| bodyPlan=dragon | fire |
| bodyPlan=bird | frost |
| bodyPlan=plant | holy |
| (otherwise) | null (no aura) |

---

## 14. Battle Canvas Overlays

Drawn by the battle render loop (line 5240-5310) **on top of** the sprite:

### Per-Unit Overlays

| Overlay | Trigger | Visual |
|---------|---------|--------|
| **Team ground decal** | Always (not death) | Flat colored ellipse at feet (blue=player, red=enemy), 15% alpha |
| **Drop shadow** | Always (not death) | Blurred black ellipse, 30% alpha |
| **Lunge offset** | Attacking | Forward x-offset during attack animation |
| **Spawn scale** | First 150ms | Scale up from 0 to 1 |
| **Hit flash** | `u.hitFlash > 0` | White tint overlay (role shape filled white, 60% alpha) |
| **Ability flash** | `u.abFlash > 0` | Expanding colored ring, fades over 0.4s |
| **Shield ring** | `u.shieldActive > 0` | White circle outline (2px) |
| **Stun ring** | `u.stun > 0` | Yellow circle outline (2px) |
| **Poison ring** | `u.poison > 0` | Green circle outline |
| **Slow ring** | `u.slow > 0` | Blue circle outline |
| **HP bar** | Always (not death) | Smooth animated bar (lerps displayed HP toward actual) |
| **Name** | Always (not death) | 9px sans-serif, centered above unit |
| **Role dot** | Always (not death) | 2px colored circle left of name (role-coded) |
| **Low-HP warning** | `u.h < u.mh * 0.25` | Pulsing red glow around unit |

### Screen-Level Effects

| Effect | Trigger | Visual |
|--------|---------|--------|
| **Screen shake** | Explosions, big hits | Canvas translate by random offset, decays over time |
| **Damage numbers** | Any damage | Floating numbers (white=normal, yellow=crit, green=heal), rise + fade |
| **Projectiles** | Ranged attacks | Moving circles/lines from attacker to target |
| **Particles** | Various | Burst, death, aura, spell effects — capped at 60 |
| **Kill feed** | On kill | Top-right overlay, last 5 kills, fades after 4s |
| **Battle stats** | During battle | Top overlay: DPS, kills, damage dealt |
| **Round history bar** | During battle | W/L badges above canvas |

### Role Colors (module-level constant)

```javascript
const ROLE_COLORS = {
  frontline:  "#f84",  // orange
  carry:      "#f44",  // red
  support:    "#4f8",  // green
  counter:    "#a4f",  // purple
  utility:    "#48f",  // blue
  assassin:   "#f6c",  // pink
  bruiser:    "#fd4"   // yellow
};
```

---

## 15. Death FX

Triggered by `onUnitDeath(u)` (line 4978-5008):

### Death Animation

All units play the `death` keyframe animation: alpha fades 1→0, rotation 0→90°, over 0.5s. The unit is removed from the canvas when `deathT >= 0.5`.

### Body-Plan-Specific Particle Bursts (line 4980-4999)

| Body Plan | Death FX |
|-----------|----------|
| golem, construct | **Shatter** — 8 colored rect particles fly outward + downward |
| ghost, wraith, undead | **Dissolve** — 6 particles rise upward, fade |
| blob, slime, monopod | **Flatten** — 5 puddle particles spread horizontally |
| (others) | **Generic burst** — via `BattleFX.onDeath(u)` |

All deaths also:
- Play `GameAudio.sfx("death")` sound
- First kill plays `GameAudio.sfx("first_blood")` sound
- Add entry to kill feed overlay
- Add entry to `deathLog` (for post-match hints)
- Increment killer's kill count (for MVP)

---

## 16. Fallback Path

If a unit has no `recipe` (e.g. base roster units without LLM generation), `SpriteRenderer.draw()` falls back to `_drawRoleShape()` (line 3527-3543):

### Role-Coded Shapes

| Role | Shape |
|------|-------|
| frontline | Square |
| carry | Triangle (point up) |
| counter | Diamond |
| support | Hexagon |
| (others) | Circle |

The shape is filled with the unit's color `u.c` and stroked with the team color (cyan for player, red for enemy). No animation, no joints, no face — just a simple colored polygon.

This path is also used for the hit flash overlay (white-tinted role shape drawn on top of the sprite).

---

## 17. Accessibility

### Colorblind Filter (line 3182-3184)

When `settings.colorblind` is set (protanopia, deuteranopia, tritanopia), shape colors are remapped via `G.applyColorblind()` before drawing. The filter is applied per-shape in `_drawShapeRaw()`.

### High Contrast (line 3191)

When `settings.highContrast` is enabled, outline widths are increased by 1px.

### Reduced Motion (line 3415, 3838)

When `settings.reducedMotion` is enabled:
- Bob, rotation, squash, stretch, wobble channels are zeroed out
- Aura particles are skipped
- Screen shake is disabled
- Death animation still plays (alpha fade only, no rotation)

### Quality Tiers

| Tier | Particles | Auras | Shadows |
|------|-----------|-------|---------|
| high | Full (60 max) | Yes | Yes |
| low | Reduced | No | No |
| minimal | Minimal | No | No |

---

## 18. Preview Rendering

`SpriteRenderer.renderPreview(canvas, u)` (line 3547) — renders a static unit preview onto a canvas element. Used by:
- Scout cards (enemy unit previews)
- Deck cards (your unit previews)
- Unit detail modal (animated preview)
- Forge preview (generated unit preview)

Creates a temporary unit object centered on the canvas, sets `animState:"idle"`, temporarily sets `Battle.time=0` for a consistent idle pose, then calls `draw()`. For animated previews, the modal re-renders on a timer.

---

## File Reference

| System | Location (line) | Description |
|--------|-----------------|-------------|
| `COLOR_MAP` | 1178 | Named colors → hex |
| `WEAPON_COLOR` | 1183 | Weapon type → color |
| `WEAPON_FX` | 1184 | Weapon type → fx type |
| `SIZE_SCALE` | 1185 | Size modifier → scale |
| `UNIT_SCHEMA` | 1188 | LLM JSON schema (24 fields) |
| `sanitizeHex()` | 1221 | Color sanitization |
| `lighten()` | 1229 | Color brightening |
| `darken()` | 1237 | Color darkening |
| `BODY_PLANS` | 1331-1762 | 28 body plan definitions |
| `WEAPONS` | 1763-1786 | 14 weapon definitions |
| `scaleShape()` | 1803 | Scale a shape by a factor |
| `HEAD_FEATURES` | 1812-1827 | 14 head feature shapes |
| `BACK_FEATURES` | 1828-1843 | 14 back feature shapes |
| `TAIL_FEATURES` | 1844-1855 | 10 tail feature shapes |
| `AURA_MAP_VISUAL` | 1856-1858 | Aura → particle color |
| `EYE_STYLES` | 1860-1862 | Eye style → color |
| `PATTERN_MODIFIERS` | 1864-1866 | Pattern enum → pattern key |
| `WEAPON_STYLE_MODIFIERS` | 1868-1871 | Weapon style → shape modifiers |
| `RecipeAssembler` | 1873-1925 | Combines all layers into recipe |
| `JOINT_ANGLES` | 3078-3083 | Max rotation per joint |
| `JOINT_CONFIG` | 3085-3093 | Joint mode/axis/range |
| `ANIM_DURATIONS` | 3094 | Animation durations |
| `SpriteRenderer` | 3096-3560 | Render engine |
| `SpriteRenderer.interpolate()` | 3099 | Keyframe interpolation + easing |
| `SpriteRenderer.drawShape()` | 3128 | Per-shape with joint transform |
| `SpriteRenderer._drawShapeRaw()` | 3179 | Primitive canvas drawing |
| `SpriteRenderer.draw()` | 3393 | Main entry point |
| `SpriteRenderer.drawFace()` | 3472 | Eye rendering |
| `SpriteRenderer._drawRoleShape()` | 3527 | Fallback role-coded shape |
| `SpriteRenderer.renderPreview()` | 3547 | Static preview for cards |
| `AURA_MAP` | 3747 | fxType → aura color |
| `deriveFxType()` | 3752 | Derive elemental type from attributes |
| `BattleFX` | 3765 | Particle effects |
| `BattleFX.unitAura()` | 3833 | Per-frame aura emitter |
| `BattleFX.onDeath()` | 4980-4999 | Body-plan-specific death particles |
| Battle render loop | 5240-5310 | Overlays (status rings, HP bar, name) |

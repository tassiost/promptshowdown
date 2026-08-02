# Prompt Showdown — Complete Improvements & Research Document

**File reviewed:** `index.html` (~9900 lines, single-file game)
**Date:** 2026-07-31 (updated)

---

## Table of Contents

1. [Rendering Library Analysis](#1-rendering-library-analysis)
2. [Visual Enhancement Research](#2-visual-enhancement-research)
3. [Gameplay Improvements](#3-gameplay-improvements)
4. [Performance](#4-performance)
5. [User Experience](#5-user-experience)
6. [Architecture](#6-architecture)
7. [Multiplayer](#7-multiplayer)
8. [Visual / Rendering](#8-visual--rendering)
9. [Audio](#9-audio)
10. [Security & Privacy](#10-security--privacy)
11. [Mobile](#11-mobile)
12. [Miscellaneous & Bugs](#12-miscellaneous--bugs)
13. [Inspiration References](#13-inspiration-references)
14. [User Feedback](#14-user-feedback)
15. [Priority Recommendations](#15-priority-recommendations)

---

## 1. Rendering Library Analysis

Four rendering approaches/libraries were evaluated for improving the visual quality and performance of Prompt Showdown's sprite system.

### 1.1 Native Canvas 2D (Current Approach)

**What:** The game currently uses the native `CanvasRenderingContext2D` API for all rendering. Shapes are drawn directly via `fillRect`, `arc`, `beginPath`, `ellipse`, etc. in `_drawShapeRaw()`.

**Pros:**
- **Zero dependencies** — no external libraries, no build step, stays single-file
- **Universal support** — works in every browser including older mobile
- **Simple mental model** — direct imperative drawing, no scene graph
- **Small code size** — no library overhead
- **Current codebase is built around it** — all 6,000+ lines assume Canvas 2D

**Cons:**
- **CPU-bound** — all rendering happens on the CPU, no GPU acceleration
- **No batching** — each draw call is individual, no sprite batching
- **`ctx.filter` (blur, contrast) is slow** — not hardware accelerated, varies by browser
- **No shader support** — can't do custom GPU effects (color grading, distortion, glow)
- **`shadowBlur` is expensive** — software-rendered, major perf hit when used per-shape
- **Retina handling is manual** — must scale canvas by `devicePixelRatio` manually
- **Performance ceiling** — benchmarks show Canvas 2D handles ~2,000-7,000 sprites at 60fps (depending on hardware), vs PixiJS WebGL handling ~44,000+

**When to keep it:** If the game stays under ~50 on-screen shapes per frame (current: ~30-60 shapes with 12 units × 5 shapes each). The current sprite count is well within Canvas 2D's comfort zone.

**When to switch:** If the game adds particle-heavy effects, many units (20+), high-resolution shadows/blurs, or post-processing filters that need GPU acceleration.

**Verdict for Prompt Showdown:** **Keep Canvas 2D as the primary renderer.** The sprite count is low enough that GPU acceleration isn't needed. The single-file architecture is a core design principle. Instead, use targeted libraries (StackBlur, KissCut) for specific visual enhancements that Canvas 2D does poorly.

---

### 1.2 PixiJS (WebGL 2D Renderer)

**What:** PixiJS is the most popular WebGL-based 2D rendering engine. It provides a scene graph, sprite batching, GPU-accelerated filters, and automatic Canvas 2D fallback. Current version: v8.

**Pros:**
- **GPU acceleration** — WebGL rendering is 5-20x faster for large sprite counts
- **Built-in filters** — blur, glow, color adjustment, displacement — all GPU-accelerated
- **Sprite batching** — thousands of sprites in a single draw call
- **Scene graph** — hierarchical transforms, containers, layers
- **Particle system** — built-in `@pixi/particle-emitter` for high-performance particles
- **Retina/HiDPI handling** — automatic resolution scaling
- **Mature ecosystem** — extensive docs, examples, community

**Cons:**
- **Breaks single-file architecture** — PixiJS is ~400KB minified, must be loaded via CDN or bundled
- **Major refactor required** — entire `SpriteRenderer` and `BattleFX` systems would need rewriting
- **Different mental model** — scene graph vs immediate-mode rendering
- **WebGPU/WebGL not available on all mobile devices** — fallback to Canvas 2D is automatic but adds complexity
- **Overkill for current sprite count** — 12 units × 5 shapes = 60 shapes is trivial for Canvas 2D
- **Version churn** — PixiJS v7 → v8 had breaking changes; docs often outdated
- **Larger memory footprint** — textures, shaders, buffers

**Benchmark data** (from [js-game-rendering-benchmark](https://github.com/Shirajuki/js-game-rendering-benchmark)):
- 10,000 sprites: PixiJS ~47fps (Canvas 2D fallback), ~60fps (WebGL)
- Native Canvas 2D: ~27fps at 10,000 sprites
- At 100-200 sprites (our range): both hit 60fps easily

**Integration approach if adopted:**
1. Load PixiJS via CDN: `<script src="https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js"></script>`
2. Replace `SpriteRenderer.draw()` with Pixi `Graphics` objects per unit
3. Replace `BattleFX` particles with `@pixi/particle-emitter`
4. Replace `ctx.filter` blur with Pixi `BlurFilter` (GPU-accelerated)
5. Use Pixi `Container` hierarchy for team grouping, HP bars, UI overlay

**Verdict for Prompt Showdown:** **Not recommended at this time.** The sprite count doesn't justify the refactor cost. Revisit if the game adds 50+ units, complex particle effects, or GPU shaders. The single-file, zero-dependency architecture is more valuable than GPU rendering at this scale.

---

### 1.3 StackBlur (Fast Canvas Blur)

**What:** [StackBlur](https://github.com/flozz/StackBlur) is a fast, almost-Gaussian blur library by Mario Klingemann. It operates directly on canvas `ImageData` or `HTMLCanvasElement` and produces quality results much faster than `ctx.filter = 'blur()'`.

**NPM:** `stackblur-canvas` (~153KB unpacked, zero dependencies, MIT license)

**API:**
```js
// Blur a region of a canvas
StackBlur.canvasRGBA(canvas, x, y, width, height, radius);
// Blur ImageData directly
StackBlur.imageDataRGBA(imageData, x, y, width, height, radius);
```

**Why it matters for Prompt Showdown:**
- **Soft drop shadows** — the current drop shadow is a hard ellipse. StackBlur can blur it to a soft, realistic shadow.
- **Silhouette outlines** — render sprite to offscreen canvas → StackBlur the alpha channel → draw as black silhouette behind sprite = clean cartoon outline.
- **Aura glow effects** — blur a colored silhouette to create a soft glow halo around units.
- **Background depth** — blur the battlefield background slightly to make foreground units pop.
- **Better than `ctx.filter`** — StackBlur is consistently faster across browsers, especially on mobile. `ctx.filter` is not supported in Safari < 14 and has unpredictable performance.

**Performance:**
- StackBlur on a 400×550 canvas with radius 3: ~0.5-1ms per call
- `ctx.filter = 'blur(3px)'` on same: ~2-5ms (and doesn't work on Safari < 14)
- For per-unit shadows (small regions): negligible cost

**Integration approach:**
1. Vendor `stackblur-canvas` as a single JS file in `vendor/stackblur.mjs` (same pattern as trystero/lz-string)
2. **Drop shadows:** After drawing the shadow ellipse to an offscreen canvas, apply `StackBlur.canvasRGBA(offscreen, 0, 0, w, h, 3)` before drawing to main canvas
3. **Silhouette outlines:** Render all sprite shapes to offscreen → `StackBlur.canvasRGBA(offscreen, 0, 0, w, h, 2)` → composite as black behind sprite
4. **Aura glow:** Render unit silhouette in aura color → `StackBlur.canvasRGBA(offscreen, 0, 0, w, h, 6)` → draw behind sprite with alpha

**Alternative — `ctx.shadowBlur`:** Canvas 2D has built-in `shadowBlur` but it's software-rendered and slow when applied per-shape. StackBlur on an offscreen canvas is faster for whole-sprite effects.

**Verdict for Prompt Showdown:** **Recommended for shadow/outline/aura effects.** Small, focused, zero-dependency. Fits the vendored dependency pattern. Solves the specific visual weaknesses (hard shadows, no outlines, no glow) without a full renderer swap.

---

### 1.4 KissCut (Sticker Outlines)

**What:** [KissCut](https://github.com/nizarmah/kisscut) is a zero-dependency TypeScript library that generates constant-width, anti-aliased outlines around transparent images — like a "kiss cut" sticker outline. It traces the true alpha edge using Euclidean distance transforms.

**NPM:** `kisscut` (~5KB minified, zero runtime dependencies, MIT license)

**API:**
```js
import { outline } from 'kisscut'

const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
const { image, pad } = outline(imageData, {
  width: 2,              // outline radius in px
  color: '#000000',      // outline color
  fillHoles: true        // fill enclosed transparent regions
})
ctx.putImageData(new ImageData(image.data, image.width, image.height), x - pad, y - pad)
```

**How it works:**
1. Read alpha coverage onto a padded grid
2. Exact Euclidean distance transform (Felzenszwalb-Huttenlocher, O(n))
3. Smoothstep over the distance field → constant-width outline with round joins, anti-aliased edges
4. Fill enclosed holes (so the outline prints as one connected sticker)
5. Composite the colored outline layer under the artwork

**Why it matters for Prompt Showdown:**
- **Perfect silhouette outlines** — the #1 visual improvement identified in `VISUALS-RESEARCH.md`. KissCut produces the exact "cartoon outline around the entire sprite" effect described in the silhouette outline proposal, but with proper anti-aliasing and constant width.
- **Better than the offscreen-canvas approach** — the VISUALS-RESEARCH.md proposal of drawing the silhouette at 4-8 offset positions produces a chunky, uneven outline. KissCut's distance-transform approach produces a smooth, constant-width outline that looks professional.
- **Team-colored outlines** — use `color: '#44aaff'` for player team, `color: '#ff4444'` for enemy team. Instant team identification.
- **Works on any LLM-generated sprite** — since it operates on the rendered pixels, it works regardless of what shapes the LLM composed.

**Performance:**
- KissCut operates on `ImageData` — it's a CPU operation, not GPU
- For a 60×60 sprite (typical unit size): ~0.1-0.3ms per outline
- Can be cached per recipe (not per frame) since the outline shape only changes with animation poses
- For animation: outline needs re-computation each frame (different pose = different silhouette). At 12 units × 0.3ms = ~3.6ms per frame — acceptable within a 16ms budget

**Integration approach:**
1. Vendor `kisscut` as `vendor/kisscut.mjs` (~5KB, trivial)
2. After `SpriteRenderer.draw()` renders all shapes to the main canvas, extract the unit's bounding box `ImageData`
3. Apply `outline(imageData, { width: 2, color: teamColor })`
4. Draw the outlined `ImageData` back at the unit's position
5. **Optimization:** Cache outlines per (recipe + animation frame). With 5-6 keyframes per animation state and 4 states, that's ~20-24 cached outlines per unit.

**Alternative comparison:**

| Approach | Quality | Performance | Complexity |
|----------|--------|-------------|------------|
| Per-shape black stroke | Low (internal lines visible) | Excellent (0ms) | 1 line |
| Offscreen silhouette (8 offsets) | Medium (chunky, uneven) | Good (~0.5ms) | ~30 lines |
| `ctx.shadowBlur` | Medium (soft, not crisp) | Poor (2-5ms) | 2 lines |
| **KissCut** | **High (crisp, constant-width, anti-aliased)** | **Good (~0.3ms, cacheable)** | ~20 lines + vendor |

**Verdict for Prompt Showdown:** **Recommended for silhouette outlines.** It's the highest-quality option for the #1 visual improvement, it's tiny (5KB), zero-dependency, and fits the vendored pattern. The caching strategy keeps per-frame cost low. Combined with StackBlur for shadows/auras, it addresses all major visual weaknesses without switching renderers.

---

### 1.5 Combined Rendering Strategy

The recommended approach combines all four elements:

```
Native Canvas 2D (primary renderer — shapes, joints, animations)
    +
StackBlur (shadows, auras, background depth — vendored)
    +
KissCut (silhouette outlines, team colors — vendored)
    +
[Future: PixiJS only if sprite count or effect complexity demands GPU]
```

**Implementation order:**
1. **KissCut outlines** — highest visual impact, smallest dependency, addresses the #1 feedback item
2. **StackBlur shadows** — replaces hard ellipse with soft shadow, adds polish
3. **StackBlur auras** — persistent particle-free glow for elemental units
4. **Keep Canvas 2D** — no renderer swap needed

**Total added dependency size:** ~158KB (StackBlur 153KB + KissCut 5KB), both vendored locally, zero build step.

---

## 2. Visual Enhancement Research

### Current Architecture

The rendering pipeline:

1. **LLM generates attributes** — bodyPlan, colors, weapon, features, aura, pattern, etc.
2. **`RecipeAssembler.build()`** assembles a recipe from predefined `BODY_PLANS` functions + features + weapon + pattern modifiers, producing an array of shape objects (circle, rect, line, polygon, arc, ellipse)
3. **`SpriteRenderer.draw()`** renders shapes to canvas with: flat/gradient fill, optional per-shape outline (same color as shape), glow, surface patterns, drop shadow ellipse, skeletal joint animation, face/eyes

**Current weaknesses:**
- Per-shape outlines use the shape's own color — not visible/contrasting
- Many shapes have no outline at all
- Flat fills look lifeless
- No silhouette-level outline — shapes blend into each other and the background
- Drop shadow is a hard ellipse (no blur)

---

### 2.1 Silhouette-Based Black Outline (HIGH PRIORITY)

**What:** Draw a clean black outline around the entire sprite silhouette, not per-shape.

**Option A — KissCut (recommended):** See §1.4 above. Produces professional, constant-width, anti-aliased outlines.

**Option B — Offscreen canvas approach:**
1. Render all shapes to an offscreen canvas (same size, transparent bg)
2. Create a black silhouette: set `globalCompositeOperation = 'source-in'`, fill the offscreen canvas with `#000`
3. Draw the black silhouette onto the main canvas at 4–8 offset positions (1–2px in each direction)
4. Draw the original colored sprite (offscreen canvas) on top

**Option C — Per-shape black stroke (simplest):**
- In `_drawShapeRaw`, default `strokeStyle` to `#000` and always stroke filled shapes with `lineWidth=1`
- Internal lines between shapes would be visible — looks more "sketched" but less clean
- One-line change, zero performance cost

**Recommendation:** Start with per-shape black stroke (trivial, instant improvement), then upgrade to KissCut for a polished silhouette outline.

---

### 2.2 Automatic Gradient Shading (MEDIUM PRIORITY)

**What:** Replace flat fills with automatic vertical gradients (lighter top → darker bottom) to simulate top-down lighting.

**How:**
- In `_drawShapeRaw`, when `shape.fill !== 'gradient'`, auto-create a gradient: `lighten(shape.c, 0.12)` at top → `darken(shape.c, 0.12)` at bottom
- Need to add a `darken()` function (only `lighten()` exists)
- For circles: use radial gradient (light spot offset to top-left)
- For rects: linear gradient top-to-bottom
- For polygons/ellipses: bounding-box linear gradient

**Result:** Flat-colored shapes get instant depth and 3D feel. Works on anything the LLM produces without it needing to specify gradients.

---

### 2.3 Soft Drop Shadow with Blur (MEDIUM PRIORITY)

**What:** Replace the current hard ellipse shadow with a blurred soft shadow.

**Option A — StackBlur (recommended):** See §1.3 above. Apply `StackBlur.canvasRGBA()` to the shadow ellipse on an offscreen canvas.

**Option B — `ctx.filter`:**
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

**Option C — `ctx.shadowBlur`:**
```js
c.shadowBlur=4;
c.shadowColor='rgba(0,0,0,0.4)';
// draw shadow ellipse
c.shadowBlur=0;
```

**Recommendation:** Use StackBlur for consistent cross-browser performance. `ctx.filter` is not supported in Safari < 14.

---

### 2.4 Rim Light / Top Highlight (LOW PRIORITY)

**What:** Add a subtle bright edge on the top of each shape to simulate overhead lighting.

**How:**
- After filling each shape, stroke the top half with `lighten(shape.c, 0.3)` at `lineWidth=1`
- For circles: draw a small arc at the top
- For rects: draw a line across the top edge

---

### 2.5 Canvas Post-Processing Filters (LOW PRIORITY)

**What:** Apply global contrast/saturation boost to the entire sprite.

**How:** `c.filter = 'contrast(1.1) saturate(1.15)'` before drawing shapes, reset after.

**Caveat:** `ctx.filter` is not supported in Safari < 14 and some mobile browsers. Feature-detect.

---

### 2.6 Ground Decal / Team Ring (LOW PRIORITY)

**What:** Draw a colored ring or decal on the ground under each unit, colored by team.

**How:** Before drawing the sprite, draw a semi-transparent colored circle at the unit's feet. Player team: blue/cyan, enemy team: red.

---

### Visual Enhancement Priority Table

| # | Technique | Effort | Impact | Priority |
|---|-----------|--------|--------|----------|
| 1 | Per-shape black stroke | 1 line | High | **Do first** |
| 1b | KissCut silhouette outline | ~20 lines + 5KB vendor | High | **Do second** |
| 2 | Auto gradient shading | ~20 lines | Medium | Do third |
| 3 | Soft drop shadow (StackBlur) | ~15 lines + 153KB vendor | Medium | Do with #2 |
| 4 | Rim light | ~40 lines | Low | Optional |
| 5 | Canvas filters | 2 lines | Low | Settings toggle |
| 6 | Ground decal | ~10 lines | Low | Optional |

---

## 3. Gameplay Improvements

### 3.1 Battle Simulation
- **No unit collision damage**: Units separate via push-apart but deal no contact damage. Adding small collision damage would make positioning matter more.
- **`enemy_cluster` targeting is O(n²)**: Computes pairwise distances for every enemy each frame. Consider caching the cluster centroid per frame.
- **Dodge chance is flat 50%**: `dodge` ability uses `R()<0.5` — no scaling, no counterplay. Could scale with speed or level.
- **Rage damage uncapped at low HP**: `dmg*=1+(1-attacker.h/attacker.mh)` can double damage at 1 HP. Consider a softer curve.
- **No healing cap per round**: Multiple healers can stack indefinitely. Consider diminishing returns.
- **Minion TTL expiry**: Minion deaths from TTL don't appear in the death log, which could skew post-match hints.
- **Battle timeout at 90s has no escalation**: Consider adding a damage-over-time "enrage" mechanic after 60s.
- **`patrol` movement only moves on X axis**: Patrolling units never adjust Y, making them predictable.

### 3.2 Draft & Strategy
- **Rerolls are per-match (3 total)**: No way to earn more rerolls. Could tie to quests or coins.
- **Bot draft strategy is basic**: `BotStrategy` only checks for missing frontline/carry roles. No synergy detection, no counter-picking based on player abilities.
- **No draft timer**: Players can stare at cards indefinitely. An optional timer would add tension.
- **Comeback mechanic is 4th draw only**: Could add scaling comeback (e.g., stat boost for losing team's units).

### 3.3 Progression
- **Only 4 arenas**: The progression is short. More arenas or a rotating arena system would add replayability.
- **Upgrade cost formula is linear**: `30+lvl*20` — diminishing returns aren't built in, making high-level upgrades too expensive relative to their +10% gain.
- **Fusion takes higher of each stat**: Fusing two identical units gives no benefit beyond the level up. Consider a small bonus for fusing identical copies.
- **No unit trade/sacrifice mechanic**: Players accumulate collection units with no way to discard or convert unwanted ones.

### 3.4 Spell System
- **Spells have no cooldown between periodic fires**: `periodic_5s` spells fire every 5s with no limit — could be too strong in long battles.
- **No spell crafting UI**: Spells can only be forged via LLM or shared. No way to combine or modify existing spells.
- **Spell summon minions have fixed stats**: `Spell Minion` is always `{h:30,d:8,r:25,s:60}` regardless of arena tier.

---

## 4. Performance

### 4.1 Rendering
- **`_drawShapeRaw` creates objects on every call**: Creates new `shape` objects via spread for colorblind/high-contrast filters. This runs per-shape per-frame. Consider pre-computing filtered colors once when the recipe is built.
- **`drawFace` called every frame for every unit**: No culling for off-screen units (though the canvas is small, so this is minor).
- **Particle system is capped at 60**: `MAX_PARTICLES=60` is very conservative. On desktop, 200+ would be fine and look better.
- **`separate()` is O(n²)**: With 30+ units on screen, this is 900 distance checks per frame. Consider spatial partitioning (grid-based).
- **`render()` draws HP bars and names for every unit every frame**: Could batch text rendering or skip for dead/dying units.
- **Canvas width is `Math.min(400, innerWidth-20)` but height is fixed 550**: On very small screens, the canvas might be too tall. Consider responsive height.
- **No `devicePixelRatio` handling**: Canvas renders at 1x resolution — looks blurry on retina displays. Should scale canvas by `devicePixelRatio` and use CSS to maintain display size.

### 4.2 Memory
- **`cloneUnit` uses `JSON.parse(JSON.stringify(u))`**: This is slow for deep cloning. `structuredClone()` is available in modern browsers and is faster.
- **`Battle.units` array is filtered multiple times per frame**: `players` and `enemies` are filtered from `this.units` at lines 3451-3452, then again in `checkEnd()`. Could cache or use a single pass.
- **`this.units=this.units.filter(...)` creates a new array every frame**: For death cleanup. Could use in-place removal or a separate "to remove" flag.
- **Snapshots sent at 20Hz include full unit objects**: `Battle.snapshot()` sends `this.units` directly — these are large objects with recipes. Consider delta compression or sending only changed fields.

### 4.3 LLM
- **Per-field generation makes 24 sequential LLM calls**: `FIELD_ORDER` has 24 fields, each requiring a separate `askField` call. This is very slow. Consider batching into fewer calls.
- **No LLM response caching per field**: If the same prompt is re-forged, all 24 fields are re-queried even if the prompt is identical.

---

## 5. User Experience

### 5.1 UI/UX
- **No keyboard navigation**: All interactions are click/tap only. Adding keyboard shortcuts (e.g., 1/2/3 for draft picks, Space for tick) would improve desktop UX.
- **No loading indicator during bot army generation**: `buildBotArmy()` is synchronous but could take a moment with large pools.
- **Battle log uses `innerHTML+=`**: Appends HTML strings, which is slow and could cause layout thrashing. Consider using `textContent` and `createElement`.
- **`screen()` removes all fixed overlays**: Queries all `div` elements to clean up overlays. This is expensive — should track overlays in an array.
- **No "back" button on forge screen**: Once in the forge, you must generate or skip to leave. Should have a cancel/back button.
- **Deck screen doesn't show unit abilities in detail**: Shows ability name with description in unit detail modal (added). Could show more stats like range/speed inline on cards.
- **Unit detail view**: Tapping a unit card in collection shows a detailed modal with full stats, ability/movement/targeting/trigger/weapon descriptions, and animated preview. (Implemented)
- **Settings screen has no "apply" feedback**: Changing settings saves silently. A toast or visual confirmation would help.
- **No confirmation on loadout swap**: Tapping a loadout slot immediately swaps — no undo.
- **Scout screen reveals all opponent picks at once**: No suspense in revealing. Could reveal one at a time or let player tap each card.

### 5.2 Onboarding
- **Onboarding is 6 steps but non-interactive**: The coachmarks just say "tap X" but don't wait for the player to actually do it. Players skip through without learning.
- **No tooltip on first draft**: The first time a player sees draft cards, there's no explanation of rarity colors or role hints.
- **No explanation of abilities**: New players see ability names. ABILITY_DESCRIPTIONS, MOVEMENT_DESCRIPTIONS, TARGETING_DESCRIPTIONS, TRIGGER_DESCRIPTIONS, and WEAPON_DESCRIPTIONS maps now provide full explanations in the unit detail modal. Tooltips on cards could further help.

### 5.3 Accessibility
- **No ARIA labels**: Buttons and interactive elements have no `aria-label` or `role` attributes.
- **Color-only differentiation**: Team colors (blue vs red), rarity tiers, and status effects rely on color alone. The colorblind filter helps but doesn't cover all cases.
- **No screen reader support for battle**: Battle state (HP, unit count, turn) is displayed visually but not announced.
- **No font size adjustment**: Only high-contrast mode exists. No way to increase text size.
- **`confirm()` dialogs**: Use native `confirm()` which is inaccessible and ugly. Should use custom modal.
- **No focus indicators**: Custom buttons don't show focus rings for keyboard navigation.
- **Reduced motion only partially implemented**: `G.save.settings.reducedMotion` is saved but never checked in the rendering code. Screen shake and particle effects should be reduced/skipped.

---

## 6. Architecture

### 6.1 Code Organization
- **Everything in one 6,000-line file**: While intentional (no build step), the file is becoming unwieldy. Consider splitting into ES modules loaded via `<script type="module">` — this works without a build step.
- **No consistent naming convention**: Mix of camelCase, PascalCase, UPPER_SNAKE, and lowercase.
- **`G` object is a god object**: Contains save data, UI methods, game logic, networking, forge, deck, achievements — all in one object.
- **Global state via closures**: `room`, `sendNet`, `connected`, `role`, `_peerId` are module-level let variables. This makes testing and reset difficult.

### 6.2 Error Handling
- **`showError` shows raw error messages**: Displays `e.message` directly to users. Should show user-friendly messages and log details to console.
- **Silent catches**: Multiple `catch(e){}` blocks with no logging. Errors are swallowed silently.
- **No error boundary for battle loop**: If `update()` or `render()` throws, the `requestAnimationFrame` chain breaks silently.

### 6.3 Data Persistence
- **`saveData()` called very frequently**: Quest tracking, settings changes, forge, match end — each calls `saveData()` which does `JSON.stringify` + `localStorage.setItem`. Consider debouncing or batching saves.
- **No IndexedDB fallback**: localStorage has a 5MB limit. With 50 collection units + 50 ai units + replays, this could overflow.
- **`migrateSave` doesn't validate**: It adds missing fields but doesn't validate types or remove corrupt data.

### 6.4 Networking
- **Snapshot serialization sends raw objects**: `transmit("snap", snap)` sends the full snapshot. Should explicitly serialize only needed fields.
- **No message versioning**: Network messages have no protocol version. A mismatched client could crash on unknown message types.
- **No reconnection logic**: If the host's network drops briefly, the match is forfeited. The `showReconnect` UI exists but isn't wired to actual reconnection.
- **`trystero` room ID is hardcoded**: No way to create private rooms with custom codes from the UI.

### 6.5 Testing
- **No tests**: Zero unit tests, integration tests, or E2E tests. The game has complex combat logic, spell effects, and networking — all untested.
- **No debug mode for abilities**: `Battle.debug` exists but only logs positions/stats. No way to test specific ability interactions.
- **No battle replay system**: `saveReplay` stores metadata but not actual battle state. Can't replay battles to debug issues.

---

## 7. Multiplayer

### 7.1 Synchronization
- **20Hz snapshots may be insufficient**: Fast-moving units or projectiles may appear to teleport. Consider interpolation on the guest side.
- **No snapshot interpolation**: `applyRemoteSnapshot` directly replaces `Battle.units` with the snapshot data. This causes jitter. Should interpolate between previous and current snapshot.
- **No client-side prediction**: Guest sees only host's state with no prediction. Input latency is high.
- **Guest can't see projectiles smoothly**: `Battle.projectiles=snap.projectiles||[]` replaces the entire array — projectiles may jump.

### 7.2 Matchmaking
- **5-second timeout is very short**: `matchmakingTimer` at 5000ms falls back to bot quickly. Players in different regions may not connect in time.
- **No skill-based matching**: Ranked rating exists but isn't used in matchmaking. Players of any skill level can be matched together.
- **No private rooms from UI**: The `roomId` input exists but matchmaking always uses the arena queue room.

### 7.3 Disconnect Handling
- **Host disconnect = guest loses**: Guest gets "Host disconnected" and returns to menu with a loss. Should offer "Continue vs Bot" for guests too.
- **No mid-round reconnect**: If a player disconnects during a battle, the match is immediately forfeited.

---

## 8. Visual / Rendering

### 8.1 Sprite System
- **No silhouette outline for unit readability**: Units blend into the dark background. A 1-2px black outline around the entire sprite would dramatically improve readability. (See §1.4 KissCut and §2.1 for solutions.)
- **No team color tinting**: Friendly and enemy units are distinguished only by a thin stroke and HP bar color. A team-colored outline or glow would help.
- **Drop shadow is a flat ellipse**: Could use a blurred shadow for more depth. (See §1.3 StackBlur and §2.3 for solutions.)
- **No rim lighting**: Units have no edge highlight to separate them from the background.
- **`drawFace` eyes are basic circles**: No expressions, blinking, or target tracking.

### 8.2 Animations
- **Attack animation is 0.4s for all units**: Fast attackers (high `a` value) should have faster attack animations. Currently `u.attackT+=dt/0.4` is hardcoded.
- **No hit reaction animation**: Units flash white but don't flinch or recoil when hit.
- **Death animation is always rotation + fade**: Could vary by body plan (e.g., shatter for golem, dissolve for ghost).
- **No idle variety**: All units use the same bob animation. Could add breathing, looking around, etc.

### 8.3 Battlefield
- **Background is solid `#080810`**: No arena-themed backgrounds. Each arena could have a distinct color scheme, pattern, or parallax effect.
- **No ground line or perspective**: Units float in space. A subtle ground line or grid would add depth.
- **No environmental hazards**: The battlefield is empty. Could add obstacles, high ground, or zones.

---

## 9. Audio

### 9.1 SFX
- **Limited variety**: Only ~15 SFX. Many abilities share sounds.
- **No unit-specific sounds**: All melee attacks sound the same regardless of weapon type. Could vary pitch/waveform by weapon.
- **No ambient sounds**: No background ambience during battle.

### 9.2 Music
- **Procedural music is very simple**: Single bass drone + arpeggio. Could add percussion, harmony, or dynamic intensity.
- **Music doesn't change with arena**: Root note changes but the pattern is identical.
- **No music in menu/forge**: Only plays during battle.

---

## 10. Security & Privacy

### 10.1 Data Validation
- **Shared unit import doesn't fully validate**: `importUnitFromURL` parses JSON from URL params and passes to `unit()` which clamps values, but doesn't validate `recipe` shapes.
- **No input sanitization on forge prompt**: `promptEl.value` is used directly.
- **P2P messages are trusted**: `networkReceive` doesn't validate message structure beyond type checking.

### 10.2 Privacy
- **Analytics has no endpoint by default**: Good — but if an endpoint is configured, `installId` is persisted and sent.
- **No GDPR/CCPA compliance**: No cookie banner, no data deletion flow, no privacy policy link.

---

## 11. Mobile

### 11.1 Touch
- **Tap-to-tick is the only battle control**: No way to speed up/slow down battle on mobile. The `auto` button helps but is 120ms intervals (8fps).
- **No pinch-to-zoom on battlefield**: Can't zoom in to see units better on small screens.
- **Canvas doesn't respond to orientation change**: Width is set once at battle start.

### 11.2 Performance
- **`isMobile` detection is basic**: Checks touch + max-width 820px. Tablets and large phones may not be detected.
- **No quality auto-detection**: `qualityTier()` returns `"high"` by default on auto. No FPS monitoring to downgrade if performance is poor.
- **`_fpsTier` is never set**: `qualityTier()` references `this._fpsTier` but it's never assigned. Auto quality detection is non-functional.

---

## 12. Miscellaneous & Bugs

### 12.1 Dead Code
- **`G.save.ai` is duplicated with `G.save.collection`**: Both store forged units. `addForge` pushes to both. Wastes storage and creates sync issues.
- **`G.deckUnits()` is a backward-compat alias**: Could be removed if nothing uses it externally.
- **`SPRITE_RECIPES` for starter units could be generated by `RecipeAssembler`**: The hand-authored recipes duplicate the body plan system.

### 12.2 Known Bugs
- **`addToLoadout` has a logic error**: The duplicate slot check is broken — the `findIndex` is the same as `existingSlot` which was already checked.
- **`_comebackCheck` checks `Match.livesEnemy<=0` at match end**: By then, `livesEnemy` may already be 0 from the final round. Should verify match history shows a round 1 loss.
- **`loadoutUnits()` doesn't apply upgrades**: Returns raw collection/base units. Upgrades are only applied in `buildArmy()`. Deck screen shows base stats, not upgraded stats.
- **`Battle.auto()` interval is 120ms but `tick()` uses fixed `dt=0.05` (50ms)**: Auto-battle runs at ~8fps but simulates 50ms steps. Auto-battle is 2.4x slower than real-time.
- **`fxTypeFreq` returns 0 for most types**: The pitch modifier is 0 for non-elemental types, making all basic attacks sound identical.
- **`qualityTier` references `this._fpsTier` but it's never set**: Auto quality detection is non-functional.
- **`reducedMotion` setting is saved but never checked**: Screen shake and particles are always active.

### 12.3 i18n
- **Only 3 languages (en, es, pt)**: No Asian or other European languages.
- **i18n only covers menu/tutorial strings**: In-game text (battle log, toasts, quest descriptions, achievement names) is all hardcoded English.
- **No RTL support**: CSS doesn't account for right-to-left languages.

### 12.4 PWA
- **No service worker**: The manifest is registered but without a SW, there's no offline support or push notifications.
- **`display:"fullscreen"` may not work on all platforms**: `"standalone"` is more widely supported.

---

## 13. Inspiration References

### Game Breakers
**Link:** [https://gamebreakers.gg/](https://gamebreakers.gg/)

An AI-powered arena battler and Vibe Jam 2026 entry. Players create units/entities and battle them in an automated arena.

**Why it's inspiring:**
- Same core loop: **create → battle → progress**
- "Create anything" mirrors our LLM forge goal of infinite visual/unit variety
- The arena auto-battler format is exactly our combat model
- Loot + progression meta on top of the auto-battler is a proven engagement pattern
- Shows that an AI-generated-content arena game can work as a compelling product

### Super Voxel Heroes
**Link:** [https://supervoxelheroes.com/](https://supervoxelheroes.com/)

A 3D voxel hero creator built with Three.js. Players build custom voxel characters in a browser-based editor.

**Why it's inspiring:**
- **Visual clarity** — voxel characters are instantly readable despite being simple shapes. This is the same problem we face.
- **Constrained creativity** — voxel art proves you can have infinite variety within a strict visual framework. Our shape-based system is the 2D equivalent.
- **Lighting makes cheap art look expensive** — even simple voxel blocks look great with proper lighting, shadows, and outlines. This validates our visual enhancement approach.
- Voxel characters have clear silhouettes — our sprites need the same silhouette readability

### Takeaways

| Theme | Game Breakers | Super Voxel Heroes | Our application |
|-------|--------------|-------------------|-----------------|
| **Create anything** | Core hook | Core experience | LLM forge promise |
| **Visual polish** | Arena presentation | Voxel + lighting | Outlines, gradients, shadows |
| **Readability** | Clear unit silhouettes | Voxel clarity | Black outlines + silhouettes |
| **Progression** | Loot, bosses, leaderboard | Creator satisfaction | XP, coins, arenas, fusion |
| **Auto-battle feel** | AI arena battles | N/A | Canvas 2D auto-battler |
| **Browser-first** | Web game | Three.js web app | Single HTML file |

Both games prove that **constrained systems with strong visual treatment** can deliver infinite creative variety without needing AAA assets.

---

## 14. User Feedback

### Forge
- **Model download feedback**: The forge needs clear feedback while the model is downloading. Add a progress bar with an estimated time remaining. Since we are still testing, set the estimated download time to **1s**.
- **Default to Unit button**: The unit button should be selected by default and visually shown as pressed/active. The user can still switch to Spell if they want.

### In-Game Visuals
- **Visual quality**: We want near-infinite visual potential since the LLM codes the visuals, but the LLM is slow and somewhat limited. We need to find ways to make anything it generates look better with minimal effort.
  - Example: add a **black outline** to sprites/entities to improve readability and polish regardless of what the LLM produces.

---

## 15. Priority Recommendations

### Quick Wins (Low effort, high impact)
1. **Add per-shape black stroke** — 1 line in `_drawShapeRaw`, instant readability improvement
2. **Add KissCut silhouette outlines** — ~20 lines + 5KB vendor, professional cartoon outlines with team colors
3. **Fix `reducedMotion` not being checked** — add conditionals in `BattleFX.shake()` and `BattleFX.burst()`
4. **Fix `qualityTier` / `_fpsTier` never being set** — implement FPS monitoring
5. **Fix `addToLoadout` logic bug** — the duplicate slot check is broken
6. **Add keyboard shortcuts** — 1/2/3 for draft picks, Space for battle tick
7. **Replace `confirm()` with custom modals** — better UX and accessibility
8. **Show upgraded stats in deck screen** — call `applyUpgrades` in `loadoutUnits()` or display
9. **Default forge to Unit button** — per user feedback
10. **Model download progress bar** — per user feedback, 1s estimated time

### Medium Priority
11. **Add StackBlur soft drop shadows** — ~15 lines + 153KB vendor, replaces hard ellipse
12. **Add StackBlur aura glow** — persistent glow for elemental units
13. **Auto gradient shading** — ~20 lines, makes flat fills look 3D
14. **Debounce `saveData()` calls** — batch saves to avoid localStorage thrashing
15. **Add snapshot interpolation for P2P** — smooth guest rendering
16. **Implement unit detail view** — ✅ Done (tap card to see full stats + ability/movement/targeting/trigger/weapon descriptions + animated preview)
17. **Add ability tooltips** — ✅ Done (ABILITY_DESCRIPTIONS + MOVEMENT_DESCRIPTIONS + TARGETING_DESCRIPTIONS + TRIGGER_DESCRIPTIONS + WEAPON_DESCRIPTIONS shown in unit detail modal)
18. **Vary attack animation speed by unit attack speed** — `dt/u.a` instead of `dt/0.4`
19. **Add arena-themed backgrounds** — distinct visual identity per arena
20. **Pre-compute colorblind-filtered colors** — don't filter per-shape per-frame
21. **Use `structuredClone()` instead of `JSON.parse(JSON.stringify())`** — faster deep cloning
22. **Add `devicePixelRatio` handling** — ✅ Done (crisp rendering on retina displays)

### Long-term
23. **Split into ES modules** — improve maintainability without adding a build step
24. **Add unit tests for combat logic** — abilities, damage calculation, spell effects
25. **Implement delta compression for P2P snapshots** — reduce bandwidth
26. **Add service worker for offline play** — full PWA support
27. **Batch LLM field generation** — reduce 24 sequential calls to 3-4 batched calls
28. **Add spatial partitioning for collision separation** — O(n) instead of O(n²)
29. **Implement proper interpolation for guest rendering** — smooth multiplayer experience
30. **Consider PixiJS if sprite count grows** — GPU acceleration for 50+ units or complex particle effects

# Prompt Showdown — Tier 4: Visuals & Animation Overhaul

**Status: PARTIALLY IMPLEMENTED (expanded body plans, visual modifiers, patterns, CSS theme)**

**Post-implementation updates (2026-07-31):**
- Body plans expanded from 6 to 28 (added centaur, hydra, elemental, aberration, ooze, crystal, construct, angel, etc.)
- Weapons expanded from 9 to 14 (added scythe, whip, spear, rifle, wand)
- 7 visual modifier categories added: headFeature (12), backFeature (11), tailFeature (5), aura (11), eyeStyle (8), pattern (8), weaponStyle (7)
- New patterns rendered: circuit, tribal, stars, hexagons, marble
- CSS theme updated to purple/gold Draft Showdown style with radial gradients, glow effects, gradient cards

Tier 1 (Draft Showdown clone), Tier 2 (LLM unit forge), and Tier 3 (ramp carry + bot strategy + formation + spells, see `PLAN-TIER3.md`) are planned. This doc plans the next layer: **massively improving the look and animation of created units** — the single biggest weakness of the current game.

All line numbers reference `index.html` as of commit `ee3914d` + the uncommitted LLM-cancel WIP. Single-file architecture preserved. No new dependencies (stays Canvas 2D).

> **⚠️ Tooling rule (very important):** Never use the `chrome-devtools` MCP server for smoke tests or any browser automation. **Always use the `playwright` MCP server instead.** This applies to every phase in this plan and to all future work on this project. chrome-devtools is explicitly forbidden.

> **⚠️ LLM usage rule (very important):** LLM inference is **free** (runs locally via WebLLM, no API costs). **Never limit tokens, never cap daily forges, never throttle generation.** Take full advantage of the model:
> - Do **not** set `max_tokens` on any `chat.completions.create` call — let the model use its full output budget. (The current code already omits it; keep it that way. The `max_tokens:300` / `max_tokens:32` values in `PLAN.md` are obsolete — do not reintroduce them.)
> - Remove the **daily forge cap of 5** (`save.forgeCount`, line 3314-3327, 3446-3447). Forging is gated by watching an ad, not by an artificial count. If ad fatigue is a concern, surface it via analytics and address it with UX, not a hard cap.
> - Prefer **richer prompts and multi-call generation** over cramped single calls. If a feature needs 3 LLM calls to produce great output, do 3 calls — the ad hides the latency and there's no cost penalty.
> - Do **not** add timeouts to LLM calls. The user-driven Cancel button (already implemented) is the only escape hatch.

---

## Diagnosis: why created units look bad today

The current visual pipeline:

```
LLM picks 5 attrs (bodyPlan, weaponType, primaryColor, accentColor, sizeMod)
        ↓
RecipeAssembler.build() (line 791) — deterministic template lookup
        ↓
BODY_PLANS[bodyPlan] (line 674) — 6 templates, each ~5-7 flat shapes
WEAPONS[weaponType] (line 757) — 8 templates, each 1 shape
        ↓
SpriteRenderer.draw() (line 1564) — interpolate keyframes, rotate joints, fill shapes
```

### The 7 hard ceilings

1. **The LLM doesn't design the visual.** It picks 5 enum values; a deterministic template builds the recipe. So "a dragon" and "a lizard" both produce the identical 7-shape `quadruped` body. There are only **6 body plans × 8 weapons = 48 possible silhouettes** in the entire game. The "infinite LLM units" pitch is visually a lie — every forged unit is one of 48 shapes with a different color.
2. **Flat shapes, zero depth.** `_drawShapeRaw` (line 1612) does `fillStyle=shape.c; fillRect(...)` — solid fills, no gradients, no outlines, no drop shadows, no glow. Reads as 1985.
3. **Rotation-only joints.** `JOINT_ANGLES` (line 1558) defines 9 channels, all `rotate` around a pivot (`drawShape` line 1589). Can't do wing flap (translate), jaw open (rotate around different pivot), recoil (translate), or squash/stretch (scale).
4. **2-3 keyframes per animation, linear interpolation.** `interpolate` (line 1566) is pure lerp. No anticipation, no follow-through, no easing curves. Animations feel stiff and robotic.
5. **No secondary motion.** No capes that lag behind the body, no hair, no cloth, no spring physics. Every shape moves rigidly with the parent. **This is the #1 reason sprites feel "dead"** — secondary motion is what makes 2D animation feel alive (Disney principle #5).
6. **No unit auras.** A fire elemental looks identical to a water elemental except fill color. `BattleFX` (line 1705) only does hit/spawn/crit particles — no persistent per-unit particle emitter (fire trail, frost mist, poison cloud, holy glow).
7. **No faces.** Humanoids get a circle head (line 677); blobs get 2 black dots (line 709-710). No eyes that track targets, no blinking, no expression change on attack/death. Zero personality.

---

## Tier Structure

| Phase | What it delivers | Variety gain | Risk | LLM cost |
|---|---|---|---|---|
| **24** | Richer procedural rendering — more body plans, gradient/glow/outline shapes, translate+scale joints, spring-physics secondary motion, unit auras, faces, anticipation/follow-through, squash/stretch | ~10x better look, same 48 silhouettes | Low (additive, no LLM change) | None |
| **25** | LLM-authored visual modifiers — extend schema so LLM picks horns/wings/tail-type/aura/eye-color/pattern/weapon-style; assembler composes them onto a body plan | ~100x silhouettes | Medium (bigger schema, semantic validation) | +1-2s generation |
| **26** | LLM-authored full recipes (moonshot) — LLM emits the shapes array + animations via grammar sampler | Infinite | High (0.5B may emit broken shapes) | +5-10s, longer ad |

**Recommended order: 24 → 25. Skip 26 unless playtesting shows 24+25 still feels limited.**

Phase 24 is pure rendering quality — it lifts everything (starter units AND forged units AND future spell FX) with zero LLM change and zero risk to the forge. Phase 25 then unlocks real per-prompt visual variety. Phase 26 is a research moonshot best deferred.

---

## Phase 24 — Richer Procedural Rendering ✅ DONE (24a-24g)

**Why:** The cheapest 10x visual win. No LLM change, no schema change, no balance risk. Every unit in the game (starters, forged, future spell-summons) gets dramatically better look + feel. This is the foundation Phase 25 builds on.

### 24a — Expanded body plans (silhouette variety)

Replace the 6 `BODY_PLANS` (line 674) with ~20 hand-authored plans covering the archetypes the LLM currently can't distinguish:

| Body plan | Used for | Key shapes |
|---|---|---|
| humanoid | knight, archer, wizard, assassin, priest | existing + face |
| quadruped | beast, wolf, lizard | existing + tail |
| **dragon** | dragon, wyvern | body + 2 wing shapes (translate joint) + tail + horns |
| **serpent** | snake, naga, eel | segmented body (3-4 chained arcs) + fanged head |
| **bird** | phoenix, eagle, harpy | body + 2 flap wings (translate+rotate) + beak |
| **insect** | spider, ant, mantis | cephalothorax + abdomen + 6 legs (3 joint chains) |
| **crab** | crab, lobster, karkinos | shell + 2 claws (rotate) + 4 legs |
| **golem** | golem, elemental, construct | large blocky body + 2 slab arms + glowing core |
| **ghost** | ghost, wraith, specter | wispy body (3 overlapping arcs with alpha) + no legs |
| **fish** | fish, mermaid, kraken | body + tail fin + 2 fins |
| blob | slime, ooze, gelatin | existing + wobble (scale joint) |
| flying | imp, fairy, bat | existing + face |
| mechanical | engineer, mech, turret | existing + antenna |
| structure | tower, totem, obelisk | existing + glowing top |
| **plant** | treant, flower, mushroom | trunk + canopy/flower cap + root legs |
| **undead** | skeleton, zombie, lich | humanoid variant + exposed ribs + glowing eyes |
| **demon** | demon, imp, devil | humanoid + horns + tail + bat wings |
| **beast-man** | minotaur, centaur, werewolf | humanoid + beast head + fur accent |
| **aquatic** | kraken, octopus, squid | mantle + 4-6 tentacles (joint chains) |
| **monopod** | slime-king, mushroom-titan, blob-titan | single large body + 2 stub legs |

Each plan: 6-12 shapes (up from 5-7), 2-3 of which are "modifier slots" (head, back, arms) that Phase 25 will populate from LLM choices. Each plan defines its own animation keyframes with **5-6 keyframes per state** (up from 2-3) including anticipation + action + follow-through.

### 24b — Richer shape primitives

Extend `_drawShapeRaw` (line 1612) and the shape schema to support:

| New shape field | Effect | Implementation |
|---|---|---|
| `fill:"gradient"` + `c2` (secondary color) | Linear/radial gradient body fills | `createLinearGradient` / `createRadialGradient` |
| `outline:1` + `oc` (outline color) | Crisp outlines on every shape | `strokeRect`/`arc.stroke()` after fill |
| `glow:8` | `shadowBlur` glow on magical/energy shapes | `c.shadowBlur=shape.glow; c.shadowColor=shape.c` |
| `alpha:0.6` | Per-shape alpha (ghosts, auras) | `c.globalAlpha` per shape |
| `dropShadow:true` | Soft ellipse shadow under the unit | One `ellipse` fill at `u.y+u.z` per unit, drawn first |
| `pattern:"stripes"\|"spots"\|"scales"` | Two-tone surface patterns | Clip to shape, draw secondary color stripes/dots over fill |

Drop shadow is the single highest-impact addition — it grounds every unit in space instead of floating. Gradient bodies make flat shapes read as 3D. Glow makes magical units read as magical. Outlines make everything crisper at small sizes.

### 24c — New joint types (translate + scale, not just rotate)

`drawShape` (line 1589) currently only rotates. Extend `JOINT_ANGLES` (line 1558) and `drawShape` to support three joint modes per channel:

| Joint mode | Channels | Effect |
|---|---|---|
| `rotate` (existing) | `arm_raise`, `leg_swing`, `head_tilt`, `tail_wag`, `staff_raise`, `bow_draw` | Rotation around pivot |
| `translate` (new) | `wing_flap`, `jaw_open`, `recoil`, `bob`, `lunge` | Offset shape position by channel value |
| `scale` (new) | `squash`, `stretch`, `breathe`, `wobble` | Scale shape around its center |

Shape declares its joint mode: `{t:"rect", ..., joint:"wing_flap", jointMode:"translate", jointAxis:"y", jointRange:8}`. Default `jointMode:"rotate"` for backward compat. This unlocks wing flaps, jaw chomps, attack recoil, idle breathing (scale), squash-on-land, stretch-on-attack — the Disney principles that make 2D feel alive.

### 24d — Spring-physics secondary motion

The big one. Add a `secondary` array to each shape: `{shape, parent:"spine", spring:{k:80, d:4, mass:1}}`. The shape lags behind its parent's movement with a damped spring, producing capes that trail, hair that whips, tails that sway. Implementation:

- New `SpriteRenderer.updateSecondaries(u, dt)` — per unit, per secondary shape, integrate spring: `a = -k*(x - parentRest) - d*v; v += a*dt; x += v*dt`. Store `u.secState = {shapeIdx: {x, v}}`.
- Called from `Battle.update` (line 1947) for each alive unit.
- Render: draw secondary shapes at `parentPos + springOffset` instead of fixed position.
- Cap secondary shapes at 3 per unit (perf budget).
- Apply to: capes (parent=shoulders), tails (parent=hips), hair (parent=head), loin-cloths (parent=hips).

This is the single biggest "alive" upgrade — secondary motion is what separates amateur animation from professional.

### 24e — Persistent unit auras

Extend `BattleFX` (line 1705) with `unitAura(u, dt)` — a per-unit persistent particle emitter driven by the unit's `fxType` (already a derived field from the LLM, line 137 etc.). Each frame, with probability based on `fxType`, spawn 1-2 particles at the unit's position:

| `fxType` | Aura |
|---|---|
| `fire` / `explosion` | Rising orange embers |
| `frost` | Falling blue snowflakes |
| `poison` / `poison_cloud` | Dripping green bubbles |
| `lightning` | Flickering yellow sparks |
| `heal_glow` | Rising golden motes |
| `shockwave` | Periodic ring pulses |
| `fire_wall` | Flickering flame base |

Capped at 2 particles/frame per unit, reusing the `MAX_PARTICLES` budget (line 1704). Degrades gracefully on mobile (existing FPS guard, line 1523). Auras make elemental units *read* instantly — a fire elemental no longer looks like a red blob.

### 24f — Faces, eyes, expressions

Add an optional `face` object to body plans: `{eyeColor, eyeCount:2, mouth:"frown"\|"snarl"\|"neutral", brow:"angry"\|"calm"}`. `SpriteRenderer.drawFace(c, u, channels)` draws eyes that:
- **Track the current target** (from `Battle.act`'s `target` — store as `u.target` runtime field). Eyes shift toward `target.x/y`.
- **Blink** every 3-5s (randomized per unit) — a 100ms scale-Y to 0.1.
- **Widen on attack** (state==="attack") and **narrow on death**.
- **Glow** for magical/undead units (`eyeColor` with `shadowBlur`).

Expressions: mouth opens on attack (jaw joint), frown deepens on low HP. This gives every unit personality — a dragon glaring at its prey, a skeleton's empty eye sockets glowing, a golem's blank stare.

### 24g — Animation polish (anticipation, follow-through, squash/stretch)

Rewrite all body-plan `animations` (line 684-755) with 5-6 keyframes per state and proper Disney principles:

```
attack: [
  {t:0,   arm_raise:0,   squash:0,    lunge:0},     // rest
  {t:0.15,arm_raise:-0.3,squash:0.15, lunge:-0.2},  // ANTICIPATION: wind up, squash down
  {t:0.35,arm_raise:1,   squash:-0.1, lunge:0.4},   // ACTION: strike, stretch forward
  {t:0.55,arm_raise:0.8, squash:0,    lunge:0.2},   // FOLLOW-THROUGH: overshoot
  {t:0.75,arm_raise:0.2, squash:0.05, lunge:0},     // settle
  {t:1,   arm_raise:0,   squash:0,    lunge:0}      // rest
]
```

Add easing to `interpolate` (line 1566): support `ease:"easeOut"` / `"easeInOut"` per keyframe segment (cubic bezier or simple smoothstep). Linear interp is the default for backward compat.

Squash/stretch: on attack windup (squash down 15%), on strike (stretch forward 10%), on landing after knockback (squash 20% then recover). On death: squash flat + disintegrate into colored particles (tie into `BattleFX`).

### Code touchpoints (Phase 24)
- `BODY_PLANS` (674-756) — expand to ~20 plans, richer shapes, 5-6 keyframes
- `WEAPONS` (757-773) — add glow to magical weapons, outline to all
- `scaleShape` (774-790) — handle new fields (c2, outline, glow, alpha, pattern, jointMode, jointAxis, jointRange, secondary)
- `RecipeAssembler.build` (791-811) — pass through new fields; add `face` + `aura` from derived fxType
- `JOINT_ANGLES` (1558) → `JOINT_CONFIG` — per-joint mode + axis + range
- `SpriteRenderer.drawShape` (1589) — translate + scale joints, not just rotate
- `SpriteRenderer._drawShapeRaw` (1612) — gradients, outlines, glow, alpha, patterns, drop shadow
- `SpriteRenderer.draw` (1637) — draw drop shadow first, face last, integrate secondaries
- New `SpriteRenderer.updateSecondaries` — spring physics
- New `SpriteRenderer.drawFace` — eyes + mouth + brow
- `Battle.update` (1947) — call `updateSecondaries` + `BattleFX.unitAura` per unit
- `Battle.initRuntime` (1869) — init `u.secState`, `u.faceState` (blink timer, target ref)
- `BattleFX` (1705) — `unitAura(u, dt)` per fxType
- `Battle.act` (1993) — store `u.target` for eye tracking
- `ANIM_DURATIONS` (1562) — per-state durations may need tuning
- `SPRITE_RECIPES` (2408+) — re-author the 6 starter recipes to use new features (drop shadow, gradient, glow, face, secondary cape for Knight, etc.)

### Smoke test (Phase 24)
1. **Starter units:** open the deck screen — Knight has a drop shadow, gradient armor, outlined shield, a cape that trails when he moves, eyes that track. Wizard has a glowing staff, purple aura, eyes that glow.
2. **Movement:** move a unit — secondary motion (cape/hair/tail) lags and settles with spring physics. Legs swing with anticipation.
3. **Attack:** Knight attacks — winds up (squash), strikes (stretch + lunge), overshoots (follow-through). Eyes widen. Mouth opens.
4. **Auras:** spawn a fire-elemental forged unit — rising embers. Frost unit — falling snowflakes. Poison — dripping bubbles.
5. **Death:** unit dies — squashes flat, disintegrates into colored particles matching its primary color.
6. **Mobile perf:** verify FPS stays >25 with 12 units each having aura + 3 secondary shapes. Degrade path: drop auras first, then secondaries, then faces.
7. **P2P:** auras + secondaries are state-derived from `u.x/y/animState` — guest renders identically with no extra network traffic. Verify.

### Risks (Phase 24)
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mobile FPS death (12 units × aura × 3 secondaries × face) | Medium | High (unplayable) | Tiered degradation: FPS<25 → drop auras; <20 → drop secondaries; <15 → drop faces + gradients. Existing Phase 17 guard pattern. Cap particles, secondaries, auras per unit. |
| Spring physics instability (overshoot/oscillation) | Low | Medium (jittery visuals) | Damped spring with `d` tuned to critical damping. Clamp offset to `jointRange`. Fallback to static if `secState` becomes NaN. |
| Glow (shadowBlur) is expensive on some GPUs | Medium | Medium (FPS) | Only apply glow to ≤2 shapes per unit (eyes + weapon). Cap `shadowBlur` at 8. Degrade to flat fill on mobile. |
| Re-authored starter recipes look worse than before | Low | Low (revert) | Keep old recipes as `SPRITE_RECIPES_LEGACY` for one release; A/B compare in smoke test. |
| P2P guests see different secondary motion (non-deterministic springs) | Medium | Low (visual only) | Secondary motion is visual-only; combat state is in snapshots. Acceptable divergence. If jarring, seed springs deterministically from `u.id`. |

---

## Phase 25 — LLM-Authored Visual Modifiers ✅ DONE

**Why:** Phase 24 makes everything look 10x better but still only ~20 silhouettes (the new body plans). A "fire dragon" and "ice dragon" both use the `dragon` body plan — same shape, different color. Phase 25 lets the LLM pick *visual modifiers* (horns, wings, tail type, aura, eye color, pattern, weapon style) that the assembler composes onto the body plan, giving real per-prompt visual variety without the risk of the LLM emitting raw shape coordinates.

### Design: Visual Modifier API

Extend `UNIT_SCHEMA` (line 570) with 7 new enum fields the LLM picks. Each maps to a modifier the `RecipeAssembler` composes:

| Field | Enum | Composes |
|---|---|---|
| `headFeature` | `none` \| `horns` \| `antlers` \| `crest` \| `halo` \| `crown` \| `horns_curved` \| `ears_pointed` | Shape(s) on head |
| `backFeature` | `none` \| `wings_bat` \| `wings_feathered` \| `wings_dragon` \| `cape` \| `shell` \| `spikes` \| `aura_vent` | Shape(s) on back (with secondary motion) |
| `tailFeature` | `none` \| `tail_long` \| `tail_spade` \| `tail_flame` \| `tail_fin` \| `tail_prehensile` \| `tail_stinger` | Tail shape + spring physics |
| `aura` | `none` \| `fire` \| `frost` \| `poison` \| `lightning` \| `holy` \| `shadow` \| `arcane` | Persistent particle emitter (Phase 24e) |
| `eyeStyle` | `normal` \| `glowing` \| `slit` \| `empty` \| `visorglow` \| `compound` \| `closed` | Face rendering (Phase 24f) |
| `pattern` | `none` \| `stripes` \| `spots` \| `scales` \| `runes` \| `cracks` \| `gradient_two_tone` | Surface pattern (Phase 24b) |
| `weaponStyle` | `standard` \| `ornate` \| `glowing` \| `cracked` \| `pristine` \| `battered` | Weapon shape variant + glow |

Combinations: 8 × 8 × 7 × 8 × 7 × 7 × 6 = **1,053,696** visual variants per body plan. With 20 body plans (Phase 24a), that's ~21M distinct silhouettes — effectively infinite for a 0.5B model's purposes. A "fire dragon" = `dragon` body + `horns_curved` head + `wings_dragon` back + `tail_flame` tail + `fire` aura + `glowing` eyes + `scales` pattern + `glowing` weapon. An "ice dragon" = same body but `frost` aura + `cracks` pattern + `pristine` weapon. They look completely different.

### Changes

1. **Extend `UNIT_SCHEMA`** (line 570) with the 7 new fields (all enums). Add to `required`.
2. **Extend `generateUnit` prompt** (line 1104-1117) with the new enum lists.
3. **New `VISUAL_MODIFIERS` lookup** (sibling of `BODY_PLANS`, ~line 756): each enum value maps to a function returning `{shapes, secondaries, face, aura, pattern}` that `RecipeAssembler.build` merges onto the body plan. Example:
   ```
   const HEAD_FEATURES={
     horns:c=>[{t:"polygon",pts:[[-3,-22],[-1,-28],[1,-28],[3,-22]],c:c.accent}],
     halo:c=>[{t:"arc",cx:0,cy:-22,r:7,start:0,end:Math.PI*2,c:"#ffd",glow:6}],
     // ...
   };
   const BACK_FEATURES={
     wings_dragon:c=>[
       {t:"polygon",pts:[[-6,-10],[-16,-18],[-14,-4],[-6,-6]],c:c.accent,joint:"wing_flap",jointMode:"translate",jointAxis:"y",jointRange:6,secondary:{parent:"shoulder",spring:{k:60,d:3}}},
       {t:"polygon",pts:[[6,-10],[16,-18],[14,-4],[6,-6]],c:c.accent,joint:"wing_flap",jointMode:"translate",jointAxis:"y",jointRange:6,secondary:{parent:"shoulder",spring:{k:60,d:3}}}
     ],
     cape:c=>[{t:"rect",x:-7,y:-10,w:14,h:14,c:c.accent,secondary:{parent:"shoulder",spring:{k:80,d:4}}}],
     // ...
   };
   ```
4. **`RecipeAssembler.build`** (line 791) — after building body + weapon, look up each modifier and merge: append shapes, register secondaries, set face + aura + pattern. Cap total shapes at 14 (perf budget from PLAN.md risk table).
5. **`semanticValidate`** (line 635) — add cross-field rules: `wings_*` only on `humanoid`/`beast-man`/`dragon`/`bird` body plans (not `blob`/`structure`); `tail_*` only on plans with a tail slot; `halo` only on `humanoid`/`angelic`; `compound` eyes only on `insect`/`crab`. Re-ask flagged fields.
6. **`templateFallback`** (line 819) — extend each template with sensible modifier defaults (dragon template gets `wings_dragon`+`horns_curved`+`tail_spade`; mage gets `glowing` eyes + `arcane` aura).
7. **Forge preview** (line 3331+) — render the unit with all modifiers on a larger canvas (96×96) so the player can see horns/wings/aura before keeping.

### Code touchpoints (Phase 25)
- `UNIT_SCHEMA` (570-592) — 7 new enum fields
- `generateUnit` prompt (1104-1117) — new enum lists
- New `VISUAL_MODIFIERS` lookup (~756) — `HEAD_FEATURES`, `BACK_FEATURES`, `TAIL_FEATURES`, `AURAS`, `EYE_STYLES`, `PATTERNS`, `WEAPON_STYLES`
- `RecipeAssembler.build` (791-811) — merge modifiers
- `CONSISTENCY_RULES` (612-634) — modifier ↔ body plan rules
- `templateFallback` (819+) — modifier defaults per template
- Forge preview (3331+) — larger canvas, render with modifiers
- `attrsToUnit` (938) — pass new fields through

### Smoke test (Phase 25)
1. **Forge "fire dragon":** verify LLM returns `dragon` body + `horns_curved` + `wings_dragon` + `tail_flame` + `fire` aura + `glowing` eyes + `scales` pattern. Preview shows all modifiers. In battle: wings flap, tail trails, fire aura rises.
2. **Forge "ice dragon":** verify `frost` aura + `cracks` pattern + `pristine` weapon — looks visually distinct from fire dragon despite same body plan.
3. **Forge "angel":** verify `halo` + `wings_feathered` + `holy` aura + `glowing` eyes. Halo glows, wings flap white.
4. **Semantic validation:** forge "winged blob" → validator flags `wings_*` on `blob` body → re-asks → produces a valid combo.
5. **Template fallback:** disable LLM → forge "dragon" → template gives `wings_dragon`+`horns_curved`+`tail_spade` — still looks like a dragon, not a generic quadruped.
6. **Shape cap:** forge a unit with many modifiers → verify total shapes ≤14 (perf budget). Excess modifiers dropped gracefully.
7. **P2P:** forged unit with modifiers serialized to peer → guest renders identical modifiers.

### Risks (Phase 25)
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM picks nonsensical modifier combos (wings on blob) | Medium | Low (visual only) | `semanticValidate` flags invalid combos; per-field fallback re-asks. Even invalid combos still render — just look odd, not broken. |
| 7 new fields slow generation | Low (+1-2s for 7 enum picks in one JSON call) | Low (still <15s) | All 7 fields are enums — grammar sampler forces valid values instantly. Single JSON call, not 7 calls. |
| Shape cap exceeded (body 8 + weapon 1 + 7 modifiers × 2 shapes = 23) | High | Medium (perf) | Cap at 14 total; `RecipeAssembler` drops lowest-priority modifiers (pattern first, then back, then head). |
| Modifiers clip/collide visually (horns inside head) | Medium | Low (visual) | Modifier shapes are positioned relative to body-plan anchor points (head top, shoulder, hips). Smoke test each combo. |
| P2P recipe size grows (7 new fields + modifier shapes) | Low (still <3KB compressed) | Low | Existing lz-string compression (Phase 18) handles it. Modifiers are enum values, not shapes — shapes are reconstructed on the peer. |

---

## Phase 26 — LLM-Authored Full Recipes (Moonshot) ⏸ DEFERRED

**Why:** The theoretical maximum — let the LLM emit the entire recipe (shapes array + animations) via grammar sampler. Infinite visual variety, no templates at all.

**Why deferred:** A 0.5B model reliably picks enum values (Phases 24-25) but emitting coherent shape coordinates (e.g. "a dragon wing is `polygon pts:[[-6,-10],[-16,-18],[-14,-4],[-6,-6]]`") is a much harder generation task. High risk of broken/incoherent shapes, long generation time (5-10s, needs a longer ad), and heavy validation burden. Phase 25's ~21M combinations is already effectively infinite for player perception.

**When to revisit:** If playtesting after Phase 25 shows players can still spot repeated silhouettes, OR if a larger model (1.5B/3B) becomes viable in-browser via WebGPU memory growth. Approach: extend the grammar schema to allow the LLM to emit a `customShapes` array (capped at 4 shapes) that overrides/complements the body plan. Validate each shape's coords are in range, types are valid, joints exist. Fall back to body-plan-only if validation fails.

---

## Verification Strategy (per phase)

| Phase | Smoke test |
|---|---|
| 24 (Rendering) | Starter units have drop shadows, gradient bodies, glowing weapons, trailing capes (spring physics), tracking eyes, attack windup/strike/follow-through, death disintegration. Mobile FPS >25 with 12 units. P2P guest matches. |
| 25 (Modifiers) | "Fire dragon" vs "ice dragon" forge → visually distinct (different aura, pattern, weapon style, but same body plan). "Angel" → halo + feathered wings + holy aura. Semantic validation rejects wings-on-blob. Template fallback still produces a recognizable dragon. Shape cap respected. P2P matches. |

---

## Implementation Order & Dependencies

```
Phase 24 (Rendering)  ──→ Phase 25 (Modifiers) — needs the new shape/joint/secondary/aura/face systems
```

- **Phase 24 is the foundation.** It delivers the shape primitives, joint modes, spring physics, aura system, face system, and animation polish that Phase 25's modifiers plug into. Phase 25 without Phase 24 would just be "more flat shapes."
- **Phase 25 is the variety unlock.** It uses Phase 24's systems to compose LLM-chosen modifiers into ~21M distinct silhouettes.
- **Phase 26 deferred** until playtesting proves 25 is insufficient.
- Each phase = 1 commit + 1 Playwright smoke test (never chrome-devtools — see tooling rule above). Push to `origin/main` after each.
- **Phase 24 is large** — consider splitting into 24a (body plans + shape primitives + drop shadows) → 24b (joints + secondary motion) → 24c (auras + faces + animation polish), each its own commit, to keep smoke tests tractable.

---

## What This Tier Does NOT Do (out of scope)

- **Sprite-sheet image generation** — no in-browser image-gen model suitable for 0.5B WebGPU. Off the table.
- **Spine / DragonBones skeletal animation library** — adds a dependency, breaks single-file architecture.
- **3D / WebGL** — stays Canvas 2D. The look we're chasing is "premium 2D juice," not 3D.
- **Per-unit manual customization UI** — players don't draw units; the LLM composes them. A future tier could let players pick modifiers from a menu (no LLM needed), but that's a different product.
- **Re-skinning the battlefield** — this tier is unit visuals only. Battlefield/arena backgrounds are a separate visual tier.

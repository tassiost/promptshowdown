# Bug Hunt — Prompt Showdown

Status legend: 🔴 confirmed | 🟡 suspected | 🟢 fixed | ⚪ cannot reproduce

---

## Critical

### BUG-001 🟢 `lighten()` produces invalid hex colors (crashes forge preview)
**File:** index.html:841-846
**Found:** 2026-07-30
**Repro:** Forge any unit with a pattern (e.g. "dragon" → scales pattern). The pattern applies `c2=lighten(scaled.c,0.15)` to body shapes. When `scaled.c` is a 3-char hex (e.g. `#fb0`, `#a72`, `#000`), `lighten` produces invalid output like `#2635d6.4` (decimal point in hex).
**Root cause:** Two bugs in `lighten`:
1. `r`, `g`, `b` are not `Math.round`'d → `(1<<24)+(r<<16)+(g<<8)+b` is a float → `.toString(16)` includes decimal point (e.g. `19281366.25.toString(16)` = `"12635d6.4"`)
2. 3-char hex (`#fb0`) not expanded to 6-char (`#ffbb00`) → `parseInt('fb0',16)` = 4016 = 0x0FB0, wrong channels extracted
**Impact:** Forge preview crashes with `addColorStop` SyntaxError. Any forged unit with a pattern on a 3-char-hex shape breaks rendering. Also affects `headHex=lighten(primary,0.2)` if primary is 3-char (unlikely since COLOR_MAP uses 6-char, but possible).
**Fix:** Round channels + handle 3-char hex:
```js
function lighten(hex,amt){
  let h=hex.slice(1);
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const n=parseInt(h,16);
  const r=Math.min(255,Math.round(((n>>16)&255)+amt*255));
  const g=Math.min(255,Math.round(((n>>8)&255)+amt*255));
  const b=Math.min(255,Math.round((n&255)+amt*255));
  return"#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
```

### BUG-002 🟢 RECIPE_MINIFY key collisions corrupt P2P serialization
**File:** index.html:1418-1428
**Found:** 2026-07-30
**Repro:** Serialize a forged unit via `serializeUnitsForPeer` → `deserializeUnitsFromPeer`. Shapes with `cx`/`cy` properties (circles, arcs, ellipses) lose those properties.
**Root cause:** `RECIPE_MINIFY` maps both `cx:"x"` and `x:"x"` to the same short key `"x"`. When `RECIPE_EXPAND` is built via `Object.fromEntries(Object.entries(RECIPE_MINIFY).map(([k,v])=>[v,k]))`, duplicate values overwrite — `RECIPE_EXPAND["x"]="x"` (last wins), so `cx` is lost. Same for `cy:"y"` / `y:"y"`.
**Verified:** `{t:'circle',cx:10,cy:20,r:8}` → minified `{t:'circle',x:10,y:20,r:8}` → expanded `{t:'circle',x:10,y:20,r:8}` (cx/cy become x/y — wrong keys for circle renderer).
**Impact:** P2P multiplayer: forged units sent to peer render incorrectly (shapes with cx/cy misplaced or invisible). Share URLs may also be affected.
**Fix:** Use unique short keys: `cx:"cx"`, `cy:"cy"` (or `cx:"kx"`, `cy:"ky"`).

### BUG-003 � `unit()` drops visual modifier fields (P2P + share + clone)
**File:** index.html:611-635
**Found:** 2026-07-30
**Repro:** Forge a unit with visual modifiers → serialize for P2P → deserialize on peer. The peer's unit has no `headFeature`, `backFeature`, `tailFeature`, `aura`, `eyeStyle`, `pattern`, `weaponStyle`, or `bodyPlan`.
**Root cause:** `attrsToUnit` (line 1525-1531) stores visual modifiers on the unit object. But `unit()` (line 611-635) only copies a fixed set of fields — it doesn't preserve `headFeature`, `backFeature`, `tailFeature`, `aura`, `eyeStyle`, `pattern`, `weaponStyle`, or `bodyPlan`. These are silently dropped.
**Affected paths:**
- `deserializeUnitsFromPeer` → `unit(d)` → drops visual modifiers
- `cloneUnit(u)` → `unit(JSON.parse(JSON.stringify(u)))` → drops visual modifiers
- `shareUnit` (line 4359) → doesn't include visual modifiers in shared data
**Impact:** P2P: peer sees broken unit (no aura, no head features, wrong eyes). Share: imported unit missing visual modifiers. Clone: cloned units lose visual modifiers (affects draft duplicates).
**Fix:** Add visual modifier fields to `unit()`:
```js
bodyPlan:x.bodyPlan||null,
headFeature:x.headFeature||"none",
backFeature:x.backFeature||"none",
tailFeature:x.tailFeature||"none",
aura:x.aura||"none",
eyeStyle:x.eyeStyle||"normal",
pattern:x.pattern||"none",
weaponStyle:x.weaponStyle||"standard",
```
Also add them to `shareUnit`'s data payload.

---

## Medium

### BUG-004 � Spell persistent zones hardcoded to enemies only
**File:** index.html:3185-3186
**Found:** 2026-07-30
**Description:** `tickZones` always applies zone effects to `u.team!==z.team` (enemies). Ally-targeted persistent zones (e.g., healing zone, shield zone) would damage allies instead of helping them.
**Impact:** Any spell with `shape:"persistent_zone"` and `target:"ally_*"` will target enemies instead. Currently no such spell exists in templates, but LLM-forged spells could produce them.
**Fix:** Check `z.spec.target` to determine ally vs enemy filtering.

### BUG-005 � Movement functions don't check if target is dead
**File:** index.html:2136-2161
**Found:** 2026-07-30
**Description:** `chase`, `flee`, `hold_midpoint`, `kite` check `if(target)` but not `if(target.h>0)`. Units could chase/flee dead targets.
**Note:** In practice, the targeting functions pre-filter dead units (line 3350-3351), so `target` should always be alive. However, a unit could die between targeting and movement in the same frame (if another unit kills it first in the loop). Low real-world impact.
**Fix:** Add `target&&target.h>0` checks in movement functions.

### BUG-006 🔴 Shape cap drops wrong shapes (tail before weapon)
**File:** index.html:1346-1347
**Found:** 2026-07-30
**Description:** `while(shapes.length>14)shapes.splice(shapes.length-1,1)` drops from the END. Shapes are added: body → weapon → head features → back features → tail features. So it drops tail first, then back, then head, then weapon. The comment says "drop lowest-priority: pattern, then back, then head" but pattern (body shapes) is never dropped.
**Impact:** Complex units with many features lose tail/back features. Not critical but suboptimal priority.
**Fix:** Drop in priority order: tail → back → head → weapon (current order is tail → back → head → weapon, which is actually reasonable). Or increase cap. Low severity.

### BUG-007 � `G.screen()` leaves blank page if target doesn't exist
**File:** index.html:4204-4212
**Found:** 2026-07-30
**Description:** If `$(id)` returns null, all screens lose `active` class and none gets it. Player sees blank page.
**Fix:** Fall back to menu screen: `if(!target)target=$("menu");`

### BUG-008 � All-spell draft picks → empty army → instant loss
**File:** index.html:4841-4855
**Found:** 2026-07-30
**Description:** If all draft picks are spells (20% chance each, ~0.8% for 3 picks), `buildArmy()` returns empty array. Battle starts with 0 player units → instant loss.
**Fix:** Guarantee at least 1 unit in draft, or auto-fill with base units if army is empty.

### BUG-009 � `migrateSave` keeps empty loadout array
**File:** index.html:547
**Found:** 2026-07-30
**Description:** `if(s.loadout)` is truthy for `[]`. Empty loadout → player can't field units. Only triggers with corrupt save data.
**Fix:** `if(s.loadout&&s.loadout.length>0)`

---

## Low

### BUG-010 🟡 Poison ticks after unit death
**File:** index.html:3320-3324
**Found:** 2026-07-30
**Description:** Poison continues ticking on dead units (h<=0) until duration expires. Harmless (dead units are skipped in main loop) but wastes computation.
**Fix:** Add `if(u.h<=0)continue;` before poison tick.

### BUG-011 � `eyeStyle:"closed"` doesn't skip eye drawing
**File:** index.html:2516-2535
**Found:** 2026-07-30
**Description:** `EYE_STYLES.closed = null` but `drawFace` doesn't check for `eyeStyle==="closed"` to skip eyes. It only checks `recipe.face===false`. Units with `eyeStyle:"closed"` still draw eyes.
**Fix:** Add `if(u.recipe?.eyeStyle==="closed")return;` in `drawFace`.

### BUG-012 🟡 `GameAudio.stopMusic` doesn't disconnect gain nodes
**File:** index.html:2713-2717
**Found:** 2026-07-30
**Description:** `stopMusic` stops oscillators but doesn't disconnect gain nodes (`bg`, `g`). Minor memory leak in audio graph.
**Fix:** Store gain nodes and disconnect them in `stopMusic`.

### BUG-013 🟡 Quest streak doesn't update across midnight
**File:** index.html:3833-3848
**Found:** 2026-07-30
**Description:** `checkStreak()` only runs during `G.init()`. If a session spans midnight, streak won't increment until next restart.
**Fix:** Check streak on each match end or periodically.

### BUG-014 � Double-forge race condition
**File:** index.html:5304
**Found:** 2026-07-30
**Description:** Rapidly clicking "Watch Ad" + "Skip" could call `_doForge` twice. Second call overwrites `pendingForgeUnit`.
**Fix:** Set a `_forgeRunning` flag and guard against re-entry.

---

## Investigated — Not Bugs

- **Targeting functions don't filter dead units** (line 2115-2130): NOT a bug — enemies array is pre-filtered with `h>0` at line 3350-3351 before being passed to targeting.
- **Spell periodic trigger missing init** (line 3165-3167): NOT a bug — `lastFire:0` is initialized at line 3273.
- **`renderPreview` crashes on null recipe**: NOT a bug — `draw()` has a null-recipe guard at line 2463.
- **`drawFace` crashes on null recipe**: NOT a bug — `u.recipe&&u.recipe.eyeColor` guard at line 2529 protects the eyeStyle access.
- **`GameAudio.startMusic` creates multiple bass oscillators**: NOT a bug — `if(this.musicInterval)return` guard at line 2691 prevents double-start.
- **Colorblind filter mutates shapes**: NOT a bug — `shape={...shape,c:...}` creates a new object at line 2371.
- **`scaleShape` mutates original pts**: NOT a bug — `out.pts=out.pts.map(...)` creates new arrays.
- **RecipeAssembler pattern mutates BODY_PLANS**: NOT a bug — `scaleShape` returns new objects, pattern is applied to the copy.

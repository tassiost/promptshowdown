# WebGPU Take-Advantage Plan — Prompt Showdown

## Smallest capable LLM model

The model with the lowest VRAM footprint that is still **in the same instruction-tuned family** as the current forge is:

- **`Qwen2.5-0.5B-Instruct-q4f16_1-MLC`** — ~944 MB, `low_resource: yes`, 4 k context.

That is the official smallest MLC/Qwen model. For even smaller total download there are third-party conversions (e.g. 1 k context `Qwen2.5-0.5B-q4f32_1` or a custom 0.5B q4f32 1 k build), but the official q4f16_1 is the safe baseline.

**Caveats:**
- The project used `Qwen2.5-0.5B` before Phase 12 and **moved to 1.5B** because the 0.5B model made semantic mistakes (e.g. `archer` with `hp=180`, wrong role/weapon pairings) and needed many re-asks.
- For the current **per-field micro-prompts** the 0.5B can still fill the 24 simple enum/stat fields *individually*, so it is **capable** for our grammar. It will just be less reliable / need more validation.
- `TinyLlama-1.1B-q4f16_1` is smaller on disk (~697 MB) but is a chat model, not an instruction model with the same JSON/JSON-mode reliability as Qwen. Not recommended for structured generation.

**Recommendation for a smallest-capable tier:**

| Tier | Model | VRAM | Use case |
|------|-------|------|----------|
| Minimal | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | ~944 MB | Low-end laptops, integrated GPU, first-time load over slow connections. |
| Default | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | ~1.6 GB | Current model. Good balance of quality and speed. |
| Premium | `Qwen2.5-3B-Instruct-q4f16_1-MLC` | ~2.5 GB | Discrete GPUs with >3 GB free VRAM. Better creative/semantic output. |

Adaptive selection can be done at runtime from `navigator.gpu.requestAdapter()` + `navigator.deviceMemory` heuristics; if detection is inconclusive, start at 1.5B and let the user pick in Settings.

---

## WebGPU for FX

### Goal

Keep the existing Canvas 2D sprite renderer as the source of truth for units/cards, but add a **WebGPU overlay** for expensive visual effects that Canvas 2D does badly:

- Large area spell zones (fire wall, heal rain, poison pools).
- Explosion / burst particles (TNT, chain lightning, death FX).
- Per-unit auras and glow (legendary units, buff/debuff halos).
- Light bloom on projectiles and critical hits.
- Post-process color grading / vignette per arena.

Canvas 2D remains for the deterministic `SpriteRenderer.draw()` sprite, shape recipe, card previews, and scout/deck images. WebGPU only draws *transient, additive* FX on top.

### Architecture

```
#cv           (shared battle/draft canvas, Canvas 2D, all units/spells)
#fxOverlay    (WebGPU canvas, same size, pointer-events:none, on top)
```

- `G.screen()` reparents `#cv` into `#draftCanvasSlot` or `#battle`. The FX overlay moves with it.
- `WebGPUEFX.init()` creates the WebGPU device once (during `G.init()` if `navigator.gpu` exists and `gputier() !== "none"`).
- `WebGPUEFX.battleLoop(dt)` is called from `Battle.loop()` after the 2D frame is drawn.
- FX commands are issued through a small JS API:
  - `WebGPUEFX.emit(name, x, y, color, magnitude)` — one-shot burst.
  - `WebGPUEFX.zone(spec, x, y, color, radius, duration)` — persistent spell zone.
  - `WebGPUEFX.aura(unit, color, intensity)` — attach a glow to a unit.
  - `WebGPUEFX.clear()` — remove all FX (battle end).
- Data uploaded per frame: unit positions, radii, team colors, active zones, new emitters.
- If WebGPU init fails, the overlay is hidden and `BattleFX` falls back to the existing Canvas 2D particles.

### Implementation steps

1. **Feature test:** detect WebGPU and require `f16`? `r32float` is safer for storage buffers and avoids shader-f16 gating. Use `r16float` only as optional.
2. **Overlay canvas:** add `<canvas id="fxOverlay" style="position:absolute;pointer-events:none;"></canvas>` and position it exactly over `#cv`.
3. **WebGPU init:** `navigator.gpu.requestAdapter()` → `requestDevice()` with `textureBindingViewDimension`, `timestampQuery` optional. Create a pipeline with two fragment passes:
   - **Particle pass:** point sprites from a storage buffer, alpha blending, additive mode.
   - **Zone/bloom pass:** full-screen triangle with storage-buffer centers for SDF zones and a bloom threshold.
4. **JS bridge:**
   - Collect active zones from `Spell.zones`.
   - Collect burst events from `BattleFX` trigger points (explosion, chain, death, crit).
   - Collect unit auras from `u.aura`, `u.shieldActive`, `u.frenzyT`, `u.buff` flags.
5. **Fallback:** if `WebGPUEFX` is null, `BattleFX` continues using the existing Canvas 2D functions (`BattleFX.burst`, `BattleFX.groundRing`, etc.).

### Risks

- **Headless testing / CI:** Playwright Chromium may not expose a real WebGPU adapter, so the FX overlay will be disabled in E2E. Need a smoke test that checks `WebGPUEFX` is at least created on a WebGPU-capable browser.
- **Mobile / battery:** WebGPU is not universally available and can drain battery. Keep it optional and disabled on `qualityTier() === "low"` or `"minimal"`.
- **Canvas sync:** the overlay must match the 2D canvas DPR and resize exactly, or effects will misalign.

---

## Compute offloads

### Where it helps

WebGPU compute is only worth the upload/download overhead when the data set is large. With the current 12-unit cap it is usually slower than JS. The offload becomes interesting if we ever increase unit count, add more complex spell interactions, or move the particle system to the GPU.

**Candidates:**

1. **Particle simulation**
   - Move `BattleFX` particles entirely to GPU: positions, velocities, lifetimes, colors.
   - Compute update in a compute shader; render as point sprites.
   - JS only spawns / removes emitters.

2. **Spatial neighbor queries**
   - Compute a grid hash of unit positions on the GPU.
   - Return neighbor lists for `enemy_cluster`, `splash`, `aura` range, `avoidanceOffset`.
   - Overkill until we have >20 units.

3. **Spell affected-unit queries**
   - For each active zone/spell, compute the set of units inside circle/cone/line shapes on the GPU.
   - Return as small bitmask arrays.
   - More useful than full neighbor search because zones are few and the query is embarrassingly parallel.

4. ** avoidance offset**
   - Given N positions, compute repulsion vectors.
   - Simple O(N²) in compute; at N=12 the JS version is faster, but at N=30+ it wins.

### Implementation model

- `WebGPUCompute.init()` same device as `WebGPUEFX` (share one `GPUDevice`).
- Use `GPUBuffer` with `GPUBufferUsage.STORAGE | MAP_READ` for results we need back in JS.
- For each tick:
  1. Write unit positions / radii / teams into a write buffer.
  2. `commandEncoder.copyBufferToBuffer(...)` to storage buffer.
  3. Dispatch compute pipeline.
  4. `copyBufferToBuffer` result to a mappable buffer.
  5. `mapAsync()` to read results.
- Because `mapAsync()` is async, the results would lag by one frame. For movement/avoidance this is acceptable (visual, not gameplay-critical). For spell damage we can either keep it on CPU or use the previous-frame query.

### Recommended scope

- **Phase 1: GPU FX only.** This gives the most visible juice for players and validates the WebGPU device/lifecycle in the wild.
- **Phase 2: particle compute.** Once the FX overlay exists, move the particle simulation to compute for 2-3x more particles.
- **Phase 3: spell queries / avoidance.** Only if we increase unit counts or add large AoE battles.

---

## Integration plan

1. Add a `gputier()` helper that returns `"none" | "low" | "high"` based on `navigator.gpu` + adapter info.
2. Wire `gputier()` into `qualityTier()` so a real GPU defaults to high effects, no GPU falls back to low/Canvas 2D.
3. Ship `WebGPUEFX` behind a feature flag (`settings.webgpuFx: true` by default if tier is high).
4. Keep the existing `BattleFX` canvas path 100% intact as the fallback.
5. Do **not** replace `SpriteRenderer` with WebGPU; the single-file Canvas 2D sprite pipeline is a core design decision.

---

## Files to touch

- `index.html`:
  - `loadModules()` — no new external lib needed; WebGPU is native.
  - `G.init()` / `G._initRest()` — detect adapter and set `gputier()`.
  - `G.screen()` — move the FX overlay along with `#cv`.
  - `Battle.start()` / `Battle.stop()` — init/destroy `WebGPUEFX` for the battle screen.
  - `Battle.loop()` — call `WebGPUEFX.battleLoop(dt)` after 2D draw.
  - `BattleFX` — add `WebGPUEFX` calls alongside Canvas 2D fallbacks.
  - `Spell.tickZones()` / `Spell.fire()` — emit WebGPU zones.
  - `G.settings` and `G.saveSetting()` — add `webgpuFx` toggle.

- New doc: this `WEBGPU-PLAN.md`.

## Quick win before full FX

The lowest-risk WebGPU win is **adaptive LLM model selection**: use WebGPU adapter hints to pick `Qwen2.5-0.5B` on low-end/integrated GPUs and `Qwen2.5-1.5B` / `3B` on discrete GPUs. It reuses the existing `web-llm` pipeline and only changes the `MODEL` constant selection, making the forge faster and more accessible while keeping the LLM quality tiered.

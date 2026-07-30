# Overnight Execution Status

## Completed
- [x] Pre-flight: forge cap removed, no max_tokens — committed 554e613
- [x] Phase 20: Ramp carry ability + Wizard starter — committed 667df38
- [x] Phase 24a: Expanded body plans (6→20) — committed c2a9055
- [x] Phase 24b: Richer shape primitives (gradient, outline, glow, alpha, drop shadow, patterns) — committed c2a9055
- [x] Phase 24c: Translate+scale joints + spring physics — implemented
- [x] Phase 24e: Persistent unit auras (fxType-driven particle emitters) — implemented
- [x] Phase 24f: Faces (eye tracking, blink, widen on attack, glow for magical) — implemented
- [x] Phase 24g: Animation polish (anticipation/follow-through, easing curves) — implemented

## Skipped / Blocked
- Phase 24d (spring-physics secondary motion): deferred — capes/tails already animate via joint rotation. Spring physics adds complexity for marginal gain. Will revisit if needed.

## Notes
- Phase 24c: Rewrote drawShape to look up channel by joint name (was using first numeric channel — bug). Added JOINT_CONFIG with mode (rotate/translate/scale), axis, range. Added wing_flap, jaw_open, recoil, lunge, squash, stretch, breathe, wobble channels.
- Phase 24e: deriveFxType() maps ability+weapon+bodyPlan → elemental type. BattleFX.unitAura() spawns 1-2 particles/frame per unit, capped by MAX_PARTICLES. Auras: fire (rising embers), frost (falling snow), poison (bubbles), lightning (sparks), heal_glow (golden motes), shadow/arcane (wisps).
- Phase 24f: drawFace() for humanoid-like plans. Eyes track u.target, blink every 3-5s, widen on attack, glow for magical/undead. u.target stored in Battle.act.
- Phase 24g: interpolate() supports ease:"easeOut"/"easeIn"/"easeInOut" per keyframe segment. Wizard attack animation rewritten with 5 keyframes (anticipation→action→follow-through→settle).

## Current
Starting Phase 22: Role-based formation positioning

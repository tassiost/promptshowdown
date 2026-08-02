Execute the plans in PLAN-TIER3.md, PLAN-TIER4.md, and PLAN-TIER5.md, in that priority order. Commit and push after each phase. Update the plan docs (mark phases DONE) and OVERNIGHT-STATUS.md after each phase so progress is visible.

Code efficiently and streamlined. Use helper functions and avoid duplicating code. Research online if something is unclear. Test via Playwright MCP (never chrome-devtools — it is forbidden on this project). Don't finish until it's finished.

## Two rules you must never break

1. **Never use chrome-devtools MCP.** All browser automation and smoke tests go through the playwright MCP server. If playwright is unavailable, stop that phase, note it in OVERNIGHT-STATUS.md, and move on — do not fall back to chrome-devtools.
2. **Never limit LLM usage.** Inference is free (local WebLLM, no API costs). Never set max_tokens on chat.completions.create. Never cap daily forges (remove the existing forgeCount cap). Never add LLM timeouts — the Cancel button is the only escape hatch. Prefer richer prompts and multi-call generation over cramped single calls.

## Execution order (one commit + push per phase)

Pre-flight first: commit the uncommitted WIP, push, start `python3 -m http.server 8765` in the background, remove the daily forge cap (forgeCount logic), verify no max_tokens in index.html, commit + push those.

Then phases in this order:

**Block A — Gameplay + Visual foundations**
1. Tier 3 Phase 20 — ramp carry ability + Wizard starter
2. Tier 4 Phase 24a — expanded body plans (~20) + richer shape primitives (gradients, outlines, glow, drop shadows, patterns)
3. Tier 4 Phase 24b — translate+scale joints + spring-physics secondary motion (capes/hair/tails)
4. Tier 4 Phase 24c — unit auras + faces (tracking eyes, blink, expressions) + animation polish (anticipation/follow-through/squash-stretch, easing)
5. Tier 3 Phase 22 — role-based formation positioning (frontline front, carries back, counters mid)
6. Tier 3 Phase 21 — bot role-fill strategy (guarantee frontline+carry, counter-pick ramp carries)

**Block B — Feel + Content**
7. Tier 5 Phase 30 — audio system (procedural Web Audio: SFX, UI, music, fxType-driven attack sounds)
8. Tier 3 Phase 23 — spell system + LLM spell forge (infinite spells via SPELL_SCHEMA)
9. Tier 4 Phase 25 — LLM visual modifiers (7 new enum fields → ~21M silhouettes)

**Block C — Shippable UX**
10. Tier 5 Phase 31 — first-time onboarding (6-step interactive tutorial)
11. Tier 5 Phase 32 — settings & accessibility (volume, quality, reduced-motion, colorblind, high-contrast)
12. Tier 5 Phase 33 — daily quests + login streaks
13. Tier 5 Phase 35 — analytics/telemetry (privacy-respecting, self-hostable, no third-party)

**Block D — Multiplayer + Competitive + Monetization**
14. Tier 5 Phase 34 — multiplayer reconnect + AFK (30s grace, snapshot rejoin, heartbeat)
15. Tier 5 Phase 36 — ranked leaderboard + seasons (Elo, tiers, quarterly reset)
16. Tier 5 Phase 37 — replays + share (forged unit URLs, match highlights, Web Share API)
17. Tier 5 Phase 38 — real ad SDK (AdMob for Web, stub fallback always)
18. Tier 5 Phase 39 — i18n (string tables, 8 languages)

## Per-phase workflow

1. Read the phase in the relevant PLAN doc — note touchpoints and smoke test criteria.
2. Re-grep for touchpoint locations (line numbers drift as you edit). Read current code before editing.
3. Implement. Match existing code style (compact vanilla JS, single-file index.html, no new deps, no comments unless non-obvious).
4. Smoke test via playwright MCP: list tools first (mcp_list_tools for playwright — never guess names), navigate to http://localhost:8765/index.html, run the phase's smoke test, screenshot, check console for errors. Fix before committing.
5. Commit: `Phase N: <one-line description>` + Devin co-author trailer (check git log for style). Push to origin/main.
6. Update the PLAN doc (mark phase DONE) + OVERNIGHT-STATUS.md. Commit those too.

## Blockers

- Smoke test fails after 3 fix attempts → revert (`git checkout -- index.html`), note in OVERNIGHT-STATUS.md, move to next phase. Don't get stuck.
- Phase needs a server endpoint (leaderboard, analytics) → implement client side fully with endpoint URL configurable (default null = no-op). Note it needs manual setup.
- Never ask the user for help — they're asleep. Make reasonable decisions, note them in OVERNIGHT-STATUS.md, continue.

## OVERNIGHT-STATUS.md format

```
# Overnight Execution Status
## Completed
- [x] Pre-flight: ...
- [x] Phase 20: ... — committed abc1234, pushed
## Skipped / Blocked
- [ ] Phase 34: skipped (reason)
## Notes
- ...
## Current
Working on Phase 25: ...
```

Start with pre-flight, then Phase 20. Don't finish until it's finished.

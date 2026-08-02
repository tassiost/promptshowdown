# E2E Test Report — Prompt Showdown

**Run date:** 2026-08-01  
**Browser:** Headless Chromium (Playwright for Python)  
**Viewport:** 1280×720  
**Server:** `python3 -m http.server 8765`  
**Test script:** `e2e_test.py`  

## Flows covered

1. App load / main menu
2. Forge — Skip Ad (template) path
3. Forge — Watch Ad path
4. Deck
5. Codex
6. Shop
7. Upgrade
8. Settings
9. Quick Match (draft)
10. Return to main menu

## Screenshots

| # | Screen | File |
|---|--------|------|
| 1 | Main menu | `e2e-screenshots/01-main-menu.png` |
| 2 | Forge (unit) | `e2e-screenshots/02-forge-screen.png` |
| 3 | Forge skip-ad result | `e2e-screenshots/03-forge-skip-result.png` |
| 4 | Forge ad confirmation | `e2e-screenshots/04-forge-confirmation.png` |
| 5 | Ad overlay (1 s) | `e2e-screenshots/05-forge-ad-overlay.png` |
| 6 | Forge watch-ad result | `e2e-screenshots/06-forge-ad-result.png` |
| 7 | Deck | `e2e-screenshots/07-deck.png` |
| 8 | Codex | `e2e-screenshots/08-codex.png` |
| 9 | Shop | `e2e-screenshots/09-shop.png` |
| 10 | Upgrade | `e2e-screenshots/10-upgrade.png` |
| 11 | Settings | `e2e-screenshots/11-settings.png` |
| 12 | Quick match draft | `e2e-screenshots/12-quick-match.png` |
| 13 | Main menu (end) | `e2e-screenshots/13-main-menu-end.png` |

## Console summary

- **Page errors:** 0
- Notable warnings:
  - `AI init failed, using procedural forge: Error: Unable to find a compatible GPU` — expected in the headless test environment (no WebGPU).
  - Forge debug logs (`[Forge]`, `[Ad]`) are working as intended: `_doForge start`, ad `stub start/complete`, `templateFallback`, `attrsToUnit`, `_doForge result`.

## Findings

### 1. Settings layout was broken
- The settings container used the shared `.group` class, which is a horizontal flex layout meant for button groups.
- Result: section headings (`Audio`, `Graphics`, `Language`, …) and labels floated into the same row, causing the `Graphics` heading to appear next to the `Music Volume` slider and the word `Language` to be repeated (`Language Language English`).

**Screenshot before fix:** `e2e-screenshots/11-settings.png` (initial run — not archived; see doc history).  
**Fix:** Replaced `class="group"` with a dedicated vertical flex column and changed the `Language` label to `Interface language`.

### 2. Shop reroll button was never disabled
- The `Buy Random Unit` button already disables itself when coins are insufficient.
- The `New Offer (10 coins)` reroll button had no disabled state, so a player with 0–9 coins could still click it and get a toast.

**Fix:** Added `id="rerollShopBtn"` to the reroll button and set `rerollBtn.disabled = (this.save.coins||0) < 10` in `_renderShopOffer()`.

## Improvements applied

| # | File | Change |
|---|------|--------|
| 1 | `index.html` | Settings container now uses `display:flex;flex-direction:column;` instead of `.group` flex row. |
| 2 | `index.html` | Language label changed from `Language` to `Interface language` to avoid duplication. |
| 3 | `index.html` | Shop reroll button gets an `id` and is disabled when the player has fewer than 10 coins. |

## Re-verification

- Re-ran `e2e_test.py` after fixes.
- Result: 0 page errors, 13 screenshots captured.
- Settings screenshot now shows a clean vertical form with section headings aligned above their controls.
- Shop screenshot confirms reroll button remains enabled for 10-coin state and buy button still disables correctly for higher costs.

## Files added

- `e2e_test.py` — reusable Playwright end-to-end flow.
- `e2e-screenshots/` — 13 screenshots + `console-logs.json`.
- `E2E-TEST-REPORT.md` — this document.

## Next steps / out of scope

- The headless environment cannot exercise WebGPU, so the LLM download progress UI and actual LLM generation path were validated by code review and the existing unit tests, not live inference.
- No changes made to the daily forge cap or ad SDK stub behavior beyond the earlier Forge Flow upgrade.

# Problems & Solutions — Prompt Showdown

A running log of recent issues, attempted fixes, and final solutions.

## Forge Flow Upgrade

### Problem: LLM only started downloading when the player opened the forge
- **Tried action:** Reviewed `loadModules()` and `G.init()` flow.
- **Solution:** Call `preloadAI()` immediately after `W` (web-llm) is loaded in `loadModules()`, guarded by `navigator.gpu`. `G.init()` still calls it later, but `initLLM()` exits early if already loading.
- **File:** `index.html` (`loadModules`)

### Problem: Forge progress bar showed only a percentage
- **Tried action:** Read `initLLM()` and `updateAI()`.
- **Solution:** Added `updateAIFromProgress(p)` that computes `%/s` and ETA, updates `#forgeModelText` and a new `#forgeModelStats` node, and resets on `cancelLLM()`.
- **File:** `index.html` (LLM state / progress UI)

### Problem: "Watch Ad to Generate" was 15 seconds
- **Tried action:** Found hardcoded `15000` in two `_doForge` call sites.
- **Solution:** Added `const FORGE_AD_MS = 1000` and used it for both unit and spell forges. Added `[Ad] stub start` / `[Ad] stub complete` logging.
- **File:** `index.html` (`AdSDK`, `showAdStub`, `_doForge`)

### Problem: Skip Ad still used the LLM path
- **Tried action:** Traced `_doForge` logic and the `forgeSkipAd()` entry point.
- **Solution:** Changed `_doForge` to use `if (watchAd && canUseLLM)`; otherwise it goes straight to `templateFallback`/`templateSpellFallback` and logs the path.
- **File:** `index.html` (`_doForge`)

### Problem: No debug logging for prompts, JSON, or template fallbacks
- **Tried action:** Identified all forge/LLM entry points.
- **Solution:** Added `debugForge(...args)` helper and logs in `_doForge`, `generateUnit`, `generateSpell`, `askField`, `templateFallback`, `templateSpellFallback`, and `attrsToUnit`.
- **File:** `index.html`

---

## E2E Testing

### Problem: `read_url_content` blocked `localhost`
- **Tried action:** Attempted to fetch `http://localhost:8765/index.html`.
- **Solution:** Used `python3 -m http.server 8765` and drove the app with Playwright instead of direct HTTP.

### Problem: Playwright Python had no `__version__` attribute
- **Tried action:** `python3 -c "import playwright; print(playwright.__version__)"` failed.
- **Solution:** Verified Playwright works by importing `from playwright.sync_api import sync_playwright` and launching Chromium.

### Problem: `page.click('#forgeGenBtn')` opened an ad confirmation overlay
- **Tried action:** Initial script tried to click the prompt and then wait for the ad. It only reached the confirmation modal.
- **Solution:** Added a click on `#forgeAdYes`, captured the confirmation and ad-overlay screenshots separately, then waited for `#forgeActions` to appear before capturing the result.
- **File:** `e2e_test.py`

### Problem: `page.click('button:has-text("BACK")')` resolved to multiple buttons and was blocked by the overlay
- **Tried action:** Tried generic text selectors for back navigation.
- **Solution:** Switched to `page.evaluate("G.menu();")` for returning to the menu between screens; more reliable across different screens.
- **File:** `e2e_test.py`

### Problem: `page.evaluate('G.save.forgeCount=0; saveData(G.save);')` threw `saveData is not defined`
- **Tried action:** Tried to reset the daily forge cap through `saveData`.
- **Solution:** `saveData` is not exposed on `window`. Resetting `G.save.forgeCount = 0` in memory is enough because `_doForge` reads `this.save.forgeCount` directly.
- **File:** `e2e_test.py`

### Problem: `page.click('button:has-text("MENU")')` matched 2 hidden "Back to Menu" buttons and timed out
- **Tried action:** Used broad text selector to return to the main menu.
- **Solution:** Replaced with `page.evaluate("G.menu();")` for the final return-to-menu step.
- **File:** `e2e_test.py`

---

## UI / UX Issues Found via E2E Screenshots

### Problem: Settings screen had a broken horizontal layout
- **Symptom:** `Graphics` heading appeared on the same row as `Music Volume`; `Language` was duplicated (`Language Language English`).
- **Root cause:** The settings container used the shared `.group` class, which is a horizontal flex for buttons.
- **Solution:** Replaced `class="group"` with a dedicated `display:flex;flex-direction:column;` style. Changed the language label span from `Language` to `Interface language`.
- **File:** `index.html` (`#settings`)

### Problem: Shop reroll button was never disabled
- **Symptom:** A player with fewer than 10 coins could still click `New Offer (10 coins)` and get a toast.
- **Solution:** Added `id="rerollShopBtn"` to the reroll button and disabled it in `_renderShopOffer()` when `save.coins < 10`.
- **File:** `index.html` (`_renderShopOffer`)

---

## Known Limitations / Not Fixed

### Headless Chromium WebGPU behavior
- **Observation:** `navigator.gpu` exists in headless Chromium, so `canUseLLM` is truthy and the forge tries the LLM path. `initLLM()` then fails with "Unable to find a compatible GPU" after several seconds, falling back to templates.
- **Impact:** In the E2E test, the watch-ad forge takes ~5 s instead of 1 s (1 s ad + LLM timeout/failure).
- **Status:** This is an environment limitation, not a code bug. In a real WebGPU browser the model will download and the flow will use the LLM.

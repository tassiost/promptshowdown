from playwright.sync_api import sync_playwright
import os, time, json, sys

OUT_DIR = "e2e-r3-screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

URL = "http://localhost:8765/index.html"

def shot(page, name):
    path = os.path.join(OUT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"  screenshot: {path}")
    return path

results = {"pass": [], "fail": [], "errors": [], "warnings": []}

def ok(name):
    results["pass"].append(name)
    print(f"[PASS] {name}")

def fail(name, detail=""):
    results["fail"].append((name, detail))
    print(f"[FAIL] {name} — {detail}")

def warn(name, detail=""):
    results["warnings"].append((name, detail))
    print(f"[WARN] {name} — {detail}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()
    logs = []
    errors = []
    page.on("console", lambda msg: logs.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda exc: errors.append(str(exc)))

    print("=== Loading game ===")
    try:
        page.goto(URL, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(3000)
        ok("page load")
    except Exception as e:
        fail("page load", str(e))
        sys.exit(1)

    # Verify G object exists
    try:
        g_ok = page.evaluate("typeof G !== 'undefined' && typeof G.menu === 'function'")
        if g_ok:
            ok("G object initialized")
        else:
            fail("G object initialized", "G or G.menu missing")
    except Exception as e:
        fail("G object initialized", str(e))

    # Capture any pageerrors during load
    if errors:
        for e in errors[:5]:
            results["errors"].append(("load", e))
            print(f"  PAGEERROR(load): {e}")

    # Skip onboarding
    try:
        page.evaluate("if(typeof G!=='undefined' && G._onboardSkip) G._onboardSkip(); else if(typeof G!=='undefined' && G.menu) G.menu();")
        page.wait_for_timeout(500)
        shot(page, "01-main-menu")
        ok("main menu")
    except Exception as e:
        fail("main menu", str(e))

    # Check save state
    try:
        save_info = page.evaluate("({coins: G.save.coins, level: G.save.level, xp: G.save.xp, arena: G.save.arena, wins: G.save.wins, losses: G.save.losses, collectionLen: (G.save.collection||[]).length, loadoutLen: (G.save.loadout||[]).length, spellbookLen: (G.save.spellbook||[]).length})")
        print(f"  save state: {json.dumps(save_info)}")
        ok("save state readable")
    except Exception as e:
        fail("save state readable", str(e))

    # === Screen navigation test ===
    print("\n=== Screen navigation ===")
    screens = [
        ("forge", "G.forge && G.forge()", "forge"),
        ("deck", "G.deck && G.deck()", "deck"),
        ("shop", "G.shop && G.shop()", "shop"),
        ("upgrade", "G.upgrade && G.upgrade()", "upgrade"),
        ("codex", "G.codex && G.codex()", "codex"),
        ("settings", "G.showSettings && G.showSettings()", "settings"),
        ("stats", "G.stats && G.stats()", "stats"),
        ("tierlist", "G.tierList && G.tierList()", "tierlist"),
        ("profile", "G.profile && G.profile()", "profile"),
        ("replays", "G.replaysScreen && G.replaysScreen()", "replays"),
        ("achievements", "G.achievementsScreen && G.achievementsScreen()", "achievements"),
        ("matchmaking", "G.startMatchmaking && G.startMatchmaking()", "matchmaking"),
    ]
    for name, js, sid in screens:
        try:
            page.evaluate(f"G.menu();")
            page.wait_for_timeout(200)
            page.evaluate(js)
            page.wait_for_timeout(400)
            active = page.evaluate(f"const el=document.getElementById('{sid}'); el&&el.classList.contains('active')")
            if active:
                shot(page, f"screen-{name}")
                ok(f"screen: {name}")
            else:
                fail(f"screen: {name}", f"#{sid} not active")
        except Exception as e:
            fail(f"screen: {name}", str(e))

    # === Forge: skip ad (template) ===
    print("\n=== Forge (skip ad / template) ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.save.forgeCount=0;")
        page.evaluate("G.forge();")
        page.wait_for_timeout(400)
        # fill prompt
        page.fill("#forgePrompt", "ice dragon")
        page.wait_for_timeout(100)
        page.click("#forgeSkipBtn")
        page.wait_for_timeout(1500)
        actions_visible = page.evaluate("!!document.querySelector('#forgeActions')")
        if actions_visible:
            shot(page, "forge-skip-result")
            ok("forge skip ad produces result")
        else:
            fail("forge skip ad produces result", "#forgeActions not visible")
    except Exception as e:
        fail("forge skip ad", str(e))

    # === Forge: watch ad ===
    print("\n=== Forge (watch ad) ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.save.forgeCount=0;")
        page.evaluate("G.forge();")
        page.wait_for_timeout(400)
        page.fill("#forgePrompt", "fire mage")
        page.click("#forgeGenBtn")
        page.wait_for_timeout(500)
        shot(page, "forge-ad-confirmation")
        yes_visible = page.evaluate("!!document.querySelector('#forgeAdYes')")
        if yes_visible:
            page.click("#forgeAdYes")
            page.wait_for_timeout(600)
            shot(page, "forge-ad-overlay")
            page.wait_for_selector("#forgeActions", state="visible", timeout=15000)
            shot(page, "forge-ad-result")
            ok("forge watch ad produces result")
        else:
            warn("forge ad confirmation", "#forgeAdYes not present (may be LLM path)")
    except Exception as e:
        fail("forge watch ad", str(e))

    # Helper to get current active screen
    def get_active_screen(page):
        return page.evaluate("""() => {
            const screens = document.querySelectorAll('.screen.active');
            return screens.length > 0 ? screens[0].id : null;
        }""")

    # === Quick match flow ===
    print("\n=== Quick match (battle) ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(300)
        # Start quick match
        page.evaluate("G.quickMatch && G.quickMatch()")
        page.wait_for_timeout(2000)
        shot(page, "quick-match-start")
        cur = get_active_screen(page)
        print(f"  active screen: {cur}")
        if cur in ("battle", "draft", "scout"):
            ok(f"quick match started (screen={cur})")
        else:
            fail("quick match started", f"screen={cur}")
    except Exception as e:
        fail("quick match", str(e))

    # Wait for match to progress / end — interact with draft if needed
    print("  waiting for match to progress (up to 90s)...")
    battle_errors_before = len(errors)
    picked_this_draft = False
    for i in range(90):
        page.wait_for_timeout(1000)
        cur = get_active_screen(page)
        # If in draft, pick a card to progress
        if cur == "draft" and not picked_this_draft:
            try:
                # Click the first available draft card
                page.evaluate("""() => {
                    const cards = document.querySelectorAll('#draftArea .card');
                    if(cards.length > 0) cards[0].click();
                }""")
                picked_this_draft = True
                page.wait_for_timeout(500)
                # Check if still in draft (need more picks)
                cur2 = get_active_screen(page)
                if cur2 == "draft":
                    picked_this_draft = False  # reset for next pick
            except Exception:
                pass
        if cur not in ("battle", "draft", "scout"):
            print(f"  match ended -> screen={cur} after {i+1}s")
            shot(page, f"quick-match-end-{cur}")
            ok(f"match reached end state: {cur}")
            break
    else:
        shot(page, "quick-match-timeout")
        warn("match timeout", "still in draft/battle after 90s")

    # Check for new pageerrors during battle
    if len(errors) > battle_errors_before:
        for e in errors[battle_errors_before:]:
            results["errors"].append(("battle", e))
            print(f"  PAGEERROR(battle): {e}")

    # === Settings toggles ===
    print("\n=== Settings toggles ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.showSettings();")
        page.wait_for_timeout(400)
        # Toggle audio
        before = page.evaluate("G.save.settings.audioEnabled")
        page.evaluate("G.saveSetting('audioEnabled', !G.save.settings.audioEnabled);")
        page.wait_for_timeout(300)
        after = page.evaluate("G.save.settings.audioEnabled")
        if before != after:
            ok("audio toggle")
        else:
            fail("audio toggle", "no change")
        # Toggle reduced motion
        before = page.evaluate("G.save.settings.reducedMotion")
        page.evaluate("G.saveSetting('reducedMotion', !G.save.settings.reducedMotion);")
        page.wait_for_timeout(300)
        after = page.evaluate("G.save.settings.reducedMotion")
        if before != after:
            ok("reducedMotion toggle")
        else:
            fail("reducedMotion toggle", "no change")
        shot(page, "settings-screen")
    except Exception as e:
        fail("settings toggles", str(e))

    # === Export/import save ===
    print("\n=== Export/import save ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.showSettings();")
        page.wait_for_timeout(300)
        page.evaluate("G.exportSave();")
        page.wait_for_timeout(300)
        code = page.evaluate("const el=document.getElementById('saveExportArea'); el?el.value:null")
        if code and len(code) > 20:
            ok("export save produces code")
        else:
            fail("export save produces code", f"got: {str(code)[:50]}")
    except Exception as e:
        fail("export save", str(e))

    # === Quest claim (if any claimable) ===
    print("\n=== Quests ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        quests_info = page.evaluate("({count: (G.save.quests&&G.save.quests.list?G.save.quests.list.length:0), claimable: (G.save.quests&&G.save.quests.list?G.save.quests.list.filter(q=>q.progress>=q.target).length:0)})")
        print(f"  quests: {json.dumps(quests_info)}")
        ok("quests readable")
    except Exception as e:
        fail("quests readable", str(e))

    # === Final: collect all pageerrors ===
    print(f"\n=== Console errors summary ===")
    print(f"  total pageerrors: {len(errors)}")
    for e in errors:
        results["errors"].append(("final", e))
        print(f"  PAGEERROR: {e}")

    # Filter console warnings/errors
    console_errors = [l for l in logs if l["type"] in ("error", "warning")]
    print(f"  console errors/warnings: {len(console_errors)}")
    for l in console_errors[:20]:
        print(f"  CONSOLE[{l['type']}]: {l['text'][:120]}")

    # Persist logs
    with open(os.path.join(OUT_DIR, "console-logs.json"), "w") as f:
        json.dump({"logs": logs, "errors": errors, "results": results}, f, indent=2)

    print(f"\n=== RESULTS ===")
    print(f"  PASS: {len(results['pass'])}")
    print(f"  FAIL: {len(results['fail'])}")
    print(f"  WARN: {len(results['warnings'])}")
    print(f"  ERRORS: {len(results['errors'])}")

    browser.close()

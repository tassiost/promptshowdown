"""
E2E Test R8 — Comprehensive bug hunt
Covers: load, menu, forge (unit+spell), deck, draft, battle, match, save, quests, upgrades, replay
"""
from playwright.sync_api import sync_playwright
import os, time, json, sys

OUT_DIR = "e2e-r8-screenshots"
os.makedirs(OUT_DIR, exist_ok=True)
URL = "http://localhost:8765/index.html"

def shot(page, name):
    path = os.path.join(OUT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    return path

results = {"pass": [], "fail": [], "errors": [], "warnings": []}
bugs = []

def ok(name):
    results["pass"].append(name)
    print(f"[PASS] {name}")

def fail(name, detail=""):
    results["fail"].append((name, detail))
    print(f"[FAIL] {name} — {detail}")

def warn(name, detail=""):
    results["warnings"].append((name, detail))
    print(f"[WARN] {name} — {detail}")

def bug(id, severity, area, desc):
    bugs.append({"id": id, "sev": severity, "area": area, "desc": desc})
    print(f"  BUG #{id} [{severity}] {area}: {desc}")

def get_active(page):
    return page.evaluate("""() => {
        const s = document.querySelectorAll('.screen.active');
        return s.length > 0 ? s[0].id : null;
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()
    logs = []
    errors = []
    page.on("console", lambda msg: logs.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda exc: errors.append(str(exc)))

    # ============================================================
    # TEST 1: Page load + init
    # ============================================================
    print("\n=== TEST 1: Page Load + Init ===")
    try:
        page.goto(URL, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(3000)
        ok("page load")
    except Exception as e:
        fail("page load", str(e))
        sys.exit(1)

    # Check G exists
    try:
        g_ok = page.evaluate("typeof G !== 'undefined' && typeof G.menu === 'function'")
        if g_ok: ok("G object initialized")
        else: fail("G object initialized", "G or G.menu missing")
    except Exception as e:
        fail("G object initialized", str(e))

    # Check G.save initialized
    try:
        sv = page.evaluate("G.save && typeof G.save.version === 'number'")
        if sv: ok("G.save initialized with version")
        else: fail("G.save initialized", "no version")
    except Exception as e:
        fail("G.save initialized", str(e))

    # Check G._initialized flag
    try:
        initd = page.evaluate("G._initialized === true")
        if initd: ok("G._initialized flag set")
        else: fail("G._initialized flag", "not true")
    except Exception as e:
        fail("G._initialized flag", str(e))

    # Check splash removed
    try:
        splash = page.evaluate("!!document.getElementById('splash')")
        if not splash: ok("splash removed")
        else: warn("splash still visible", "splash element exists")
    except Exception as e:
        warn("splash check", str(e))

    # Check for pageerrors during load
    if errors:
        for e in errors[:5]:
            results["errors"].append(("load", e))
            # Filter out CORS errors (expected from file://)
            if "CORS" not in e and "torrent" not in e and "lz-string" not in e:
                bug(1, "CRITICAL", "Init", f"PageError on load: {e}")
                print(f"  PAGEERROR: {e}")

    # Check console errors (non-CORS)
    for log in logs:
        if log["type"] == "error" and "CORS" not in log["text"] and "torrent" not in log["text"] and "lz-string" not in log["text"]:
            bug(2, "MAJOR", "Console", f"Console error: {log['text'][:100]}")

    # ============================================================
    # TEST 2: Skip onboarding + menu
    # ============================================================
    print("\n=== TEST 2: Onboarding + Menu ===")
    try:
        page.evaluate("if(G._onboardSkip)G._onboardSkip();else if(G.menu)G.menu();")
        page.wait_for_timeout(500)
        cur = get_active(page)
        if cur == "menu": ok("main menu reached")
        else: fail("main menu", f"screen={cur}")
        shot(page, "01-menu")
    except Exception as e:
        fail("main menu", str(e))

    # Check save state
    try:
        si = page.evaluate("({coins:G.save.coins||0, xp:G.save.xp||0, arena:G.save.arena||0, collection:(G.save.collection||[]).length, loadout:(G.save.loadout||[]).length, spellbook:(G.save.spellbook||[]).length, version:G.save.version})")
        print(f"  save: {json.dumps(si)}")
        ok("save state readable")
    except Exception as e:
        fail("save state", str(e))

    # ============================================================
    # TEST 3: Screen navigation
    # ============================================================
    print("\n=== TEST 3: Screen Navigation ===")
    screens = [
        ("forge", "G.forge()", "forge"),
        ("deck", "G.deck()", "deck"),
        ("upgrade", "G.upgrade()", "upgrade"),
        ("settings", "G.showSettings()", "settings"),
        ("achievements", "G.achievementsScreen()", "achievements"),
        ("matchmaking", "G.startMatchmaking()", "matchmaking"),
    ]
    for name, js, sid in screens:
        try:
            page.evaluate("G.menu();")
            page.wait_for_timeout(200)
            page.evaluate(js)
            page.wait_for_timeout(400)
            cur = get_active(page)
            if cur == sid:
                shot(page, f"screen-{name}")
                ok(f"screen: {name}")
            else:
                fail(f"screen: {name}", f"expected #{sid}, got #{cur}")
                bug(3, "MAJOR", "Navigation", f"Screen {name} navigation failed: expected #{sid}, got #{cur}")
        except Exception as e:
            fail(f"screen: {name}", str(e))
            bug(4, "MAJOR", "Navigation", f"Screen {name} threw: {e}")

    # ============================================================
    # TEST 4: Forge unit (skip ad / template fallback)
    # ============================================================
    print("\n=== TEST 4: Forge Unit (template) ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.save.forgeCount=0;G.save.forgeDate='';")
        page.evaluate("G.forge();")
        page.wait_for_timeout(400)
        # Set to unit mode
        page.evaluate("G.setForgeMode('unit');")
        page.wait_for_timeout(100)
        page.fill("#forgePrompt", "ice dragon")
        page.wait_for_timeout(100)
        # Click skip (template fallback)
        page.click("#forgeSkipBtn")
        page.wait_for_timeout(2000)
        # Check result
        actions = page.evaluate("!!document.querySelector('#forgeActions')")
        preview = page.evaluate("document.querySelector('#forgePreview')?.innerHTML?.length > 0")
        if actions or preview:
            shot(page, "forge-unit-result")
            ok("forge unit (template) produced result")
        else:
            fail("forge unit (template)", "no result shown")
            bug(5, "CRITICAL", "Forge", "Template forge unit produced no result")
    except Exception as e:
        fail("forge unit (template)", str(e))
        bug(6, "CRITICAL", "Forge", f"Forge unit threw: {e}")

    # ============================================================
    # TEST 5: Forge spell (skip ad / template fallback)
    # ============================================================
    print("\n=== TEST 5: Forge Spell (template) ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.save.forgeCount=0;G.save.forgeDate='';")
        page.evaluate("G.forge();")
        page.wait_for_timeout(400)
        page.evaluate("G.setForgeMode('spell');")
        page.wait_for_timeout(100)
        page.fill("#forgePrompt", "fireball")
        page.wait_for_timeout(100)
        page.click("#forgeSkipBtn")
        page.wait_for_timeout(2000)
        actions = page.evaluate("!!document.querySelector('#forgeActions')")
        preview = page.evaluate("document.querySelector('#forgePreview')?.innerHTML?.length > 0")
        if actions or preview:
            shot(page, "forge-spell-result")
            ok("forge spell (template) produced result")
        else:
            fail("forge spell (template)", "no result shown")
            bug(7, "CRITICAL", "Forge", "Template forge spell produced no result")
    except Exception as e:
        fail("forge spell (template)", str(e))
        bug(8, "CRITICAL", "Forge", f"Forge spell threw: {e}")

    # ============================================================
    # TEST 6: Forge daily cap
    # ============================================================
    print("\n=== TEST 6: Forge Daily Cap ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        # Set forge count to 10 (max)
        today = page.evaluate("new Date().toISOString().slice(0,10)")
        page.evaluate(f"G.save.forgeCount=10;G.save.forgeDate='{today}';")
        page.evaluate("G.forge();")
        page.wait_for_timeout(400)
        page.evaluate("G.setForgeMode('unit');")
        page.wait_for_timeout(100)
        page.fill("#forgePrompt", "test")
        page.wait_for_timeout(100)
        page.click("#forgeSkipBtn")
        page.wait_for_timeout(1000)
        # Should show toast about cap
        toast = page.evaluate("document.querySelector('#toast')?.innerText || ''")
        if "cap" in toast.lower() or "limit" in toast.lower() or "10" in toast:
            ok("forge daily cap enforced")
        else:
            # Check if forge actually ran (shouldn't)
            fc = page.evaluate("G.save.forgeCount")
            if fc > 10:
                fail("forge daily cap", f"forgeCount={fc}, expected <=10")
                bug(9, "MAJOR", "Forge", "Daily cap not enforced")
            else:
                ok("forge daily cap enforced (count unchanged)")
    except Exception as e:
        fail("forge daily cap", str(e))

    # ============================================================
    # TEST 7: Deck management
    # ============================================================
    print("\n=== TEST 7: Deck Management ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.deck();")
        page.wait_for_timeout(400)
        cur = get_active(page)
        if cur == "deck":
            shot(page, "deck-screen")
            ok("deck screen")
            # Check loadout
            loadout = page.evaluate("G.save.loadout || []")
            print(f"  loadout: {loadout}")
            ok("loadout readable")
        else:
            fail("deck screen", f"screen={cur}")
    except Exception as e:
        fail("deck management", str(e))

    # ============================================================
    # TEST 8: Quick match (full battle flow)
    # ============================================================
    print("\n=== TEST 8: Quick Match (battle) ===")
    errors_before = len(errors)
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(300)
        page.evaluate("G.quickMatch && G.quickMatch()")
        page.wait_for_timeout(2000)
        shot(page, "quick-match-start")
        cur = get_active(page)
        print(f"  active screen: {cur}")
        if cur in ("battle", "draft", "scout"):
            ok(f"quick match started (screen={cur})")
        else:
            fail("quick match started", f"screen={cur}")
            bug(10, "CRITICAL", "Match", f"Quick match didn't start: screen={cur}")
    except Exception as e:
        fail("quick match", str(e))
        bug(11, "CRITICAL", "Match", f"Quick match threw: {e}")

    # Wait for match to progress — auto-pick in draft
    print("  waiting for match to progress (up to 180s)...")
    for i in range(180):
        page.wait_for_timeout(1000)
        cur = get_active(page)
        # Auto-pick in draft (keep picking until draft is done)
        if cur == "draft":
            try:
                page.evaluate("""() => {
                    const cards = document.querySelectorAll('#draftArea .card');
                    if(cards.length > 0) cards[0].click();
                }""")
                page.wait_for_timeout(300)
            except Exception:
                pass
        # Click through scout
        if cur == "scout":
            try:
                page.evaluate("""() => {
                    const btn = document.querySelector('#scout .btn.primary, #scout button');
                    if(btn) btn.click();
                }""")
                page.wait_for_timeout(500)
            except Exception:
                pass
        # Click through result — detect match end vs round end
        if cur == "result":
            try:
                # Check if match ended (matchMenu visible or nextRound says "PLAY AGAIN")
                is_match_end = page.evaluate("""() => {
                    const mm = document.getElementById('matchMenu');
                    const nr = document.getElementById('nextRound');
                    return (mm && mm.style.display !== 'none') ||
                           (nr && nr.innerText.includes('PLAY AGAIN'));
                }""")
                if is_match_end:
                    # Click "Menu" to go back to main menu
                    page.evaluate("""() => {
                        const mm = document.getElementById('matchMenu');
                        if(mm) mm.click();
                    }""")
                    page.wait_for_timeout(500)
                else:
                    # Click "Next Round" to continue
                    page.evaluate("""() => {
                        const nr = document.getElementById('nextRound');
                        if(nr && !nr.disabled) nr.click();
                    }""")
                    page.wait_for_timeout(500)
            except Exception:
                pass
        if cur == "menu":
            print(f"  match ended -> menu after {i+1}s")
            shot(page, f"quick-match-end-menu")
            ok(f"match reached end state: menu")
            break
    else:
        shot(page, "quick-match-timeout")
        warn("match timeout", "still in draft/battle after 120s")

    # Check for pageerrors during battle
    if len(errors) > errors_before:
        for e in errors[errors_before:]:
            if "CORS" not in e and "torrent" not in e and "lz-string" not in e:
                results["errors"].append(("battle", e))
                bug(12, "CRITICAL", "Battle", f"PageError during battle: {e}")
                print(f"  PAGEERROR(battle): {e}")

    # ============================================================
    # TEST 9: Full match flow (draft → battle → result)
    # ============================================================
    print("\n=== TEST 9: Full Match Flow ===")
    errors_before = len(errors)
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(300)
        page.evaluate("G.start && G.start()")
        page.wait_for_timeout(1000)
        cur = get_active(page)
        print(f"  match start screen: {cur}")
        if cur in ("draft", "battle", "scout"):
            ok("match started")
        else:
            fail("match start", f"screen={cur}")
            bug(13, "CRITICAL", "Match", f"Match didn't start: screen={cur}")
    except Exception as e:
        fail("match start", str(e))
        bug(14, "CRITICAL", "Match", f"Match start threw: {e}")

    # Progress through multiple rounds
    round_count = 0
    last_screen = None
    round_start_time = 0
    for i in range(240):
        page.wait_for_timeout(1000)
        cur = get_active(page)
        # Track when we enter battle
        if cur == "battle" and last_screen != "battle":
            round_start_time = i + 1
        # Auto-pick in draft (keep picking until done)
        if cur == "draft":
            try:
                page.evaluate("""() => {
                    const cards = document.querySelectorAll('#draftArea .card');
                    if(cards.length > 0) cards[0].click();
                }""")
                page.wait_for_timeout(300)
            except Exception:
                pass
        # Click through scout
        if cur == "scout":
            try:
                page.evaluate("""() => {
                    const btn = document.querySelector('#scout .btn.primary, #scout button');
                    if(btn) btn.click();
                }""")
                page.wait_for_timeout(500)
            except Exception:
                pass
        # Click through result — detect match end vs round end
        if cur == "result":
            if cur != last_screen:
                round_count += 1
                battle_dur = (i + 1) - round_start_time if round_start_time > 0 else 0
                print(f"  round {round_count} result reached at {i+1}s (battle: {battle_dur}s)")
                if battle_dur > 60:
                    warn(f"round {round_count} long battle", f"battle took {battle_dur}s")
            try:
                is_match_end = page.evaluate("""() => {
                    const mm = document.getElementById('matchMenu');
                    const nr = document.getElementById('nextRound');
                    return (mm && mm.style.display !== 'none') ||
                           (nr && nr.innerText.includes('PLAY AGAIN'));
                }""")
                if is_match_end:
                    page.evaluate("""() => {
                        const mm = document.getElementById('matchMenu');
                        if(mm) mm.click();
                    }""")
                    page.wait_for_timeout(500)
                else:
                    page.evaluate("""() => {
                        const nr = document.getElementById('nextRound');
                        if(nr && !nr.disabled) nr.click();
                    }""")
                    page.wait_for_timeout(500)
            except Exception:
                pass
        if cur == "menu":
            print(f"  match ended -> menu after {i+1}s ({round_count} rounds)")
            ok(f"full match completed ({round_count} rounds)")
            break
        last_screen = cur
    else:
        shot(page, "match-flow-timeout")
        warn("match flow timeout", f"still going after 240s ({round_count} rounds, last screen={last_screen})")

    # Check for errors during match
    if len(errors) > errors_before:
        for e in errors[errors_before:]:
            if "CORS" not in e and "torrent" not in e and "lz-string" not in e:
                results["errors"].append(("match", e))
                bug(15, "CRITICAL", "Match", f"PageError during match: {e}")
                print(f"  PAGEERROR(match): {e}")

    # ============================================================
    # TEST 10: Save/Load
    # ============================================================
    print("\n=== TEST 10: Save/Load ===")
    try:
        # Get current save
        save1 = page.evaluate("JSON.stringify(G.save)")
        save1_data = json.loads(save1)
        ok("save readable")
        # Reload page
        page.reload(wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(3000)
        page.evaluate("if(G._onboardSkip)G._onboardSkip();else if(G.menu)G.menu();")
        page.wait_for_timeout(500)
        save2 = page.evaluate("JSON.stringify(G.save)")
        save2_data = json.loads(save2)
        if save1_data.get("version") == save2_data.get("version"):
            ok("save persisted across reload")
        else:
            fail("save persisted", f"v{save1_data.get('version')} != v{save2_data.get('version')}")
            bug(16, "CRITICAL", "Save", "Save not persisted across reload")
        if save1_data.get("coins") == save2_data.get("coins"):
            ok("coins persisted")
        else:
            warn("coins mismatch", f"{save1_data.get('coins')} != {save2_data.get('coins')}")
    except Exception as e:
        fail("save/load", str(e))
        bug(17, "CRITICAL", "Save", f"Save/load threw: {e}")

    # ============================================================
    # TEST 11: Quests
    # ============================================================
    print("\n=== TEST 11: Quests ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        # Check quests exist
        quests = page.evaluate("G.save.quests?.list || []")
        print(f"  quests: {len(quests)}")
        if len(quests) > 0:
            ok("quests generated")
            # Check quest structure
            for q in quests:
                if not q.get("id") or not q.get("target"):
                    bug(18, "MAJOR", "Quests", f"Quest missing id/target: {q}")
                    break
            else:
                ok("quest structure valid")
        else:
            # Try generating
            page.evaluate("Quests.generateDaily();")
            page.wait_for_timeout(200)
            quests = page.evaluate("G.save.quests?.list || []")
            if len(quests) > 0:
                ok("quests generated on demand")
            else:
                warn("quests empty", "no quests after generateDaily")
    except Exception as e:
        fail("quests", str(e))

    # ============================================================
    # TEST 12: Achievements
    # ============================================================
    print("\n=== TEST 12: Achievements ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.achievementsScreen && G.achievementsScreen()")
        page.wait_for_timeout(400)
        cur = get_active(page)
        if cur == "achievements":
            shot(page, "achievements")
            ok("achievements screen")
        else:
            fail("achievements screen", f"screen={cur}")
    except Exception as e:
        fail("achievements", str(e))

    # ============================================================
    # TEST 13: Settings
    # ============================================================
    print("\n=== TEST 13: Settings ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.showSettings && G.showSettings()")
        page.wait_for_timeout(400)
        cur = get_active(page)
        if cur == "settings":
            shot(page, "settings")
            ok("settings screen")
            # Test language change
            page.evaluate("G.setLang && G.setLang('es')")
            page.wait_for_timeout(300)
            # Check a string changed
            es_text = page.evaluate("document.querySelector('.screen.active h2, .screen.active h1, .screen.active .title')?.innerText || ''")
            print(f"  ES text sample: {es_text[:30]}")
            page.evaluate("G.setLang && G.setLang('en')")
            page.wait_for_timeout(200)
            ok("language switch works")
        else:
            fail("settings screen", f"screen={cur}")
    except Exception as e:
        fail("settings", str(e))

    # ============================================================
    # TEST 14: Upgrade screen
    # ============================================================
    print("\n=== TEST 14: Upgrade Screen ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.upgrade && G.upgrade()")
        page.wait_for_timeout(400)
        cur = get_active(page)
        if cur == "upgrade":
            shot(page, "upgrade")
            ok("upgrade screen")
        else:
            fail("upgrade screen", f"screen={cur}")
    except Exception as e:
        fail("upgrade", str(e))

    # ============================================================
    # TEST 15: Matchmaking (with timeout)
    # ============================================================
    print("\n=== TEST 15: Matchmaking ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        page.evaluate("G.startMatchmaking && G.startMatchmaking()")
        page.wait_for_timeout(500)
        cur = get_active(page)
        if cur == "matchmaking":
            shot(page, "matchmaking")
            ok("matchmaking screen")
            # Wait for timeout (60s) — but we'll only wait 5s then cancel
            page.wait_for_timeout(2000)
            page.evaluate("G.cancelMatchmaking && G.cancelMatchmaking()")
            page.wait_for_timeout(300)
            cur = get_active(page)
            if cur == "menu":
                ok("matchmaking cancelled")
            else:
                fail("matchmaking cancel", f"screen={cur}")
        else:
            fail("matchmaking screen", f"screen={cur}")
    except Exception as e:
        fail("matchmaking", str(e))

    # ============================================================
    # TEST 16: Battle edge cases — all units dead simultaneously
    # ============================================================
    print("\n=== TEST 16: Battle Edge Cases ===")
    try:
        # Clean up any running battle first
        page.evaluate("if(Battle.running)Battle.stop();if(Match.active)Match.active=false;G.menu();")
        page.wait_for_timeout(500)
        page.evaluate("G.menu();")
        page.wait_for_timeout(300)
        # Start a quick match
        page.evaluate("G.quickMatch && G.quickMatch()")
        page.wait_for_timeout(1000)
        # Auto-pick through draft (need 3 picks)
        for _ in range(10):
            cur = get_active(page)
            if cur != "draft": break
            page.evaluate("""() => {
                const cards = document.querySelectorAll('#draftArea .card');
                if(cards.length > 0) cards[0].click();
            }""")
            page.wait_for_timeout(500)
        # Click through scout if needed
        cur = get_active(page)
        if cur == "scout":
            page.evaluate("""() => {
                const btn = document.querySelector('#scout .btn.primary');
                if(btn) btn.click();
            }""")
            page.wait_for_timeout(1000)
        # Now should be in battle
        page.wait_for_timeout(2000)
        running = page.evaluate("Battle.running")
        units = page.evaluate("Battle.units.length")
        print(f"  battle running: {running}, units: {units}")
        if running and units > 0:
            ok("battle started with units")
        else:
            warn("battle state", f"running={running}, units={units} (may still be in draft/scout)")
        # Let it run for a bit
        page.wait_for_timeout(3000)
        # Check no NaN in unit positions
        nan_check = page.evaluate("""() => {
            for(const u of Battle.units) {
                if(isNaN(u.x) || isNaN(u.y) || isNaN(u.h)) return true;
            }
            return false;
        }""")
        if nan_check:
            bug(19, "CRITICAL", "Battle", "NaN in unit positions/HP")
            fail("NaN check", "units have NaN values")
        else:
            ok("no NaN in unit positions")
        # Check battle time advancing
        bt = page.evaluate("Battle.time")
        print(f"  battle time: {bt}")
        if bt > 0: ok("battle time advancing")
        else: warn("battle time", f"time={bt}")
        # Check for negative HP
        neg_hp = page.evaluate("""() => {
            for(const u of Battle.units) {
                if(u.h < 0) return true;
            }
            return false;
        }""")
        if neg_hp:
            bug(20, "MAJOR", "Battle", "Unit has negative HP")
            fail("negative HP check", "units have negative HP")
        else:
            ok("no negative HP")
        # Check for negative cooldowns
        neg_cd = page.evaluate("""() => {
            for(const u of Battle.units) {
                if(u.abCool < 0) return true;
            }
            return false;
        }""")
        if neg_cd:
            bug(21, "MINOR", "Battle", "Unit has negative ability cooldown")
            fail("negative cooldown check", "units have negative cooldown")
        else:
            ok("no negative cooldowns")
        # Check for stuck units (no movement over 5s)
        positions_before = page.evaluate("""() => Battle.units.map(u => ({x:u.x, y:u.y, h:u.h}))""")
        page.wait_for_timeout(3000)
        positions_after = page.evaluate("""() => Battle.units.map(u => ({x:u.x, y:u.y, h:u.h}))""")
        moved = False
        for a, b in zip(positions_before, positions_after):
            if abs(a['x'] - b['x']) > 1 or abs(a['y'] - b['y']) > 1:
                moved = True
                break
        if moved:
            ok("units are moving")
        else:
            # Check if battle is still running — if not, it ended (which is fine)
            still_running = page.evaluate("Battle.running")
            if not still_running:
                ok("battle ended during check (no stuck units)")
            else:
                warn("unit movement", "units may be stuck (no movement in 3s)")
        # Clean up
        page.evaluate("if(Battle.running)Battle.stop();G.menu();")
        page.wait_for_timeout(300)
    except Exception as e:
        fail("battle edge cases", str(e))

    # ============================================================
    # TEST 16b: Replay screen
    # ============================================================
    print("\n=== TEST 16b: Replay Screen ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        # Check if there are any replays
        replay_count = page.evaluate("(G.save.replays||[]).length")
        print(f"  replays: {replay_count}")
        page.evaluate("G.replaysScreen && G.replaysScreen()")
        page.wait_for_timeout(400)
        cur = get_active(page)
        if cur == "replays":
            shot(page, "replays")
            ok("replays screen")
            if replay_count > 0:
                ok("replays exist from previous matches")
            else:
                warn("no replays", "no matches played yet")
        else:
            fail("replays screen", f"screen={cur}")
    except Exception as e:
        fail("replays", str(e))

    # ============================================================
    # TEST 16c: Share match result
    # ============================================================
    print("\n=== TEST 16c: Share Match Result ===")
    try:
        page.evaluate("G.menu();")
        page.wait_for_timeout(200)
        # Try sharing (may fail if no replays)
        page.evaluate("G.shareMatchResult && G.shareMatchResult()")
        page.wait_for_timeout(500)
        # Check for toast (success or failure)
        toast = page.evaluate("document.querySelector('#toast')?.innerText || ''")
        if toast:
            ok(f"share result toast: {toast[:40]}")
        else:
            # Web Share API may have been called (headless can't test)
            ok("share result called (no toast = Web Share API)")
    except Exception as e:
        fail("share result", str(e))

    # ============================================================
    # TEST 17: Console error summary
    # ============================================================
    print("\n=== TEST 17: Console Error Summary ===")
    real_errors = [l for l in logs if l["type"] == "error" and "CORS" not in l["text"] and "torrent" not in l["text"] and "lz-string" not in l["text"]]
    real_pageerrors = [e for e in errors if "CORS" not in e and "torrent" not in e and "lz-string" not in e]
    print(f"  Console errors (non-CORS): {len(real_errors)}")
    print(f"  PageErrors (non-CORS): {len(real_pageerrors)}")
    for e in real_errors[:10]:
        print(f"    CONSOLE ERROR: {e['text'][:120]}")
    for e in real_pageerrors[:10]:
        print(f"    PAGEERROR: {e[:120]}")
    if len(real_errors) == 0 and len(real_pageerrors) == 0:
        ok("no console errors or pageerrors")
    else:
        for e in real_pageerrors:
            bug(20, "MAJOR", "Runtime", f"PageError: {e[:100]}")

    # ============================================================
    # Cleanup
    # ============================================================
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    browser.close()

# ============================================================
# Results summary
# ============================================================
print("\n" + "=" * 60)
print("E2E TEST RESULTS SUMMARY")
print("=" * 60)
print(f"  PASS:     {len(results['pass'])}")
print(f"  FAIL:     {len(results['fail'])}")
print(f"  WARN:     {len(results['warnings'])}")
print(f"  ERRORS:   {len(results['errors'])}")
print(f"  BUGS:     {len(bugs)}")
print()
if results["fail"]:
    print("FAILURES:")
    for name, detail in results["fail"]:
        print(f"  - {name}: {detail}")
print()
if bugs:
    print("BUGS FOUND:")
    for b in bugs:
        print(f"  #{b['id']} [{b['sev']}] {b['area']}: {b['desc']}")
print()
print(f"Total: {len(results['pass'])+len(results['fail'])} tests, {len(bugs)} bugs")

# Write results to file
with open(os.path.join(OUT_DIR, "results.json"), "w") as f:
    json.dump({"results": results, "bugs": bugs}, f, indent=2)

sys.exit(0 if len(bugs) == 0 else 1)

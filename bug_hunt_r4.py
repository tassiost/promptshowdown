#!/usr/bin/env python3
"""Bug hunt round 4: exercise Draft Showdown game flows via Playwright,
capturing all console errors/warnings and pageerrors per flow."""

import os
import time
import traceback
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
OUT_DIR = "/Users/tassio/Downloads/promptshowdown/bug_hunt_r4_shots"
os.makedirs(OUT_DIR, exist_ok=True)


class ConsoleCapture:
    """Collects console messages (error/warning) and pageerrors."""
    def __init__(self, page):
        self.page = page
        self.entries = []  # (kind, text)
        self._handlers = []

    def __enter__(self):
        def on_console(msg):
            if msg.type in ("error", "warning"):
                self.entries.append(("console:" + msg.type, msg.text))
        def on_pageerror(err):
            self.entries.append(("pageerror", str(err)))
        self.page.on("console", on_console)
        self.page.on("pageerror", on_pageerror)
        self._handlers = [on_console, on_pageerror]
        return self

    def __exit__(self, *exc):
        # Playwright sync listeners can't be easily removed; keep them but
        # they only append to this list which we stop reading after exit.
        return False


def active_screen(page):
    return page.evaluate("""() => {
        const els = document.querySelectorAll('.screen.active');
        return Array.from(els).map(e => e.id);
    }""")


def wait_ready(page):
    # Don't wait for networkidle — CDN dynamic imports (web-llm) can hang.
    page.wait_for_load_state("domcontentloaded")
    # Poll for window.G with a generous timeout + retry.
    deadline = time.time() + 40
    while time.time() < deadline:
        try:
            page.wait_for_function("typeof window.G === 'object' && window.G !== null", timeout=5000)
            break
        except Exception:
            print("  (waiting for window.G...)")
    else:
        raise RuntimeError("window.G never became available")
    page.wait_for_function("!!(window.G && window.G.save)", timeout=20000)


def shot(page, name):
    path = os.path.join(OUT_DIR, name + ".png")
    try:
        page.screenshot(path=path, full_page=False)
    except Exception as e:
        print(f"  (screenshot failed for {name}: {e})")


def report(flow, ok, entries, extra=""):
    errs = [e for e in entries if e[0] == "pageerror" or e[0] == "console:error"]
    warns = [e for e in entries if e[0] == "console:warning"]
    status = "SUCCESS" if ok else "FAILED"
    print(f"\n=== {flow} === [{status}]")
    if extra:
        print(f"  note: {extra}")
    if errs:
        print(f"  ERRORS ({len(errs)}):")
        for kind, text in errs:
            print(f"    [{kind}] {text}")
    else:
        print("  errors: none")
    if warns:
        print(f"  WARNINGS ({len(warns)}):")
        for kind, text in warns:
            print(f"    [{kind}] {text}")
    else:
        print("  warnings: none")
    return errs, warns


def run_flow(page, flow_name, fn):
    """Run a flow inside a console capture; flow takes its own peak screenshot."""
    cap = ConsoleCapture(page)
    with cap:
        ok = True
        extra = ""
        try:
            # Give the flow a screenshot helper bound to this flow's name.
            extra = fn(page, lambda sub: shot(page, flow_name + "_" + sub))
        except Exception as e:
            ok = False
            extra = f"EXCEPTION: {e}\n{traceback.format_exc()}"
        time.sleep(0.2)
    errs, warns = report(flow_name, ok, cap.entries, extra)
    return ok, errs, warns


# ---------- Flow implementations ----------

def flow_forge(page, snap):
    page.evaluate("G.menu()")
    time.sleep(0.3)
    page.evaluate("G.forge()")
    time.sleep(0.3)
    snap("forge_screen")
    # set forgePrompt to "dragon"
    page.evaluate("""() => {
        const el = document.getElementById('forgePrompt');
        if (el) { el.value = 'dragon'; }
    }""")
    page.evaluate("G.forgeSkipAd()")
    # wait 3s for generation (template fallback is sync-ish but async promise)
    time.sleep(3)
    # verify a pending unit exists
    has_pending = page.evaluate("!!G.pendingForgeUnit")
    snap("forge_preview")
    page.evaluate("G.keepForge()")
    time.sleep(0.3)
    page.evaluate("G.menu()")
    return f"pendingForgeUnit after skip: {has_pending}"


def flow_deck(page, snap):
    page.evaluate("G.menu()")
    time.sleep(0.2)
    # G.screen('deck') alone doesn't render content; G.deck() is the canonical
    # entry point that calls screen('deck') AND renders loadout + collection.
    page.evaluate("G.deck()")
    time.sleep(1.0)
    snap("deck_screen")
    # click loadout slot cards (triggers swapLoadoutSlot)
    clicked = page.evaluate("""() => {
        let n = 0;
        const area = document.getElementById('loadoutArea');
        if (area) {
            area.querySelectorAll('.card').forEach(c => { try { c.click(); n++; } catch(e){} });
        }
        return n;
    }""")
    time.sleep(0.3)
    # click a couple collection cards (triggers swap into loadout / fuse)
    clicked2 = page.evaluate("""() => {
        let n = 0;
        const area = document.getElementById('deckArea');
        if (area) {
            const cards = area.querySelectorAll('.card');
            for (let i = 0; i < Math.min(3, cards.length); i++) {
                try { cards[i].click(); n++; } catch(e){}
            }
        }
        return n;
    }""")
    time.sleep(0.3)
    snap("deck_after_clicks")
    page.evaluate("G.menu()")
    return f"loadout clicks={clicked}, collection clicks={clicked2}"


def flow_shop(page, snap):
    page.evaluate("G.menu()")
    time.sleep(0.2)
    # give coins so buy/reroll are exercisable (saveData is module-scoped,
    # not on window, so set directly on the save object the UI reads from)
    page.evaluate("G.save.coins = 1000;")
    # G.shop() is the canonical entry (renders offer + buttons)
    page.evaluate("G.shop()")
    time.sleep(1.0)
    snap("shop_screen")
    # click shop offer cards (triggers showUnitDetail modal)
    clicked = page.evaluate("""() => {
        let n = 0;
        const offer = document.getElementById('shopOffer');
        if (offer) {
            offer.querySelectorAll('.card').forEach(c => { try { c.click(); n++; } catch(e){} });
        }
        return n;
    }""")
    time.sleep(0.3)
    snap("shop_detail_modal")
    # close any unit-detail modal overlay
    page.evaluate("""() => {
        document.querySelectorAll('div').forEach(d => {
            if (d.style && d.style.position === 'fixed' && d.style.zIndex === '9999') d.remove();
        });
    }""")
    # try reroll + buy
    page.evaluate("""() => {
        const r = document.getElementById('rerollShopBtn'); if (r && !r.disabled) try { r.click(); } catch(e){}
        const b = document.getElementById('buyBtn'); if (b && !b.disabled) try { b.click(); } catch(e){}
    }""")
    time.sleep(0.3)
    snap("shop_after_buy")
    page.evaluate("G.menu()")
    return f"shop card clicks={clicked}"


def pick_three_cards(page):
    """Pick 3 draft cards via G.pickDraft on the current offering."""
    picked = 0
    for i in range(3):
        # wait until offering is ready
        page.wait_for_function("!!(G.currentOffering && G.currentOffering.length)", timeout=5000)
        page.evaluate("""() => {
            const off = G.currentOffering;
            if (off && off.length) G.pickDraft(off[0]);
        }""")
        picked += 1
        time.sleep(0.15)
    return picked


def wait_for_result_screen(page, timeout_ms=90000, snap=None):
    """Poll until the result screen is active (round or match end).
    Returns (reached, diag_string)."""
    start = time.time()
    last_battle_time = None
    while time.time() - start < timeout_ms / 1000:
        screens = active_screen(page)
        if "result" in screens:
            return True, ""
        # speed up the battle once it starts
        page.evaluate("""() => { if (typeof Battle !== 'undefined' && Battle.speed) Battle.speed = 16; }""")
        # sample battle diagnostics every ~5s
        if int(time.time() - start) % 5 == 0:
            diag = page.evaluate("""() => {
                if (typeof Battle === 'undefined') return 'Battle undefined';
                return JSON.stringify({
                    running: Battle.running,
                    time: +(Battle.time||0).toFixed(1),
                    speed: Battle.speed,
                    units: (Battle.units||[]).length,
                    alive: (Battle.units||[]).filter(u=>u.h>0).length,
                    screen: (document.querySelector('.screen.active')||{}).id,
                });
            }""")
            if diag != last_battle_time:
                last_battle_time = diag
                print(f"    [poll {int(time.time()-start)}s] {diag}")
        time.sleep(0.25)
    # final diagnostic
    diag = page.evaluate("""() => {
        if (typeof Battle === 'undefined') return 'Battle undefined';
        return JSON.stringify({
            running: Battle.running, time: +(Battle.time||0).toFixed(1),
            speed: Battle.speed, units: (Battle.units||[]).length,
            alive: (Battle.units||[]).filter(u=>u.h>0).length,
            screen: (document.querySelector('.screen.active')||{}).id,
            matchActive: (typeof Match!=='undefined') && Match.active,
            livesP: (typeof Match!=='undefined') && Match.livesPlayer,
            livesE: (typeof Match!=='undefined') && Match.livesEnemy,
            round: (typeof Match!=='undefined') && Match.round,
        });
    }""")
    return False, diag


def flow_match(page, snap):
    page.evaluate("G.menu()")
    time.sleep(0.2)
    # set a high default speed so battles resolve fast
    page.evaluate("G.save.defaultSpeed = 4")
    page.evaluate("G.quickMatch()")
    # Round 1: pick 3 cards (auto-starts battle)
    n1 = pick_three_cards(page)
    snap("r1_battle")
    # The 3rd pick auto-calls G.startBattle(); calling again would double-start.
    # We follow the flow spirit: startBattle already invoked.
    got1, diag1 = wait_for_result_screen(page)
    snap("r1_result")
    notes = [f"round1 picks={n1}, result_screen={got1}"]
    if not got1:
        notes.append(f"r1 diag={diag1}")

    # Determine if this was round end (next round available) or match end
    is_match_end = page.evaluate("""() => {
        const nr = document.getElementById('nextRound');
        const mm = document.getElementById('matchMenu');
        return (mm && mm.style.display !== 'none') || (nr && nr.style.display === 'none' && !nr.onclick);
    }""")

    if not got1:
        page.evaluate("G.menu()")
        return "; ".join(notes) + " | NO RESULT SCREEN"

    if is_match_end:
        notes.append("match ended after round 1 (no next round)")
        page.evaluate("G.menu()")
        return "; ".join(notes)

    # click next round
    clicked = page.evaluate("""() => {
        const nr = document.getElementById('nextRound');
        if (nr && nr.onclick) { nr.click(); return true; }
        return false;
    }""")
    notes.append(f"nextRound clicked={clicked}")
    time.sleep(0.4)

    # Round 2: pick 3 cards
    n2 = pick_three_cards(page)
    snap("r2_battle")
    notes.append(f"round2 picks={n2}")
    got2, diag2 = wait_for_result_screen(page)
    snap("r2_result")
    notes.append(f"round2 result_screen={got2}")
    if not got2:
        notes.append(f"r2 diag={diag2}")
    page.evaluate("G.menu()")
    return "; ".join(notes)


def flow_settings(page, snap):
    page.evaluate("G.menu()")
    time.sleep(0.2)
    # G.showSettings() is the canonical entry that opens + populates settings
    page.evaluate("G.showSettings()")
    time.sleep(0.5)
    snap("settings_screen")
    # toggle each setting control
    toggled = page.evaluate("""() => {
        let n = 0; const log = [];
        const ids = ['setAudioEnabled','setSfxVol','setMusicVol','setQuality',
                     'setReducedMotion','setColorblind','setHighContrast',
                     'setAnalyticsOptOut','setLang'];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) { log.push(id+':missing'); continue; }
            try {
                if (el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change')); n++; }
                else if (el.tagName === 'SELECT') {
                    const opts = el.options;
                    if (opts.length > 1) { el.selectedIndex = (el.selectedIndex+1) % opts.length; el.dispatchEvent(new Event('change')); n++; }
                } else if (el.type === 'range') {
                    el.value = (parseInt(el.value)+20) % 100; el.dispatchEvent(new Event('change')); n++;
                }
            } catch(e){ log.push(id+':err:'+e.message); }
        }
        return n + ' toggles; ' + log.join(',');
    }""")
    time.sleep(0.3)
    snap("settings_after_toggles")
    page.evaluate("G.screen('menu')")
    return toggled


def flow_simple(page, snap, screen_id):
    page.evaluate("G.menu()")
    time.sleep(0.2)
    # Use canonical entry points which render content (screen() alone is empty).
    entry = {"stats": "G.stats()", "codex": "G.codex()", "upgrade": "G.upgrade()"}[screen_id]
    page.evaluate(entry)
    time.sleep(1.0)
    snap(screen_id + "_screen")
    # try clicking any tab buttons if present (codex tabs)
    if screen_id == "codex":
        page.evaluate("""() => {
            ['codexTabAbilities','codexTabRoles','codexTabSpells','codexTabMovement','codexTabTargeting']
              .forEach(id => { const b = document.getElementById(id); if (b) try { b.click(); } catch(e){} });
        }""")
        time.sleep(0.3)
        snap("codex_after_tabs")
    # upgrade screen: click the first upgrade button if any
    if screen_id == "upgrade":
        page.evaluate("""() => {
            const area = document.getElementById('upgradeArea');
            if (area) {
                const btns = area.querySelectorAll('button');
                for (let i = 0; i < Math.min(2, btns.length); i++) { try { btns[i].click(); } catch(e){} }
            }
        }""")
        time.sleep(0.3)
        snap("upgrade_after_clicks")
    page.evaluate("G.menu()")
    return f"screen={screen_id} via {entry}"


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 420, "height": 800},
                                       device_scale_factor=2)
        page = context.new_page()
        # Global pageerror capture (safety net across whole session)
        global_errors = []
        page.on("pageerror", lambda e: global_errors.append(str(e)))

        print("Navigating to", URL)
        page.goto(URL, wait_until="load")
        wait_ready(page)
        print("Game ready. window.G present.")

        # Reset to a clean menu state
        page.evaluate("G.menu()")
        time.sleep(0.5)
        shot(page, "00_initial_menu")

        flows = [
            ("01_forge", flow_forge),
            ("02_deck", flow_deck),
            ("03_shop", flow_shop),
            ("04_match", flow_match),
            ("05_settings", flow_settings),
            ("06_stats", lambda pg, snap: flow_simple(pg, snap, "stats")),
            ("07_codex", lambda pg, snap: flow_simple(pg, snap, "codex")),
            ("08_upgrade", lambda pg, snap: flow_simple(pg, snap, "upgrade")),
        ]

        for name, fn in flows:
            ok, errs, warns = run_flow(page, name, fn)
            results.append((name, ok, len(errs), len(warns)))
            # small breather between flows
            time.sleep(0.4)
            # ensure back to menu
            try:
                page.evaluate("G.menu()")
            except Exception:
                pass
            time.sleep(0.2)

        browser.close()

    print("\n\n========== SUMMARY ==========")
    total_err = 0
    total_warn = 0
    for name, ok, ne, nw in results:
        flag = "OK" if ok else "FAIL"
        print(f"  {name:14s} [{flag}]  errors={ne}  warnings={nw}")
        total_err += ne
        total_warn += nw
    print(f"\nTOTAL: errors={total_err}  warnings={total_warn}")
    if global_errors:
        print(f"\nSession-wide pageerrors (outside flow capture): {len(global_errors)}")
        for e in global_errors:
            print("  ", e)
    print(f"\nScreenshots saved to: {OUT_DIR}")


if __name__ == "__main__":
    main()

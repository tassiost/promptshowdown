"""
Bug hunt: Draft Showdown battle system.
Run with: python3 bug_hunt_battle.py
Viewport 420x800, target http://localhost:8765/index.html
"""
import sys
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
results = []


def log(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    line = f"[{status}] {name}"
    if detail:
        line += f" -- {detail}"
    print(line)
    results.append((name, passed, detail))


def wait_for(page, js_expr, timeout=15000, interval=100):
    """Poll a JS expression until it returns truthy or timeout (ms)."""
    deadline = time.time() + timeout / 1000.0
    while time.time() < deadline:
        val = page.evaluate(js_expr)
        if val:
            return val
        page.wait_for_timeout(interval)
    return page.evaluate(js_expr)


def reset_state(page):
    """Stop any running battle and clear match state so the next test starts clean."""
    page.evaluate(
        """() => {
            try { if (Battle && Battle.running) Battle.stop(); } catch(e) {}
            try { if (Battle.autoTimer) { clearInterval(Battle.autoTimer); Battle.autoTimer = null; } } catch(e) {}
            try { Match.active = false; } catch(e) {}
            try { G.playerSurvivors = []; G.enemySurvivors = []; G.selected = []; } catch(e) {}
            try { G.screen('menu'); } catch(e) {}
        }"""
    )
    page.wait_for_timeout(50)


def start_quick_match(page):
    """Start a quick match and play through the draft (auto-pick first card)."""
    page.evaluate("G.quickMatch()")
    # Draft screen: pick cards until battle starts (Battle.running true).
    for _ in range(6):
        if page.evaluate("!!(Battle && Battle.running)"):
            break
        # Pick the first offered card if offering exists.
        page.evaluate(
            """() => {
                if (G.currentOffering && G.currentOffering.length) {
                    G.pickDraft(G.currentOffering[0]);
                }
            }"""
        )
        page.wait_for_timeout(50)
    return page.evaluate("!!(Battle && Battle.running)")


def finish_battle(page):
    """Fast-simulate the current battle to completion via Battle.skip()."""
    page.evaluate("Battle.skip()")
    # skip() runs synchronously; battle should be over now.
    return not page.evaluate("!!(Battle && Battle.running)")


def test_cumulative_draft(page):
    name = "Test 1: Cumulative draft (survivors include dead units, carry to round 2)"
    try:
        reset_state(page)
        # Round 1
        if not start_quick_match(page):
            log(name, False, "Could not start round 1 battle")
            return
        # Capture the player unit count from the battle before finishing.
        player_count = page.evaluate(
            """() => (Battle._allUnits || []).filter(u => u.team === 'player').length"""
        )
        if not finish_battle(page):
            log(name, False, "Battle.skip() did not end round 1")
            return

        # After round 1 ends, playerSurvivors must contain ALL player units
        # (including dead ones with h=0).
        info = page.evaluate(
            """() => {
                const ps = G.playerSurvivors || [];
                const total = ps.length;
                const dead = ps.filter(u => u.h === 0).length;
                const alive = ps.filter(u => u.h > 0).length;
                return {total, dead, alive};
            }"""
        )
        if info["total"] == 0:
            log(name, False, "playerSurvivors empty after round 1")
            return
        if info["total"] != player_count:
            log(name, False, f"playerSurvivors ({info['total']}) != player units in battle ({player_count})")
            return
        # At least the dead ones should be present; ideally some are dead.
        has_dead = info["dead"] > 0
        detail = f"total={info['total']} alive={info['alive']} dead={info['dead']}"

        # Start round 2 via the NEXT ROUND button flow.
        page.evaluate("Match.startRound()")
        page.wait_for_timeout(100)
        # Round 2 draft screen should be active; survivors carried over.
        r2_survivors = page.evaluate("(G.playerSurvivors || []).length")
        # Play round 2 draft and start battle, then inspect buildArmy output.
        # Pick cards to advance to battle.
        for _ in range(6):
            if page.evaluate("!!(Battle && Battle.running)"):
                break
            page.evaluate(
                """() => {
                    if (G.currentOffering && G.currentOffering.length) {
                        G.pickDraft(G.currentOffering[0]);
                    }
                }"""
            )
            page.wait_for_timeout(50)

        # buildArmy combines survivors + new picks. Inspect it directly.
        army_info = page.evaluate(
            """() => {
                const army = G.buildArmy();
                return {len: army.length, fullHp: army.filter(u => u.h === u.mh).length};
            }"""
        )
        if army_info["len"] < r2_survivors:
            log(name, False, f"round 2 army ({army_info['len']}) smaller than survivors ({r2_survivors})")
            return
        log(name, True, f"r1 {detail} | r2 survivors={r2_survivors} army={army_info['len']} fullHp={army_info['fullHp']}" + (" (no dead in r1, but all carried)" if not has_dead else ""))
    except Exception as e:
        log(name, False, f"exception: {e}")


def test_forged_unit_size(page):
    name = "Test 2: Forged unit size (dragon z ~= 16)"
    try:
        reset_state(page)
        # Go to forge screen and reset daily cap to be safe.
        page.evaluate("G.forge()")
        page.evaluate("G.save.forgeCount = 0; G.save.forgeDate = Quests.todayStr();")
        # Set the prompt to dragon.
        page.evaluate("document.getElementById('forgePrompt').value = 'dragon'")
        page.evaluate("G.forgeSkipAd()")
        # Wait for pendingForgeUnit (async template fallback).
        unit = wait_for(page, "G.pendingForgeUnit", timeout=8000)
        if not unit:
            log(name, False, "pendingForgeUnit not set after forgeSkipAd")
            return
        z = unit.get("z")
        size_mod = unit.get("sizeMod")
        body_plan = unit.get("bodyPlan")
        # SIZE_SCALE/BODY_SIZE are module-scoped consts (not on window), so
        # compute the expected value here: large=1.3, dragon=1.25 -> round(16.25)=16.
        expected = round(1.3 * 1.25 * 10)
        # Core assertion: z must match the formula. bodyPlan must be dragon.
        # NOTE: sizeMod is NOT preserved on the unit by unit() (dropped from the
        # returned object), so it is None — reported as a separate finding but
        # not a failure of the z-size check.
        ok = z == expected and body_plan == "dragon"
        note = "" if size_mod == "large" else f" [NOTE: sizeMod field missing on unit ({size_mod}) — unit() drops it]"
        log(name, ok, f"z={z} expected={expected} sizeMod={size_mod} bodyPlan={body_plan}{note}")
    except Exception as e:
        log(name, False, f"exception: {e}")


def test_dead_unit_revival(page):
    name = "Test 3: Dead unit revival (survivors revived to full HP in buildArmy)"
    try:
        reset_state(page)
        # Start a fresh quick match round 1 and finish it.
        if not start_quick_match(page):
            log(name, False, "Could not start battle")
            return
        if not finish_battle(page):
            log(name, False, "Battle.skip() did not end battle")
            return
        # Force some survivors to be "dead" (h=0) to simulate dead carry-over.
        page.evaluate(
            """() => {
                if (G.playerSurvivors.length) {
                    G.playerSurvivors[0].h = 0;
                    G.playerSurvivors[0].mh = G.playerSurvivors[0].mh || 100;
                }
            }"""
        )
        had_dead = page.evaluate("(G.playerSurvivors[0] || {}).h === 0")
        # buildArmy revives survivors: clean.h = clean.mh.
        army = page.evaluate("G.buildArmy()")
        # The first survivor in the army should be at full HP.
        revived = page.evaluate(
            """() => {
                const army = G.buildArmy();
                // survivors are spread first in the army list.
                const first = army[0];
                return {h: first.h, mh: first.mh, full: first.h === first.mh};
            }"""
        )
        ok = revived["full"] and had_dead
        log(name, ok, f"hadDead={had_dead} firstArmyUnit h={revived['h']} mh={revived['mh']} full={revived['full']}")
    except Exception as e:
        log(name, False, f"exception: {e}")


def setup_battle_with_spell(page):
    """Start a quick match battle and inject a damage spell into playerSpells."""
    if not start_quick_match(page):
        return False
    # Inject a damage spell spec into playerSpells and re-render the bar.
    page.evaluate(
        """() => {
            const spec = {
                name: 'Test Fireball',
                effect: 'damage',
                shape: 'circle_aoe',
                fxType: 'explosion',
                target: 'enemy_cluster',
                trigger: 'manual',
                magnitude: 50,
                radius: 120,
                duration: 0
            };
            Battle.playerSpells = [{spec, cooldown: 0, maxCD: 5}];
            Battle._renderSpellBar();
            window.__testSpell = spec;
        }"""
    )
    return True


def test_spell_casting(page):
    name = "Test 4: Spell casting (manual spell bar button)"
    try:
        reset_state(page)
        if not setup_battle_with_spell(page):
            log(name, False, "Could not start battle with spell")
            return
        # Record enemy HP total before casting.
        enemy_hp_before = page.evaluate(
            "Battle.units.filter(u=>u.team==='enemy').reduce((s,u)=>s+u.h,0)"
        )
        # Click the spell button in the spell bar.
        clicked = page.evaluate(
            """() => {
                const btn = document.querySelector('#spellBar .spellBtn');
                if (btn) { btn.click(); return true; }
                return false;
            }"""
        )
        if not clicked:
            log(name, False, "spell bar button not found")
            return
        cd = page.evaluate("Battle.playerSpells[0] && Battle.playerSpells[0].cooldown")
        enemy_hp_after = page.evaluate(
            "Battle.units.filter(u=>u.team==='enemy').reduce((s,u)=>s+u.h,0)"
        )
        ok = cd and cd > 0 and enemy_hp_after < enemy_hp_before
        log(name, ok, f"clicked={clicked} cooldown={cd} enemyHpBefore={enemy_hp_before} after={enemy_hp_after}")
    except Exception as e:
        log(name, False, f"exception: {e}")


def test_hp_bar_display(page):
    name = "Test 5: HP bar display (green/red HP bar pixels on canvas)"
    try:
        reset_state(page)
        if not start_quick_match(page):
            log(name, False, "Could not start battle")
            return
        # Damage some units so we get a mix of HP-bar colors (green/yellow/red),
        # then force a render so HP bars are painted onto the canvas.
        page.evaluate(
            """() => {
                const enemies = Battle.units.filter(u => u.team === 'enemy');
                if (enemies.length) { enemies[0].h = Math.floor(enemies[0].mh * 0.1); enemies[0].dispH = enemies[0].h; }
                const players = Battle.units.filter(u => u.team === 'player');
                if (players.length) { players[0].h = Math.floor(players[0].mh * 0.4); players[0].dispH = players[0].h; }
                Battle.render();
            }"""
        )
        page.wait_for_timeout(100)
        # Scan the canvas for HP-bar colors: green #34d399, yellow #fbbf24, red #fb7185.
        counts = page.evaluate(
            """() => {
                const cv = document.getElementById('cv');
                const ctx = cv.getContext('2d');
                const w = cv.width, h = cv.height;
                const data = ctx.getImageData(0, 0, w, h).data;
                const targets = {
                    green: [52, 211, 153],
                    yellow: [251, 191, 36],
                    red: [251, 113, 133]
                };
                const counts = {green: 0, yellow: 0, red: 0};
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i+1], b = data[i+2];
                    for (const k in targets) {
                        const t = targets[k];
                        if (Math.abs(r-t[0])<=25 && Math.abs(g-t[1])<=25 && Math.abs(b-t[2])<=25) {
                            counts[k]++;
                        }
                    }
                }
                return counts;
            }"""
        )
        total = counts["green"] + counts["yellow"] + counts["red"]
        ok = total > 0
        log(name, ok, f"green={counts['green']} yellow={counts['yellow']} red={counts['red']} total={total}")
    except Exception as e:
        log(name, False, f"exception: {e}")


def test_kill_attribution(page):
    name = "Test 6: Kill attribution (lastAttacker set after damage)"
    try:
        reset_state(page)
        if not start_quick_match(page):
            log(name, False, "Could not start battle")
            return
        # Run updates until at least one unit has taken damage (h < mh).
        page.evaluate(
            """() => {
                let safety = 400;
                while (safety-- > 0 && Battle.running) {
                    Battle.update(0.05 * (Battle.speed || 1));
                    const damaged = Battle.units.some(u => u.h < u.mh && u.h > 0);
                    if (damaged) break;
                }
            }"""
        )
        info = page.evaluate(
            """() => {
                const damaged = Battle.units.filter(u => u.h < u.mh && u.h > 0);
                const withAttacker = damaged.filter(u => u.lastAttacker);
                return {damaged: damaged.length, withAttacker: withAttacker.length};
            }"""
        )
        ok = info["damaged"] > 0 and info["withAttacker"] > 0
        log(name, ok, f"damaged={info['damaged']} withLastAttacker={info['withAttacker']}")
    except Exception as e:
        log(name, False, f"exception: {e}")


def test_floating_damage_numbers(page):
    name = "Test 7: Floating damage numbers (Battle.damageNums populated)"
    try:
        reset_state(page)
        if not start_quick_match(page):
            log(name, False, "Could not start battle")
            return
        # Run updates until damage numbers appear.
        page.evaluate(
            """() => {
                let safety = 400;
                while (safety-- > 0 && Battle.running) {
                    Battle.update(0.05 * (Battle.speed || 1));
                    if (Battle.damageNums && Battle.damageNums.length) break;
                }
            }"""
        )
        count = page.evaluate("(Battle.damageNums || []).length")
        ok = count > 0
        log(name, ok, f"damageNums count={count}")
    except Exception as e:
        log(name, False, f"exception: {e}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 420, "height": 800})
        page = context.new_page()
        page.goto(URL, wait_until="networkidle")
        # Wait for the game module to initialize (G object available).
        wait_for(page, "typeof G !== 'undefined' && !!G", timeout=15000)

        test_cumulative_draft(page)
        test_forged_unit_size(page)
        test_dead_unit_revival(page)
        test_spell_casting(page)
        test_hp_bar_display(page)
        test_kill_attribution(page)
        test_floating_damage_numbers(page)

        browser.close()

    print("\n==== SUMMARY ====")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = len(results) - passed
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name} -- {detail}")
    print(f"\n{passed}/{len(results)} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

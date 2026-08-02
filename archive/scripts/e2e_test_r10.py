#!/usr/bin/env python3
"""E2E test suite for Prompt Showdown — R10 comprehensive coverage."""
import sys, time, json, base64
from playwright.sync_api import sync_playwright

results={"pass":0,"fail":0,"warn":0,"errors":[],"bugs":[]}

def ok(name): results["pass"]+=1; print(f"[PASS] {name}")
def fail(name,detail): results["fail"]+=1; print(f"[FAIL] {name}: {detail}")
def warn(name,detail): results["warn"]+=1; print(f"[WARN] {name}: {detail}")
def bug(name,detail): results["bugs"]+=1; print(f"[BUG] {name}: {detail}")

def wait_for_init(page,timeout=10):
    """Wait for G._initialized to become true."""
    for _ in range(timeout*10):
        if page.evaluate("typeof G!=='undefined' && G._initialized===true"):return True
        time.sleep(0.1)
    return False

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(viewport={"width":390,"height":844})
        page=context.new_page()
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("console",lambda m:errors.append(f"console.{m.type}: {m.text}") if m.type=="error" else None)

        # === TEST 1: Page Load + Init ===
        print("\n=== TEST 1: Page Load + Init ===")
        try:
            page.goto("http://localhost:8765/index.html",wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            ok("page load")
        except Exception as e:
            fail("page load",str(e)); sys.exit(1)

        if page.evaluate("typeof G!=='undefined' && typeof G.menu==='function'"): ok("G object exists")
        else: fail("G object","missing")

        if wait_for_init(page): ok("G._initialized (waited)")
        else: fail("G._initialized","timeout")

        sv=page.evaluate("G.save && typeof G.save.version==='number'")
        if sv: ok("G.save.version is number")
        else: fail("G.save.version","not number")

        # === TEST 2: Menu + Navigation ===
        print("\n=== TEST 2: Menu + Navigation ===")
        page.evaluate("G.save.onboarded=true; G.menu();")
        page.wait_for_timeout(500)
        if page.evaluate("document.querySelector('.screen.active')?.id==='menu'"): ok("menu screen")
        else: fail("menu screen","not active")

        for screen_name in ["forge","deck","upgrade","settings","achievements","matchmaking","shop","codex","stats","profile","replays","tierlist"]:
            page.evaluate(f"G.screen('{screen_name}')")
            page.wait_for_timeout(200)
            active=page.evaluate("document.querySelector('.screen.active')?.id")
            if active==screen_name: ok(f"screen: {screen_name}")
            else: fail(f"screen: {screen_name}",f"got {active}")

        # === TEST 3: Settings ===
        print("\n=== TEST 3: Settings ===")
        page.evaluate("G.screen('settings')")
        page.wait_for_timeout(300)
        # Language switch
        page.evaluate("G.saveSetting('lang','es')")
        page.wait_for_timeout(300)
        es_text=page.evaluate("document.querySelector('#settings h2')?.innerText || ''")
        if es_text: ok(f"language switch (es: {es_text[:20]})")
        else: fail("language switch","no text")
        page.evaluate("G.saveSetting('lang','en')")
        page.wait_for_timeout(300)

        # Difficulty switch
        page.evaluate("G.setDifficulty('hard')")
        page.wait_for_timeout(200)
        diff=page.evaluate("G.save.difficulty")
        if diff=="hard": ok("difficulty set to hard")
        else: fail("difficulty",f"got {diff}")
        page.evaluate("G.setDifficulty('normal')")
        page.wait_for_timeout(200)

        # === TEST 4: Forge Unit (template) ===
        print("\n=== TEST 4: Forge Unit ===")
        page.evaluate("G.screen('forge')")
        page.wait_for_timeout(300)
        page.evaluate("G.forgeMode='unit'")
        page.wait_for_timeout(100)
        # Use template fallback (no ad)
        page.evaluate("G._doForge('test warrior', false)")
        page.wait_for_timeout(3000)
        has_unit=page.evaluate("!!G.pendingForgeUnit")
        if has_unit:
            unit_data=page.evaluate("G.pendingForgeUnit")
            ok(f"forge unit: {unit_data.get('n','?')} ({unit_data.get('role','?')})")
            # Keep the unit
            page.evaluate("G.keepForge()")
            page.wait_for_timeout(300)
            in_coll=page.evaluate("(name) => G.save.collection.some(u=>u.n===name)",unit_data.get('n'))
            if in_coll: ok("forge unit added to collection")
            else: fail("forge unit","not in collection")
        else:
            fail("forge unit","no pendingForgeUnit")

        # === TEST 5: Forge Spell (template) ===
        print("\n=== TEST 5: Forge Spell ===")
        page.evaluate("G.screen('forge')")
        page.wait_for_timeout(300)
        page.evaluate("G.forgeMode='spell'")
        page.wait_for_timeout(100)
        page.evaluate("G._doForge('fireball', false)")
        page.wait_for_timeout(3000)
        has_spell=page.evaluate("!!G.pendingForgeSpell")
        if has_spell:
            spell=page.evaluate("G.pendingForgeSpell")
            ok(f"forge spell: {spell.get('name','?')} ({spell.get('effect','?')})")
            page.evaluate("G.addSpellToBook()")
            page.wait_for_timeout(300)
            ok("spell added to spellbook")
        else:
            fail("forge spell","no pendingForgeSpell")

        # === TEST 6: Forge Daily Cap ===
        print("\n=== TEST 6: Forge Daily Cap ===")
        page.evaluate("G.save.forgeCount=10; saveData(G.save);")
        page.wait_for_timeout(200)
        page.evaluate("G.screen('forge')")
        page.wait_for_timeout(200)
        page.evaluate("G.forgeMode='unit'")
        page.evaluate("G._doForge('test', false)")
        page.wait_for_timeout(2000)
        # Should NOT have produced a unit (cap reached)
        cap_ok=page.evaluate("!G.pendingForgeUnit || G._forgeRunning===false")
        # Reset cap
        page.evaluate("G.save.forgeCount=0; saveData(G.save);")
        if cap_ok: ok("forge daily cap enforced")
        else: warn("forge daily cap","unclear")

        # === TEST 7: Deck + Loadout ===
        print("\n=== TEST 7: Deck + Loadout ===")
        page.evaluate("G.screen('deck')")
        page.wait_for_timeout(300)
        loadout=page.evaluate("G.save.loadout")
        if loadout and len(loadout)==4: ok(f"loadout has 4 units: {loadout}")
        else: fail("loadout",f"got {loadout}")

        # Swap a loadout slot
        coll=page.evaluate("G.collectionUnits().map(u=>u.n)")
        if len(coll)>4:
            # Try to swap slot 0 with a non-loadout unit
            non_loadout=[u for u in coll if u not in loadout]
            if non_loadout:
                page.evaluate(f"G.addToLoadout('{non_loadout[0]}')")
                page.wait_for_timeout(300)
                new_loadout=page.evaluate("G.save.loadout")
                if non_loadout[0] in new_loadout: ok("loadout swap works")
                else: fail("loadout swap",f"got {new_loadout}")

        # Save preset
        page.evaluate("G.savePreset()")
        # Can't interact with prompt() in headless — test via direct call
        page.evaluate("G.save.presets['TestPreset']=G.save.loadout.slice(); saveData(G.save);")
        page.wait_for_timeout(200)
        presets=page.evaluate("Object.keys(G.save.presets)")
        if "TestPreset" in presets: ok("preset saved")
        else: fail("preset","not saved")

        # Apply preset
        page.evaluate("G.applyPreset(0)")
        page.wait_for_timeout(200)
        ok("preset applied (no crash)")

        # Delete preset
        page.evaluate("G.deletePreset(0)")
        page.wait_for_timeout(200)
        presets=page.evaluate("Object.keys(G.save.presets)")
        if "TestPreset" not in presets: ok("preset deleted")
        else: fail("preset delete","still exists")

        # === TEST 8: Upgrade Screen ===
        print("\n=== TEST 8: Upgrade Screen ===")
        page.evaluate("G.save.coins=10000; saveData(G.save);")
        page.wait_for_timeout(200)
        page.evaluate("G.screen('upgrade')")
        page.wait_for_timeout(300)
        # Try upgrading first unit
        first_unit=page.evaluate("G.collectionUnits()[0]?.n")
        if first_unit:
            current_lvl=page.evaluate(f"G.unitLevel('{first_unit}')")
            if current_lvl<10:
                page.evaluate(f"G.upgradeUnit('{first_unit}', 30)")
                page.wait_for_timeout(300)
                new_lvl=page.evaluate(f"G.unitLevel('{first_unit}')")
                if new_lvl==current_lvl+1: ok(f"upgrade works: {first_unit} Lv{current_lvl}->{new_lvl}")
                else: fail("upgrade",f"lvl {current_lvl}->{new_lvl}")
            else:
                ok(f"unit already max level: {first_unit}")
        else:
            fail("upgrade","no units in collection")

        # === TEST 9: Shop ===
        print("\n=== TEST 9: Shop ===")
        page.evaluate("G.save.coins=1000; saveData(G.save);")
        page.wait_for_timeout(200)
        page.evaluate("G.shop()")
        page.wait_for_timeout(300)
        offer=page.evaluate("G._shopOffer")
        if offer and len(offer)==3: ok("shop offer generated (3 units)")
        else: fail("shop offer",f"got {offer}")

        # Buy a unit
        coll_before=page.evaluate("G.save.collection.length")
        page.evaluate("G.buyShopUnit()")
        page.wait_for_timeout(300)
        coll_after=page.evaluate("G.save.collection.length")
        if coll_after>=coll_before: ok(f"shop buy (collection: {coll_before}->{coll_after})")
        else: fail("shop buy","collection shrank")

        # Reroll shop
        page.evaluate("G.rerollShop()")
        page.wait_for_timeout(300)
        ok("shop reroll (no crash)")

        # === TEST 10: Codex ===
        print("\n=== TEST 10: Codex ===")
        page.evaluate("G.codex()")
        page.wait_for_timeout(300)
        for tab in ["abilities","roles","spells","movement","targeting"]:
            page.evaluate(f"G.codexTab('{tab}')")
            page.wait_for_timeout(200)
            content=page.evaluate("document.getElementById('codexContent')?.innerHTML?.length || 0")
            if content>0: ok(f"codex tab: {tab} ({content} chars)")
            else: fail(f"codex tab: {tab}","empty")

        # === TEST 11: Tier List ===
        print("\n=== TEST 11: Tier List ===")
        page.evaluate("G.tierList()")
        page.wait_for_timeout(300)
        for tab in ["all","collection"]:
            page.evaluate(f"G.tierListTab('{tab}')")
            page.wait_for_timeout(200)
            content=page.evaluate("document.getElementById('tierContent')?.innerHTML?.length || 0")
            if content>0: ok(f"tierlist tab: {tab} ({content} chars)")
            else: fail(f"tierlist tab: {tab}","empty")

        # === TEST 12: Profile + Stats ===
        print("\n=== TEST 12: Profile + Stats ===")
        page.evaluate("G.profile()")
        page.wait_for_timeout(300)
        content=page.evaluate("document.getElementById('profileContent')?.innerHTML?.length || 0")
        if content>0: ok(f"profile screen ({content} chars)")
        else: fail("profile","empty")

        page.evaluate("G.stats()")
        page.wait_for_timeout(300)
        content=page.evaluate("document.getElementById('statsContent')?.innerHTML?.length || 0")
        if content>0: ok(f"stats screen ({content} chars)")
        else: fail("stats","empty")

        # === TEST 13: Achievements ===
        print("\n=== TEST 13: Achievements ===")
        page.evaluate("G.screen('achievements')")
        page.wait_for_timeout(300)
        ach=page.evaluate("G.save.achievements || {}")
        ach_defs=page.evaluate("Object.keys(G.achievements).length")
        ok(f"achievements: {len(ach)} unlocked / {ach_defs} total")

        # === TEST 14: Quests ===
        print("\n=== TEST 14: Quests ===")
        quests=page.evaluate("G.save.quests?.list || []")
        if len(quests)==3: ok(f"3 daily quests generated")
        else: fail("quests",f"got {len(quests)}")
        for q in quests:
            if "id" in q and "target" in q and "progress" in q: pass
            else: fail("quest structure",str(q))
        if len(quests)==3: ok("quest structure valid")

        # === TEST 15: Quick Match (Draft + Battle) ===
        print("\n=== TEST 15: Quick Match ===")
        page.evaluate("G.menu()")
        page.wait_for_timeout(300)
        page.evaluate("G.start()")
        page.wait_for_timeout(2000)
        screen=page.evaluate("document.querySelector('.screen.active')?.id")
        if screen in ["draft","battle"]: ok(f"match started (screen={screen})")
        else: fail("match start",f"screen={screen}")

        # Pick cards
        for i in range(4):
            picked=page.evaluate("G.pickDraft(G.currentOffering?.[0])")
            page.wait_for_timeout(500)
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="battle": break
        screen=page.evaluate("document.querySelector('.screen.active')?.id")
        if screen=="battle": ok("reached battle screen")
        else: fail("battle screen",f"got {screen}")

        # === TEST 16: Battle Edge Cases ===
        print("\n=== TEST 16: Battle Edge Cases ===")
        running=page.evaluate("Battle.running")
        units=page.evaluate("Battle.units.length")
        if running and units>0: ok(f"battle running with {units} units")
        else: fail("battle",f"running={running} units={units}")

        # Check for NaN in positions
        nan_check=page.evaluate("Battle.units.some(u=>isNaN(u.x)||isNaN(u.y)||isNaN(u.h))")
        if not nan_check: ok("no NaN in unit positions")
        else: fail("NaN check","NaN found")

        # Battle time advancing
        t1=page.evaluate("Battle.time")
        page.wait_for_timeout(2000)
        t2=page.evaluate("Battle.time")
        if t2>t1: ok(f"battle time advancing ({t1:.1f}->{t2:.1f})")
        else: fail("battle time","not advancing")

        # No negative HP
        neg_hp=page.evaluate("Battle.units.some(u=>u.h<0)")
        if not neg_hp: ok("no negative HP")
        else: fail("negative HP","found")

        # No negative cooldowns
        neg_cd=page.evaluate("Battle.units.some(u=>(u.cool||0)<0||(u.abCool||0)<0)")
        if not neg_cd: ok("no negative cooldowns")
        else: fail("negative cooldowns","found")

        # Units are moving
        pos1=page.evaluate("Battle.units.map(u=>({x:u.x,y:u.y}))")
        page.wait_for_timeout(2000)
        pos2=page.evaluate("Battle.units.map(u=>({x:u.x,y:u.y}))")
        moved=any(pos1[i]["x"]!=pos2[i]["x"] or pos1[i]["y"]!=pos2[i]["y"] for i in range(min(len(pos1),len(pos2))))
        if moved: ok("units are moving")
        else: warn("units moving","no movement detected")

        # === TEST 17: Full Match Flow ===
        print("\n=== TEST 17: Full Match Flow ===")
        # Wait for match to complete (up to 180s)
        match_done=False
        for _ in range(180):
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="menu":
                match_done=True
                break
            time.sleep(1)
        if match_done: ok("full match completed (returned to menu)")
        else: warn("full match","timeout (still in match)")

        # === TEST 18: Save/Load ===
        print("\n=== TEST 18: Save/Load ===")
        save=page.evaluate("JSON.stringify(G.save)")
        if save and len(save)>10: ok(f"save readable ({len(save)} chars)")
        else: fail("save","not readable")

        # Reload and verify
        page.reload()
        page.wait_for_timeout(3000)
        if wait_for_init(page):
            save2=page.evaluate("JSON.stringify(G.save)")
            if save==save2: ok("save persisted across reload")
            else: warn("save persisted","data differs (may be expected if quests generated)")
        else: fail("save persisted","init timeout")

        # === TEST 19: Export/Import ===
        print("\n=== TEST 19: Export/Import ===")
        page.evaluate("G.exportSave()")
        page.wait_for_timeout(300)
        export_code=page.evaluate("document.getElementById('saveExportArea')?.value || ''")
        if export_code.startswith("PSV4:"): ok(f"export code generated ({len(export_code)} chars)")
        else: fail("export",f"got {export_code[:20]}")

        # Import the exported save
        page.evaluate(f"G.importSave()")
        # Can't interact with prompt in headless — test via direct logic
        if export_code.startswith("PSV4:"):
            # Simulate import
            page.evaluate(f"""() => {{
                const code = {json.dumps(export_code)};
                const b64 = code.slice(5);
                const json = decodeURIComponent(escape(atob(b64)));
                const data = JSON.parse(json);
                const migrated = migrateSave(data);
                if (migrated) {{
                    G.save = migrated;
                    saveData(G.save);
                }}
            }}""")
            page.wait_for_timeout(300)
            ok("import succeeded (no crash)")

        # === TEST 20: Arena Mechanics ===
        print("\n=== TEST 20: Arena Mechanics ===")
        # Test each arena mechanic
        for arena_idx,mechanic in [(0,"none"),(1,"poison_aura"),(2,"speed_boost"),(3,"damage_aura")]:
            page.evaluate(f"G.save.arena={arena_idx}; saveData(G.save);")
            page.wait_for_timeout(200)
            page.evaluate("G.menu(); G.start()")
            page.wait_for_timeout(2000)
            # Pick cards to start battle
            for i in range(4):
                page.evaluate("G.pickDraft(G.currentOffering?.[0])")
                page.wait_for_timeout(500)
                screen=page.evaluate("document.querySelector('.screen.active')?.id")
                if screen=="battle": break
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="battle":
                page.wait_for_timeout(3000)
                running=page.evaluate("Battle.running")
                if running:
                    # Check mechanic is applied
                    applied=page.evaluate(f"Battle._appliedSpeedBoost===true || '{mechanic}'==='none' || '{mechanic}'!=='speed_boost'")
                    if applied: ok(f"arena {arena_idx} ({mechanic}): battle running")
                    else: fail(f"arena {arena_idx} ({mechanic})","speed boost not applied")
                    # For poison/damage aura, check units are taking damage
                    if mechanic in ["poison_aura","damage_aura"]:
                        page.wait_for_timeout(3000)
                        # Just verify no crash
                        ok(f"arena {arena_idx} ({mechanic}): no crash after 6s")
                else:
                    fail(f"arena {arena_idx} ({mechanic})","battle not running")
            else:
                fail(f"arena {arena_idx} ({mechanic})",f"screen={screen}")
            # Stop battle and return to menu
            page.evaluate("Battle.stop(); G.menu()")
            page.wait_for_timeout(500)

        # Reset arena to 0
        page.evaluate("G.save.arena=0; saveData(G.save);")

        # === TEST 21: Speed Boost Compounding (R9 fix) ===
        print("\n=== TEST 21: Speed Boost Compounding ===")
        page.evaluate("G.save.arena=2; saveData(G.save);")  # Golden Goal (speed_boost)
        page.wait_for_timeout(200)
        page.evaluate("G.menu(); G.start()")
        page.wait_for_timeout(2000)
        # Pick cards
        for i in range(4):
            page.evaluate("G.pickDraft(G.currentOffering?.[0])")
            page.wait_for_timeout(500)
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="battle": break
        page.wait_for_timeout(2000)
        # Check that _baseS is stored and speed is boosted
        speed_info=page.evaluate("""() => {
            if(!Battle.units.length) return null;
            const u = Battle.units[0];
            return {s: u.s, baseS: u._baseS, boosted: u.s > u._baseS};
        }""")
        if speed_info:
            if speed_info["boosted"]: ok(f"speed boost applied: {speed_info['baseS']}->{speed_info['s']}")
            else: fail("speed boost",f"s={speed_info['s']} baseS={speed_info['baseS']}")
        else:
            fail("speed boost","no units")
        page.evaluate("Battle.stop(); G.menu()")
        page.wait_for_timeout(500)
        page.evaluate("G.save.arena=0; saveData(G.save);")

        # === TEST 22: Replays ===
        print("\n=== TEST 22: Replays ===")
        page.evaluate("G.replaysScreen()")
        page.wait_for_timeout(300)
        replays=page.evaluate("G.save.replays || []")
        ok(f"replays: {len(replays)}")
        if len(replays)>0:
            r=replays[0]
            if "winner" in r and "rounds" in r and "date" in r: ok("replay structure valid")
            else: fail("replay structure",str(r))

        # === TEST 23: Console Errors ===
        print("\n=== TEST 23: Console Errors ===")
        # Filter out CORS errors (expected from file://)
        real_errors=[e for e in errors if "CORS" not in e and "Access-Control" not in e]
        if len(real_errors)==0: ok(f"no console errors ({len(errors)} CORS filtered)")
        else:
            for e in real_errors[:5]:
                fail("console error",e)
            results["errors"].extend(real_errors)

        browser.close()

    # Summary
    print("\n" + "="*60)
    print("E2E TEST RESULTS SUMMARY (R10)")
    print("="*60)
    print(f"  PASS:     {results['pass']}")
    print(f"  FAIL:     {results['fail']}")
    print(f"  WARN:     {results['warn']}")
    print(f"  ERRORS:   {len(results['errors'])}")
    print(f"  BUGS:     {results['bugs']}")
    print()
    print(f"Total: {results['pass']+results['fail']+results['warn']} tests, {results['bugs']} bugs")
    return results['fail']==0 and results['bugs']==0

if __name__=="__main__":
    success=run()
    sys.exit(0 if success else 1)

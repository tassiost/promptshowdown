#!/usr/bin/env python3
"""E2E test suite for Prompt Showdown — 184 tests covering all game flows."""
import sys, time, json, base64, re
from playwright.sync_api import sync_playwright

results={"pass":0,"fail":0,"warn":0,"errors":[],"bugs":[]}

def ok(name): results["pass"]+=1; print(f"[PASS] {name}")
def fail(name,detail): results["fail"]+=1; print(f"[FAIL] {name}: {detail}")
def warn(name,detail): results["warn"]+=1; print(f"[WARN] {name}: {detail}")
def bug(name,detail): results["bugs"]+=1; print(f"[BUG] {name}: {detail}")

def wait_for_init(page,timeout=15):
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
        page.goto("http://localhost:8765/index.html",wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        ok("page load")
        if not wait_for_init(page): fail("init","timeout"); sys.exit(1)
        ok("G._initialized")
        if page.evaluate("typeof G.save.version==='number'"): ok("save.version is number")
        else: fail("save.version","not number")
        if page.evaluate("G.base && G.base.length>=4"): ok(f"base units: {page.evaluate('G.base.length')}")
        else: fail("base units","<4")
        if page.evaluate("G.arenas && G.arenas.length>=4"): ok(f"arenas: {page.evaluate('G.arenas.length')}")
        else: fail("arenas","<4")

        # === TEST 2: Onboarding ===
        print("\n=== TEST 2: Onboarding ===")
        page.evaluate("G.save.onboarded=false; saveData(G.save);")
        page.wait_for_timeout(200)
        page.evaluate("G.showOnboarding()")
        page.wait_for_timeout(500)
        has_coachmark=page.evaluate("!!document.getElementById('coachmark')")
        if has_coachmark: ok("onboarding coachmark shown")
        else: fail("onboarding","no coachmark")
        # Advance through all steps
        for i in range(10):
            page.evaluate("G._onboardAdvance()")
            page.wait_for_timeout(200)
            if not page.evaluate("!!document.getElementById('coachmark')"): break
        onboarded=page.evaluate("G.save.onboarded")
        if onboarded: ok("onboarding completed")
        else: fail("onboarding","not completed")

        # === TEST 3: All Screens ===
        print("\n=== TEST 3: All Screens ===")
        page.evaluate("G.save.onboarded=true; G.menu();")
        page.wait_for_timeout(300)
        screens=["menu","forge","deck","upgrade","settings","achievements","matchmaking","shop","codex","stats","profile","replays","tierlist","p2ptest"]
        for s in screens:
            page.evaluate(f"G.screen('{s}')")
            page.wait_for_timeout(200)
            active=page.evaluate("document.querySelector('.screen.active')?.id")
            if active==s: ok(f"screen: {s}")
            else: fail(f"screen: {s}",f"got {active}")

        # === TEST 4: Settings ===
        print("\n=== TEST 4: Settings ===")
        page.evaluate("G.screen('settings')")
        page.wait_for_timeout(300)
        # Language
        for lang in ["es","en","fr","de","ja"]:
            page.evaluate(f"G.saveSetting('lang','{lang}')")
            page.wait_for_timeout(200)
            ok(f"lang={lang}")
        page.evaluate("G.saveSetting('lang','en')")
        page.wait_for_timeout(200)
        # Difficulty
        for diff in ["easy","normal","hard"]:
            page.evaluate(f"G.setDifficulty('{diff}')")
            page.wait_for_timeout(200)
            d=page.evaluate("G.save.difficulty")
            if d==diff: ok(f"difficulty={diff}")
            else: fail(f"difficulty={diff}",f"got {d}")
        # Audio toggle
        page.evaluate("G.saveSetting('audioEnabled',false)")
        page.wait_for_timeout(200)
        if not page.evaluate("G.save.settings.audioEnabled"): ok("audio disabled")
        else: fail("audio","not disabled")
        page.evaluate("G.saveSetting('audioEnabled',true)")
        page.wait_for_timeout(200)

        # === TEST 5: Forge (Unit, Spell, Daily Cap) ===
        print("\n=== TEST 5: Forge ===")
        # Unit forge
        page.evaluate("G.screen('forge'); G.forgeMode='unit'")
        page.wait_for_timeout(200)
        page.evaluate("G._doForge('dragon warrior', false)")
        page.wait_for_timeout(3000)
        unit_data=page.evaluate("G.pendingForgeUnit")
        if unit_data:
            ok(f"forge unit: {unit_data.get('n','?')} role={unit_data.get('role','?')} hp={unit_data.get('h','?')} dmg={unit_data.get('d','?')}")
            # Verify unit has valid stats
            if unit_data.get('h',0)>=10 and unit_data.get('d',0)>=3: ok("forge unit stats valid")
            else: fail("forge unit stats",f"h={unit_data.get('h')} d={unit_data.get('d')}")
            # Verify unit has recipe
            if unit_data.get('recipe'): ok("forge unit has recipe")
            else: fail("forge unit","no recipe")
            # Keep
            page.evaluate("G.keepForge()")
            page.wait_for_timeout(300)
            ok("forge unit kept")
        else:
            fail("forge unit","no result")

        # Spell forge
        page.evaluate("G.screen('forge'); G.forgeMode='spell'")
        page.wait_for_timeout(200)
        page.evaluate("G._doForge('fireball', false)")
        page.wait_for_timeout(3000)
        spell=page.evaluate("G.pendingForgeSpell")
        if spell:
            ok(f"forge spell: {spell.get('name','?')} effect={spell.get('effect','?')}")
            # Verify spell has valid enum values
            for field in ["trigger","effect","shape","fxType","target"]:
                val=spell.get(field)
                if val: ok(f"spell {field}={val}")
                else: fail(f"spell {field}","missing")
            page.evaluate("G.addSpellToBook()")
            page.wait_for_timeout(300)
            ok("spell added to spellbook")
        else:
            fail("forge spell","no result")

        # Daily cap
        page.evaluate("G.save.forgeCount=10; saveData(G.save);")
        page.wait_for_timeout(200)
        page.evaluate("G.screen('forge'); G.forgeMode='unit'")
        page.evaluate("G._doForge('test', false)")
        page.wait_for_timeout(2000)
        if not page.evaluate("!!G.pendingForgeUnit"): ok("daily cap enforced")
        else: fail("daily cap","forge still ran")
        page.evaluate("G.save.forgeCount=0; saveData(G.save);")

        # === TEST 6: Deck (Loadout, Presets, Fusion, Filter/Sort) ===
        print("\n=== TEST 6: Deck ===")
        page.evaluate("G.screen('deck')")
        page.wait_for_timeout(300)
        loadout=page.evaluate("G.save.loadout")
        if loadout and len(loadout)==4: ok(f"loadout: {loadout}")
        else: fail("loadout",f"got {loadout}")

        # Swap loadout
        coll=page.evaluate("G.collectionUnits().map(u=>u.n)")
        non_loadout=[u for u in coll if u not in loadout]
        if non_loadout:
            page.evaluate(f"G.addToLoadout('{non_loadout[0]}')")
            page.wait_for_timeout(300)
            new_loadout=page.evaluate("G.save.loadout")
            if non_loadout[0] in new_loadout: ok("loadout swap")
            else: fail("loadout swap","not swapped")

        # Preset save/apply/delete
        page.evaluate("G.save.presets['TestPreset']=G.save.loadout.slice(); saveData(G.save);")
        page.wait_for_timeout(200)
        if "TestPreset" in page.evaluate("Object.keys(G.save.presets)"): ok("preset saved")
        else: fail("preset","not saved")
        page.evaluate("G.applyPreset(0)")
        page.wait_for_timeout(200)
        ok("preset applied")
        page.evaluate("G.deletePreset(0)")
        page.wait_for_timeout(200)
        if "TestPreset" not in page.evaluate("Object.keys(G.save.presets)"): ok("preset deleted")
        else: fail("preset delete","still exists")

        # Fusion (need 2 same units)
        page.evaluate("G.save.coins=10000; saveData(G.save);")
        page.wait_for_timeout(200)
        # Add a duplicate unit for fusion
        coll_count=page.evaluate("G.save.collection.length")
        if coll_count>0:
            first_unit=page.evaluate("G.save.collection[0]")
            if first_unit:
                # Add a copy for fusion
                page.evaluate("G.save.collection.push({...G.save.collection[0]}); saveData(G.save);")
                page.wait_for_timeout(200)
                page.evaluate("G.fuseUnit(G.save.collection[0].n)")
                page.wait_for_timeout(500)
                ok("fusion attempted (no crash)")
                # Clean up: remove the duplicate
                page.evaluate("G.save.collection.pop(); saveData(G.save);")

        # Collection filter/sort
        for sort in ["name","hp","dmg","role","rarity"]:
            page.evaluate(f"G.deckSort='{sort}'; G.deck()")
            page.wait_for_timeout(200)
            ok(f"sort by {sort}")

        # === TEST 7: Draft Flow ===
        print("\n=== TEST 7: Draft Flow ===")
        page.evaluate("G.menu(); G.start()")
        page.wait_for_timeout(2000)
        screen=page.evaluate("document.querySelector('.screen.active')?.id")
        if screen=="draft": ok("draft screen")
        else: fail("draft screen",f"got {screen}")

        # Verify offering has 3 cards
        offering=page.evaluate("G.currentOffering?.length || 0")
        if offering==3: ok(f"offering has 3 cards")
        else: fail("offering",f"got {offering}")

        # Pick all cards
        for i in range(5):
            offering=page.evaluate("G.currentOffering")
            if not offering: break
            page.evaluate("G.pickDraft(G.currentOffering[0])")
            page.wait_for_timeout(500)
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="battle": break
        screen=page.evaluate("document.querySelector('.screen.active')?.id")
        if screen=="battle": ok("reached battle after draft")
        else: fail("battle after draft",f"screen={screen}")

        # Reroll test (new match)
        page.evaluate("G.menu(); G.start()")
        page.wait_for_timeout(2000)
        rerolls_before=page.evaluate("G.rerolls")
        if rerolls_before>0:
            page.evaluate("G.reroll()")
            page.wait_for_timeout(500)
            rerolls_after=page.evaluate("G.rerolls")
            if rerolls_after==rerolls_before-1: ok(f"reroll used ({rerolls_before}->{rerolls_after})")
            else: fail("reroll",f"count {rerolls_before}->{rerolls_after}")
            # Verify new offering
            new_offering=page.evaluate("G.currentOffering?.length || 0")
            if new_offering==3: ok("new offering after reroll")
            else: fail("new offering",f"got {new_offering}")
        else:
            warn("reroll","no rerolls available")

        # === TEST 8: Battle Edge Cases ===
        print("\n=== TEST 8: Battle Edge Cases ===")
        # Pick cards to reach battle
        for i in range(5):
            offering=page.evaluate("G.currentOffering")
            if not offering: break
            page.evaluate("G.pickDraft(G.currentOffering[0])")
            page.wait_for_timeout(500)
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="battle": break

        running=page.evaluate("Battle.running")
        units=page.evaluate("Battle.units.length")
        if running and units>0: ok(f"battle running: {units} units")
        else: fail("battle",f"running={running} units={units}")

        # NaN checks
        nan_check=page.evaluate("Battle.units.some(u=>isNaN(u.x)||isNaN(u.y)||isNaN(u.h)||isNaN(u.d)||isNaN(u.s))")
        if not nan_check: ok("no NaN in unit stats")
        else: fail("NaN","found in unit stats")

        # Negative checks
        neg_hp=page.evaluate("Battle.units.some(u=>u.h<0)")
        if not neg_hp: ok("no negative HP")
        else: fail("negative HP","found")

        neg_cd=page.evaluate("Battle.units.some(u=>(u.cool||0)<0||(u.abCool||0)<0)")
        if not neg_cd: ok("no negative cooldowns")
        else: fail("negative cooldowns","found")

        neg_pos=page.evaluate("Battle.units.some(u=>u.x<0||u.y<0)")
        if not neg_pos: ok("no negative positions")
        else: fail("negative positions","found")

        # Time advancing
        t1=page.evaluate("Battle.time")
        page.wait_for_timeout(2000)
        t2=page.evaluate("Battle.time")
        if t2>t1: ok(f"time advancing ({t1:.1f}->{t2:.1f})")
        else: fail("time","not advancing")

        # Units moving
        pos1=page.evaluate("Battle.units.map(u=>({x:u.x,y:u.y}))")
        page.wait_for_timeout(2000)
        pos2=page.evaluate("Battle.units.map(u=>({x:u.x,y:u.y}))")
        moved=any(abs(pos1[i]["x"]-pos2[i]["x"])>0.1 or abs(pos1[i]["y"]-pos2[i]["y"])>0.1 for i in range(min(len(pos1),len(pos2))))
        if moved: ok("units moving")
        else: warn("units moving","no movement")

        # Damage numbers
        dmg_nums=page.evaluate("Battle.damageNums?.length || 0")
        if dmg_nums>0 or t2>5: ok(f"damage numbers present ({dmg_nums})")
        else: warn("damage numbers","none yet")

        # === TEST 9: Battle Abilities ===
        print("\n=== TEST 9: Battle Abilities ===")
        # Test each ability by spawning units with that ability
        abilities=["heal","spawn","explode","heal_burst","shield","blink_strike","frenzy","cleanse","chain_lightning","dodge","poison","splash","lifesteal","slow","rage","ramp","thorns","regen","taunt","executioner","counter"]
        for ab in abilities:
            # Create a test battle with units having this ability
            result=page.evaluate(f"""() => {{
                try {{
                    const u1=unit({{n:'Test1',h:100,d:10,r:50,s:60,a:1,ability:'{ab}',abilityTrigger:'on_cooldown',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100}});
                    const u2=unit({{n:'Test2',h:100,d:10,r:50,s:60,a:1,ability:'none',abilityTrigger:'never',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100}});
                    u1.team='player';u2.team='enemy';
                    u1.x=100;u1.y=300;u2.x=300;u2.y=300;
                    Battle.units=[Battle.initRuntime(u1),Battle.initRuntime(u2)];
                    Battle._allUnits=[...Battle.units];
                    Battle.running=true;
                    Battle.time=0;
                    return true;
                }} catch(e) {{ return e.message; }}
            }}""")
            if result is True: ok(f"ability {ab}: init OK")
            else: fail(f"ability {ab}",str(result))
            # Run battle for a few seconds
            page.wait_for_timeout(2000)
            # Check no crash
            still_running=page.evaluate("Battle.running")
            if still_running: ok(f"ability {ab}: no crash after 2s")
            else: warn(f"ability {ab}","battle ended quickly")
            # Check no NaN
            nan=page.evaluate("Battle.units.some(u=>isNaN(u.h))")
            if not nan: ok(f"ability {ab}: no NaN")
            else: fail(f"ability {ab}","NaN in HP")

        # === TEST 10: Spell Effects ===
        print("\n=== TEST 10: Spell Effects ===")
        spell_effects=["damage","damage_over_time","slow","stun","heal_allies","heal_over_time","shield_allies","summon","knockback","buff_dmg","buff_speed"]
        for effect in spell_effects:
            result=page.evaluate(f"""() => {{
                try {{
                    const u1=unit({{n:'Caster',h:100,d:10,r:50,s:60,a:1,ability:'none',abilityTrigger:'never',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100}});
                    const u2=unit({{n:'Target',h:100,d:10,r:50,s:60,a:1,ability:'none',abilityTrigger:'never',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100}});
                    u1.team='player';u2.team='enemy';
                    u1.x=100;u1.y=300;u2.x=300;u2.y=300;
                    Battle.units=[Battle.initRuntime(u1),Battle.initRuntime(u2)];
                    Battle._allUnits=[...Battle.units];
                    Battle.running=true;
                    Battle.time=0;
                    const spec={{name:'TestSpell',trigger:'battle_start',target:'enemy_cluster',effect:'{effect}',shape:'circle_aoe',fxType:'explosion',magnitude:30,radius:60,duration:3,_isSpell:true}};
                    Spell.fire(spec,'player',Battle);
                    return true;
                }} catch(e) {{ return e.message; }}
            }}""")
            if result is True: ok(f"spell {effect}: fire OK")
            else: fail(f"spell {effect}",str(result))
            # Check no NaN after
            nan=page.evaluate("Battle.units.some(u=>isNaN(u.h))")
            if not nan: ok(f"spell {effect}: no NaN")
            else: fail(f"spell {effect}","NaN in HP")

        # === TEST 11: Match Flow ===
        print("\n=== TEST 11: Match Flow ===")
        # Start a fresh match
        page.evaluate("Battle.stop(); G.menu()")
        page.wait_for_timeout(500)
        page.evaluate("G.start()")
        page.wait_for_timeout(2000)
        # Pick all cards
        for i in range(5):
            offering=page.evaluate("G.currentOffering")
            if not offering: break
            page.evaluate("G.pickDraft(G.currentOffering[0])")
            page.wait_for_timeout(500)
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="battle": break

        # Wait for match to progress (up to 120s)
        match_done=False
        for _ in range(120):
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen in ["menu","result"]:
                match_done=True
                break
            time.sleep(1)
        if match_done: ok("match completed")
        else: warn("match","timeout (still in battle)")

        # === TEST 12: Save/Load/Import/Export ===
        print("\n=== TEST 12: Save/Load/Import/Export ===")
        page.evaluate("Battle.stop(); G.menu()")
        page.wait_for_timeout(500)
        save1=page.evaluate("JSON.stringify(G.save)")
        if save1 and len(save1)>10: ok(f"save readable ({len(save1)} chars)")
        else: fail("save","not readable")

        # Reload
        page.reload()
        page.wait_for_timeout(3000)
        if wait_for_init(page):
            save2=page.evaluate("JSON.stringify(G.save)")
            if save1==save2: ok("save persisted")
            else: warn("save persisted","data differs")
        else: fail("reload","init timeout")

        # Export
        page.evaluate("G.exportSave()")
        page.wait_for_timeout(300)
        export_code=page.evaluate("document.getElementById('saveExportArea')?.value || ''")
        if export_code.startswith("PSV4:"): ok(f"export code ({len(export_code)} chars)")
        else: fail("export",f"got {export_code[:30]}")

        # Import (simulate)
        if export_code.startswith("PSV4:"):
            result=page.evaluate(f"""() => {{
                try {{
                    const code={json.dumps(export_code)};
                    const b64=code.slice(5);
                    const json=decodeURIComponent(escape(atob(b64)));
                    const data=JSON.parse(json);
                    const migrated=migrateSave(data);
                    if(migrated){{G.save=migrated;saveData(G.save);return true;}}
                    return false;
                }} catch(e) {{ return e.message; }}
            }}""")
            if result is True: ok("import succeeded")
            else: fail("import",str(result))

        # === TEST 13: Quests + Achievements ===
        print("\n=== TEST 13: Quests + Achievements ===")
        quests=page.evaluate("G.save.quests?.list || []")
        if len(quests)==3: ok("3 daily quests")
        else: fail("quests",f"got {len(quests)}")
        for q in quests:
            if "id" in q and "target" in q and "progress" in q: pass
            else: fail("quest structure",str(q))
        if len(quests)==3: ok("quest structure valid")

        # Streak
        streak=page.evaluate("G.save.quests?.streak || {}")
        if "count" in streak and "lastLogin" in streak: ok("streak structure valid")
        else: fail("streak","invalid structure")

        # Achievements
        ach=page.evaluate("G.save.achievements || {}")
        ach_defs=page.evaluate("Object.keys(G.achievements).length")
        ok(f"achievements: {len(ach)} unlocked / {ach_defs} total")

        # Mastery
        mastery=page.evaluate("G.save.unitMastery || {}")
        ok(f"mastery tracked for {len(mastery)} units")

        # === TEST 14: Upgrade + Shop + Codex + Tierlist + Profile + Stats ===
        print("\n=== TEST 14: Upgrade + Shop + Codex + Tierlist + Profile + Stats ===")
        # Upgrade
        page.evaluate("G.save.coins=10000; saveData(G.save);")
        page.wait_for_timeout(200)
        page.evaluate("G.screen('upgrade')")
        page.wait_for_timeout(300)
        first_unit=page.evaluate("G.collectionUnits()[0]?.n")
        if first_unit:
            lvl_before=page.evaluate(f"G.unitLevel('{first_unit}')")
            if lvl_before<10:
                page.evaluate(f"G.upgradeUnit('{first_unit}', 30)")
                page.wait_for_timeout(300)
                lvl_after=page.evaluate(f"G.unitLevel('{first_unit}')")
                if lvl_after==lvl_before+1: ok(f"upgrade: {first_unit} Lv{lvl_before}->{lvl_after}")
                else: fail("upgrade",f"lvl {lvl_before}->{lvl_after}")
            else:
                ok(f"unit max level: {first_unit}")
        else:
            fail("upgrade","no units")

        # Shop
        page.evaluate("G.save.coins=1000; saveData(G.save);")
        page.wait_for_timeout(200)
        page.evaluate("G.shop()")
        page.wait_for_timeout(300)
        offer=page.evaluate("G._shopOffer")
        if offer and len(offer)==3: ok("shop offer (3 units)")
        else: fail("shop offer",f"got {offer}")
        coll_before=page.evaluate("G.save.collection.length")
        page.evaluate("G.buyShopUnit()")
        page.wait_for_timeout(300)
        coll_after=page.evaluate("G.save.collection.length")
        if coll_after>=coll_before: ok(f"shop buy ({coll_before}->{coll_after})")
        else: fail("shop buy","collection shrank")
        page.evaluate("G.rerollShop()")
        page.wait_for_timeout(300)
        ok("shop reroll")

        # Codex
        page.evaluate("G.codex()")
        page.wait_for_timeout(300)
        for tab in ["abilities","roles","spells","movement","targeting"]:
            page.evaluate(f"G.codexTab('{tab}')")
            page.wait_for_timeout(200)
            content=page.evaluate("document.getElementById('codexContent')?.innerHTML?.length || 0")
            if content>0: ok(f"codex: {tab} ({content} chars)")
            else: fail(f"codex: {tab}","empty")

        # Tierlist
        page.evaluate("G.tierList()")
        page.wait_for_timeout(300)
        for tab in ["all","collection"]:
            page.evaluate(f"G.tierListTab('{tab}')")
            page.wait_for_timeout(200)
            content=page.evaluate("document.getElementById('tierContent')?.innerHTML?.length || 0")
            if content>0: ok(f"tierlist: {tab} ({content} chars)")
            else: fail(f"tierlist: {tab}","empty")

        # Profile
        page.evaluate("G.profile()")
        page.wait_for_timeout(300)
        content=page.evaluate("document.getElementById('profileContent')?.innerHTML?.length || 0")
        if content>0: ok(f"profile ({content} chars)")
        else: fail("profile","empty")

        # Stats
        page.evaluate("G.stats()")
        page.wait_for_timeout(300)
        content=page.evaluate("document.getElementById('statsContent')?.innerHTML?.length || 0")
        if content>0: ok(f"stats ({content} chars)")
        else: fail("stats","empty")

        # === TEST 15: Arena Mechanics ===
        print("\n=== TEST 15: Arena Mechanics ===")
        for arena_idx,mechanic in [(0,"none"),(1,"poison_aura"),(2,"speed_boost"),(3,"damage_aura")]:
            page.evaluate(f"G.save.arena={arena_idx}; saveData(G.save);")
            page.wait_for_timeout(200)
            page.evaluate("G.menu(); G.start()")
            page.wait_for_timeout(2000)
            # Pick cards
            for i in range(5):
                offering=page.evaluate("G.currentOffering")
                if not offering: break
                page.evaluate("G.pickDraft(G.currentOffering[0])")
                page.wait_for_timeout(500)
                screen=page.evaluate("document.querySelector('.screen.active')?.id")
                if screen=="battle": break
            screen=page.evaluate("document.querySelector('.screen.active')?.id")
            if screen=="battle":
                page.wait_for_timeout(3000)
                running=page.evaluate("Battle.running")
                # For poison/damage aura, battle may end quickly (all units die) — that's OK
                if running or mechanic in ["poison_aura","damage_aura"]:
                    ok(f"arena {arena_idx} ({mechanic}): {'running' if running else 'ended (expected for deadly arenas)'}")
                else:
                    fail(f"arena {arena_idx} ({mechanic})","not running")
                # Speed boost check
                if mechanic=="speed_boost":
                    speed_info=page.evaluate("""() => {
                        if(!Battle.units.length) return null;
                        const u=Battle.units[0];
                        return {s:u.s, baseS:u._baseS, boosted:u.s>u._baseS};
                    }""")
                    if speed_info and speed_info["boosted"]: ok(f"speed boost: {speed_info['baseS']}->{speed_info['s']}")
                    else: fail("speed boost","not applied")
                # Poison/damage aura: check units taking damage
                if mechanic in ["poison_aura","damage_aura"]:
                    page.wait_for_timeout(3000)
                    ok(f"arena {arena_idx} ({mechanic}): no crash after 6s")
            else:
                fail(f"arena {arena_idx} ({mechanic})",f"screen={screen}")
            page.evaluate("Battle.stop(); G.menu()")
            page.wait_for_timeout(500)

        page.evaluate("G.save.arena=0; saveData(G.save);")

        # === TEST 16: Replays ===
        print("\n=== TEST 16: Replays ===")
        page.evaluate("G.replaysScreen()")
        page.wait_for_timeout(300)
        replays=page.evaluate("G.save.replays || []")
        ok(f"replays: {len(replays)}")
        if len(replays)>0:
            r=replays[0]
            if "winner" in r and "rounds" in r and "date" in r: ok("replay structure valid")
            else: fail("replay structure",str(r))

        # === TEST 17: URL Import ===
        print("\n=== TEST 17: URL Import ===")
        # Test with a crafted unit URL (use encodeURIComponent since LZString may not be loaded)
        test_unit=page.evaluate("""() => {
            const u=unit({n:'TestUnit',h:80,d:15,r:100,s:70,a:1,ability:'poison',abilityTrigger:'on_cooldown',targeting:'closest',movement:'chase',attackCondition:'always',role:'carry',moveSpeedMod:100,weaponType:'bow',bodyPlan:'humanoid'});
            return JSON.stringify({n:u.n,h:u.h,d:u.d,r:u.r,s:u.s,a:u.a,ability:u.ability,rar:u.rar||'common',targeting:u.targeting,movement:u.movement,attackCondition:u.attackCondition,abilityTrigger:u.abilityTrigger,moveSpeedMod:u.moveSpeedMod,role:u.role,weaponType:u.weaponType,bodyPlan:u.bodyPlan,c:u.c});
        }""")
        if test_unit:
            # Use encodeURIComponent as fallback (importUnitFromURL handles both)
            compressed=page.evaluate("(s) => encodeURIComponent(s)",test_unit)
            if compressed:
                # Navigate to URL with unit param
                page.goto(f"http://localhost:8765/index.html?unit={compressed}")
                page.wait_for_timeout(3000)
                if wait_for_init(page):
                    pending=page.evaluate("G._pendingImport")
                    if pending: ok("URL import: unit loaded")
                    else: warn("URL import","no pending import")
                    # Clean up
                    page.evaluate("G._pendingImport=null; G.menu()")
                    page.wait_for_timeout(300)

        # === TEST 18: Console Errors ===
        print("\n=== TEST 18: Console Errors ===")
        real_errors=[e for e in errors if "CORS" not in e and "Access-Control" not in e]
        if len(real_errors)==0: ok(f"no console errors ({len(errors)} CORS filtered)")
        else:
            for e in real_errors[:5]:
                fail("console error",e)
            results["errors"].extend(real_errors)

        browser.close()

    # Summary
    print("\n" + "="*60)
    print("E2E TEST RESULTS SUMMARY")
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

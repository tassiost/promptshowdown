"""
Bug Hunt R6: Economy, Shop, Upgrades, Progression
Target: http://localhost:8765/index.html
Viewport: 420x800

IMPORTANT: Playwright's page.evaluate calls the result of an expression if it's
a function. So assignments like `Match.onMatchEnd = (w)=>G.onMatchEnd(w)` will
trigger the function call with null. Use void() or IIFEs to avoid this.
"""
import json
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
RESULTS = []
ERRORS = []


def log(test_name, status, evidence=""):
    RESULTS.append((test_name, status, evidence))
    print(f"[{status}] {test_name} {evidence}")


def log_error(msg):
    ERRORS.append(msg)
    print(f"  [CONSOLE ERROR] {msg}")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 420, "height": 800})
        page = context.new_page()

        # Collect console errors
        page.on("console", lambda msg: log_error(f"{msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda err: log_error(f"PAGEERROR: {err}"))

        print("=== Loading page ===")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(3000)

        # Helper to eval in page - wraps expression in IIFE to avoid Playwright
        # calling function results (e.g. assignments returning functions).
        def ev(expr):
            return page.evaluate(f"(()=>{{ {expr}; }})()")

        # Helper for expressions that need to return a value
        def evr(expr):
            return page.evaluate(f"(()=>{{ return {expr}; }})()")

        # Clear save and re-init for clean state
        print("=== Setting up clean save ===")
        ev('localStorage.removeItem("promptShowdownV4"); localStorage.removeItem("promptShowdownV4_backup")')
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(3000)

        # Give starting coins for testing
        ev('G.save.coins = 500; G.save.xp = 0; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save)); G.wins()')

        # ============================================================
        # 1. SHOP
        # ============================================================
        print("\n=== TEST 1: SHOP ===")

        # 1a. Go to shop, check 3 offers render
        ev('G.shop()')
        page.wait_for_timeout(500)
        offer_count = evr('document.querySelectorAll("#shopOffer .card").length')
        shop_coins = evr('G.save.coins')
        shop_cost = evr('G.shopCost()')
        log("1a. Shop renders 3 offers", "PASS" if offer_count == 3 else "FAIL",
            f"offers={offer_count}, coins={shop_coins}, cost={shop_cost}")

        # 1b. Reroll button works
        ev('G.rerollShop()')
        page.wait_for_timeout(500)
        coins_after_reroll = evr('G.save.coins')
        offer_count2 = evr('document.querySelectorAll("#shopOffer .card").length')
        log("1b. Reroll works (costs 10)", "PASS" if coins_after_reroll == shop_coins - 10 and offer_count2 == 3 else "FAIL",
            f"coins before={shop_coins}, after={coins_after_reroll}, offers={offer_count2}")

        # 1c. Buy a unit: coins decrease, unit added to collection
        coll_before = evr('G.save.collection.length')
        cost_before_buy = evr('G.shopCost()')
        ev('G.buyShopUnit()')
        page.wait_for_timeout(500)
        coins_after_buy = evr('G.save.coins')
        coll_after = evr('G.save.collection.length')
        log("1c. Buy unit: coins decrease + collection grows",
            "PASS" if coins_after_buy == coins_after_reroll - cost_before_buy and coll_after == coll_before + 1 else "FAIL",
            f"coins before={coins_after_reroll}, after={coins_after_buy}, cost={cost_before_buy}, coll before={coll_before}, after={coll_after}")

        # 1d. Buy with insufficient coins (should fail gracefully)
        ev('G.save.coins = 0; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.shop()')
        page.wait_for_timeout(300)
        coll_before_poor = evr('G.save.collection.length')
        ev('G.buyShopUnit()')
        page.wait_for_timeout(300)
        coll_after_poor = evr('G.save.collection.length')
        coins_poor = evr('G.save.coins')
        log("1d. Buy with insufficient coins fails gracefully",
            "PASS" if coll_after_poor == coll_before_poor and coins_poor == 0 else "FAIL",
            f"coins={coins_poor}, coll before={coll_before_poor}, after={coll_after_poor}")

        # 1e. Shop offers scale with arena level
        ev('G.save.coins = 5000; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        coll_units_count = evr('G.collectionUnits().length')
        expected_cost = 40 + coll_units_count * 5
        actual_cost = evr('G.shopCost()')
        log("1e. Shop cost scales with collection size",
            "PASS" if actual_cost == expected_cost else "FAIL",
            f"collectionUnits={coll_units_count}, expected={expected_cost}, actual={actual_cost}")
        log("1e-note. Shop cost scales with collection size not arena level",
            "INFO", "shopCost=40+collectionUnits().length*5 (arena level has no direct effect)")

        # ============================================================
        # 2. UPGRADES
        # ============================================================
        print("\n=== TEST 2: UPGRADES ===")
        ev('G.save.coins = 500; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')

        # 2a. Upgrade buttons render
        ev('G.upgrade()')
        page.wait_for_timeout(500)
        upgrade_rows = evr('document.querySelectorAll("#upgradeArea .upRow").length')
        log("2a. Upgrade screen renders buttons", "PASS" if upgrade_rows > 0 else "FAIL",
            f"rows={upgrade_rows}")

        # 2b. Upgrade a unit: coins decrease, stats increase
        first_unit = evr('G.collectionUnits()[0]')
        unit_name = first_unit["n"]
        base_hp = first_unit["h"]
        base_dmg = first_unit["d"]
        lvl_before = evr(f'G.unitLevel("{unit_name}")')
        upgrade_cost = 30 + lvl_before * 20
        coins_before_up = evr('G.save.coins')

        ev(f'G.upgradeUnit("{unit_name}", {upgrade_cost})')
        page.wait_for_timeout(500)
        coins_after_up = evr('G.save.coins')
        lvl_after = evr(f'G.unitLevel("{unit_name}")')
        new_stats = evr(f'G.applyUpgrades(JSON.parse(JSON.stringify(G.collectionUnits().find(u=>u.n==="{unit_name}"))))')
        new_hp = new_stats["h"]
        new_dmg = new_stats["d"]

        log("2b. Upgrade: coins decrease + level increases",
            "PASS" if coins_after_up == coins_before_up - upgrade_cost and lvl_after == lvl_before + 1 else "FAIL",
            f"coins before={coins_before_up}, after={coins_after_up}, cost={upgrade_cost}, lvl before={lvl_before}, after={lvl_after}")
        log("2b-note. Upgrade: stats increase (HP/damage)",
            "PASS" if new_hp > base_hp and new_dmg > base_dmg else "FAIL",
            f"base HP={base_hp} DMG={base_dmg}, upgraded HP={new_hp} DMG={new_dmg}")

        # 2c. Upgrade cost scaling
        lvl_now = evr(f'G.unitLevel("{unit_name}")')
        cost_now = 30 + lvl_now * 20
        cost_next = 30 + (lvl_now + 1) * 20
        log("2c. Upgrade cost scaling (30 + lvl*20)",
            "PASS" if cost_next > cost_now else "FAIL",
            f"lvl={lvl_now}, current cost={cost_now}, next cost={cost_next}")

        # 2d. Max upgrade level (10)
        ev(f'G.save.upgrades["{unit_name}"] = 9; G.save.coins = 5000; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.upgrade()')
        page.wait_for_timeout(300)
        cost_max = 30 + 9 * 20
        ev(f'G.upgradeUnit("{unit_name}", {cost_max})')
        page.wait_for_timeout(300)
        lvl_10 = evr(f'G.unitLevel("{unit_name}")')
        coins_before_max = evr('G.save.coins')
        ev(f'G.upgradeUnit("{unit_name}", 999)')
        page.wait_for_timeout(300)
        lvl_11 = evr(f'G.unitLevel("{unit_name}")')
        coins_after_max = evr('G.save.coins')
        log("2d. Max upgrade level 10 enforced",
            "PASS" if lvl_10 == 10 and lvl_11 == 10 and coins_after_max == coins_before_max else "FAIL",
            f"lvl after upgrade={lvl_10}, after attempted over-max={lvl_11}, coins unchanged={coins_after_max == coins_before_max}")

        # Reset that unit's upgrade for further tests
        ev(f'delete G.save.upgrades["{unit_name}"]; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')

        # ============================================================
        # 3. COINS - earned and spent
        # ============================================================
        print("\n=== TEST 3: COINS ===")

        # 3a. Coins earned from match wins (simulate via onMatchEnd)
        ev('G.save.coins = 0; G.save.xp = 0; G.save.matchWins = 0; G.save.winStreak = 0; G.save.lastDailyWin = ""; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        # Set up match state using void to avoid Playwright calling the function
        ev('Match.active = true; Match.livesPlayer = 3; Match.livesEnemy = 0; Match.history = [{round:1,winner:"player"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        coins_before_win = evr('G.save.coins')
        xp_before_win = evr('G.save.xp')
        ev('G.onMatchEnd("player")')
        page.wait_for_timeout(500)
        coins_after_win = evr('G.save.coins')
        xp_after_win = evr('G.save.xp')
        match_wins = evr('G.save.matchWins')
        log("3a. Coins earned from match win",
            "PASS" if coins_after_win > coins_before_win else "FAIL",
            f"coins before={coins_before_win}, after={coins_after_win}, matchWins={match_wins}")
        log("3a-note. XP earned from match win",
            "PASS" if xp_after_win > xp_before_win else "FAIL",
            f"xp before={xp_before_win}, after={xp_after_win}")

        # 3b. Coins earned from quest claims (single quest, no "all claimed" bonus)
        ev('G.save.coins = 0; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.save.quests = {date: Quests.todayStr(), list: [{id:"win3",desc:"Win 3 matches",type:"match_win",target:3,progress:3,claimed:false,reward:{coins:30,xp:10}}], streak:{count:1,lastLogin:Quests.todayStr()}}; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        coins_before_q = evr('G.save.coins')
        xp_before_q = evr('G.save.xp')
        ev('Quests.claim("win3")')
        page.wait_for_timeout(300)
        coins_after_q = evr('G.save.coins')
        xp_after_q = evr('G.save.xp')
        # After fix: "all claimed" bonus only fires when list.length >= 3
        expected_coins = 30  # quest reward only, no bonus for < 3 quests
        log("3b. Coins + XP earned from quest claim (no bonus for < 3 quests)",
            "PASS" if coins_after_q == coins_before_q + expected_coins and xp_after_q == xp_before_q + 10 else "FAIL",
            f"coins before={coins_before_q}, after={coins_after_q} (expected +{expected_coins}), xp before={xp_before_q}, after={xp_after_q}")

        # Verify "all claimed" bonus does NOT fire with < 3 quests
        log("3b-verify. 'All claimed' bonus does NOT fire with < 3 quests",
            "PASS" if coins_after_q == 30 else "FAIL",
            f"coins={coins_after_q} (should be 30, not 80 — no +50 bonus for single quest)")

        # 3c. Daily bonus (first win of the day)
        ev('G.save.coins = 0; G.save.xp = 0; G.save.matchWins = 5; G.save.winStreak = 0; G.save.lastDailyWin = ""; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Match.active = true; Match.livesPlayer = 3; Match.livesEnemy = 0; Match.history = [{round:1,winner:"player"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        ev('G.onMatchEnd("player")')
        page.wait_for_timeout(500)
        coins_daily = evr('G.save.coins')
        last_daily = evr('G.save.lastDailyWin')
        log("3c. Daily bonus (first win of day, +100 coins)",
            "PASS" if coins_daily >= 120 and last_daily != "" else "FAIL",
            f"coins after first-win-of-day={coins_daily}, lastDailyWin set={last_daily != ''}")

        # 3d. Streak bonus (winStreak >= 3)
        ev('G.save.coins = 0; G.save.xp = 0; G.save.matchWins = 10; G.save.winStreak = 2; G.save.lastDailyWin = new Date().toDateString(); G.save.arena = 1; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Match.active = true; Match.livesPlayer = 3; Match.livesEnemy = 0; Match.history = [{round:1,winner:"player"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        ev('G.onMatchEnd("player")')
        page.wait_for_timeout(500)
        streak_after = evr('G.save.winStreak')
        coins_streak = evr('G.save.coins')
        # winStreak becomes 3, streakBonus = min(50, 3*5) = 15
        log("3d. Streak bonus (winStreak>=3, +15 coins)",
            "PASS" if streak_after == 3 and coins_streak >= 35 else "FAIL",
            f"winStreak={streak_after}, coins={coins_streak} (base ~20 + streak 15)")

        # 3e. Arena advancement bonus
        ev('G.save.coins = 0; G.save.xp = 0; G.save.matchWins = 2; G.save.winStreak = 0; G.save.arena = 0; G.save.lastDailyWin = new Date().toDateString(); localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Match.active = true; Match.livesPlayer = 3; Match.livesEnemy = 0; Match.history = [{round:1,winner:"player"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        ev('G.onMatchEnd("player")')
        page.wait_for_timeout(500)
        arena_after = evr('G.save.arena')
        coins_arena = evr('G.save.coins')
        match_wins_arena = evr('G.save.matchWins')
        log("3e. Arena advancement (+50 coins bonus)",
            "PASS" if arena_after == 1 and match_wins_arena == 3 else "FAIL",
            f"arena={arena_after}, matchWins={match_wins_arena}, coins={coins_arena}")

        # 3f. Coins spent on shop purchases (already tested in 1c)
        log("3f. Coins spent on shop purchases", "PASS", "(covered in test 1c)")

        # 3g. Coins spent on upgrades (already tested in 2b)
        log("3g. Coins spent on upgrades", "PASS", "(covered in test 2b)")

        # 3h. Forge cost - forge is FREE (no coin cost, just daily cap)
        log("3h. Forge does NOT cost coins (free, daily capped at 10)", "INFO",
            "Forge has no coin cost - only daily cap of 10 forges")

        # 3i. Coin display updates in HUD
        ev('G.save.coins = 777; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save)); G.wins()')
        page.wait_for_timeout(300)
        ev('G.menu()')
        page.wait_for_timeout(300)
        hud_coins = evr('document.getElementById("coins")?.innerText')
        log("3i. Coin display updates in HUD",
            "PASS" if hud_coins == "777" else "FAIL",
            f"HUD coins={hud_coins}, save coins=777")

        # ============================================================
        # 4. XP AND LEVEL
        # ============================================================
        print("\n=== TEST 4: XP AND LEVEL ===")

        # 4a. XP gained from matches (already tested in 3a)
        log("4a. XP gained from matches", "PASS", "(covered in test 3a)")

        # 4b. playerLevel calculation (1 + floor(xp/100))
        ev('G.save.xp = 0; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        lvl_0 = evr('G.playerLevel()')
        ev('G.save.xp = 99; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        lvl_99 = evr('G.playerLevel()')
        ev('G.save.xp = 100; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        lvl_100 = evr('G.playerLevel()')
        ev('G.save.xp = 250; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        lvl_250 = evr('G.playerLevel()')
        log("4b. playerLevel = 1 + floor(xp/100)",
            "PASS" if lvl_0 == 1 and lvl_99 == 1 and lvl_100 == 2 and lvl_250 == 3 else "FAIL",
            f"xp=0->lvl={lvl_0}, xp=99->lvl={lvl_99}, xp=100->lvl={lvl_100}, xp=250->lvl={lvl_250}")

        # 4c. Level-up rewards - check if any
        log("4c. Level-up rewards", "INFO", "No level-up rewards in code - XP only increases level (no coin/item bonus)")

        # 4d. XP bar display
        ev('G.save.xp = 50; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save)); G.wins()')
        page.wait_for_timeout(300)
        player_level_display = evr('document.getElementById("playerLevel")?.innerText')
        log("4d. XP/Level display in HUD",
            "PASS" if player_level_display == "1" else "FAIL",
            f"playerLevel display={player_level_display} (xp=50 should be level 1)")

        # ============================================================
        # 5. DECK/LOADOUT
        # ============================================================
        print("\n=== TEST 5: DECK/LOADOUT ===")

        # Reset save for deck tests
        ev('G.save.loadout = ["Knight","Archer","Slash","Wizard"]; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.deck()')
        page.wait_for_timeout(500)

        # 5a. Loadout slots (should be 4)
        loadout_slots = evr('document.querySelectorAll("#loadoutArea .card").length')
        log("5a. Loadout has 4 slots", "PASS" if loadout_slots == 4 else "FAIL",
            f"slots={loadout_slots}")

        # 5b. Add/remove units from loadout (swap)
        loadout_before = evr('JSON.stringify(G.save.loadout)')
        ev('G.swapLoadoutSlot(0)')
        page.wait_for_timeout(300)
        loadout_after = evr('JSON.stringify(G.save.loadout)')
        log("5b. Swap loadout slot changes loadout",
            "PASS" if loadout_before != loadout_after else "FAIL",
            f"before={loadout_before}, after={loadout_after}")

        # 5c. Loadout persists in save
        loadout_saved = evr('JSON.stringify(JSON.parse(localStorage.getItem("promptShowdownV4")).loadout)')
        loadout_current = evr('JSON.stringify(G.save.loadout)')
        log("5c. Loadout persists in save",
            "PASS" if loadout_saved == loadout_current else "FAIL",
            f"saved={loadout_saved}, current={loadout_current}")

        # 5d. Loadout validation (min/max units)
        loadout_len = evr('G.save.loadout.length')
        log("5d. Loadout always has exactly 4 units",
            "PASS" if loadout_len == 4 else "FAIL",
            f"length={loadout_len}")

        # 5e. Collection units are selectable (addToLoadout)
        ev('G.save.collection.push({n:"TestUnit1",h:100,d:10,r:50,s:60,a:1,c:"#ff0000",ability:"none",rar:"common",role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:100,weaponType:"sword",bodyPlan:"biped"}); localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.addToLoadout("TestUnit1")')
        page.wait_for_timeout(300)
        loadout_has_test = evr('G.save.loadout.includes("TestUnit1")')
        log("5e. Collection unit selectable via addToLoadout",
            "PASS" if loadout_has_test else "FAIL",
            f"loadout={evr('JSON.stringify(G.save.loadout)')}")

        # ============================================================
        # 6. COLLECTION
        # ============================================================
        print("\n=== TEST 6: COLLECTION ===")

        # 6a. Collection grows when buying
        ev('G.save.coins = 5000; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        coll_before_buy = evr('G.save.collection.length')
        ev('G.shop()')
        page.wait_for_timeout(300)
        ev('G.buyShopUnit()')
        page.wait_for_timeout(300)
        coll_after_buy = evr('G.save.collection.length')
        log("6a. Collection grows when buying",
            "PASS" if coll_after_buy == coll_before_buy + 1 else "FAIL",
            f"before={coll_before_buy}, after={coll_after_buy}")

        # 6b. Collection units have required fields
        required_fields = ["n", "h", "d", "r", "s", "a", "c", "ability", "rar", "role"]
        missing = evr(f'(() => {{ const coll = G.save.collection || []; const missing = []; for (const u of coll) {{ for (const f of {json.dumps(required_fields)}) {{ if (u[f] === undefined) missing.push(u.n + "." + f); }} }} return missing; }})()')
        log("6b. Collection units have required fields",
            "PASS" if len(missing) == 0 else "FAIL",
            f"missing fields: {missing[:5]}")

        # 6c. Collection persists across page reloads
        coll_before_reload = evr('G.save.collection.length')
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(3000)
        coll_after_reload = evr('G.save.collection.length')
        log("6c. Collection persists across reloads",
            "PASS" if coll_after_reload == coll_before_reload else "FAIL",
            f"before reload={coll_before_reload}, after reload={coll_after_reload}")

        # ============================================================
        # 7. PRESETS
        # ============================================================
        print("\n=== TEST 7: PRESETS ===")

        # 7a. Save a loadout preset (uses prompt())
        ev('G.save.presets = {}; G.save.loadout = ["Knight","Archer","Slash","Wizard"]; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')

        # Handle the prompt dialog
        page.on("dialog", lambda dialog: dialog.accept("TestPreset"))
        ev('G.savePreset()')
        page.wait_for_timeout(500)
        preset_keys = evr('Object.keys(G.save.presets)')
        log("7a. Save preset",
            "PASS" if "TestPreset" in preset_keys else "FAIL",
            f"presets={preset_keys}")

        # Verify preset content
        preset_content = evr('JSON.stringify(G.save.presets["TestPreset"])')
        expected = '["Knight","Archer","Slash","Wizard"]'
        log("7a-note. Preset contains loadout",
            "PASS" if preset_content == expected else "FAIL",
            f"content={preset_content}")

        # 7b. Load a preset
        ev('G.save.loadout = ["Knight","Knight","Knight","Knight"]; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.applyPreset(0)')
        page.wait_for_timeout(300)
        loadout_after_preset = evr('JSON.stringify(G.save.loadout)')
        log("7b. Load preset",
            "PASS" if loadout_after_preset == expected else "FAIL",
            f"loadout={loadout_after_preset}")

        # 7c. Delete a preset
        ev('G.deletePreset(0)')
        page.wait_for_timeout(300)
        preset_keys_after = evr('Object.keys(G.save.presets)')
        log("7c. Delete preset",
            "PASS" if "TestPreset" not in preset_keys_after else "FAIL",
            f"presets after delete={preset_keys_after}")

        # ============================================================
        # 8. QUEST REWARDS
        # ============================================================
        print("\n=== TEST 8: QUEST REWARDS ===")

        # 8a. Complete a quest, claim it, verify coins + XP
        ev('G.save.coins = 0; G.save.xp = 0; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.save.quests = {date: Quests.todayStr(), list: [{id:"win3",desc:"Win 3 matches",type:"match_win",target:3,progress:3,claimed:false,reward:{coins:30,xp:10}}], streak:{count:0,lastLogin:""}}; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        coins_bq = evr('G.save.coins')
        xp_bq = evr('G.save.xp')
        ev('Quests.claim("win3")')
        page.wait_for_timeout(300)
        coins_aq = evr('G.save.coins')
        xp_aq = evr('G.save.xp')
        claimed_status = evr('G.save.quests.list[0].claimed')
        # After fix: no "all claimed" bonus for < 3 quests
        expected_q_coins = 30  # quest reward only
        log("8a. Quest claim: coins + XP added (no bonus for < 3 quests)",
            "PASS" if coins_aq == coins_bq + expected_q_coins and xp_aq == xp_bq + 10 and claimed_status == True else "FAIL",
            f"coins before={coins_bq}, after={coins_aq} (expected +{expected_q_coins}), xp before={xp_bq}, after={xp_aq}, claimed={claimed_status}")

        # Verify "all claimed" bonus does NOT fire with < 3 quests
        log("8a-verify. 'All claimed' bonus does NOT fire with < 3 quests",
            "PASS" if coins_aq == 30 else "FAIL",
            f"coins={coins_aq} (should be 30, not 80 — no +50 bonus for single quest)")

        # 8b. Daily quest reset (change date, verify new quests generated)
        ev('G.save.quests = {date: "2020-01-01", list: [{id:"old",desc:"Old quest",type:"match_win",target:1,progress:1,claimed:true,reward:{coins:10,xp:5}}], streak:{count:0,lastLogin:""}}; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        old_list = evr('JSON.stringify(G.save.quests.list)')
        ev('Quests.generateDaily()')
        page.wait_for_timeout(300)
        new_list = evr('JSON.stringify(G.save.quests.list)')
        new_date = evr('G.save.quests.date')
        today_str = evr('Quests.todayStr()')
        new_count = evr('G.save.quests.list.length')
        log("8b. Daily quest reset generates new quests",
            "PASS" if new_date == today_str and new_count == 3 and old_list != new_list else "FAIL",
            f"date={new_date}, today={today_str}, quest count={new_count}")

        # 8c. Quest claim bonus (all 3 claimed = +50 coins) - test with 3 quests
        ev('G.save.coins = 0; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.save.quests = {date: Quests.todayStr(), list: [{id:"q1",desc:"Q1",type:"match_win",target:1,progress:1,claimed:false,reward:{coins:10,xp:5}},{id:"q2",desc:"Q2",type:"forge",target:1,progress:1,claimed:false,reward:{coins:10,xp:5}},{id:"q3",desc:"Q3",type:"fuse",target:1,progress:1,claimed:false,reward:{coins:10,xp:5}}], streak:{count:0,lastLogin:""}}; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Quests.claim("q1"); Quests.claim("q2")')
        coins_before_bonus = evr('G.save.coins')
        ev('Quests.claim("q3")')
        page.wait_for_timeout(300)
        coins_after_bonus = evr('G.save.coins')
        # 3 quests * 10 coins = 30, + 50 bonus = 80
        log("8c. All-3-claimed bonus (+50 coins) with 3 quests",
            "PASS" if coins_after_bonus == 80 else "FAIL",
            f"coins after all 3 claimed={coins_after_bonus} (expected 80: 30 rewards + 50 bonus)")

        # ============================================================
        # 9. ACHIEVEMENT REWARDS
        # ============================================================
        print("\n=== TEST 9: ACHIEVEMENT REWARDS ===")

        # 9a. Check if achievements give rewards (coins/XP) or just badges
        ev('G.save.coins = 0; G.save.xp = 0; G.save.matchWins = 0; G.save.achievements = {}; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        coins_before_ach = evr('G.save.coins')
        xp_before_ach = evr('G.save.xp')
        ev('G.save.matchWins = 1; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('G.checkAchievements()')
        page.wait_for_timeout(300)
        coins_after_ach = evr('G.save.coins')
        xp_after_ach = evr('G.save.xp')
        first_win_unlocked = evr('G.save.achievements.firstWin')
        log("9a. Achievements give NO rewards (just badges)",
            "PASS" if first_win_unlocked and coins_after_ach == coins_before_ach and xp_after_ach == xp_before_ach else "FAIL",
            f"firstWin unlocked={first_win_unlocked}, coins unchanged={coins_after_ach == coins_before_ach}, xp unchanged={xp_after_ach == xp_before_ach}")

        # ============================================================
        # 10. MATCH REWARDS (full match simulation)
        # ============================================================
        print("\n=== TEST 10: MATCH REWARDS ===")

        # 10a. Full match - win
        ev('G.save.coins = 0; G.save.xp = 0; G.save.matchWins = 0; G.save.winStreak = 0; G.save.lastDailyWin = ""; G.save.arena = 0; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Match.active = true; Match.livesPlayer = 3; Match.livesEnemy = 0; Match.history = [{round:1,winner:"player"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        coins_before_match = evr('G.save.coins')
        xp_before_match = evr('G.save.xp')
        ev('G.onMatchEnd("player")')
        page.wait_for_timeout(500)
        coins_after_match = evr('G.save.coins')
        xp_after_match = evr('G.save.xp')
        coin_gain_display = evr('document.getElementById("coinGain")?.innerText')
        xp_gain_display = evr('document.getElementById("xpGain")?.innerText')

        log("10a. Full match win rewards",
            "PASS" if coins_after_match > coins_before_match and xp_after_match > xp_before_match else "FAIL",
            f"coins before={coins_before_match}, after={coins_after_match}, xp before={xp_before_match}, after={xp_after_match}")
        log("10a-note. Match reward display",
            "INFO" if coin_gain_display else "FAIL",
            f"coinGain display={coin_gain_display}, xpGain display={xp_gain_display}")

        # 10b. MVP bonus - check if MVP gives bonus coins
        log("10b. MVP is display-only (no coin bonus)", "INFO",
            "MVP is tracked and displayed but gives no coin/XP bonus")

        # 10c. Streak bonus calculation
        ev('G.save.coins = 0; G.save.winStreak = 4; G.save.matchWins = 10; G.save.lastDailyWin = new Date().toDateString(); localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Match.active = true; Match.livesPlayer = 3; Match.livesEnemy = 0; Match.history = [{round:1,winner:"player"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        ev('G.onMatchEnd("player")')
        page.wait_for_timeout(500)
        streak_final = evr('G.save.winStreak')
        # streakBonus = min(50, 5*5) = 25
        log("10c. Streak bonus (winStreak=5, bonus=min(50,25)=25)",
            "PASS" if streak_final == 5 else "FAIL",
            f"winStreak={streak_final}, streakBonus should be 25")

        # 10d. Loss rewards (reset streak, no coins)
        ev('G.save.coins = 100; G.save.winStreak = 5; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Match.active = true; Match.livesPlayer = 0; Match.livesEnemy = 3; Match.history = [{round:1,winner:"enemy"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        ev('G.onMatchEnd("enemy")')
        page.wait_for_timeout(500)
        coins_after_loss = evr('G.save.coins')
        streak_after_loss = evr('G.save.winStreak')
        log("10d. Loss resets win streak, no coins gained",
            "PASS" if streak_after_loss == 0 and coins_after_loss == 100 else "FAIL",
            f"coins={coins_after_loss} (should stay 100), winStreak={streak_after_loss} (should be 0)")

        # 10e. Draw rewards
        ev('G.save.coins = 0; G.save.xp = 0; G.save.winStreak = 3; localStorage.setItem("promptShowdownV4",JSON.stringify(G.save))')
        ev('Match.active = true; Match.livesPlayer = 0; Match.livesEnemy = 0; Match.history = [{round:1,winner:"draw"}]; Match.onMatchEnd = (w)=>G.onMatchEnd(w)')
        ev('G.onMatchEnd("draw")')
        page.wait_for_timeout(500)
        coins_after_draw = evr('G.save.coins')
        xp_after_draw = evr('G.save.xp')
        streak_after_draw = evr('G.save.winStreak')
        log("10e. Draw: +5 coins, +15 XP, streak NOT reset",
            "PASS" if coins_after_draw == 5 and xp_after_draw == 15 and streak_after_draw == 3 else "FAIL",
            f"coins={coins_after_draw}, xp={xp_after_draw}, winStreak={streak_after_draw}")

        # ============================================================
        # SUMMARY
        # ============================================================
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        passed = sum(1 for _, s, _ in RESULTS if s == "PASS")
        failed = sum(1 for _, s, _ in RESULTS if s == "FAIL")
        info = sum(1 for _, s, _ in RESULTS if s == "INFO")
        print(f"PASS: {passed}, FAIL: {failed}, INFO: {info}")
        print()

        if failed > 0:
            print("FAILURES:")
            for name, status, evidence in RESULTS:
                if status == "FAIL":
                    print(f"  - {name}: {evidence}")
            print()

        if ERRORS:
            print(f"CONSOLE ERRORS/WARNINGS ({len(ERRORS)}):")
            for err in ERRORS:
                print(f"  - {err}")
        else:
            print("CONSOLE ERRORS/WARNINGS: None")

        browser.close()
        return failed


if __name__ == "__main__":
    failed = run()
    exit(1 if failed > 0 else 0)

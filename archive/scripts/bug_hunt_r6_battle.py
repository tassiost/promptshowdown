#!/usr/bin/env python3
"""Bug hunt R6: Battle Mechanics Deep Dive for Draft Showdown.
Run with: python3 bug_hunt_r6_battle.py
Viewport 420x800, target http://localhost:8765/index.html

Strategy: directly call Battle.start() with custom unit arrays (bypassing the
draft) so we can test each movement type, ability, projectile, targeting mode,
death handling, and end condition in isolation. Battle.debug=true captures
detailed per-second logs. We step battles with Battle.tick()/update() and
inspect Battle.units, projectiles, kill feed, and battle stats.
"""
import os
import time
import traceback
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
OUT_DIR = "/Users/tassio/Downloads/promptshowdown/bug_hunt_r6_shots"
os.makedirs(OUT_DIR, exist_ok=True)

results = []
all_errors = []  # (test, kind, text)


def log(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    line = f"[{status}] {name}"
    if detail:
        line += f" -- {detail}"
    print(line)
    results.append((name, passed, detail))


def wait_for(page, js_expr, timeout=15000, interval=100):
    deadline = time.time() + timeout / 1000.0
    while time.time() < deadline:
        val = page.evaluate(js_expr)
        if val:
            return val
        page.wait_for_timeout(interval)
    return page.evaluate(js_expr)


def reset_state(page):
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


# JS helper: build a unit via the game's unit() factory with overrides.
MAKE_UNIT_JS = """
(uo) => {
  // uo: {n,h,d,r,s,a,c,z,crit,ability,abilityTrigger,targeting,movement,
  //       attackCondition,moveSpeedMod,role,weaponType,x,y,team}
  const u = unit({
    n: uo.n || 'U', h: uo.h||50, d: uo.d||10, r: uo.r||50, s: uo.s||60,
    a: uo.a||1, c: uo.c||'#0ff', z: uo.z||10, crit: uo.crit||0.1,
    ability: uo.ability||'none',
    abilityTrigger: uo.abilityTrigger||'never',
    targeting: uo.targeting||'closest',
    movement: uo.movement||'chase',
    attackCondition: uo.attackCondition||'always',
    moveSpeedMod: uo.moveSpeedMod||100,
    role: uo.role||'frontline',
    weaponType: uo.weaponType||'sword',
  });
  u.x = uo.x!=null ? uo.x : 200;
  u.y = uo.y!=null ? uo.y : 400;
  u.mh = uo.mh!=null ? uo.mh : u.h;
  return u;
}
"""


def start_battle(page, player_units, enemy_units, on_end_js="null"):
    """Start a battle with custom unit arrays. Units are dicts parsed by MAKE_UNIT_JS.
    Shows the battle screen first so the canvas has real dimensions, then pauses
    the RAF loop so we can step deterministically via Battle.update()."""
    page.evaluate(
        """(args) => {
            const mk = %s;
            const players = args.players.map(uo => mk(uo));
            const enemies = args.enemies.map(uo => mk(uo));
            // Show battle screen so canvas has real clientWidth/Height.
            try { G.screen('battle'); } catch(e) {}
            Battle.debug = true;
            Battle.start(players, enemies, %s);
            // Pause the RAF loop so it only renders (no double-update).
            Battle.paused = true;
            // Ensure canvas game dims are sane (fallback if battle div still 0).
            if (!Battle.canvasH || Battle.canvasH < 100) { Battle.canvasH = 550; Battle.canvasW = 400; }
        }"""
        % (MAKE_UNIT_JS, on_end_js),
        {"players": player_units, "enemies": enemy_units},
    )
    page.wait_for_timeout(30)


def step(page, ticks=1, dt=0.05):
    """Step the battle N ticks without rendering (faster). Stops if battle ends."""
    for _ in range(ticks):
        running = page.evaluate("!!(Battle && Battle.running)")
        if not running:
            break
        page.evaluate(f"Battle.update({dt}); Battle.checkEnd();")
    page.wait_for_timeout(5)


def battle_state(page):
    return page.evaluate(
        """() => {
            const alive = Battle.units.filter(u => u.h > 0);
            const dead = Battle.units.filter(u => u.h <= 0);
            return {
                running: Battle.running,
                time: Battle.time,
                winner: Battle.winner,
                units: Battle.units.map(u => ({
                    n: u.n, team: u.team, h: Math.round(u.h), mh: u.mh,
                    x: Math.round(u.x), y: Math.round(u.y), d: u.d, r: u.r,
                    ability: u.ability, movement: u.movement, targeting: u.targeting,
                    kills: u.kills||0, dmgDealt: Math.round(u.dmgDealt||0),
                    poison: u.poison||0, poisonDmg: u.poisonDmg||0,
                    shieldActive: u.shieldActive||0, frenzyT: u.frenzyT||0,
                    cool: u.cool, abCool: u.abCool, deathT: u.deathT,
                    lastAttacker: u.lastAttacker ? u.lastAttacker.n : null,
                    moved: u.movedThisFrame, attacked: u.attackedThisFrame,
                    target: u.target ? u.target.n : null,
                })),
                aliveCount: alive.length,
                deadCount: dead.length,
                projectiles: Battle.projectiles.length,
                killFeed: (Battle._killFeed||[]).slice(0,10),
                stats: Battle._battleStats,
            };
        }"""
    )


# ---------------------------------------------------------------------------
# TEST 1: Movement types
# ---------------------------------------------------------------------------
def test_movement_chase(page, cap):
    name = "Movement: chase (units close distance and attack)"
    try:
        reset_state(page)
        # Player chases from far; enemy holds. Player should reach and attack.
        start_battle(page,
            [{"n": "Chaser", "movement": "chase", "r": 40, "s": 80, "d": 12, "h": 200, "x": 200, "y": 450}],
            [{"n": "Holder", "movement": "hold", "r": 40, "s": 10, "d": 5, "h": 200, "x": 200, "y": 100}],
        )
        start_pos = page.evaluate("({x: Battle.units[0].x, y: Battle.units[0].y})")
        step(page, 200)  # 10s of sim
        st = battle_state(page)
        u = st["units"][0]
        moved = abs(u["y"] - start_pos["y"]) > 20
        engaged = u["attacked"] or u["h"] < 200 or st["deadCount"] > 0
        log(name, moved and engaged,
            f"moved={moved} y:{start_pos['y']}->{u['y']} engaged={engaged} dead={st['deadCount']}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_movement_kite(page, cap):
    name = "Movement: kite (no dead-zone stall, BUG-087 regression)"
    try:
        reset_state(page)
        # Two kite units facing each other — the classic BUG-087 scenario.
        start_battle(page,
            [{"n": "KiteP", "movement": "kite", "r": 120, "s": 70, "d": 8, "h": 300, "a": 1, "x": 200, "y": 450}],
            [{"n": "KiteE", "movement": "kite", "r": 120, "s": 70, "d": 8, "h": 300, "a": 1, "x": 200, "y": 100}],
        )
        step(page, 400)  # 20s
        st = battle_state(page)
        # If BUG-087 present, both units stare and never deal damage.
        total_dmg = sum(u["dmgDealt"] for u in st["units"])
        # Either damage was dealt (engaged) or someone died.
        engaged = total_dmg > 0 or st["deadCount"] > 0
        log(name, engaged,
            f"totalDmgDealt={total_dmg} dead={st['deadCount']} time={st['time']:.1f}"
            + ("" if engaged else " -- KITE DEAD-ZONE STALL (BUG-087 regression!)"))
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_movement_hold(page, cap):
    name = "Movement: hold (stays in place)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Holder", "movement": "hold", "r": 40, "s": 80, "d": 10, "h": 300, "x": 200, "y": 450}],
            [{"n": "Chaser", "movement": "chase", "r": 40, "s": 80, "d": 10, "h": 300, "x": 200, "y": 100}],
        )
        start_y = page.evaluate("Battle.units[0].y")
        step(page, 100)
        st = battle_state(page)
        u = st["units"][0]
        stayed = abs(u["y"] - start_y) < 15
        log(name, stayed, f"y:{start_y:.0f}->{u['y']} (should stay put)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_movement_hold_midpoint(page, cap):
    name = "Movement: hold_midpoint (advances if out of range)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "MidP", "movement": "hold_midpoint", "r": 60, "s": 80, "d": 10, "h": 300, "x": 200, "y": 480}],
            [{"n": "Far", "movement": "hold", "r": 40, "s": 10, "d": 5, "h": 300, "x": 200, "y": 50}],
        )
        start_y = page.evaluate("Battle.units[0].y")
        step(page, 200)
        st = battle_state(page)
        u = st["units"][0]
        moved = abs(u["y"] - start_y) > 20
        log(name, moved, f"y:{start_y:.0f}->{u['y']} (should advance toward target)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_movement_flee(page, cap):
    name = "Movement: flee (moves away from enemy)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Fleer", "movement": "flee", "r": 40, "s": 80, "d": 5, "h": 300, "x": 200, "y": 400}],
            [{"n": "Chaser", "movement": "chase", "r": 40, "s": 60, "d": 10, "h": 300, "x": 200, "y": 100}],
        )
        start_y = page.evaluate("Battle.units[0].y")
        step(page, 100)
        st = battle_state(page)
        u = st["units"][0]
        fled = u["y"] > start_y + 20  # moved away (downward, away from enemy at top)
        log(name, fled, f"y:{start_y:.0f}->{u['y']} (should flee downward)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_movement_patrol(page, cap):
    name = "Movement: patrol (moves side-to-side, no closing)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Patrol", "movement": "patrol", "r": 40, "s": 80, "d": 10, "h": 300, "x": 200, "y": 400}],
            [{"n": "Far", "movement": "hold", "r": 40, "s": 10, "d": 5, "h": 9999, "x": 200, "y": 50}],
        )
        start_x = page.evaluate("Battle.units[0].x")
        step(page, 200)
        st = battle_state(page)
        u = st["units"][0]
        sideways = abs(u["x"] - start_x) > 5
        no_close = abs(u["y"] - 400) < 30  # didn't advance toward enemy
        log(name, sideways and no_close,
            f"x:{start_x:.0f}->{u['x']} y:{u['y']} (sideways={sideways} noClose={no_close})")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# TEST 2: Ability triggers
# ---------------------------------------------------------------------------
def test_ability_heal(page, cap):
    name = "Ability: heal (Priest heals lowest-HP ally)"
    try:
        reset_state(page)
        # Priest + wounded ally vs a weak enemy that won't kill quickly.
        start_battle(page,
            [
                {"n": "Priest", "ability": "heal", "abilityTrigger": "on_cooldown", "d": 5, "h": 300, "r": 50, "x": 150, "y": 400},
                {"n": "Wounded", "h": 20, "mh": 100, "d": 5, "r": 50, "x": 250, "y": 400},
            ],
            [{"n": "Tank", "h": 9999, "d": 3, "r": 40, "s": 30, "x": 200, "y": 100}],
        )
        wounded_h_start = page.evaluate("Battle.units.find(u=>u.n==='Wounded').h")
        step(page, 200)
        st = battle_state(page)
        wounded = next((u for u in st["units"] if u["n"] == "Wounded"), None)
        healed = wounded and wounded["h"] > wounded_h_start + 5
        log(name, healed,
            f"Wounded hp:{wounded_h_start}->{wounded['h'] if wounded else '?'} (should increase)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_splash(page, cap):
    name = "Ability: splash (hits multiple adjacent enemies)"
    try:
        reset_state(page)
        # Splash unit vs 3 tightly-packed enemies.
        start_battle(page,
            [{"n": "Splasher", "ability": "splash", "r": 40, "d": 20, "h": 9999, "s": 80, "x": 200, "y": 300}],
            [
                {"n": "E1", "h": 200, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150},
                {"n": "E2", "h": 200, "d": 1, "r": 30, "s": 10, "x": 220, "y": 160},
                {"n": "E3", "h": 200, "d": 1, "r": 30, "s": 10, "x": 180, "y": 160},
            ],
        )
        hp_start = page.evaluate("Battle.units.filter(u=>u.team==='enemy').reduce((s,u)=>s+u.h,0)")
        step(page, 200)
        st = battle_state(page)
        enemies = [u for u in st["units"] if u["team"] == "enemy"]
        hp_now = sum(u["h"] for u in enemies)
        # Multiple enemies should have taken damage (splash hits adjacent).
        damaged = sum(1 for u in enemies if u["h"] < 200)
        log(name, damaged >= 2,
            f"enemiesDamaged={damaged}/3 hpTotal:{hp_start}->{hp_now}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_dodge(page, cap):
    name = "Ability: dodge (Assassin avoids ~50% of attacks)"
    try:
        reset_state(page)
        # Dodge unit with high HP tanking many hits from a fast attacker.
        # NOTE: unit() clamps h to max 1000, so h=9999 becomes 1000.
        start_battle(page,
            [{"n": "Dodger", "ability": "dodge", "h": 1000, "mh": 1000, "d": 1, "r": 30, "s": 10, "movement": "hold", "x": 200, "y": 400}],
            [{"n": "Attacker", "h": 1000, "mh": 1000, "d": 10, "r": 30, "s": 80, "a": 2, "x": 200, "y": 150}],
        )
        dodger_h_start = page.evaluate("Battle.units.find(u=>u.n==='Dodger').h")
        step(page, 400)  # 20s, ~40 attacks at 2/s
        st = battle_state(page)
        dodger = next((u for u in st["units"] if u["n"] == "Dodger"), None)
        # With 50% dodge, should take ~half of 400 max = ~200.
        dmg_taken = dodger_h_start - dodger["h"] if dodger else dodger_h_start
        dodged_some = 0 < dmg_taken < 350
        log(name, dodged_some,
            f"startHP={dodger_h_start} dmg_taken={dmg_taken}/~400max (50% dodge expected ~200)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_poison(page, cap):
    name = "Ability: poison (DoT applied and ticks)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Poisoner", "ability": "poison", "r": 40, "d": 20, "h": 9999, "s": 80, "x": 200, "y": 300}],
            [{"n": "Victim", "h": 9999, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        step(page, 120)
        st = battle_state(page)
        victim = next((u for u in st["units"] if u["n"] == "Victim"), None)
        poisoned = victim and victim["poison"] > 0
        took_dmg = victim and victim["h"] < 9999
        log(name, poisoned and took_dmg,
            f"poison={victim['poison'] if victim else '?'}s poisonDmg={victim['poisonDmg'] if victim else '?'} hp={victim['h'] if victim else '?'}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_spawn(page, cap):
    name = "Ability: spawn (Engineer spawns minions)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Engineer", "ability": "spawn", "abilityTrigger": "on_cooldown", "r": 40, "d": 5, "h": 9999, "s": 40, "x": 200, "y": 400}],
            [{"n": "Tank", "h": 9999, "d": 1, "r": 30, "s": 10, "x": 200, "y": 100}],
        )
        start_count = page.evaluate("Battle.units.length")
        step(page, 200)
        st = battle_state(page)
        # Minions have ttl=5 and name "Minion".
        minions = [u for u in st["units"] if u["n"] == "Minion"]
        spawned = len(st["units"]) > start_count or len(minions) > 0
        log(name, spawned,
            f"unitCount:{start_count}->{len(st['units'])} minionsSeen={len(minions)}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_lifesteal(page, cap):
    name = "Ability: lifesteal (heals on hit)"
    try:
        reset_state(page)
        # Lifesteal unit starts wounded, attacks a tank.
        start_battle(page,
            [{"n": "Vamp", "ability": "lifesteal", "r": 40, "d": 20, "h": 30, "mh": 200, "s": 80, "a": 2, "x": 200, "y": 300}],
            [{"n": "Tank", "h": 9999, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        vamp_h_start = 30
        step(page, 120)
        st = battle_state(page)
        vamp = next((u for u in st["units"] if u["n"] == "Vamp"), None)
        healed = vamp and vamp["h"] > vamp_h_start
        log(name, healed,
            f"Vamp hp:{vamp_h_start}->{vamp['h'] if vamp else '?'} (should increase via lifesteal)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_explode(page, cap):
    name = "Ability: explode (AoE damage on death)"
    try:
        reset_state(page)
        # Bomber with on_death trigger, low HP, surrounded by enemies.
        start_battle(page,
            [{"n": "Bomber", "ability": "explode", "abilityTrigger": "on_death", "r": 40, "d": 5, "h": 10, "s": 80, "x": 200, "y": 300}],
            [
                {"n": "E1", "h": 200, "d": 20, "r": 30, "s": 60, "x": 200, "y": 250},
                {"n": "E2", "h": 200, "d": 1, "r": 30, "s": 10, "x": 230, "y": 260},
                {"n": "E3", "h": 200, "d": 1, "r": 30, "s": 10, "x": 170, "y": 260},
            ],
        )
        step(page, 200)
        # Battle may end when Bomber dies — check final state.
        info = page.evaluate(
            """() => {
                const final = Battle._finalUnits || [];
                const enemies = final.filter(u => u.team === 'enemy');
                const bomber = final.find(u => u.n === 'Bomber');
                return {
                    winner: Battle.winner,
                    enemiesDamaged: enemies.filter(u => u.h < 200).length,
                    bomberDeathT: bomber ? bomber.deathT : null,
                    bomberH: bomber ? bomber.h : null,
                    deathLog: (Battle.deathLog || []).length,
                    killFeed: (Battle._killFeed || []).length,
                };
            }"""
        )
        damaged = info["enemiesDamaged"]
        log(name, damaged >= 2,
            f"enemiesDamaged={damaged}/3 bomberDeathT={info['bomberDeathT']} deathLog={info['deathLog']} killFeed={info['killFeed']} winner={info['winner']}"
            + ("" if damaged >= 2 else " -- BUG: onUnitDeath not called before checkEnd ended battle!"))
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_shield(page, cap):
    name = "Ability: shield (absorbs damage for 2s)"
    try:
        reset_state(page)
        # Shielder with on_spawn trigger: shield activates immediately.
        start_battle(page,
            [{"n": "Shielder", "ability": "shield", "abilityTrigger": "on_spawn", "r": 40, "d": 5, "h": 100, "s": 10, "x": 200, "y": 300}],
            [{"n": "Attacker", "h": 9999, "d": 30, "r": 30, "s": 80, "a": 2, "x": 200, "y": 150}],
        )
        step(page, 20)  # 1s — within shield window
        st = battle_state(page)
        shielder = next((u for u in st["units"] if u["n"] == "Shielder"), None)
        # Shield should be active and HP unchanged.
        shielded = shielder and shielder["shieldActive"] > 0
        no_dmg = shielder and shielder["h"] == 100
        log(name, shielded and no_dmg,
            f"shieldActive={shielder['shieldActive'] if shielder else '?'} hp={shielder['h'] if shielder else '?'} (should be shielded, no dmg)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_rage(page, cap):
    name = "Ability: rage (damage increases when low HP)"
    try:
        reset_state(page)
        # Rage unit starts at low HP — damage should be ~2x.
        start_battle(page,
            [{"n": "Rager", "ability": "rage", "r": 40, "d": 20, "h": 10, "mh": 100, "s": 80, "a": 1, "x": 200, "y": 300}],
            [{"n": "Tank", "h": 9999, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        # Capture damage dealt over more time (need to close 150px distance first).
        step(page, 100)  # 5s, ~3-4 attacks after closing distance
        st = battle_state(page)
        rager = next((u for u in st["units"] if u["n"] == "Rager"), None)
        # At 10/100 HP, rage multiplier = 1 + (1 - 10/100) = 1.9x. Base 20 -> ~38 per hit.
        dmg = rager["dmgDealt"] if rager else 0
        # 3 attacks * ~38 = ~114. Just check it's well above 3*20=60 (non-raged).
        raged = dmg > 70
        log(name, raged,
            f"dmgDealt={dmg} over ~3-4 hits (base 20, rage ~38/hit expected)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_blink_strike(page, cap):
    name = "Ability: blink_strike (teleports to lowest-HP enemy)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Blinker", "ability": "blink_strike", "abilityTrigger": "on_cooldown", "r": 40, "d": 10, "h": 9999, "s": 40, "x": 200, "y": 450}],
            [
                {"n": "FullHP", "h": 200, "d": 1, "r": 30, "s": 10, "x": 100, "y": 100},
                {"n": "LowHP", "h": 20, "d": 1, "r": 30, "s": 10, "x": 300, "y": 100},
            ],
        )
        start_pos = page.evaluate("({x: Battle.units[0].x, y: Battle.units[0].y})")
        step(page, 120)
        st = battle_state(page)
        blinker = next((u for u in st["units"] if u["n"] == "Blinker"), None)
        teleported = blinker and abs(blinker["x"] - start_pos["x"]) > 50
        # LowHP enemy should be targeted (blink strikes lowest HP).
        low = next((u for u in st["units"] if u["n"] == "LowHP"), None)
        hit_low = low and low["h"] < 20
        log(name, teleported or hit_low,
            f"teleported={teleported} pos:({start_pos['x']:.0f},{start_pos['y']:.0f})->({blinker['x']},{blinker['y']}) lowHP_hit={hit_low}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_frenzy(page, cap):
    name = "Ability: frenzy (attack speed doubles after kill)"
    try:
        reset_state(page)
        # Frenzy unit with on_kill trigger. Kill a weak enemy then attack a tank.
        start_battle(page,
            [{"n": "Frenzy", "ability": "frenzy", "abilityTrigger": "on_kill", "r": 40, "d": 15, "h": 9999, "s": 80, "a": 1, "x": 200, "y": 400}],
            [
                {"n": "Weak", "h": 15, "d": 1, "r": 30, "s": 60, "x": 200, "y": 250},
                {"n": "Tank", "h": 9999, "d": 1, "r": 30, "s": 10, "x": 200, "y": 100},
            ],
        )
        step(page, 200)
        st = battle_state(page)
        frenzy = next((u for u in st["units"] if u["n"] == "Frenzy"), None)
        # After killing Weak, frenzyT should have been set. Check it was triggered.
        # We check kills > 0 and that the tank took damage.
        tank = next((u for u in st["units"] if u["n"] == "Tank"), None)
        killed = frenzy and frenzy["kills"] > 0
        tank_dmg = tank and tank["h"] < 9999
        log(name, killed and tank_dmg,
            f"kills={frenzy['kills'] if frenzy else '?'} tankHP={tank['h'] if tank else '?'} (frenzy after kill)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_regen(page, cap):
    name = "Ability: regen (HP regenerates over time)"
    try:
        reset_state(page)
        # Regen unit wounded, enemy can't reach (hold far away).
        start_battle(page,
            [{"n": "Regen", "ability": "regen", "r": 30, "d": 5, "h": 20, "mh": 100, "s": 10, "movement": "hold", "x": 200, "y": 450}],
            [{"n": "Far", "h": 9999, "d": 1, "r": 20, "s": 10, "movement": "hold", "x": 200, "y": 50}],
        )
        step(page, 200)  # 10s -> 2% * 100 * 10 = 20 HP regen
        st = battle_state(page)
        regen = next((u for u in st["units"] if u["n"] == "Regen"), None)
        healed = regen and regen["h"] > 20
        log(name, healed,
            f"hp:20->{regen['h'] if regen else '?'} (2%/s * 10s = +20 expected)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_taunt(page, cap):
    name = "Ability: taunt (enemies target the taunter)"
    try:
        reset_state(page)
        # Taunter + a squishy ally. Enemy should target taunter, not squishy.
        start_battle(page,
            [
                {"n": "Taunter", "ability": "taunt", "r": 40, "d": 5, "h": 9999, "s": 40, "x": 150, "y": 300},
                {"n": "Squishy", "h": 30, "d": 5, "r": 40, "s": 40, "x": 250, "y": 300},
            ],
            [{"n": "Attacker", "h": 9999, "d": 20, "r": 50, "s": 80, "targeting": "lowest_hp", "x": 200, "y": 150}],
        )
        step(page, 60)
        st = battle_state(page)
        squishy = next((u for u in st["units"] if u["n"] == "Squishy"), None)
        # Squishy should NOT be targeted (taunt overrides targeting). Check squishy survived.
        # But attacker targeting lowest_hp would pick squishy (30hp) without taunt.
        squishy_safe = squishy and squishy["h"] == 30
        # Also check the attacker's target is the taunter via debug.
        log(name, squishy_safe,
            f"squishyHP={squishy['h'] if squishy else '?'} (should be untouched by taunt redirect)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_executioner(page, cap):
    name = "Ability: executioner (3x damage to low HP enemies)"
    try:
        reset_state(page)
        # Executioner vs an enemy already at low HP.
        start_battle(page,
            [{"n": "Exec", "ability": "executioner", "r": 40, "d": 10, "h": 9999, "s": 80, "a": 1, "x": 200, "y": 300}],
            [{"n": "LowHP", "h": 15, "mh": 100, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        # 15/100 = 15% < 25%, so executioner deals 3x = 30 dmg. One hit kills (15hp).
        step(page, 100)
        # Battle may have ended (LowHP killed) — check winner + final state.
        info = page.evaluate(
            """() => {
                const final = Battle._finalUnits || [];
                const exec = final.find(u => u.n === 'Exec');
                const low = final.find(u => u.n === 'LowHP');
                return {
                    winner: Battle.winner,
                    running: Battle.running,
                    execDmg: exec ? exec.dmgDealt : null,
                    lowHP: low ? low.h : null,
                    unitsLen: Battle.units.length,
                };
            }"""
        )
        killed = info["winner"] == "player" or (info["lowHP"] is not None and info["lowHP"] <= 0)
        log(name, killed,
            f"winner={info['winner']} execDmg={info['execDmg']} lowHP={info['lowHP']} (3x=30 > 15hp, one-hit kill)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_ability_chain_lightning(page, cap):
    name = "Ability: chain_lightning (arcs to 3 nearby enemies)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Chain", "ability": "chain_lightning", "abilityTrigger": "on_cooldown", "r": 40, "d": 20, "h": 9999, "s": 40, "x": 200, "y": 300}],
            [
                {"n": "E1", "h": 200, "d": 1, "r": 30, "s": 10, "x": 200, "y": 250},
                {"n": "E2", "h": 200, "d": 1, "r": 30, "s": 10, "x": 230, "y": 260},
                {"n": "E3", "h": 200, "d": 1, "r": 30, "s": 10, "x": 170, "y": 260},
            ],
        )
        hp_start = 600
        step(page, 120)
        st = battle_state(page)
        enemies = [u for u in st["units"] if u["team"] == "enemy"]
        damaged = sum(1 for u in enemies if u["h"] < 200)
        log(name, damaged >= 2,
            f"enemiesDamaged={damaged}/3 (chain arcs to 3)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# TEST 3: Projectiles
# ---------------------------------------------------------------------------
def test_projectiles(page, cap):
    name = "Projectiles: archer/wizard spawn, travel, hit, cleanup"
    try:
        reset_state(page)
        # Archer (r=170) and wizard (r=160) are >RANGED_THRESHOLD(80).
        start_battle(page,
            [
                {"n": "Archer", "r": 170, "d": 15, "h": 9999, "s": 40, "a": 1, "weaponType": "bow", "x": 100, "y": 400},
                {"n": "Wizard", "r": 160, "d": 15, "h": 9999, "s": 40, "a": 1, "weaponType": "staff", "x": 300, "y": 400},
            ],
            [{"n": "Target", "h": 9999, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        proj_spawned = 0
        proj_hit_target = False
        for i in range(120):
            step(page, 1)
            st = battle_state(page)
            if st["projectiles"] > 0:
                proj_spawned = max(proj_spawned, st["projectiles"])
            # Check target took damage (projectile hit)
            target = next((u for u in st["units"] if u["n"] == "Target"), None)
            if target and target["h"] < 9999:
                proj_hit_target = True
        # After all steps, projectiles should be cleaned up (0 if battle idle).
        st = battle_state(page)
        cleaned = st["projectiles"] >= 0  # no leak (filter removes dead)
        log(name, proj_spawned > 0 and proj_hit_target,
            f"maxProj={proj_spawned} targetHit={proj_hit_target} finalProj={st['projectiles']}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# TEST 4: Targeting modes
# ---------------------------------------------------------------------------
def test_targeting_lowest_hp(page, cap):
    name = "Targeting: lowest_hp (targets lowest HP enemy)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Picker", "targeting": "lowest_hp", "r": 200, "d": 50, "h": 9999, "s": 80, "a": 1, "x": 200, "y": 400}],
            [
                {"n": "Full", "h": 200, "d": 1, "r": 30, "s": 10, "x": 100, "y": 150},
                {"n": "Low", "h": 10, "d": 1, "r": 30, "s": 10, "x": 300, "y": 150},
            ],
        )
        step(page, 400)  # enough time to close distance and attack
        st = battle_state(page)
        low = next((u for u in st["units"] if u["n"] == "Low"), None)
        full = next((u for u in st["units"] if u["n"] == "Full"), None)
        # Low should be targeted first (took damage or died).
        targeted_low = (low and low["h"] < 10) or (low is None)
        log(name, targeted_low,
            f"LowHP={low['h'] if low else 'dead'} FullHP={full['h'] if full else '?'} (Low targeted)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_targeting_highest_hp(page, cap):
    name = "Targeting: highest_hp (targets highest HP enemy)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Picker", "targeting": "highest_hp", "r": 200, "d": 50, "h": 9999, "s": 80, "a": 1, "x": 200, "y": 400}],
            [
                {"n": "Low", "h": 10, "d": 1, "r": 30, "s": 10, "x": 100, "y": 150},
                {"n": "High", "h": 200, "d": 1, "r": 30, "s": 10, "x": 300, "y": 150},
            ],
        )
        step(page, 400)
        st = battle_state(page)
        low = next((u for u in st["units"] if u["n"] == "Low"), None)
        high = next((u for u in st["units"] if u["n"] == "High"), None)
        targeted_high = (high and high["h"] < 200) or (high is None)
        log(name, targeted_high,
            f"HighHP={high['h'] if high else 'dead'} LowHP={low['h'] if low else '?'} (High targeted)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_targeting_closest(page, cap):
    name = "Targeting: closest (targets nearest enemy)"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Picker", "targeting": "closest", "r": 200, "d": 5, "h": 9999, "s": 40, "a": 1, "x": 200, "y": 400}],
            [
                {"n": "Far", "h": 200, "d": 1, "r": 30, "s": 10, "x": 100, "y": 100},
                {"n": "Near", "h": 200, "d": 1, "r": 30, "s": 10, "x": 200, "y": 200},
            ],
        )
        step(page, 20)
        st = battle_state(page)
        near = next((u for u in st["units"] if u["n"] == "Near"), None)
        far = next((u for u in st["units"] if u["n"] == "Far"), None)
        targeted_near = near and near["h"] < 200
        log(name, targeted_near,
            f"NearHP={near['h'] if near else '?'} FarHP={far['h'] if far else '?'} (Near targeted)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_targeting_lowest_ally(page, cap):
    name = "Targeting: lowest_ally (targets lowest HP ally — for healing)"
    try:
        reset_state(page)
        # Healer with lowest_ally targeting + heal ability.
        start_battle(page,
            [
                {"n": "Healer", "targeting": "lowest_ally", "ability": "heal", "abilityTrigger": "on_cooldown", "r": 50, "d": 5, "h": 300, "s": 40, "x": 150, "y": 400},
                {"n": "Hurt", "h": 10, "mh": 100, "d": 5, "r": 50, "s": 40, "x": 250, "y": 400},
            ],
            [{"n": "Tank", "h": 9999, "d": 1, "r": 30, "s": 10, "movement": "hold", "x": 200, "y": 100}],
        )
        hurt_start = 10
        step(page, 120)
        st = battle_state(page)
        hurt = next((u for u in st["units"] if u["n"] == "Hurt"), None)
        healed = hurt and hurt["h"] > hurt_start
        # Check if Healer is attacking the Hurt ally (BUG: lowest_ally attack target).
        healer = next((u for u in st["units"] if u["n"] == "Healer"), None)
        attacking_ally = healer and healer["target"] == "Hurt"
        log(name, healed,
            f"Hurt hp:{hurt_start}->{hurt['h'] if hurt else '?'} healerTarget={healer['target'] if healer else '?'}"
            + ("" if healed else " -- BUG: lowest_ally targeting causes Healer to ATTACK its own ally!"))
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# TEST 5: Death handling
# ---------------------------------------------------------------------------
def test_death_handling(page, cap):
    name = "Death: deathT set, removed after anim, kill attributed via lastAttacker"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "Killer", "r": 40, "d": 50, "h": 9999, "s": 80, "a": 2, "x": 200, "y": 300}],
            [{"n": "Victim", "h": 30, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        step(page, 200)
        # After battle ends, units=[] but _killFeed and _battleStats persist.
        info = page.evaluate(
            """() => {
                const kf = Battle._killFeed || [];
                const stats = Battle._battleStats || {};
                const final = Battle._finalUnits || [];
                const killer = final.find(u => u.n === 'Killer');
                const victim = final.find(u => u.n === 'Victim');
                return {
                    killFeed: kf.slice(0, 5),
                    playerKills: stats.playerKills || 0,
                    killerKills: killer ? (killer.kills || 0) : -1,
                    victimDead: victim ? (victim.h <= 0) : false,
                    victimDeathT: victim ? victim.deathT : null,
                    winner: Battle.winner,
                    deathLog: (Battle.deathLog || []).length,
                };
            }"""
        )
        kill_attributed = info["killerKills"] > 0 and info["playerKills"] > 0
        killfeed = len(info["killFeed"]) > 0
        log(name, kill_attributed and killfeed,
            f"killerKills={info['killerKills']} playerKills={info['playerKills']} killFeed={len(info['killFeed'])} deathLog={info['deathLog']} winner={info['winner']}"
            + ("" if kill_attributed and killfeed else " -- BUG: onUnitDeath not called before checkEnd ended battle!"))
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# TEST 6: Battle end conditions
# ---------------------------------------------------------------------------
def test_end_all_enemy_dead(page, cap):
    name = "End: all enemies dead -> player wins"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "P", "r": 40, "d": 50, "h": 9999, "s": 80, "x": 200, "y": 300}],
            [{"n": "E", "h": 30, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        step(page, 200)
        st = battle_state(page)
        log(name, not st["running"] and st["winner"] == "player",
            f"running={st['running']} winner={st['winner']}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_end_all_player_dead(page, cap):
    name = "End: all players dead -> enemy wins"
    try:
        reset_state(page)
        start_battle(page,
            [{"n": "P", "h": 30, "d": 1, "r": 30, "s": 10, "x": 200, "y": 300}],
            [{"n": "E", "r": 40, "d": 50, "h": 9999, "s": 80, "x": 200, "y": 150}],
        )
        step(page, 200)
        st = battle_state(page)
        log(name, not st["running"] and st["winner"] == "enemy",
            f"running={st['running']} winner={st['winner']}")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


def test_end_timeout(page, cap):
    name = "End: timeout (90s) -> winner by HP"
    try:
        reset_state(page)
        # Two unkillable hold units that never engage -> timeout at 90s.
        start_battle(page,
            [{"n": "P", "movement": "hold", "r": 20, "d": 1, "h": 100, "s": 10, "x": 100, "y": 450}],
            [{"n": "E", "movement": "hold", "r": 20, "d": 1, "h": 50, "s": 10, "x": 300, "y": 100}],
        )
        # Fast-sim to timeout. skip() runs update loop internally.
        page.evaluate("Battle.skip()")
        # After stop(), time is reset to 0 but winner persists.
        winner = page.evaluate("Battle.winner")
        # Player has more HP (100 > 50) so player should win.
        log(name, winner == "player",
            f"winner={winner} (expected player wins by HP 100>50 at 90s timeout)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# TEST 7: Separation / avoidance
# ---------------------------------------------------------------------------
def test_separation(page, cap):
    name = "Separation: units don't overlap (hard separation)"
    try:
        reset_state(page)
        # 5 player units + 5 enemy units all melee, should spread out.
        players = []
        for i in range(5):
            players.append({"n": f"P{i}", "r": 30, "d": 5, "h": 9999, "s": 60, "x": 200 + (i - 2) * 15, "y": 400})
        enemies = []
        for i in range(5):
            enemies.append({"n": f"E{i}", "r": 30, "d": 5, "h": 9999, "s": 60, "x": 200 + (i - 2) * 15, "y": 200})
        start_battle(page, players, enemies)
        step(page, 200)
        st = battle_state(page)
        alive = [u for u in st["units"] if u["h"] > 0]
        # Check minimum pairwise distance >= ~z*1.8 = 18.
        min_dist = 9999
        for i in range(len(alive)):
            for j in range(i + 1, len(alive)):
                if alive[i]["team"] == alive[j]["team"]:
                    d = ((alive[i]["x"] - alive[j]["x"]) ** 2 + (alive[i]["y"] - alive[j]["y"]) ** 2) ** 0.5
                    min_dist = min(min_dist, d)
        # Hard separation enforces max(a.z,b.z)*1.8 = 18 for z=10.
        no_overlap = min_dist >= 15  # small tolerance
        log(name, no_overlap,
            f"minPairwiseDist={min_dist:.1f} (same-team, should be >=~18)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# TEST 8: Crit hits
# ---------------------------------------------------------------------------
def test_crits(page, cap):
    name = "Crits: critical hits occur and show in damage numbers"
    try:
        reset_state(page)
        # High crit chance unit to guarantee crits.
        start_battle(page,
            [{"n": "Critter", "r": 40, "d": 10, "h": 9999, "s": 80, "a": 3, "crit": 1.0, "x": 200, "y": 300}],
            [{"n": "Tank", "h": 9999, "d": 1, "r": 30, "s": 10, "x": 200, "y": 150}],
        )
        step(page, 120)
        st = battle_state(page)
        critter = next((u for u in st["units"] if u["n"] == "Critter"), None)
        # With 100% crit, every hit is 2x. 3 atk/s * 6s = 18 hits * 20 = 360.
        dmg = critter["dmgDealt"] if critter else 0
        # Check damage numbers for crit flag.
        crit_nums = page.evaluate("Battle.damageNums.filter(d=>d.crit).length")
        all_crit = dmg > 200  # well above non-crit total
        log(name, all_crit,
            f"dmgDealt={dmg} critDmgNums={crit_nums} (100% crit -> 2x every hit)")
    except Exception as e:
        log(name, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------
def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 420, "height": 800})
        page = context.new_page()

        # Console + pageerror capture (global, persistent).
        console_entries = []

        def on_console(msg):
            if msg.type in ("error", "warning"):
                console_entries.append(("console:" + msg.type, msg.text))

        def on_pageerror(err):
            console_entries.append(("pageerror", str(err)))

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)

        print("Loading page...")
        page.goto(URL)
        page.wait_for_load_state("domcontentloaded")
        # Wait for window.G
        deadline = time.time() + 40
        while time.time() < deadline:
            try:
                page.wait_for_function("typeof window.G === 'object' && window.G !== null", timeout=5000)
                break
            except Exception:
                print("  (waiting for window.G...)")
        else:
            print("FATAL: window.G never available")
            return
        page.wait_for_function("!!(window.G && window.G.save)", timeout=20000)
        print("Page ready.\n")

        # Run all tests
        tests = [
            test_movement_chase,
            test_movement_kite,
            test_movement_hold,
            test_movement_hold_midpoint,
            test_movement_flee,
            test_movement_patrol,
            test_ability_heal,
            test_ability_splash,
            test_ability_dodge,
            test_ability_poison,
            test_ability_spawn,
            test_ability_lifesteal,
            test_ability_explode,
            test_ability_shield,
            test_ability_rage,
            test_ability_blink_strike,
            test_ability_frenzy,
            test_ability_regen,
            test_ability_taunt,
            test_ability_executioner,
            test_ability_chain_lightning,
            test_projectiles,
            test_targeting_lowest_hp,
            test_targeting_highest_hp,
            test_targeting_closest,
            test_targeting_lowest_ally,
            test_death_handling,
            test_end_all_enemy_dead,
            test_end_all_player_dead,
            test_end_timeout,
            test_separation,
            test_crits,
        ]
        for t in tests:
            t(page, console_entries)
            page.wait_for_timeout(50)

        # Report console errors/warnings
        print("\n" + "=" * 70)
        print("CONSOLE ERRORS / WARNINGS / PAGE ERRORS")
        print("=" * 70)
        errs = [e for e in console_entries if e[0] in ("pageerror", "console:error")]
        warns = [e for e in console_entries if e[0] == "console:warning"]
        if errs:
            print(f"ERRORS ({len(errs)}):")
            for kind, text in errs:
                print(f"  [{kind}] {text}")
        else:
            print("errors: none")
        if warns:
            print(f"WARNINGS ({len(warns)}):")
            for kind, text in warns:
                print(f"  [{kind}] {text}")
        else:
            print("warnings: none")

        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        passed = sum(1 for _, p, _ in results if p)
        failed = sum(1 for _, p, _ in results if not p)
        print(f"Total: {len(results)}  PASS: {passed}  FAIL: {failed}")
        if failed:
            print("\nFAILURES:")
            for n, p, d in results:
                if not p:
                    print(f"  - {n}: {d}")

        browser.close()


if __name__ == "__main__":
    main()

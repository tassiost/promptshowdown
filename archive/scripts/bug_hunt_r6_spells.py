#!/usr/bin/env python3
"""
E2E Bug Hunt — Round 6: Spell System Deep Dive
Target: http://localhost:8765/index.html (Draft Showdown)
Viewport: 420x800

Drives the module-scoped spell system via the exposed window.Battle / window.G / window.unit.
Spell itself is NOT on window, but Battle.fireSpell(spec,team) -> Spell.fire, and
Battle.update(dt) -> Spell.checkTriggers + Spell.tickZones, so we exercise the full path.
"""
import json, traceback
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
RESULTS = []
ERRORS = []   # console errors / pageerrors

def record(name, passed, evidence):
    status = "PASS" if passed else "FAIL"
    RESULTS.append((status, name, evidence))
    print(f"[{status}] {name}\n        {evidence}")

def make_unit_js(n, h=200, d=5, r=40, s=50, x=100, y=400, team_color="#0ff",
                 ability="none", role="frontline", movement="chase"):
    # unit() does NOT keep x/y in its returned object; set them after creation.
    return (f"(()=>{{const _u=window.unit({{n:{json.dumps(n)},h:{h},d:{d},r:{r},s:{s},"
            f"c:{json.dumps(team_color)},ability:{json.dumps(ability)},"
            f"role:{json.dumps(role)},movement:{json.dumps(movement)},"
            f"targeting:'closest',attackCondition:'always',abilityTrigger:'never'}});"
            f"_u.x={x};_u.y={y};return _u;}})()")

def start_battle_js(player_units, enemy_units, player_spells=None, enemy_spells=None):
    """Return JS that starts a fresh battle with given units/spells. Returns nothing."""
    pu = ",".join(make_unit_js(**u) if isinstance(u, dict) else u for u in player_units)
    eu = ",".join(make_unit_js(**u) if isinstance(u, dict) else u for u in enemy_units)
    ps = json.dumps(player_spells or [])
    es = json.dumps(enemy_spells or [])
    return f"""
    (()=>{{
      try {{
        if (Battle.running) Battle.stop();
        Battle.screenShown = true;
        G.screen('battle');
        const players = [{pu}];
        const enemies = [{eu}];
        // place teams
        players.forEach((u,i)=>{{u.team='player';}});
        enemies.forEach((u,i)=>{{u.team='enemy';}});
        const spells = {{player:{ps}, enemy:{es}}};
        Battle.start(players, enemies, null, spells);
        // Stop the auto RAF loop so we drive update() manually (deterministic).
        cancelAnimationFrame(Battle.frame); Battle.frame=null;
        return {{ok:true, units:Battle.units.length, spells:Battle.spells.length,
                 playerSpells:Battle.playerSpells.length, zones:Battle.zones.length,
                 positions:Battle.units.map(u=>({{n:u.n,x:u.x,y:u.y}}))}};
      }} catch(e) {{ return {{ok:false, err:String(e), stack:e&&e.stack}}; }}
    }})()
    """

def run(page, js):
    return page.evaluate(js)

def step(page, dt=1.0, n=1):
    """Step Battle.update dt seconds, n times (no render)."""
    for _ in range(n):
        page.evaluate(f"try{{Battle.update({dt})}}catch(e){{window.__lastUpdErr=String(e)}}")
        err = page.evaluate("window.__lastUpdErr||null")
        if err:
            ERRORS.append(f"Battle.update error: {err}")
            page.evaluate("window.__lastUpdErr=null")
            return False
    return True

def unit_state(page, idx):
    """Return a snapshot of Battle.units[idx] relevant fields."""
    return page.evaluate(f"""(()=>{{
      const u=Battle.units[{idx}];
      if(!u) return null;
      return {{n:u.n,team:u.team,h:u.h,mh:u.mh,d:u.d,r:u.r,s:u.s,x:u.x,y:u.y,
        poison:u.poison??0,poisonDmg:u.poisonDmg??0,slow:u.slow??0,stun:u.stun??0,
        shieldActive:u.shieldActive??0,regen:u.regen??0,regenAmt:u.regenAmt??0,
        moveSpeedMod:u.moveSpeedMod??100,ttl:u.ttl??0,deathT:u.deathT??null,
        _buffDmgApplied:u._buffDmgApplied??null,_buffSpeedApplied:u._buffSpeedApplied??0}};
      }})()""")

def all_states(page):
    return page.evaluate("""(()=>Battle.units.map((u,i)=>({
      i,n:u.n,team:u.team,h:u.h,mh:u.mh,d:u.d,s:u.s,x:u.x,y:u.y,
      poison:u.poison??0,poisonDmg:u.poisonDmg??0,slow:u.slow??0,stun:u.stun??0,
      shieldActive:u.shieldActive??0,regen:u.regen??0,regenAmt:u.regenAmt??0,
      moveSpeedMod:u.moveSpeedMod??100,ttl:u.ttl??0,deathT:u.deathT??null,
      _buffDmgApplied:u._buffDmgApplied??null})))()""")

def fire_spell(page, spec, team="player"):
    return page.evaluate(f"""(()=>{{try{{Battle.fireSpell({json.dumps(spec)},{json.dumps(team)});return{{ok:true}}}}catch(e){{return{{ok:false,err:String(e),stack:e&&e.stack}}}}}})()""")

# ---------------------------------------------------------------------------------------

def test_effect_damage(page):
    # 2 enemies close together, cast damage circle_aoe on enemy_cluster
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500},{"n":"E2","x":120,"y":110,"h":500}]
    r = run(page, start_battle_js(pu, eu))
    if not r.get("ok"): return record("effect.damage", False, f"start failed: {r}")
    e1h0 = unit_state(page,1)["h"]; e2h0 = unit_state(page,2)["h"]
    spec = {"name":"Dmg","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
            "shape":"circle_aoe","fxType":"explosion","magnitude":40,"radius":80}
    fr = fire_spell(page, spec, "player")
    if not fr.get("ok"): return record("effect.damage", False, f"fire error: {fr}")
    s = all_states(page)
    e1 = next(u for u in s if u["n"]=="E1"); e2 = next(u for u in s if u["n"]=="E2")
    p1 = next(u for u in s if u["n"]=="P1")
    ok = (e1["h"] == e1h0-40) and (e2["h"] == e2h0-40) and (p1["h"]==500)
    record("effect.damage", ok, f"E1 {e1h0}->{e1['h']}, E2 {e2h0}->{e2['h']}, P1 {p1['h']} (expect both -40, P1 unchanged)")

def test_effect_damage_over_time(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    spec = {"name":"DoT","trigger":"battle_start","target":"enemy_cluster","effect":"damage_over_time",
            "shape":"circle_aoe","fxType":"poison_cloud","magnitude":12,"radius":80,"duration":5}
    fire_spell(page, spec, "player")
    s = all_states(page); e1 = next(u for u in s if u["n"]=="E1")
    has_poison = e1["poison"]>0 and e1["poisonDmg"]==12
    # step a few seconds; poison ticks every 0.5s for poisonDmg
    h0 = e1["h"]
    step(page, 0.5, 4)  # 2 seconds => ~4 ticks
    s = all_states(page); e1 = next(u for u in s if u["n"]=="E1")
    # 4 ticks * 12 = 48 dmg
    ok = has_poison and e1["h"] == h0-48 and e1["poison"]>0
    record("effect.damage_over_time", ok, f"poison={e1['poison']} poisonDmg={e1['poisonDmg']} h {h0}->{e1['h']} (expect -48 after 4 ticks)")

def test_effect_heal_allies(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500},{"n":"P2","x":120,"y":460,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    # damage the players a bit first
    page.evaluate("Battle.units[0].h=100; Battle.units[1].h=80;")
    spec = {"name":"Heal","trigger":"battle_start","target":"ally_cluster","effect":"heal_allies",
            "shape":"circle_aoe","fxType":"heal_glow","magnitude":50,"radius":80}
    fire_spell(page, spec, "player")
    s = all_states(page)
    p1 = next(u for u in s if u["n"]=="P1"); p2 = next(u for u in s if u["n"]=="P2")
    e1 = next(u for u in s if u["n"]=="E1")
    ok = (p1["h"]==150) and (p2["h"]==130) and (e1["h"]==500)
    record("effect.heal_allies", ok, f"P1 100->{p1['h']}, P2 80->{p2['h']}, E1 {e1['h']} (expect 150,130,500)")

def test_effect_shield_allies(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    spec = {"name":"Shield","trigger":"battle_start","target":"ally_cluster","effect":"shield_allies",
            "shape":"circle_aoe","fxType":"shockwave","magnitude":20,"radius":80,"duration":3}
    fire_spell(page, spec, "player")
    s = all_states(page); p1 = next(u for u in s if u["n"]=="P1")
    ok = p1["shieldActive"]==3
    record("effect.shield_allies", ok, f"P1 shieldActive={p1['shieldActive']} (expect 3)")

def test_effect_slow(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    spec = {"name":"Slow","trigger":"battle_start","target":"enemy_cluster","effect":"slow",
            "shape":"circle_aoe","fxType":"frost","magnitude":20,"radius":80,"duration":4}
    fire_spell(page, spec, "player")
    s = all_states(page); e1 = next(u for u in s if u["n"]=="E1")
    ok = e1["slow"]==4
    record("effect.slow", ok, f"E1 slow={e1['slow']} (expect 4)")

def test_effect_stun(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    spec = {"name":"Stun","trigger":"battle_start","target":"enemy_cluster","effect":"stun",
            "shape":"circle_aoe","fxType":"lightning","magnitude":20,"radius":80,"duration":2}
    fire_spell(page, spec, "player")
    s = all_states(page); e1 = next(u for u in s if u["n"]=="E1")
    ok = e1["stun"]==2
    record("effect.stun", ok, f"E1 stun={e1['stun']} (expect 2)")

def test_effect_buff_speed(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500,"s":60}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    s0 = all_states(page); p1 = next(u for u in s0 if u["n"]=="P1")
    base = p1["s"]
    spec = {"name":"BuffSpd","trigger":"battle_start","target":"ally_cluster","effect":"buff_speed",
            "shape":"circle_aoe","fxType":"heal_glow","magnitude":30,"radius":80}
    fire_spell(page, spec, "player")
    s = all_states(page); p1 = next(u for u in s if u["n"]=="P1")
    # moveSpeedMod should be max(100, 100+30)=130
    ok = p1["moveSpeedMod"]==130
    record("effect.buff_speed", ok, f"P1 moveSpeedMod={p1['moveSpeedMod']} (expect 130, base speed {base})")

def test_effect_buff_dmg(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500,"d":20}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    s0 = all_states(page); p1 = next(u for u in s0 if u["n"]=="P1")
    baseD = page.evaluate("Battle.units[0].baseD")
    spec = {"name":"BuffDmg","trigger":"battle_start","target":"ally_cluster","effect":"buff_dmg",
            "shape":"circle_aoe","fxType":"heal_glow","magnitude":50,"radius":80}
    fire_spell(page, spec, "player")
    s = all_states(page); p1 = next(u for u in s if u["n"]=="P1")
    # _buffDmgApplied = 1+50/100=1.5 ; d = round(baseD*1.5)
    expect = round(baseD*1.5)
    ok = (p1["_buffDmgApplied"]==1.5) and (p1["d"]==expect)
    record("effect.buff_dmg", ok, f"P1 d={p1['d']} baseD={baseD} _buffDmgApplied={p1['_buffDmgApplied']} (expect d={expect},1.5)")

def test_effect_summon(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    n0 = page.evaluate("Battle.units.length")
    spec = {"name":"Summon","trigger":"battle_start","target":"ally_cluster","effect":"summon",
            "shape":"circle_aoe","fxType":"fire_wall","magnitude":50,"radius":80}
    fire_spell(page, spec, "player")
    n1 = page.evaluate("Battle.units.length")
    minions = page.evaluate("Battle.units.filter(u=>u.n==='Spell Minion' && u.team==='player').length")
    ok = (n1-n0)>=2 and minions>=2
    record("effect.summon", ok, f"units {n0}->{n1}, player minions={minions} (magnitude 50 => expect 3 minions)")

def test_effect_knockback(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":200,"y":200,"h":500},{"n":"E2","x":210,"y":210,"h":500}]
    run(page, start_battle_js(pu, eu))
    s0 = all_states(page)
    e1x0 = next(u for u in s0 if u["n"]=="E1")["x"]
    spec = {"name":"Knock","trigger":"battle_start","target":"enemy_cluster","effect":"knockback",
            "shape":"circle_aoe","fxType":"shockwave","magnitude":40,"radius":80}
    fire_spell(page, spec, "player")
    s = all_states(page); e1 = next(u for u in s if u["n"]=="E1")
    e2 = next(u for u in s if u["n"]=="E2")
    e2_0 = next(u for u in s0 if u["n"]=="E2")
    # anchor = affected[0] = E1 (center) => E1 no self-move; E2 pushed away from E1.
    e1_moved = abs(e1["x"]-e1x0)>1
    moved2 = abs(e2["x"]-e2_0["x"])>1 or abs(e2["y"]-e2_0["y"])>1
    ok = (not e1_moved) and moved2
    record("effect.knockback", ok, f"E1(anchor) x {e1x0}->{e1['x']} (expect no move), E2 moved={moved2} x {e2_0['x']}->{e2['x']} y {e2_0['y']}->{e2['y']}")

def test_effect_heal_over_time(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    page.evaluate("Battle.units[0].h=100;")
    spec = {"name":"HoT","trigger":"battle_start","target":"ally_cluster","effect":"heal_over_time",
            "shape":"circle_aoe","fxType":"heal_glow","magnitude":15,"radius":80,"duration":4}
    fire_spell(page, spec, "player")
    s = all_states(page); p1 = next(u for u in s if u["n"]=="P1")
    has_regen = p1["regen"]==4 and p1["regenAmt"]==15
    h0 = p1["h"]
    step(page, 0.5, 4)  # 2s => 4 regen ticks (every 0.5s) of 15 = +60
    s = all_states(page); p1 = next(u for u in s if u["n"]=="P1")
    # regen ticks every 0.5s healing min(regenAmt, mh-h); 100+60=160
    ok = has_regen and p1["h"]==160 and p1["regen"]>0
    record("effect.heal_over_time", ok, f"regen={p1['regen']} regenAmt={p1['regenAmt']} h {h0}->{p1['h']} (expect 160, regen set={has_regen})")

def test_nonexistent_effects(page):
    """Task lists freeze, cleanse, buff_shield, buff_damage. Check they don't exist in SPELL_EFFECT."""
    exists = page.evaluate("""(()=>({
      freeze: typeof SPELL_EFFECT!=='undefined' && !!SPELL_EFFECT.freeze,
      cleanse: typeof SPELL_EFFECT!=='undefined' && !!SPELL_EFFECT.cleanse,
      buff_shield: typeof SPELL_EFFECT!=='undefined' && !!SPELL_EFFECT.buff_shield,
      buff_damage: typeof SPELL_EFFECT!=='undefined' && !!SPELL_EFFECT.buff_damage,
      enum: typeof SPELL_ENUM!=='undefined' ? SPELL_ENUM.effect : null
    }))()""")
    # SPELL_EFFECT/SPELL_ENUM are module-scoped, not on window -> will be undefined here.
    # So check via firing: a spell with effect 'freeze' should silently no-op (no error, no effect).
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    h0 = unit_state(page,1)["h"]
    for eff in ["freeze","cleanse","buff_shield","buff_damage"]:
        spec = {"name":eff,"trigger":"battle_start","target":"enemy_cluster","effect":eff,
                "shape":"circle_aoe","fxType":"explosion","magnitude":40,"radius":80}
        fr = fire_spell(page, spec, "player")
        h1 = unit_state(page,1)["h"]
        noop = (h1==h0) and fr.get("ok")
        record(f"effect.{eff}_nonexistent_silent_noop", noop,
               f"fire ok={fr.get('ok')} E1 h {h0}->{h1} (expect no-op, no error). enum exposed={exists}")
        h0 = h1

def test_zone_persistence(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":200,"y":275,"h":500,"movement":"hold"}]  # at center, immobile
    run(page, start_battle_js(pu, eu))
    spec = {"name":"ZoneDoT","trigger":"battle_start","target":"center","effect":"damage_over_time",
            "shape":"persistent_zone","fxType":"poison_cloud","magnitude":10,"radius":80,"duration":3}
    fire_spell(page, spec, "player")
    zones = page.evaluate("Battle.zones.length")
    z0 = page.evaluate("Battle.zones[0]?{x:Battle.zones[0].x,y:Battle.zones[0].y,duration:Battle.zones[0].duration,maxDuration:Battle.zones[0].maxDuration,team:Battle.zones[0].team}:null")
    # step 1s -> first tick
    step(page, 1.0, 1)
    e1 = next(u for u in all_states(page) if u["n"]=="E1")
    poisoned_after_1s = e1["poison"]>0
    # step until expiry (3s total)
    step(page, 1.0, 3)
    zones_after = page.evaluate("Battle.zones.length")
    zinfo = page.evaluate("Battle.zones.map(z=>({duration:z.duration,fired:z.fired}))")
    ok = zones==1 and z0 and z0["team"]=="player" and poisoned_after_1s and zones_after==0
    record("zone.persistence_and_cleanup", ok,
           f"zones created={zones} z0={z0} poisoned_after_1s={poisoned_after_1s} zones_after_4s={zones_after} remaining={zinfo}")

def test_zone_tick_each_second(page):
    """Zone with effect damage (direct) should apply once per second."""
    pu = [{"n":"P1","x":100,"y":450,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":200,"y":275,"h":500,"movement":"hold"}]  # at center, immobile
    run(page, start_battle_js(pu, eu))
    spec = {"name":"ZoneDmg","trigger":"battle_start","target":"center","effect":"damage",
            "shape":"persistent_zone","fxType":"fire_wall","magnitude":20,"radius":80,"duration":3}
    fire_spell(page, spec, "player")
    h0 = unit_state(page,1)["h"]
    # step 1s at a time, check dmg applied each second
    damages = []
    prev = h0
    for i in range(3):
        step(page, 1.0, 1)
        h = unit_state(page,1)["h"]
        damages.append(prev-h)
        prev = h
    # each tick should be 20
    ok = all(d==20 for d in damages) and len(damages)==3
    record("zone.tick_each_second", ok, f"per-second damage deltas={damages} (expect [20,20,20])")

def test_zone_slow_effect(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":200,"y":275,"h":500,"movement":"hold"}]
    run(page, start_battle_js(pu, eu))
    spec = {"name":"ZoneSlow","trigger":"battle_start","target":"center","effect":"slow",
            "shape":"persistent_zone","fxType":"frost","magnitude":20,"radius":80,"duration":3}
    fire_spell(page, spec, "player")
    step(page, 1.0, 1)
    e1 = next(u for u in all_states(page) if u["n"]=="E1")
    ok = e1["slow"]>0
    record("zone.slow_effect", ok, f"E1 slow={e1['slow']} after 1s in slow zone (expect >0)")

def test_target_filtering(page):
    """For each target type, verify ally spells don't hit enemies & vice versa."""
    # Place P1 and E1 both near center so circle_aoe would hit both if unfiltered.
    pu = [{"n":"P1","x":195,"y":270,"h":500}]
    eu = [{"n":"E1","x":205,"y":280,"h":500}]
    results = []
    # enemy target + damage -> only enemy hit
    run(page, start_battle_js(pu, eu))
    p0=unit_state(page,0)["h"]; e0=unit_state(page,1)["h"]
    fire_spell(page, {"name":"D","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
                      "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80},"player")
    s=all_states(page); p=next(u for u in s if u["n"]=="P1"); e=next(u for u in s if u["n"]=="E1")
    enemy_only = (e["h"]==e0-30 and p["h"]==p0)
    results.append(("damage@enemy_cluster hits enemy only", enemy_only, f"P {p0}->{p['h']} E {e0}->{e['h']}"))

    # ally target + heal -> only ally healed (ally_cluster)
    run(page, start_battle_js(pu, eu))
    page.evaluate("Battle.units[0].h=200; Battle.units[1].h=200;")
    fire_spell(page, {"name":"H","trigger":"battle_start","target":"ally_cluster","effect":"heal_allies",
                      "shape":"circle_aoe","fxType":"heal_glow","magnitude":50,"radius":80},"player")
    s=all_states(page); p=next(u for u in s if u["n"]=="P1"); e=next(u for u in s if u["n"]=="E1")
    ally_only = (p["h"]==250 and e["h"]==200)
    results.append(("heal_allies@ally_cluster heals ally only", ally_only, f"P 200->{p['h']} E 200->{e['h']}"))

    # center target + damage -> only enemies (per filter: center defaults to enemies)
    run(page, start_battle_js(pu, eu))
    p0=unit_state(page,0)["h"]; e0=unit_state(page,1)["h"]
    fire_spell(page, {"name":"Dc","trigger":"battle_start","target":"center","effect":"damage",
                      "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80},"player")
    s=all_states(page); p=next(u for u in s if u["n"]=="P1"); e=next(u for u in s if u["n"]=="E1")
    center_enemy_only = (e["h"]==e0-30 and p["h"]==p0)
    results.append(("damage@center hits enemy only (P1 in radius untouched)", center_enemy_only, f"P {p0}->{p['h']} E {e0}->{e['h']}"))

    # BUG PROBE: center target + heal_allies -> filter defaults to ENEMIES => heals enemies!
    run(page, start_battle_js(pu, eu))
    page.evaluate("Battle.units[0].h=200; Battle.units[1].h=200;")
    fire_spell(page, {"name":"Hc","trigger":"battle_start","target":"center","effect":"heal_allies",
                      "shape":"circle_aoe","fxType":"heal_glow","magnitude":50,"radius":80},"player")
    s=all_states(page); p=next(u for u in s if u["n"]=="P1"); e=next(u for u in s if u["n"]=="E1")
    # Expected (correct): ally healed. Actual (bug?): enemy healed.
    center_heal_bug = (e["h"]==250 and p["h"]==200)
    results.append(("heal_allies@center — does it heal ENEMY instead of ally? (BUG)", center_heal_bug,
                    f"P 200->{p['h']} E 200->{e['h']} (if E->250 & P->200, heal hit enemy = BUG)"))

    for name,ok,ev in results:
        record(f"target.filter.{name}", ok, ev)

def test_manual_casting(page):
    """Click spell bar button; verify cooldown starts, countdown displays, re-enables at 0."""
    pu = [{"n":"P1","x":100,"y":450,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":100,"y":100,"h":500,"movement":"hold"}]
    spell = {"name":"ManualDmg","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
             "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80}
    run(page, start_battle_js(pu, eu, player_spells=[spell]))
    # spell bar should have 1 button
    page.evaluate("Battle._renderSpellBar()")
    btns = page.locator("#spellBar .spellBtn")
    count = btns.count()
    cd0 = page.evaluate("Battle.playerSpells[0].cooldown")
    disabled0 = btns.first.is_disabled()
    # Investigate overlap: the Forfeit button (top:70px,right:8px,z-index:100) was reported
    # to intercept the spell bar button. Capture bounding boxes.
    boxes = page.evaluate("""(()=>({
      spell: document.querySelector('#spellBar .spellBtn')?.getBoundingClientRect(),
      forfeit: document.querySelector('button.btn.red[onclick*=forfeitMatch]')?.getBoundingClientRect(),
      spellBar: document.getElementById('spellBar').getBoundingClientRect()
    }))()""")
    # click with force to bypass actionability/interception checks
    btns.first.click(force=True)
    cd1 = page.evaluate("Battle.playerSpells[0].cooldown")
    maxcd = page.evaluate("Battle.playerSpells[0].maxCD")
    page.evaluate("Battle._renderSpellBar()")
    disabled1 = page.locator("#spellBar .spellBtn").first.is_disabled()
    cd_overlay = page.locator("#spellBar .spellCD").count()
    # step until cooldown ~0
    steps_needed = int(maxcd/0.5)+2
    step(page, 0.5, steps_needed)
    page.evaluate("Battle._renderSpellBar()")
    cd2 = page.evaluate("Battle.playerSpells[0].cooldown")
    disabled2 = page.locator("#spellBar .spellBtn").first.is_disabled()
    ok = (count==1 and cd0==0 and not disabled0 and cd1>0 and disabled1 and cd_overlay>=1 and cd2==0 and not disabled2)
    record("manual.cast_cooldown_cycle", ok,
           f"buttons={count} cd0={cd0} dis0={disabled0} -> cd1={cd1} dis1={disabled1} overlay={cd_overlay} maxCD={maxcd} -> cd2={cd2} dis2={disabled2}")
    # Report the Forfeit/spell-bar overlap as a separate UI finding
    sb = boxes["spellBar"]; sp = boxes["spell"]; ff = boxes["forfeit"]
    overlap = False
    if sp and ff:
        overlap = not (sp["right"]<ff["left"] or sp["left"]>ff["right"] or sp["bottom"]<ff["top"] or sp["top"]>ff["bottom"])
    record("manual.spellbar_forfeit_overlap_ui", not overlap,
           f"spellBtn={sp} forfeitBtn={ff} spellBar={sb} overlap={overlap} (Forfeit intercepts spell bar clicks = UI BUG)" if overlap
           else f"spellBtn={sp} forfeitBtn={ff} no overlap (click works without force)")

def test_manual_cast_actually_fires(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    spell = {"name":"ManualDmg","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
             "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80}
    run(page, start_battle_js(pu, eu, player_spells=[spell]))
    e0 = unit_state(page,1)["h"]
    page.evaluate("Battle._castPlayerSpell(0)")
    e1 = unit_state(page,1)["h"]
    cd = page.evaluate("Battle.playerSpells[0].cooldown")
    ok = (e1==e0-30) and cd>0
    record("manual.cast_fires_effect", ok, f"E1 {e0}->{e1} (expect -30), cooldown set={cd>0}")

def test_manual_cooldown_via_api(page):
    """Verify cooldown logic works when invoked programmatically (separates logic from UI overlap bug)."""
    pu = [{"n":"P1","x":100,"y":450,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":100,"y":100,"h":500,"movement":"hold"}]
    spell = {"name":"ManualDmg","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
             "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80}
    run(page, start_battle_js(pu, eu, player_spells=[spell]))
    cd0 = page.evaluate("Battle.playerSpells[0].cooldown")
    maxcd = page.evaluate("Battle.playerSpells[0].maxCD")
    page.evaluate("Battle._castPlayerSpell(0)")
    cd1 = page.evaluate("Battle.playerSpells[0].cooldown")
    # step until cooldown reaches 0
    step(page, 0.5, int(maxcd/0.5)+2)
    cd2 = page.evaluate("Battle.playerSpells[0].cooldown")
    # can cast again
    page.evaluate("Battle._castPlayerSpell(0)")
    cd3 = page.evaluate("Battle.playerSpells[0].cooldown")
    ok = (cd0==0 and cd1==maxcd and cd2==0 and cd3==maxcd)
    record("manual.cooldown_cycle_via_api", ok,
           f"cd0={cd0} -> after cast cd1={cd1}(={maxcd}) -> after step cd2={cd2} -> recast cd3={cd3}")

def test_autofire_triggers(page):
    """Set spells with each trigger; verify Spell.checkTriggers fires them automatically."""
    triggers = [
        ("battle_start", 0.0),
        ("on_first_contact", None),  # need units close
        ("delayed_3s", 3.0),
        ("when_ally_hurt", None),
        ("periodic_5s", 5.0),
    ]
    for trig, t in triggers:
        pu = [{"n":"P1","x":100,"y":450,"h":500}]
        eu = [{"n":"E1","x":100,"y":100,"h":500}]
        spell = {"name":f"Auto_{trig}","trigger":trig,"target":"enemy_cluster","effect":"damage",
                 "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80}
        # for on_first_contact place units within 80px
        if trig=="on_first_contact":
            pu=[{"n":"P1","x":100,"y":200,"h":500}]
            eu=[{"n":"E1","x":100,"y":220,"h":500}]  # 20px apart
        if trig=="when_ally_hurt":
            # damage the ally at start so h<mh*0.5
            pass
        run(page, start_battle_js(pu, eu, player_spells=[spell], enemy_spells=[]))
        if trig=="when_ally_hurt":
            page.evaluate("Battle.units[0].h=100;")  # 100<250
        e0 = unit_state(page,1)["h"]
        # step a tiny dt first so battle_start (time<0.1) can fire, then larger steps
        step(page, 0.05, 1)
        if t is not None and t > 0.1:
            step(page, 0.5, int(t/0.5)+3)
        else:
            step(page, 0.5, 4)
        e1 = unit_state(page,1)["h"]
        fired = page.evaluate("Battle.spells[0].fired")
        ok = (e1 < e0)  # damage applied
        record(f"autofire.trigger.{trig}", ok,
               f"E1 {e0}->{e1} fired_flag={fired} (expect damage applied)")

def test_spell_bar_ui(page):
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    spells = [
        {"name":"Fireball","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
         "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80},
        {"name":"Frost","trigger":"battle_start","target":"enemy_cluster","effect":"slow",
         "shape":"circle_aoe","fxType":"frost","magnitude":20,"radius":80,"duration":3},
    ]
    run(page, start_battle_js(pu, eu, player_spells=spells))
    page.evaluate("Battle._renderSpellBar()")
    btns = page.locator("#spellBar .spellBtn")
    icons = page.locator("#spellBar .spellBtn .spellIcon")
    bar_display = page.evaluate("getComputedStyle(document.getElementById('spellBar')).display")
    names = page.evaluate("Array.from(document.querySelectorAll('#spellBar .spellBtn')).map(b=>b.textContent.trim())")
    titles = page.locator("#spellBar .spellBtn").evaluate_all("els=>els.map(e=>e.title)")
    ok = (btns.count()==2 and bar_display=="flex" and icons.count()==2 and len(titles)==2)
    record("spell_bar.ui.render", ok,
           f"buttons={btns.count()} display={bar_display} icons={icons.count()} names={names} titles={titles}")

def test_stacking_poison(page):
    """Cast damage_over_time twice on same enemy: magnitude 10 then 5 -> poisonDmg stays 10 (Math.max)."""
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    fire_spell(page, {"name":"P10","trigger":"battle_start","target":"enemy_cluster","effect":"damage_over_time",
                      "shape":"circle_aoe","fxType":"poison_cloud","magnitude":10,"radius":80,"duration":5},"player")
    pd1 = unit_state(page,1)["poisonDmg"]
    fire_spell(page, {"name":"P5","trigger":"battle_start","target":"enemy_cluster","effect":"damage_over_time",
                      "shape":"circle_aoe","fxType":"poison_cloud","magnitude":5,"radius":80,"duration":5},"player")
    pd2 = unit_state(page,1)["poisonDmg"]
    # now reverse order on a fresh enemy
    run(page, start_battle_js(pu, eu))
    fire_spell(page, {"name":"P5b","trigger":"battle_start","target":"enemy_cluster","effect":"damage_over_time",
                      "shape":"circle_aoe","fxType":"poison_cloud","magnitude":5,"radius":80,"duration":5},"player")
    pd3 = unit_state(page,1)["poisonDmg"]
    fire_spell(page, {"name":"P10b","trigger":"battle_start","target":"enemy_cluster","effect":"damage_over_time",
                      "shape":"circle_aoe","fxType":"poison_cloud","magnitude":10,"radius":80,"duration":5},"player")
    pd4 = unit_state(page,1)["poisonDmg"]
    ok = (pd1==10 and pd2==10 and pd3==5 and pd4==10)
    record("stacking.poisonDmg_uses_max", ok,
           f"10->10={pd2}, 5->10={pd2} | 5={pd3} then 10={pd4} (expect max retained: 10,10,5,10)")

def test_edge_no_valid_targets(page):
    """Cast spell when all enemies dead."""
    pu = [{"n":"P1","x":100,"y":450,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    page.evaluate("Battle.units[1].h=0; Battle.units[1].deathT=0;")  # kill enemy
    h0 = unit_state(page,0)["h"]
    fr = fire_spell(page, {"name":"D","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
                           "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80},"player")
    p1 = unit_state(page,0)["h"]
    ok = fr.get("ok") and p1==h0  # no error, no self-damage
    record("edge.no_valid_targets_all_enemies_dead", ok, f"fire ok={fr.get('ok')} P1 {h0}->{p1} (expect no-op, no error)")

def test_edge_spell_on_dead_units(page):
    """Cast heal on dead ally — should not revive / should be filtered (h>0 filter)."""
    pu = [{"n":"P1","x":100,"y":450,"h":500},{"n":"P2","x":120,"y":460,"h":500}]
    eu = [{"n":"E1","x":100,"y":100,"h":500}]
    run(page, start_battle_js(pu, eu))
    page.evaluate("Battle.units[0].h=0; Battle.units[0].deathT=0;")  # kill P1
    page.evaluate("Battle.units[1].h=400;")  # damage living ally so heal is visible
    fire_spell(page, {"name":"H","trigger":"battle_start","target":"ally_cluster","effect":"heal_allies",
                      "shape":"circle_aoe","fxType":"heal_glow","magnitude":50,"radius":80},"player")
    p1 = unit_state(page,0)["h"]
    p2 = unit_state(page,1)["h"]
    ok = (p1==0) and (p2==450)  # dead stays dead, living ally healed 400->450 (capped at mh=500)
    record("edge.spell_on_dead_unit_filtered", ok, f"dead P1 h={p1} (expect 0), living P2 h={p2} (expect 450)")

def test_edge_empty_battle(page):
    """Cast spell with no units at all."""
    run(page, start_battle_js([], []))
    fr = fire_spell(page, {"name":"D","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
                           "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80},"player")
    ok = fr.get("ok")
    record("edge.empty_battle_no_error", ok, f"fire ok={fr.get('ok')} err={fr.get('err')}")

def test_quests_track_fragility(page):
    """If G.save.quests is undefined (e.g. save not yet loaded / incomplete migration),
    Quests.track (called at end of Spell.fire) throws and breaks ALL spell casting."""
    pu = [{"n":"P1","x":100,"y":450,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":100,"y":100,"h":500,"movement":"hold"}]
    run(page, start_battle_js(pu, eu))
    # simulate missing quests (race with async save load / incomplete migration)
    page.evaluate("G.save.__questsBackup=G.save.quests; G.save.quests=undefined;")
    fr = fire_spell(page, {"name":"D","trigger":"battle_start","target":"enemy_cluster","effect":"damage",
                           "shape":"circle_aoe","fxType":"explosion","magnitude":30,"radius":80},"player")
    # restore
    page.evaluate("G.save.quests=G.save.__questsBackup; delete G.save.__questsBackup;")
    ok = fr.get("ok")  # expect FAIL: throws TypeError reading 'list'
    record("quests.track_undefined_breaks_spell_fire", ok,
           f"fire with G.save.quests=undefined -> ok={fr.get('ok')} err={fr.get('err')!r} "
           f"(if err mentions 'list', Spell.fire crashes entirely = BUG)")

def test_zone_ally_target_filtering(page):
    """A persistent_zone with ally target should affect allies, not enemies."""
    # units immobile & outside each other's attack range, both inside zone radius
    pu = [{"n":"P1","x":160,"y":275,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":240,"y":275,"h":500,"movement":"hold"}]
    run(page, start_battle_js(pu, eu))
    page.evaluate("Battle.units[0].h=200; Battle.units[1].h=200;")
    spec = {"name":"ZoneHeal","trigger":"battle_start","target":"ally_cluster","effect":"heal_allies",
            "shape":"persistent_zone","fxType":"heal_glow","magnitude":20,"radius":80,"duration":3}
    fire_spell(page, spec, "player")
    zteam = page.evaluate("Battle.zones[0]?.team")
    step(page, 1.0, 1)
    s = all_states(page); p=next(u for u in s if u["n"]=="P1"); e=next(u for u in s if u["n"]=="E1")
    ok = (zteam=="player" and p["h"]==220 and e["h"]==200)
    record("zone.ally_target_filters_to_allies", ok, f"zone.team={zteam} P 200->{p['h']} E 200->{e['h']} (expect P->220, E->200)")

def test_zone_enemy_target_filtering(page):
    pu = [{"n":"P1","x":160,"y":275,"h":500,"movement":"hold"}]
    eu = [{"n":"E1","x":240,"y":275,"h":500,"movement":"hold"}]
    run(page, start_battle_js(pu, eu))
    spec = {"name":"ZoneDmg","trigger":"battle_start","target":"center","effect":"damage",
            "shape":"persistent_zone","fxType":"fire_wall","magnitude":20,"radius":80,"duration":3}
    fire_spell(page, spec, "player")
    step(page, 1.0, 1)
    s = all_states(page); p=next(u for u in s if u["n"]=="P1"); e=next(u for u in s if u["n"]=="E1")
    ok = (e["h"]==500-20 and p["h"]==500)
    record("zone.center_target_filters_to_enemies", ok, f"P {p['h']} E {e['h']} (expect P=500, E=480)")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width":420,"height":800})
        page = ctx.new_page()
        page.on("console", lambda msg: ERRORS.append(f"console.{msg.type}: {msg.text}") if msg.type in ("error","warning") else None)
        page.on("pageerror", lambda exc: ERRORS.append(f"pageerror: {exc}"))

        page.goto(URL, wait_until="domcontentloaded")
        # wait for module to expose globals (init is async-ish; give it time)
        page.wait_for_timeout(3000)
        page.wait_for_function("() => !!(window.G && window.Battle)", timeout=15000)
        # Wait until the save is fully loaded (async IDB path) so Quests.track
        # (called by Spell.fire) doesn't crash on undefined G.save.quests.
        try:
            page.wait_for_function("() => !!(window.G && G.save && G.save.quests && G.save.quests.list)",
                                   timeout=8000)
        except Exception:
            # Save quests not initialized — record as a bug, then patch so tests can run.
            record("quests.save_quests_undefined_breaks_spells", False,
                   "G.save.quests not initialized after load -> Quests.track throws inside Spell.fire")
            page.evaluate("if(G&&!G.save.quests)G.save.quests={list:[],date:'',streak:{count:0}};")
        # GameAudio is module-scoped (not on window); its sfx() is a no-op while
        # AudioContext is null (no user gesture), so no need to disable.

        tests = [
            test_effect_damage,
            test_effect_damage_over_time,
            test_effect_heal_allies,
            test_effect_shield_allies,
            test_effect_slow,
            test_effect_stun,
            test_effect_buff_speed,
            test_effect_buff_dmg,
            test_effect_summon,
            test_effect_knockback,
            test_effect_heal_over_time,
            test_nonexistent_effects,
            test_zone_persistence,
            test_zone_tick_each_second,
            test_zone_slow_effect,
            test_zone_ally_target_filtering,
            test_zone_enemy_target_filtering,
            test_target_filtering,
            test_manual_casting,
            test_manual_cast_actually_fires,
            test_manual_cooldown_via_api,
            test_autofire_triggers,
            test_spell_bar_ui,
            test_stacking_poison,
            test_edge_no_valid_targets,
            test_edge_spell_on_dead_units,
            test_edge_empty_battle,
            test_quests_track_fragility,
        ]
        for t in tests:
            try:
                t(page)
            except Exception as e:
                record(t.__name__, False, f"EXCEPTION: {e}\n{traceback.format_exc()}")

        browser.close()

    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    passed = sum(1 for s,_,_ in RESULTS if s=="PASS")
    failed = sum(1 for s,_,_ in RESULTS if s=="FAIL")
    print(f"PASS: {passed}  FAIL: {failed}  TOTAL: {len(RESULTS)}")
    if ERRORS:
        print(f"\nCONSOLE ERRORS/WARNINGS ({len(ERRORS)}):")
        for e in ERRORS:
            print(f"  - {e}")
    else:
        print("\nNo console errors/warnings captured.")
    print("="*70)

if __name__ == "__main__":
    main()

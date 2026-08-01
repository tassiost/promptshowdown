#!/usr/bin/env python3
"""Lightweight performance profiler — measures only loop-level timings."""
import sys, time, json
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(viewport={"width":390,"height":844})
        page=context.new_page()
        page.goto("http://localhost:8765/index.html",wait_until="domcontentloaded")
        for _ in range(150):
            if page.evaluate("typeof G!=='undefined' && G._initialized===true"):break
            time.sleep(0.1)

        # Lightweight instrumentation — only wrap loop, update, render
        page.evaluate("""() => {
            window._perf = { enabled: false, frames: 0, frameTimes: [], updateTimes: [], renderTimes: [] };
            const P = window._perf;
            const origLoop = Battle.loop;
            Battle.loop = function(time) {
                if (P.enabled) {
                    P.frames++;
                    if (P.lastFrame) { const ft = time - P.lastFrame; if (ft < 1000) P.frameTimes.push(ft); }
                    P.lastFrame = time;
                }
                origLoop.call(this, time);
            };
            const origUpdate = Battle.update;
            Battle.update = function(dt) {
                if (!P.enabled) { origUpdate.call(this, dt); return; }
                const t0 = performance.now();
                origUpdate.call(this, dt);
                P.updateTimes.push(performance.now() - t0);
            };
            const origRender = Battle.render;
            Battle.render = function() {
                if (!P.enabled) { origRender.call(this); return; }
                const t0 = performance.now();
                origRender.call(this);
                P.renderTimes.push(performance.now() - t0);
            };
        }""")

        def run_scenario(name, setup_code, duration=5000):
            js = """() => {
                window._perf.enabled = true;
                window._perf.frames = 0;
                window._perf.frameTimes = [];
                window._perf.updateTimes = [];
                window._perf.renderTimes = [];
                window._perf.lastFrame = 0;
                """ + setup_code + """
            }"""
            page.evaluate(js)
            page.wait_for_timeout(duration)
            return page.evaluate("""() => {
                const P = window._perf;
                const stats = (arr) => {
                    if (!arr.length) return {avg:0, p50:0, p95:0, p99:0, max:0};
                    const s = [...arr].sort((a,b)=>a-b);
                    return {
                        avg: arr.reduce((s,v)=>s+v,0)/arr.length,
                        p50: s[Math.floor(s.length*0.5)],
                        p95: s[Math.floor(s.length*0.95)],
                        p99: s[Math.floor(s.length*0.99)],
                        max: s[s.length-1],
                    };
                };
                const fps = P.frameTimes.length > 0 ? 1000 / (P.frameTimes.reduce((s,v)=>s+v,0)/P.frameTimes.length) : 0;
                return { frames: P.frames, fps, frameTime: stats(P.frameTimes), updateTime: stats(P.updateTimes), renderTime: stats(P.renderTimes), units: Battle.units.length, time: Battle.time };
            }""")

        def print_result(name, r):
            print(f"\n=== {name} ===")
            print(f"  Frames: {r['frames']} | Time: {r['time']:.1f}s | Units: {r['units']}")
            print(f"  FPS: {r['fps']:.1f}")
            print(f"  Frame: avg={r['frameTime']['avg']:.3f}ms p50={r['frameTime']['p50']:.3f} p95={r['frameTime']['p95']:.3f} p99={r['frameTime']['p99']:.3f} max={r['frameTime']['max']:.3f}ms")
            print(f"  Update: avg={r['updateTime']['avg']:.3f}ms p50={r['updateTime']['p50']:.3f} p95={r['updateTime']['p95']:.3f} p99={r['updateTime']['p99']:.3f} max={r['updateTime']['max']:.3f}ms")
            print(f"  Render: avg={r['renderTime']['avg']:.3f}ms p50={r['renderTime']['p50']:.3f} p95={r['renderTime']['p95']:.3f} p99={r['renderTime']['p99']:.3f} max={r['renderTime']['max']:.3f}ms")

        setup_2v2 = """
            const u1=unit({n:'A',h:99999,d:1,r:50,s:60,a:1,ability:'heal',abilityTrigger:'on_cooldown',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100});
            const u2=unit({n:'B',h:99999,d:1,r:50,s:60,a:1,ability:'none',abilityTrigger:'never',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100});
            u1.team='player';u2.team='enemy';u1.x=100;u1.y=300;u2.x=300;u2.y=300;
            Battle.units=[Battle.initRuntime(u1),Battle.initRuntime(u2)];Battle._allUnits=[...Battle.units];
            Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
            Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;Battle.onEnd=null;
            Battle.checkEnd=function(){};Battle.running=true;Battle.last=performance.now();
            cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
        """
        setup_20v20 = """
            const units=[];const abs=['heal','spawn','explode','poison','ramp','rage','lifesteal','thorns','regen','counter','dodge','splash','slow','shield','blink_strike','frenzy','cleanse','chain_lightning','taunt','executioner'];
            for(let i=0;i<20;i++){
                const u=unit({n:'U'+i,h:99999,d:1,r:50+(i%3)*50,s:60,a:1,ability:abs[i%abs.length],abilityTrigger:'on_cooldown',targeting:'closest',movement:'chase',attackCondition:'always',role:i%2?'carry':'frontline',moveSpeedMod:100});
                u.team=i<10?'player':'enemy';u.x=u.team==='player'?50+(i%10)*15:350-(i%10)*15;u.y=100+(i%10)*40;
                units.push(Battle.initRuntime(u));
            }
            Battle.units=units;Battle._allUnits=[...units];
            Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
            Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;Battle.onEnd=null;
            Battle.checkEnd=function(){};Battle.running=true;Battle.last=performance.now();
            cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
        """
        setup_50v50_ranged = """
            const units=[];
            for(let i=0;i<100;i++){
                const u=unit({n:'U'+i,h:99999,d:1,r:100,s:60,a:1,ability:'poison',abilityTrigger:'on_cooldown',targeting:'closest',movement:'chase',attackCondition:'always',role:'carry',moveSpeedMod:100,weaponType:'bow'});
                u.team=i<50?'player':'enemy';u.x=u.team==='player'?30+(i%50)*7:370-(i%50)*7;u.y=50+(i%25)*20;
                units.push(Battle.initRuntime(u));
            }
            Battle.units=units;Battle._allUnits=[...units];
            Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
            Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;Battle.onEnd=null;
            Battle.checkEnd=function(){};Battle.running=true;Battle.last=performance.now();
            cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
        """
        setup_50v50_melee = """
            const units=[];
            for(let i=0;i<100;i++){
                const u=unit({n:'U'+i,h:99999,d:1,r:50,s:60,a:1,ability:'splash',abilityTrigger:'on_cooldown',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100});
                u.team=i<50?'player':'enemy';u.x=u.team==='player'?50+(i%10)*5:350-(i%10)*5;u.y=200+(i%10)*15;
                units.push(Battle.initRuntime(u));
            }
            Battle.units=units;Battle._allUnits=[...units];
            Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
            Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;Battle.onEnd=null;
            Battle.checkEnd=function(){};Battle.running=true;Battle.last=performance.now();
            cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
        """

        print("=== AFTER OPTIMIZATION (lightweight profiler) ===")
        r1 = run_scenario("Light 2v2", setup_2v2)
        print_result("Light 2v2", r1)
        r2 = run_scenario("Heavy 20v20", setup_20v20)
        print_result("Heavy 20v20", r2)
        r3 = run_scenario("Stress 50v50 (ranged)", setup_50v50_ranged)
        print_result("Stress 50v50 (ranged)", r3)
        r4 = run_scenario("Stress 50v50 (melee cluster)", setup_50v50_melee)
        print_result("Stress 50v50 (melee cluster)", r4)

        # Memory
        mem = page.evaluate("""() => ({
            used: (performance.memory?.usedJSHeapSize||0)/1024/1024,
            total: (performance.memory?.totalJSHeapSize||0)/1024/1024,
            units: Battle.units.length,
            projectiles: (Battle.projectiles||[]).length,
            particles: (Battle.particles||[]).length,
            damageNums: (Battle.damageNums||[]).length,
        })""")
        print(f"\n=== MEMORY ===")
        print(f"  Heap: {mem['used']:.1f}MB / {mem['total']:.1f}MB")
        print(f"  Objects: units={mem['units']} proj={mem['projectiles']} particles={mem['particles']} dmg={mem['damageNums']}")

        results = {"light_2v2": r1, "heavy_20v20": r2, "stress_50v50_ranged": r3, "stress_50v50_melee": r4, "memory": mem}
        with open("/Users/tassio/Downloads/promptshowdown/perf_after.json", "w") as f:
            json.dump(results, f, indent=2)
        print("\nResults saved to perf_after.json")

        browser.close()

if __name__ == "__main__":
    run()

#!/usr/bin/env python3
"""Performance profiler for Prompt Showdown — R11."""
import sys, time, json, statistics
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

        # Install instrumentation
        page.evaluate("""() => {
            window._perf = { enabled: false, frames: 0, updateTimes: [], renderTimes: [], frameTimes: [], loopTimes: [], hotspots: {}, gcCount: 0 };
            const P = window._perf;

            // Wrap loop
            const origLoop = Battle.loop;
            Battle.loop = function(time) {
                if (P.enabled) {
                    P.frames++;
                    if (P.lastFrame) { const ft = time - P.lastFrame; if (ft < 1000) P.frameTimes.push(ft); }
                    P.lastFrame = time;
                    const t0 = performance.now();
                    origLoop.call(this, time);
                    P.loopTimes.push(performance.now() - t0);
                } else { origLoop.call(this, time); }
            };

            // Wrap update
            const origUpdate = Battle.update;
            Battle.update = function(dt) {
                if (!P.enabled) { origUpdate.call(this, dt); return; }
                const t0 = performance.now();
                origUpdate.call(this, dt);
                P.updateTimes.push(performance.now() - t0);
            };

            // Wrap render
            const origRender = Battle.render;
            Battle.render = function() {
                if (!P.enabled) { origRender.call(this); return; }
                const t0 = performance.now();
                origRender.call(this);
                P.renderTimes.push(performance.now() - t0);
            };

            // Wrap hotspots
            function wrap(obj, name, key) {
                const orig = obj[name];
                obj[name] = function() {
                    if (!P.enabled) return orig.apply(this, arguments);
                    const t0 = performance.now();
                    const r = orig.apply(this, arguments);
                    const dt = performance.now() - t0;
                    if (!P.hotspots[key]) P.hotspots[key] = {count:0, time:0};
                    P.hotspots[key].count++;
                    P.hotspots[key].time += dt;
                    return r;
                };
            }
            wrap(Battle, 'act', 'act');
            wrap(Battle, 'separate', 'separate');
            wrap(Battle, 'updateProjectiles', 'projectiles');
            wrap(Battle, 'drawBackground', 'drawBackground');
            wrap(Battle, '_applyArenaMechanics', 'arenaMech');
            wrap(Battle, 'takeDamage', 'takeDamage');
            wrap(Battle, 'initRuntime', 'initRuntime');
            wrap(SpriteRenderer, 'draw', 'spriteDraw');
            wrap(SpriteRenderer, '_drawShapeRaw', 'drawShapeRaw');
            wrap(Spell, 'tickZones', 'tickZones');
            wrap(Spell, 'checkTriggers', 'checkTriggers');

            // GC tracking
            if (window.PerformanceObserver) {
                try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.entryType==='gc') P.gcCount++; }).observe({entryTypes:['gc']}); } catch(e){}
            }
        }""")

        def run_scenario(name, setup_code, duration=5000):
            js = """() => {
                window._perf.enabled = true;
                window._perf.frames = 0;
                window._perf.updateTimes = [];
                window._perf.renderTimes = [];
                window._perf.frameTimes = [];
                window._perf.loopTimes = [];
                window._perf.hotspots = {};
                window._perf.lastFrame = 0;
                """ + setup_code + """
            }"""
            page.evaluate(js)
            page.wait_for_timeout(duration)
            return page.evaluate("""() => {
                const P = window._perf;
                const stats = (arr) => {
                    if (!arr.length) return {avg:0, p50:0, p95:0, p99:0, max:0, count:0};
                    const s = [...arr].sort((a,b)=>a-b);
                    return {
                        avg: arr.reduce((s,v)=>s+v,0)/arr.length,
                        p50: s[Math.floor(s.length*0.5)],
                        p95: s[Math.floor(s.length*0.95)],
                        p99: s[Math.floor(s.length*0.99)],
                        max: s[s.length-1],
                        count: arr.length,
                    };
                };
                const fps = P.frameTimes.length > 0 ? 1000 / (P.frameTimes.reduce((s,v)=>s+v,0)/P.frameTimes.length) : 0;
                const hotspots = {};
                for (const [k,v] of Object.entries(P.hotspots)) {
                    hotspots[k] = {count: v.count, total: v.time, avg: v.count>0?v.time/v.count:0};
                }
                return {
                    frames: P.frames,
                    fps: fps,
                    frameTime: stats(P.frameTimes),
                    loopTime: stats(P.loopTimes),
                    updateTime: stats(P.updateTimes),
                    renderTime: stats(P.renderTimes),
                    hotspots: hotspots,
                    units: Battle.units.length,
                    time: Battle.time,
                };
            }""")

        def print_result(name, r):
            print(f"\n=== {name} ===")
            print(f"  Frames: {r['frames']} | Time: {r['time']:.1f}s | Units: {r['units']}")
            print(f"  FPS: {r['fps']:.1f}")
            print(f"  Frame: avg={r['frameTime']['avg']:.2f}ms p50={r['frameTime']['p50']:.2f} p95={r['frameTime']['p95']:.2f} p99={r['frameTime']['p99']:.2f} max={r['frameTime']['max']:.2f}ms")
            print(f"  Loop:  avg={r['loopTime']['avg']:.2f}ms p95={r['loopTime']['p95']:.2f} p99={r['loopTime']['p99']:.2f}ms")
            print(f"  Update: avg={r['updateTime']['avg']:.2f}ms p95={r['updateTime']['p95']:.2f} p99={r['updateTime']['p99']:.2f}ms")
            print(f"  Render: avg={r['renderTime']['avg']:.2f}ms p95={r['renderTime']['p95']:.2f} p99={r['renderTime']['p99']:.2f}ms")
            print(f"  Hotspots:")
            for k, v in sorted(r['hotspots'].items(), key=lambda x: -x[1]['total']):
                print(f"    {k}: count={v['count']} total={v['total']:.2f}ms avg={v['avg']:.4f}ms")

        # SCENARIO 1: Light (2v2)
        r1 = run_scenario("Light 2v2", """
            const u1=unit({n:'A',h:99999,d:1,r:50,s:60,a:1,ability:'heal',abilityTrigger:'on_cooldown',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100});
            const u2=unit({n:'B',h:99999,d:1,r:50,s:60,a:1,ability:'none',abilityTrigger:'never',targeting:'closest',movement:'chase',attackCondition:'always',role:'frontline',moveSpeedMod:100});
            u1.team='player';u2.team='enemy';u1.x=100;u1.y=300;u2.x=300;u2.y=300;
            Battle.units=[Battle.initRuntime(u1),Battle.initRuntime(u2)];Battle._allUnits=[...Battle.units];
            Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
            Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;Battle.onEnd=null;
            Battle.checkEnd=function(){};Battle.running=true;Battle.last=performance.now();
            cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
        """)
        print_result("SCENARIO 1: Light 2v2", r1)

        # SCENARIO 2: Heavy (20v20)
        r2 = run_scenario("Heavy 20v20", """
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
        """)
        print_result("SCENARIO 2: Heavy 20v20", r2)

        # SCENARIO 3: Stress (50v50 ranged)
        r3 = run_scenario("Stress 50v50 (ranged)", """
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
        """)
        print_result("SCENARIO 3: Stress 50v50 (ranged)", r3)

        # SCENARIO 4: Stress (50v50 melee, tight cluster)
        r4 = run_scenario("Stress 50v50 (melee cluster)", """
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
        """)
        print_result("SCENARIO 4: Stress 50v50 (melee cluster)", r4)

        # Memory
        print("\n=== MEMORY ===")
        mem = page.evaluate("""() => ({
            used: (performance.memory?.usedJSHeapSize||0)/1024/1024,
            total: (performance.memory?.totalJSHeapSize||0)/1024/1024,
            limit: (performance.memory?.jsHeapSizeLimit||0)/1024/1024,
            units: Battle.units.length,
            projectiles: (Battle.projectiles||[]).length,
            particles: (Battle.particles||[]).length,
            damageNums: (Battle.damageNums||[]).length,
            zones: (Battle.zones||[]).length,
            gc: window._perf.gcCount,
        })""")
        print(f"  Heap: {mem['used']:.1f}MB / {mem['total']:.1f}MB (limit {mem['limit']:.0f}MB)")
        print(f"  Objects: units={mem['units']} proj={mem['projectiles']} particles={mem['particles']} dmg={mem['damageNums']} zones={mem['zones']}")
        print(f"  GC events: {mem['gc']}")

        # Save
        results = {"light_2v2": r1, "heavy_20v20": r2, "stress_50v50_ranged": r3, "stress_50v50_melee": r4, "memory": mem}
        with open("/Users/tassio/Downloads/promptshowdown/perf_baseline.json", "w") as f:
            json.dump(results, f, indent=2)
        print("\nBaseline saved to perf_baseline.json")

        browser.close()

if __name__ == "__main__":
    run()

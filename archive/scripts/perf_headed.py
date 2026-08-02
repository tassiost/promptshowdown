#!/usr/bin/env python3
"""Headed browser profiler — measures real render times including GPU."""
import sys, time, json
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=False)
        context=browser.new_context(viewport={"width":390,"height":844})
        page=context.new_page()
        page.goto("http://localhost:8765/index.html",wait_until="domcontentloaded")
        for _ in range(150):
            if page.evaluate("typeof G!=='undefined' && G._initialized===true"):break
            time.sleep(0.1)

        # Instrument loop, update, render, and sub-render functions
        page.evaluate("""() => {
            window._perf = { enabled: false, frames: 0, frameTimes: [], updateTimes: [], renderTimes: [], renderSub: {} };
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
            // Sub-render profiling
            function wrapSub(obj, name, key) {
                const orig = obj[name];
                obj[name] = function() {
                    if (!P.enabled) return orig.apply(this, arguments);
                    const t0 = performance.now();
                    const r = orig.apply(this, arguments);
                    const dt = performance.now() - t0;
                    if (!P.renderSub[key]) P.renderSub[key] = {count:0, time:0};
                    P.renderSub[key].count++;
                    P.renderSub[key].time += dt;
                    return r;
                };
            }
            if (window.SpriteRenderer) {
                wrapSub(SpriteRenderer, 'draw', 'spriteDraw');
                wrapSub(SpriteRenderer, '_drawShapeRaw', 'drawShapeRaw');
                wrapSub(SpriteRenderer, '_applyJoint', 'applyJoint');
            }
            wrapSub(Battle, 'drawBackground', 'drawBackground');
            wrapSub(Battle, 'drawUnits', 'drawUnits');
            wrapSub(Battle, 'drawProjectiles', 'drawProjectiles');
            wrapSub(Battle, 'drawParticles', 'drawParticles');
            wrapSub(Battle, 'drawDamageNums', 'drawDamageNums');
            wrapSub(Battle, 'drawZones', 'drawZones');
            if (window.BattleFX) wrapSub(BattleFX, 'update', 'battleFXUpdate');
            if (window.BattleFX) wrapSub(BattleFX, 'draw', 'battleFXDraw');
        }""")

        def run_scenario(name, setup_code, duration=8000):
            js = """() => {
                window._perf.enabled = true;
                window._perf.frames = 0;
                window._perf.frameTimes = [];
                window._perf.updateTimes = [];
                window._perf.renderTimes = [];
                window._perf.renderSub = {};
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
                const sub = {};
                for (const [k,v] of Object.entries(P.renderSub)) {
                    sub[k] = {count: v.count, total: v.time.toFixed(2), avg: (v.count>0?v.time/v.count:0).toFixed(4)};
                }
                return { frames: P.frames, fps, frameTime: stats(P.frameTimes), updateTime: stats(P.updateTimes), renderTime: stats(P.renderTimes), sub, units: Battle.units.length, time: Battle.time };
            }""")

        def print_result(name, r):
            print(f"\n=== {name} ===")
            print(f"  Frames: {r['frames']} | Time: {r['time']:.1f}s | Units: {r['units']}")
            print(f"  FPS: {r['fps']:.1f}")
            ft=r['frameTime']; ut=r['updateTime']; rt=r['renderTime']
            print(f"  Frame:  avg={ft['avg']:.2f}ms p50={ft['p50']:.2f} p95={ft['p95']:.2f} p99={ft['p99']:.2f} max={ft['max']:.2f}ms")
            print(f"  Update: avg={ut['avg']:.2f}ms p50={ut['p50']:.2f} p95={ut['p95']:.2f} p99={ut['p99']:.2f} max={ut['max']:.2f}ms")
            print(f"  Render: avg={rt['avg']:.2f}ms p50={rt['p50']:.2f} p95={rt['p95']:.2f} p99={rt['p99']:.2f} max={rt['max']:.2f}ms")
            print(f"  Render sub-functions:")
            for k, v in sorted(r['sub'].items(), key=lambda x: -float(x[1]['total'])):
                print(f"    {k}: count={v['count']} total={v['total']}ms avg={v['avg']}ms")

        # 20v20 with diverse abilities (realistic)
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

        print("=== HEADED BROWSER PROFILE ===")
        r = run_scenario("20v20 realistic", setup_20v20)
        print_result("20v20 realistic", r)

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

        with open("/Users/tassio/Downloads/promptshowdown/perf_headed_20v20.json", "w") as f:
            json.dump({"scenario": r, "memory": mem}, f, indent=2)
        print("\nSaved to perf_headed_20v20.json")

        browser.close()

if __name__ == "__main__":
    run()

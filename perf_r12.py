#!/usr/bin/env python3
"""PERF-R12: Comprehensive profiler separating CPU vs GPU timings + memory.
Scenarios: empty, 5v5, 20v20, 50v50, multiplayer-guest.
"""
import json, os, sys, time, statistics
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
DURATION = 10  # seconds per scenario

# Instrumentation injected into the page. Wraps Battle.update and Battle.render
# with performance.now() timers. Also tracks frame intervals via rAF timestamps.
INSTRUMENT = r"""
window._perf = {
    enabled: false,
    frames: 0,
    frameTimes: [],      // total frame interval (rAF to rAF)
    updateTimes: [],     // CPU: update() duration
    renderTimes: [],     // CPU: render() duration
    cpuTimes: [],        // CPU: update + render
    gpuEst: [],          // GPU estimate: frameInterval - cpuTime
    slowFrames: 0,
    lastRAF: 0,
    heapSamples: [],
    objCounts: [],
    subFunc: {},
    rafTimes: [],
};

(function() {
    const _p = window._perf;
    // Wrap Battle.update
    const _update = Battle.update.bind(Battle);
    Battle.update = function(dt) {
        const t0 = performance.now();
        const r = _update(dt);
        _p.updateTimes.push(performance.now() - t0);
        return r;
    };
    // Wrap Battle.render
    const _render = Battle.render.bind(Battle);
    Battle.render = function() {
        const t0 = performance.now();
        const r = _render();
        _p.renderTimes.push(performance.now() - t0);
        return r;
    };
    // Wrap sub-functions
    function wrapSub(obj, name, key) {
        if (!obj[name]) return;
        const orig = obj[name].bind(obj);
        obj[name] = function() {
            const t0 = performance.now();
            const r = orig.apply(this, arguments);
            const dt = performance.now() - t0;
            if (_p.enabled) {
                if (!_p.subFunc[key]) _p.subFunc[key] = {count: 0, total: 0};
                _p.subFunc[key].count++;
                _p.subFunc[key].total += dt;
            }
            return r;
        };
    }
    wrapSub(SpriteRenderer, 'draw', 'spriteDraw');
    wrapSub(SpriteRenderer, '_drawShapeRaw', 'drawShapeRaw');
    wrapSub(SpriteRenderer, 'drawFace', 'drawFace');
    wrapSub(Battle, 'drawBackground', 'drawBackground');
    wrapSub(Battle, 'drawDmgNums', 'drawDmgNums');
    if (typeof BattleFX !== 'undefined') wrapSub(BattleFX, 'drawParticles', 'drawParticles');
    wrapSub(Battle, 'updateProjectiles', 'updateProjectiles');
    wrapSub(Battle, 'separate', 'separate');
    wrapSub(Battle, 'act', 'act');
})();

// rAF interval tracker
(function() {
    let last = performance.now();
    function tick(t) {
        if (window._perf && window._perf.enabled) {
            const interval = t - last;
            if (interval > 0 && interval < 1000) {
                window._perf.frameTimes.push(interval);
                window._perf.rafTimes.push(t);
            }
        }
        last = t;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
"""

def start_server():
    import http.server, socketserver, threading
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map.update({".js": "application/javascript"})
    # Suppress logs
    class Q(handler):
        def log_message(self, *a): pass
    import socket
    class ReuseSrv(socketserver.TCPServer):
        allow_reuse_address = True
    srv = ReuseSrv(("127.0.0.1", 8765), Q)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv

def init_page(page):
    page.goto(URL, wait_until="domcontentloaded")
    for _ in range(150):
        if page.evaluate('typeof G!=="undefined" && G._initialized===true'): break
        time.sleep(0.1)
    page.evaluate(INSTRUMENT)

def setup_canvas(page):
    """Initialize canvas context like Battle.start does."""
    page.evaluate("""() => {
        const cv = document.getElementById('cv');
        if(cv){
            const dpr = window.devicePixelRatio || 1;
            cv.style.width = '390px';
            cv.style.height = '844px';
            cv.width = 390 * dpr;
            cv.height = 844 * dpr;
            Battle.canvasW = 390;
            Battle.canvasH = 844;
            Battle.ctx = cv.getContext('2d');
            Battle.ctx.scale(dpr, dpr);
        }
    }""")

def make_units(page, count_per_side, hp=100, high_hp=False):
    """Create a battle with count_per_side units on each team.
    Mix of ranged (r>80, spawn projectiles) and melee units.
    High HP so the battle lasts the full profiling window."""
    js = """
        const abs=['heal','spawn','explode','poison','ramp','rage','lifesteal','thorns','regen','counter','dodge','splash','slow','shield','blink_strike','frenzy','cleanse','chain_lightning','taunt','executioner'];
        const roles=['frontline','carry','support'];
        const targs=['closest','lowest_hp','enemy_cluster','enemy_frontline','enemy_backline'];
        const units=[];
        const n=__N__;
        const hp=__HP__;
        for(let i=0;i<n*2;i++){
            // 60% ranged (r=120-180, spawns projectiles), 40% melee (r=40-70)
            const isRanged=(i%5)<3;
            const r=isRanged?120+Math.floor(Math.random()*60):40+Math.floor(Math.random()*30);
            // Ranged units kite, melee units chase — ensures continuous combat
            const mov=isRanged?'kite':'chase';
            const u=unit({n:'U'+i,h:hp+Math.floor(Math.random()*100),d:8+Math.floor(Math.random()*8),r:r,s:60+Math.floor(Math.random()*20),a:0.8+Math.random()*0.4,ability:abs[i%abs.length],abilityTrigger:'on_cooldown',targeting:targs[i%targs.length],movement:mov,attackCondition:'always',role:roles[i%3],moveSpeedMod:100});
            u.team=i<n?'player':'enemy';
            // Spread units across the battlefield. Player on left, enemy on right.
            const col=i%n;
            const row=Math.floor(i/n);
            u.x=u.team==='player'?40+col*7+row*3:360-col*7-row*3;
            u.y=60+col*12+row*40;
            units.push(Battle.initRuntime(u));
        }
        Battle.units=units;Battle._allUnits=[...units];
        Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
        Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;
        Battle.onEnd=null;
        Battle.running=true;Battle.last=performance.now();
        cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
    """.replace("__N__", str(count_per_side)).replace("__HP__", str(hp))
    page.evaluate("(() => {" + js + "})()")

def make_empty(page):
    """Empty screen — just background rendering."""
    page.evaluate("""(function() {
        Battle.units=[];Battle._allUnits=[];
        Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
        Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;
        Battle.onEnd=null;
        Battle.running=true;Battle.last=performance.now();
        cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
    })()""")

def reset_perf(page):
    page.evaluate("""() => {
        window._perf.enabled = true;
        window._perf.frames = 0;
        window._perf.frameTimes = [];
        window._perf.updateTimes = [];
        window._perf.renderTimes = [];
        window._perf.cpuTimes = [];
        window._perf.gpuEst = [];
        window._perf.slowFrames = 0;
        window._perf.heapSamples = [];
        window._perf.objCounts = [];
        window._perf.subFunc = {};
        window._perf.maxProj = 0;
        window._perf.maxPart = 0;
        window._perf.maxDmg = 0;
    }""")

def collect(page, label):
    # Sample memory + object counts mid-run
    for _ in range(5):
        page.evaluate("""() => {
            if (window._perf.enabled) {
                if (performance.memory) {
                    window._perf.heapSamples.push({
                        used: performance.memory.usedJSHeapSize,
                        total: performance.memory.totalJSHeapSize,
                        limit: performance.memory.jsHeapSizeLimit,
                    });
                }
                window._perf.maxProj = Math.max(window._perf.maxProj, Battle.projectiles.length);
                window._perf.maxPart = Math.max(window._perf.maxPart, Battle.particles.length);
                window._perf.maxDmg = Math.max(window._perf.maxDmg, Battle.damageNums.length);
            }
        }""")
        time.sleep(DURATION / 5)

    data = page.evaluate("""() => {
        window._perf.enabled = false;
        const p = window._perf;
        // Compute CPU times (update + render per frame)
        const cpuTimes = [];
        const n = Math.min(p.updateTimes.length, p.renderTimes.length);
        for (let i = 0; i < n; i++) {
            cpuTimes.push(p.updateTimes[i] + p.renderTimes[i]);
        }
        // GPU estimate: frame interval - cpu time
        const gpuEst = [];
        const fn = Math.min(p.frameTimes.length, cpuTimes.length);
        for (let i = 0; i < fn; i++) {
            const g = Math.max(0, p.frameTimes[i] - cpuTimes[i]);
            gpuEst.push(g);
        }
        function stats(arr) {
            if (!arr.length) return {avg:0, p50:0, p95:0, p99:0, max:0};
            const s = [...arr].sort((a,b)=>a-b);
            return {
                avg: arr.reduce((a,b)=>a+b,0)/arr.length,
                p50: s[Math.floor(s.length*0.5)],
                p95: s[Math.floor(s.length*0.95)],
                p99: s[Math.floor(s.length*0.99)],
                max: s[s.length-1],
            };
        }
        return {
            frames: p.frameTimes.length,
            frameStats: stats(p.frameTimes),
            updateStats: stats(p.updateTimes),
            renderStats: stats(p.renderTimes),
            cpuStats: stats(cpuTimes),
            gpuStats: stats(gpuEst),
            slowFrames: p.frameTimes.filter(f => f > 20).length,
            heap: p.heapSamples.length ? {
                usedAvg: p.heapSamples.reduce((a,b)=>a+b.used,0)/p.heapSamples.length,
                totalAvg: p.heapSamples.reduce((a,b)=>a+b.total,0)/p.heapSamples.length,
                usedMax: Math.max(...p.heapSamples.map(s=>s.used)),
            } : null,
            subFunc: p.subFunc,
            objCounts: {
                units: Battle.units.length,
                projectiles: Battle.projectiles.length,
                particles: Battle.particles.length,
                zones: Battle.zones.length,
                damageNums: Battle.damageNums.length,
            },
            maxProj: p.maxProj,
            maxPart: p.maxPart,
            maxDmg: p.maxDmg,
        };
    }""")

    print(f"\n{'='*60}")
    print(f"=== {label} ({DURATION}s) ===")
    print(f"{'='*60}")
    print(f"  Frames: {data['frames']} | Slow frames (>20ms): {data['slowFrames']}")
    fps = data['frames'] / DURATION if data['frames'] else 0
    print(f"  FPS: {fps:.1f}")
    f = data['frameStats']
    print(f"  Frame:  avg={f['avg']:.2f}ms p50={f['p50']:.2f} p95={f['p95']:.2f} p99={f['p99']:.2f} max={f['max']:.2f}ms")
    u = data['updateStats']
    print(f"  Update: avg={u['avg']:.2f}ms p50={u['p50']:.2f} p95={u['p95']:.2f} p99={u['p99']:.2f} max={u['max']:.2f}ms")
    r = data['renderStats']
    print(f"  Render: avg={r['avg']:.2f}ms p50={r['p50']:.2f} p95={r['p95']:.2f} p99={r['p99']:.2f} max={r['max']:.2f}ms")
    c = data['cpuStats']
    print(f"  CPU:    avg={c['avg']:.2f}ms p50={c['p50']:.2f} p95={c['p95']:.2f} p99={c['p99']:.2f} max={c['max']:.2f}ms")
    g = data['gpuStats']
    print(f"  GPU*:   avg={g['avg']:.2f}ms p50={g['p50']:.2f} p95={g['p95']:.2f} p99={g['p99']:.2f} max={g['max']:.2f}ms")
    print(f"  (*GPU = frameInterval - cpuTime, approximate)")
    if data['heap']:
        h = data['heap']
        print(f"  Memory: used={h['usedAvg']/1048576:.1f}MB max={h['usedMax']/1048576:.1f}MB total={h['totalAvg']/1048576:.1f}MB")
    oc = data['objCounts']
    print(f"  Objects: units={oc['units']} proj={oc['projectiles']} particles={oc['particles']} zones={oc['zones']} dmg={oc['damageNums']}")
    print(f"  Max:     proj={data.get('maxProj',0)} particles={data.get('maxPart',0)} dmg={data.get('maxDmg',0)}")
    sf = data['subFunc']
    if sf:
        print(f"  Sub-functions:")
        for k in sorted(sf.keys()):
            v = sf[k]
            print(f"    {k}: count={v['count']} total={v['total']:.1f}ms avg={v['total']/v['count']:.4f}ms")
    return data

def main():
    srv = start_server()
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        init_page(page)
        setup_canvas(page)

        # Scenario 1: Empty screen
        print("\n--- Scenario 1: Empty screen (background only) ---")
        make_empty(page)
        time.sleep(1)
        reset_perf(page)
        results['empty'] = collect(page, "EMPTY SCREEN")

        # Scenario 2: 5v5
        print("\n--- Scenario 2: 5v5 (10 units, mixed ranged+melee) ---")
        make_units(page, 5, hp=300)
        time.sleep(1)
        reset_perf(page)
        results['5v5'] = collect(page, "5v5 (10 units)")

        # Scenario 3: 20v20
        print("\n--- Scenario 3: 20v20 (40 units, mixed ranged+melee) ---")
        make_units(page, 20, hp=500)
        time.sleep(1)
        reset_perf(page)
        results['20v20'] = collect(page, "20v20 (40 units)")

        # Scenario 4: 50v50
        print("\n--- Scenario 4: 50v50 (100 units, mixed ranged+melee) ---")
        make_units(page, 50, hp=800, high_hp=True)
        time.sleep(1)
        reset_perf(page)
        results['50v50'] = collect(page, "50v50 (100 units)")

        # Scenario 5: Multiplayer guest (snapshot interpolation)
        print("\n--- Scenario 5: Multiplayer guest (50v50, snapshot interpolation) ---")
        make_units(page, 50, hp=800, high_hp=True)
        time.sleep(0.5)
        # Simulate guest receiving snapshots every 100ms (10fps from host).
        # The guest interpolates between snapshots at 60fps via _interpRender.
        page.evaluate("""(() => {
            window._guestSnapshots = [];
            window._guestSnapIdx = 0;
            // Generate 100 snapshots with slightly moved units.
            for(let s=0;s<100;s++){
                const snap = {
                    time: s*0.1,
                    units: Battle.units.map(u=>({
                        id:u.id, n:u.n, x:u.x+(Math.random()-0.5)*4,
                        y:u.y+(Math.random()-0.5)*4, h:u.h, mh:u.mh,
                        t:u.team, s:u.animState||'idle', c:u.c, z:u.z, r:u.r,
                        prevH:u.h, deathT:undefined
                    })),
                    projectiles: [],
                    recentCrits: []
                };
                window._guestSnapshots.push(snap);
            }
            // Start guest mode: stop normal loop, use interpolation.
            Battle.running = true;
            cancelAnimationFrame(Battle.frame);
            // Feed first snapshot.
            const snap0 = window._guestSnapshots[0];
            Battle._interpFrom = {units: Battle.units.map(u=>({id:u.id,x:u.x,y:u.y,h:u.h})), time:0};
            Battle._interpTo = snap0;
            Battle._interpStart = performance.now();
            Battle._interpDur = 0.1;
            Battle.applySnapshot(snap0);
            Battle.renderOnly();
            Battle._startInterpLoop();
            // Feed subsequent snapshots every 100ms.
            window._guestFeedInterval = setInterval(()=>{
                window._guestSnapIdx++;
                if(window._guestSnapIdx >= window._guestSnapshots.length){
                    clearInterval(window._guestFeedInterval);
                    return;
                }
                const snap = window._guestSnapshots[window._guestSnapIdx];
                Battle.applyRemoteSnapshot(snap);
            }, 100);
        })()""")
        time.sleep(1)
        reset_perf(page)
        results['mp_guest'] = collect(page, "MP GUEST (50v50 interpolation)")

        browser.close()

    # Save results
    with open('perf_r12_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to perf_r12_results.json")

    srv.shutdown()

if __name__ == '__main__':
    main()

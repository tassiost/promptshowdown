#!/usr/bin/env python3
"""Comprehensive profiler: 60fps/60tps target verification.
Scenarios: empty, 5v5, 20v20, 50v50, multiplayer-lockstep, multiplayer-guest.

Uses THREE separate measurement systems:
1. In-page JS timers: CPU time (update + render), TPS, frame intervals, sub-functions
2. CDP Tracing: actual GPU process time (CrGpuMain thread) + compositor time
3. CDP Performance.getMetrics: accurate JS heap size + DOM nodes + layout counts

This gives TRUE CPU/GPU/memory separation — not just estimates.
"""
import json, os, sys, time, statistics, threading
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
DURATION = 10  # seconds per scenario

# =============================================================================
# In-page JS instrumentation: wraps loop/update/render for per-frame CPU timing.
# =============================================================================
INSTRUMENT = r"""
window._perf = {
    enabled: false,
    frameTimes: [],      // render interval (ms) — measured inside render()
    cpuTimes: [],        // total CPU time per frame (all updates + render)
    updateCounts: [],    // number of update() calls per frame (for TPS)
    updateTimes: [],     // total update time per frame (all updates summed)
    renderTimes: [],     // render time per frame
    tickTimes: [],       // individual update() duration
    subFunc: {},         // sub-function profiling
    heapSamples: [],     // performance.memory samples
    maxProj: 0, maxPart: 0, maxDmg: 0,
    _lastRenderTime: 0,  // last performance.now() from render()
    _frameStartCpu: 0,   // CPU time at start of frame (set by update or render)
    _frameUpdateCount: 0,
    _frameUpdateTotal: 0,
};

(function() {
    const _p = window._perf;

    // Wrap update() for per-tick timing + per-frame update accumulation.
    const _update = Battle.update.bind(Battle);
    Battle.update = function(dt) {
        const t0 = performance.now();
        const r = _update(dt);
        const dt_ms = performance.now() - t0;
        if (_p.enabled) {
            _p.tickTimes.push(dt_ms);
            _p._frameUpdateCount++;
            _p._frameUpdateTotal += dt_ms;
        }
        return r;
    };

    // Wrap render() for per-frame timing + frame interval measurement.
    // render() is called via this.render() which goes through the prototype
    // chain, so it can't be bypassed by _loopBound caching.
    // Frame interval is measured from performance.now() inside render().
    const _render = Battle.render.bind(Battle);
    Battle.render = function() {
        if (!_p.enabled) return _render();
        const now = performance.now();
        // Frame interval: time since last render call.
        if (_p._lastRenderTime > 0) {
            const interval = now - _p._lastRenderTime;
            if (interval > 0 && interval < 1000) _p.frameTimes.push(interval);
        }
        _p._lastRenderTime = now;

        const t0 = performance.now();
        const r = _render();
        const renderTime = performance.now() - t0;

        // CPU time = update time + render time (for this frame).
        const cpuTime = _p._frameUpdateTotal + renderTime;
        _p.cpuTimes.push(cpuTime);
        _p.updateCounts.push(_p._frameUpdateCount);
        _p.updateTimes.push(_p._frameUpdateTotal);
        _p.renderTimes.push(renderTime);

        // Reset per-frame update accumulators for next frame.
        _p._frameUpdateCount = 0;
        _p._frameUpdateTotal = 0;
        return r;
    };

    // Wrap _interpRender for guest mode (same approach as render).
    if (Battle._interpRender) {
        const _interp = Battle._interpRender.bind(Battle);
        Battle._interpRender = function() {
            if (!_p.enabled) return _interp();
            const now = performance.now();
            if (_p._lastRenderTime > 0) {
                const interval = now - _p._lastRenderTime;
                if (interval > 0 && interval < 1000) _p.frameTimes.push(interval);
            }
            _p._lastRenderTime = now;
            const t0 = performance.now();
            const r = _interp();
            const renderTime = performance.now() - t0;
            _p.cpuTimes.push(renderTime);
            _p.updateCounts.push(0);
            _p.updateTimes.push(0);
            _p.renderTimes.push(renderTime);
            _p._frameUpdateCount = 0;
            _p._frameUpdateTotal = 0;
            return r;
        };
    }

    // Wrap sub-functions for detailed profiling.
    function wrapSub(obj, name, key) {
        if (!obj[name]) return;
        const orig = obj[name].bind(obj);
        obj[name] = function() {
            if (!_p.enabled) return orig.apply(this, arguments);
            const t0 = performance.now();
            const r = orig.apply(this, arguments);
            const dt = performance.now() - t0;
            if (!_p.subFunc[key]) _p.subFunc[key] = {count: 0, total: 0};
            _p.subFunc[key].count++;
            _p.subFunc[key].total += dt;
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
"""

# =============================================================================
# CDP Tracing categories for GPU measurement.
# Based on Chromium tracing docs + web.dev about:tracing guide.
# - "gpu" / "gpu.service": CrGpuMain thread events (actual GPU command execution)
# - "viz": VizCompositorThread (display compositor)
# - "cc": compositor layer tree
# - "blink": renderer main thread
# - "disabled-by-default-gpu.service": detailed GPU service events
# =============================================================================
GPU_TRACE_CATEGORIES = [
    "gpu",
    "gpu.service",
    "viz",
    "cc",
    "blink",
    "blink.user_timing",
    "disabled-by-default-gpu.service",
    "disabled-by-default-devtools.timeline",
    "toplevel",
]

def start_server():
    import http.server, socketserver
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map.update({".js": "application/javascript"})
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
            Battle.ctx = cv.getContext('2d', {alpha: false, desynchronized: true});
            Battle.ctx.scale(dpr, dpr);
        }
    }""")

def make_units(page, count_per_side, hp=100, high_hp=False):
    """Create a battle with count_per_side units on each team.
    Mix of ranged (r>80, spawn projectiles) and melee units.
    High HP so the battle lasts the full profiling window.
    Uses seeded RNG for deterministic, comparable results across runs."""
    js = """
        let _seed=12345;
        const _origRandom=Math.random;
        Math.random=function(){_seed=(_seed*1103515245+12345)&0x7fffffff;return _seed/0x7fffffff;};
        const abs=['heal','spawn','explode','poison','ramp','rage','lifesteal','thorns','regen','counter','dodge','splash','slow','shield','blink_strike','frenzy','cleanse','chain_lightning','taunt','executioner'];
        const roles=['frontline','carry','support'];
        const targs=['closest','lowest_hp','enemy_cluster','enemy_frontline','enemy_backline'];
        const units=[];
        const n=__N__;
        const hp=__HP__;
        for(let i=0;i<n*2;i++){
            const isRanged=(i%5)<3;
            const r=isRanged?120+Math.floor(Math.random()*60):40+Math.floor(Math.random()*30);
            const mov=isRanged?'kite':'chase';
            const u=unit({n:'U'+i,h:hp+Math.floor(Math.random()*100),d:8+Math.floor(Math.random()*8),r:r,s:60+Math.floor(Math.random()*20),a:0.8+Math.random()*0.4,ability:abs[i%abs.length],abilityTrigger:'on_cooldown',targeting:targs[i%targs.length],movement:mov,attackCondition:'always',role:roles[i%3],moveSpeedMod:100});
            u.team=i<n?'player':'enemy';
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
        Battle._accumulator=0;Battle._tick=0;
        Battle._cmdBuffer=new Map();
        Battle._lockstepActive=false;Battle._peerConfirmedTick=null;
        Battle._effectiveSpeed=1;Battle._manualSpeed=false;
        Battle._battleStats={playerDmg:0,enemyDmg:0,playerKills:0,enemyKills:0,peakDPS:0,dmgWindow:[]};
        Battle._killFeed=[];
        Battle._highlights={biggestHit:0,biggestHitBy:null,biggestHitTarget:null,biggestHitCrit:false};
        Battle._firstBlood=false;
        Battle.running=true;Battle.last=performance.now();
        cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
        Battle.checkEnd=function(){};
        Math.random=_origRandom;
    """.replace("__N__", str(count_per_side)).replace("__HP__", str(hp))
    page.evaluate("(() => {" + js + "})()")

def make_empty(page):
    """Empty screen — just background rendering."""
    page.evaluate("""(function() {
        Battle.units=[];Battle._allUnits=[];
        Battle.projectiles=[];Battle.particles=[];Battle.zones=[];Battle.spells=[];Battle.damageNums=[];
        Battle.speed=1;Battle.paused=false;Battle.time=0;Battle.winner=null;
        Battle.onEnd=null;
        Battle._accumulator=0;Battle._tick=0;
        Battle._lockstepActive=false;Battle._peerConfirmedTick=null;
        Battle.checkEnd=function(){};
        Battle.running=true;Battle.last=performance.now();
        cancelAnimationFrame(Battle.frame);Battle.frame=requestAnimationFrame(Battle.loop.bind(Battle));
    })()""")

def make_lockstep(page, count_per_side, hp=800):
    """Lockstep mode — both peers run the sim."""
    make_units(page, count_per_side, hp=hp, high_hp=True)
    page.evaluate("""(() => {
        Battle._lockstepActive = true;
        Battle._peerConfirmedTick = 999999;
        Battle._localTeam = 'player';
    })()""")

def reset_perf(page):
    page.evaluate("""() => {
        window._perf.enabled = true;
        window._perf.frameTimes = [];
        window._perf.cpuTimes = [];
        window._perf.updateCounts = [];
        window._perf.updateTimes = [];
        window._perf.renderTimes = [];
        window._perf.tickTimes = [];
        window._perf.heapSamples = [];
        window._perf.subFunc = {};
        window._perf.maxProj = 0;
        window._perf.maxPart = 0;
        window._perf.maxDmg = 0;
        window._perf._lastRenderTime = 0;
        window._perf._frameUpdateCount = 0;
        window._perf._frameUpdateTotal = 0;
    }""")

# =============================================================================
# CDP GPU tracing: capture actual GPU process time via Chrome DevTools Protocol.
# Uses Tracing.start/end with GPU categories, then parses trace events to
# extract CrGpuMain thread duration (actual GPU command execution time).
# =============================================================================
def start_gpu_trace(cdp_session):
    """Start a CDP trace with GPU categories to capture actual GPU time."""
    cdp_session.send("Tracing.start", {
        "categories": ",".join(GPU_TRACE_CATEGORIES),
    })

def stop_gpu_trace(cdp_session, page):
    """Stop the CDP trace and collect all trace events.
    Returns a list of trace event dicts.

    IMPORTANT: Playwright's CDP event handlers are not called while the Python
    thread is blocked on time.sleep(). We must call page.evaluate() periodically
    to pump the CDP event loop and allow dataCollected/tracingComplete events
    to be delivered to our handlers.
    """
    events = []
    complete = [False]

    def on_data(event):
        if "value" in event and isinstance(event["value"], list):
            events.extend(event["value"])

    def on_complete(event):
        complete[0] = True

    cdp_session.on("Tracing.dataCollected", on_data)
    cdp_session.on("Tracing.tracingComplete", on_complete)

    cdp_session.send("Tracing.end")

    # Poll for completion, pumping CDP event loop with page.evaluate()
    for i in range(200):  # up to 20 seconds (200 * 0.1s)
        page.evaluate("1")  # pump the event loop
        time.sleep(0.05)
        if complete[0] and i > 5:  # wait a bit after complete for stragglers
            break

    cdp_session.remove_listener("Tracing.dataCollected", on_data)
    cdp_session.remove_listener("Tracing.tracingComplete", on_complete)
    return events

def parse_gpu_time(trace_events, duration_ms):
    """Parse trace events to extract GPU process time.
    Looks for events on the CrGpuMain thread (tid matching GPU process).
    Returns dict with gpu_time_ms, compositor_time_ms, and event counts.

    Based on Chromium tracing docs:
    - CrGpuMain: actual GPU command execution (GL/DirectX calls)
    - VizCompositorThread: display compositor (assembles layers)
    - cc: compositor layer tree operations

    Trace event phases: X=complete (has dur), B/E=begin/end pair, b/e=async
    """
    gpu_events = []
    viz_events = []
    cc_events = []
    # Debug: count all categories and phases
    cat_counts = {}
    phase_counts = {}

    for e in trace_events:
        if not isinstance(e, dict):
            continue
        name = e.get("name", "")
        cat = e.get("cat", "")
        ph = e.get("ph", "")
        dur = e.get("dur", e.get("tdur", 0))

        # Debug counts
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        phase_counts[ph] = phase_counts.get(ph, 0) + 1

        # Only count complete (X) events with duration (most reliable)
        if ph != "X" or dur <= 0:
            continue

        # GPU process events — match by category (may be comma-separated)
        cat_lower = cat.lower()
        if "gpu" in cat_lower:
            gpu_events.append(e)
        elif "viz" in cat_lower:
            viz_events.append(e)
        elif cat == "cc":
            cc_events.append(e)

    # Sum durations (convert microseconds to ms)
    gpu_time_ms = sum(e.get("dur", 0) for e in gpu_events) / 1000.0
    viz_time_ms = sum(e.get("dur", 0) for e in viz_events) / 1000.0
    cc_time_ms = sum(e.get("dur", 0) for e in cc_events) / 1000.0

    num_frames = max(1, duration_ms / 16.67)
    gpu_per_frame = gpu_time_ms / num_frames
    viz_per_frame = viz_time_ms / num_frames

    return {
        "gpuTotalMs": gpu_time_ms,
        "gpuPerFrameMs": gpu_per_frame,
        "vizTotalMs": viz_time_ms,
        "vizPerFrameMs": viz_per_frame,
        "ccTotalMs": cc_time_ms,
        "gpuEventCount": len(gpu_events),
        "vizEventCount": len(viz_events),
        "totalTraceEvents": len(trace_events),
        "topCategories": dict(sorted(cat_counts.items(), key=lambda x: -x[1])[:10]),
        "phaseCounts": phase_counts,
    }

# =============================================================================
# CDP Performance.getMetrics: accurate memory + DOM stats.
# More accurate than performance.memory (which is quantized for security).
# =============================================================================
def get_cdp_metrics(cdp_session):
    """Get performance metrics via CDP Performance.getMetrics.
    Returns dict with JSHeapUsedSize, JSHeapTotalSize, Nodes, LayoutCount, etc."""
    try:
        result = cdp_session.send("Performance.getMetrics")
        metrics = {}
        for m in result.get("metrics", []):
            metrics[m["name"]] = m["value"]
        return metrics
    except Exception as e:
        return {"error": str(e)}

def collect(page, cdp_session, label):
    """Collect perf data: in-page JS timers + CDP GPU trace + CDP metrics.

    IMPORTANT: We avoid calling page.evaluate() during the measurement window
    because it blocks the browser's main thread, causing rAF to miss vsyncs
    (p99 jumps from 18ms to 33ms, dropping FPS from 60 to 59). Instead, we
    install a setInterval in the page that collects memory samples autonomously,
    and just sleep on the Python side without any browser interaction.
    """
    import time as _time
    t_start = _time.time()

    # Start GPU trace
    start_gpu_trace(cdp_session)

    # Install in-page memory sampler (runs autonomously via setInterval).
    # This avoids blocking rAF with page.evaluate() calls during measurement.
    page.evaluate("""(dur) => {
        window._perf._memInterval = setInterval(() => {
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
        }, dur / 5 * 1000);
    }""", DURATION)

    # Wait for the measurement duration WITHOUT calling page.evaluate().
    # Any page.evaluate() here would block rAF and cause missed vsyncs.
    time.sleep(DURATION)

    # Clear the in-page memory sampler
    page.evaluate("clearInterval(window._perf._memInterval)")

    # Record actual collection duration
    actual_duration = _time.time() - t_start

    # Get CDP memory metrics (end of run)
    cdp_mem_end = get_cdp_metrics(cdp_session)

    # IMPORTANT: Disable in-page profiling BEFORE stopping GPU trace.
    # stop_gpu_trace pumps the CDP event loop with page.evaluate() calls,
    # which would keep the render wrapper collecting frames and inflate
    # the frame count, breaking FPS calculation.
    page.evaluate("window._perf.enabled = false")

    # Stop GPU trace and parse events (pumps CDP event loop with page.evaluate)
    trace_events = stop_gpu_trace(cdp_session, page)
    gpu_stats = parse_gpu_time(trace_events, actual_duration * 1000)

    # Collect in-page JS perf data.
    # FPS is calculated from frame intervals (sum of all intervals = total time),
    # which is more precise than Python-side time.time() because it excludes
    # the overhead of page.evaluate() calls after the measurement window.
    data = page.evaluate("""(actualDur) => {
        const p = window._perf;
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
        const totalUpdates = p.updateCounts.reduce((a,b)=>a+b,0);
        // Calculate precise duration from frame intervals (excludes Python overhead).
        const frameDur = p.frameTimes.reduce((a,b)=>a+b,0) / 1000;
        const tps = frameDur > 0 ? totalUpdates / frameDur : 0;
        const fps = frameDur > 0 ? p.frameTimes.length / frameDur : 0;
        const nonCpuTimes = [];
        const fn = Math.min(p.frameTimes.length, p.cpuTimes.length);
        for (let i = 0; i < fn; i++) {
            nonCpuTimes.push(Math.max(0, p.frameTimes[i] - p.cpuTimes[i]));
        }
        return {
            frames: p.frameTimes.length,
            fps: fps,
            frameDur: frameDur,
            frameStats: stats(p.frameTimes),
            cpuStats: stats(p.cpuTimes),
            updateStats: stats(p.updateTimes),
            renderStats: stats(p.renderTimes),
            tickStats: stats(p.tickTimes),
            nonCpuStats: stats(nonCpuTimes),
            slowFrames: p.frameTimes.filter(f => f > 20).length,
            totalUpdates: totalUpdates,
            tps: tps,
            heap: p.heapSamples.length ? {
                usedAvg: p.heapSamples.reduce((a,b)=>a+b.used,0)/p.heapSamples.length,
                totalAvg: p.heapSamples.reduce((a,b)=>a+b.total,0)/p.heapSamples.length,
                usedMax: Math.max(...p.heapSamples.map(s=>s.used)),
                usedMin: Math.min(...p.heapSamples.map(s=>s.used)),
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
    }""", actual_duration)

    # Merge GPU + CDP memory stats
    data["gpu"] = gpu_stats
    data["cdpMem"] = cdp_mem_end
    data["actualDuration"] = actual_duration

    # Print results
    print(f"\n{'='*70}")
    print(f"=== {label} ({data.get('frameDur', 0):.1f}s frame data / {actual_duration:.1f}s wall) ===")
    print(f"{'='*70}")
    fps = data.get('fps', 0)
    print(f"  Frames: {data['frames']} | FPS: {fps:.1f} | TPS: {data['tps']:.1f} | Slow frames (>20ms): {data['slowFrames']}")
    f = data['frameStats']
    print(f"  Frame:  avg={f['avg']:.2f}ms p50={f['p50']:.2f} p95={f['p95']:.2f} p99={f['p99']:.2f} max={f['max']:.2f}ms")
    c = data['cpuStats']
    print(f"  CPU:    avg={c['avg']:.2f}ms p50={c['p50']:.2f} p95={c['p95']:.2f} p99={c['p99']:.2f} max={c['max']:.2f}ms")
    u = data['updateStats']
    print(f"  Update: avg={u['avg']:.2f}ms p50={u['p50']:.2f} p95={u['p95']:.2f} p99={u['p99']:.2f} max={u['max']:.2f}ms")
    r = data['renderStats']
    print(f"  Render: avg={r['avg']:.2f}ms p50={r['p50']:.2f} p95={r['p95']:.2f} p99={r['p99']:.2f} max={r['max']:.2f}ms")
    t = data['tickStats']
    print(f"  Tick:   avg={t['avg']:.3f}ms p50={t['p50']:.3f} p95={t['p95']:.3f} p99={t['p99']:.3f} max={t['max']:.3f}ms ({data['totalUpdates']} total)")
    n = data['nonCpuStats']
    print(f"  Non-CPU:avg={n['avg']:.2f}ms p50={n['p50']:.2f} p95={n['p95']:.2f} p99={n['p99']:.2f} max={n['max']:.2f}ms")
    print(f"  (Non-CPU = frame interval - CPU; includes vsync wait + browser + GPU composite)")

    # GPU stats from CDP tracing
    g = data.get("gpu", {})
    if g and g.get("gpuEventCount", 0) > 0:
        print(f"  GPU:    total={g['gpuTotalMs']:.1f}ms per-frame={g['gpuPerFrameMs']:.2f}ms events={g['gpuEventCount']}")
        print(f"  Viz:    total={g['vizTotalMs']:.1f}ms per-frame={g['vizPerFrameMs']:.2f}ms events={g['vizEventCount']}")
        print(f"  (GPU = CrGpuMain thread time from CDP trace; Viz = display compositor)")
    else:
        total_events = g.get("totalTraceEvents", 0)
        top_cats = g.get("topCategories", {})
        print(f"  GPU:    no GPU events in trace ({total_events} total events)")
        if top_cats:
            top3 = list(top_cats.items())[:5]
            print(f"  Debug:  top categories: {top3}")
            print(f"          phases: {g.get('phaseCounts', {})}")

    # Memory stats from CDP Performance.getMetrics
    cm = data.get("cdpMem", {})
    if cm and "JSHeapUsedSize" in cm:
        print(f"  Memory: JSHeap={cm['JSHeapUsedSize']/1048576:.1f}MB total={cm.get('JSHeapTotalSize',0)/1048576:.1f}MB nodes={int(cm.get('Nodes',0))} layouts={int(cm.get('LayoutCount',0))}")
    elif data['heap']:
        h = data['heap']
        print(f"  Memory: used={h['usedAvg']/1048576:.1f}MB min={h['usedMin']/1048576:.1f}MB max={h['usedMax']/1048576:.1f}MB total={h['totalAvg']/1048576:.1f}MB (performance.memory)")

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
        # Headed mode for GPU acceleration (headless uses SwiftShader/software)
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--enable-gpu-rasterization",
                "--enable-accelerated-2d-canvas",
            ],
        )
        ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        init_page(page)
        setup_canvas(page)

        # Create CDP session for GPU tracing + Performance metrics
        cdp_session = ctx.new_cdp_session(page)
        cdp_session.send("Performance.enable")

        # Scenario 1: Empty screen
        print("\n--- Scenario 1: Empty screen (background only) ---")
        make_empty(page)
        time.sleep(1)
        reset_perf(page)
        results['empty'] = collect(page, cdp_session, "EMPTY SCREEN")

        # Scenario 2: 5v5
        print("\n--- Scenario 2: 5v5 (10 units, mixed ranged+melee) ---")
        make_units(page, 5, hp=300)
        time.sleep(1)
        reset_perf(page)
        results['5v5'] = collect(page, cdp_session, "5v5 (10 units)")

        # Scenario 3: 20v20
        print("\n--- Scenario 3: 20v20 (40 units, mixed ranged+melee) ---")
        make_units(page, 20, hp=500)
        time.sleep(1)
        reset_perf(page)
        results['20v20'] = collect(page, cdp_session, "20v20 (40 units)")

        # Scenario 4: 50v50
        print("\n--- Scenario 4: 50v50 (100 units, mixed ranged+melee) ---")
        make_units(page, 50, hp=800, high_hp=True)
        time.sleep(1)
        reset_perf(page)
        results['50v50'] = collect(page, cdp_session, "50v50 (100 units)")

        # Scenario 5: Multiplayer lockstep (both peers run sim)
        print("\n--- Scenario 5: Multiplayer lockstep (50v50, both peers sim) ---")
        make_lockstep(page, 50, hp=800)
        time.sleep(1)
        reset_perf(page)
        results['mp_lockstep'] = collect(page, cdp_session, "MP LOCKSTEP (50v50 both peers sim)")

        # Scenario 6: Multiplayer guest (snapshot interpolation)
        print("\n--- Scenario 6: Multiplayer guest (50v50, snapshot interpolation) ---")
        make_units(page, 50, hp=800, high_hp=True)
        time.sleep(0.5)
        page.evaluate("""(() => {
            window._guestSnapshots = [];
            window._guestSnapIdx = 0;
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
            Battle.running = true;
            cancelAnimationFrame(Battle.frame);
            const snap0 = window._guestSnapshots[0];
            Battle._interpFrom = {units: Battle.units.map(u=>({id:u.id,x:u.x,y:u.y,h:u.h})), time:0};
            Battle._interpTo = snap0;
            Battle._interpStart = performance.now();
            Battle._interpDur = 0.1;
            Battle.applySnapshot(snap0);
            Battle.renderOnly();
            Battle._startInterpLoop();
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
        results['mp_guest'] = collect(page, cdp_session, "MP GUEST (50v50 interpolation)")

        cdp_session.send("Performance.disable")
        browser.close()

    # Save results
    with open('perf_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to perf_results.json")

    # Summary table
    print(f"\n{'='*90}")
    print("SUMMARY: 60fps/60tps Target Verification (CPU/GPU/Memory Separation)")
    print(f"{'='*90}")
    print(f"{'Scenario':<20} {'FPS':>6} {'TPS':>6} {'CPU avg':>8} {'GPU/frame':>10} {'Slow':>5} {'JSHeap':>8} {'Nodes':>7}")
    print(f"{'-'*20} {'-'*6} {'-'*6} {'-'*8} {'-'*10} {'-'*5} {'-'*8} {'-'*7}")
    for key, label in [('empty','Empty'), ('5v5','5v5 (10)'), ('20v20','20v20 (40)'),
                       ('50v50','50v50 (100)'), ('mp_lockstep','MP Lockstep'),
                       ('mp_guest','MP Guest')]:
        if key not in results: continue
        d = results[key]
        fps = d.get('fps', d['frames'] / d.get('actualDuration', DURATION))
        tps = d.get('tps', 0)
        cpu_avg = d['cpuStats']['avg']
        gpu = d.get('gpu', {})
        gpu_pf = gpu.get('gpuPerFrameMs', 0)
        slow = d['slowFrames']
        cm = d.get('cdpMem', {})
        mem = cm.get('JSHeapUsedSize', d['heap']['usedAvg'] if d.get('heap') else 0) / 1048576
        nodes = int(cm.get('Nodes', 0))
        fps_ok = "OK" if fps >= 58 else "FAIL"
        tps_ok = "OK" if tps >= 58 or key == 'mp_guest' else "FAIL"
        print(f"{label:<20} {fps:>5.1f}{fps_ok[0]} {tps:>5.1f}{tps_ok[0]} {cpu_avg:>7.2f}m {gpu_pf:>9.2f}m {slow:>5} {mem:>7.1f}MB {nodes:>7}")

    srv.shutdown()

if __name__ == '__main__':
    main()

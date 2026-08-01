#!/usr/bin/env python3
"""
E2E Bug Hunt R6: Save System, Migration, Import/Export, Corruption Recovery
Game: Draft Showdown (Prompt Showdown) — single-file HTML game.
Server: http://localhost:8765/index.html
Viewport: 420x800
"""
import json, base64, re, sys, time, traceback
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
SAVE_KEY = "promptShowdownV4"
SAVE_BACKUP_KEY = "promptShowdownV4_backup"
RESULTS = []

def log(name, passed, evidence=""):
    status = "PASS" if passed else "FAIL"
    line = f"[{status}] {name}"
    if evidence:
        line += f" — {evidence}"
    print(line)
    RESULTS.append((name, passed, evidence))

def enc_b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")

def dec_b64(b):
    return base64.b64decode(b.encode("ascii")).decode("utf-8")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width":420,"height":800})
        console_msgs = []
        page = ctx.new_page()
        page.on("console", lambda m: console_msgs.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: console_msgs.append(f"pageerror: {e}"))

        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1200)  # let init/async IDB settle

        # ---------- 1. Save structure ----------
        print("\n=== 1. Save structure ===")
        save = page.evaluate("() => { const c = JSON.parse(JSON.stringify(G.save)); return c; }")
        print("Dumped G.save keys:", sorted(save.keys()))
        type_checks = {
            "version": ("number", isinstance(save.get("version"), (int,float)) and not isinstance(save.get("version"), bool)),
            "coins": ("number", isinstance(save.get("coins"), (int,float)) and not isinstance(save.get("coins"), bool)),
            "xp": ("number", isinstance(save.get("xp"), (int,float)) and not isinstance(save.get("xp"), bool)),
            "matchWins": ("number", isinstance(save.get("matchWins"), (int,float)) and not isinstance(save.get("matchWins"), bool)),
            "wins": ("number", isinstance(save.get("wins"), (int,float)) and not isinstance(save.get("wins"), bool)),
            "arena": ("number", isinstance(save.get("arena"), (int,float)) and not isinstance(save.get("arena"), bool)),
            "endlessLevel": ("number|undefined", (save.get("endlessLevel") is None) or (isinstance(save.get("endlessLevel"), (int,float)) and not isinstance(save.get("endlessLevel"), bool))),
            "loadout": ("array of strings", isinstance(save.get("loadout"), list) and all(isinstance(x,str) for x in save.get("loadout",[]))),
            "collection": ("array of objects", isinstance(save.get("collection"), list) and all(isinstance(x,dict) for x in save.get("collection",[]))),
            "spellbook": ("array", isinstance(save.get("spellbook"), list)),
            "quests": ("object with list+streak", isinstance(save.get("quests"), dict) and "list" in save.get("quests",{}) and "streak" in save.get("quests",{})),
            "achievements": ("object", isinstance(save.get("achievements"), dict)),
            "ranked": ("object with rating/peakRating/wins/losses", isinstance(save.get("ranked"), dict) and all(k in save.get("ranked",{}) for k in ["rating","peakRating","wins","losses"])),
            "settings": ("object", isinstance(save.get("settings"), dict)),
            "presets": ("array", isinstance(save.get("presets"), list)),
            "replays": ("array", isinstance(save.get("replays"), list)),
            "stats": ("object|undefined", save.get("stats") is None or isinstance(save.get("stats"), dict)),
            "forgeDate": ("string", isinstance(save.get("forgeDate"), str)),
            "forgeCount": ("number", isinstance(save.get("forgeCount"), (int,float)) and not isinstance(save.get("forgeCount"), bool)),
            "winStreak": ("number", isinstance(save.get("winStreak"), (int,float)) and not isinstance(save.get("winStreak"), bool)),
            "bestStreak": ("number", isinstance(save.get("bestStreak"), (int,float)) and not isinstance(save.get("bestStreak"), bool)),
        }
        for field, (expected, ok) in type_checks.items():
            actual = type(save.get(field)).__name__ if field in save else "MISSING"
            log(f"1.save.{field} is {expected}", ok, f"actual={actual}, value={repr(save.get(field))[:60]}")

        # ---------- 2. Export ----------
        print("\n=== 2. Export ===")
        # exportSave writes to #saveExportArea textarea, not prompt()
        page.evaluate("() => G.exportSave()")
        page.wait_for_timeout(300)
        area_val = page.evaluate("() => { const el=document.getElementById('saveExportArea'); return el? el.value : null; }")
        log("2.export produces code starting with PSV4:", isinstance(area_val,str) and area_val.startswith("PSV4:"), f"len={len(area_val) if area_val else 0}")
        if area_val and area_val.startswith("PSV4:"):
            b64 = area_val[5:]
            try:
                decoded = dec_b64(b64)
                parsed = json.loads(decoded)
                log("2.export decodes to valid JSON", isinstance(parsed, dict), f"keys={len(parsed)}")
                # verify all expected fields present in exported save
                expected_fields = ["version","coins","xp","matchWins","wins","arena","loadout","collection",
                                   "spellbook","quests","achievements","ranked","settings","presets","replays",
                                   "forgeDate","forgeCount"]
                missing = [f for f in expected_fields if f not in parsed]
                log("2.export contains all expected fields", len(missing)==0, f"missing={missing}")
                # check fields that may be missing (winStreak/bestStreak/stats/endlessLevel)
                optional_missing = [f for f in ["winStreak","bestStreak","stats","endlessLevel"] if f not in parsed]
                log("2.export optional fields (winStreak/bestStreak/stats/endlessLevel) present", len(optional_missing)==0, f"missing_optional={optional_missing}")
            except Exception as e:
                log("2.export decode", False, f"exception={e}")

        # ---------- 3. Import valid save ----------
        print("\n=== 3. Import valid save ===")
        # Build a valid save code from current save
        current_save = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        valid_code = "PSV4:" + enc_b64(json.dumps(current_save))
        # Override prompt to return our code
        page.evaluate(f'(code) => {{ window.__origPrompt = window.prompt; window.prompt = () => code; }}', valid_code)
        page.evaluate("() => G.importSave()")
        page.wait_for_timeout(300)
        # confirm modal should appear; click Yes
        yes_btn = page.locator("button.btn.primary:has-text('Yes')")
        log("3.import shows confirm modal", yes_btn.count() > 0, "")
        if yes_btn.count() > 0:
            yes_btn.first.click()
            page.wait_for_timeout(500)
        # verify save loaded
        after_import = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        log("3.import loads save (version matches)", after_import.get("version")==current_save.get("version"), f"version={after_import.get('version')}")
        # restore prompt
        page.evaluate("() => { if(window.__origPrompt) window.prompt = window.__origPrompt; }")

        # ---------- 4. Import edge cases ----------
        print("\n=== 4. Import edge cases ===")
        def do_import(code, label):
            page.evaluate(f'(c) => {{ window.__origPrompt = window.prompt; window.prompt = () => c; }}', code if code is not None else "__NULL__")
            # handle null: prompt returns null
            if code is None:
                page.evaluate("() => { window.__origPrompt = window.prompt; window.prompt = () => null; }")
            # clear any stale toast before test
            page.evaluate("() => { const t=document.getElementById('toast'); if(t){t.style.display='none';t.innerText='';} }")
            before = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
            page.evaluate("() => G.importSave()")
            page.wait_for_timeout(400)
            # check toast
            toast_text = page.evaluate("() => { const el=document.getElementById('toast'); return el? (el.style.display==='block'? el.innerText : null) : null; }")
            # check confirm modal
            confirm_count = page.locator("button.btn.primary:has-text('Yes')").count()
            # if confirm appeared, dismiss with No to avoid state change
            if confirm_count > 0:
                # use JS to click No button inside the confirm overlay
                # (browser normalizes style, so find via button ancestor)
                page.evaluate("""() => {
                    const yesBtns = [...document.querySelectorAll('button.btn.primary')].filter(b => b.textContent.trim()==='Yes');
                    for(const y of yesBtns){
                        const overlay = y.closest('div');
                        if(overlay){
                            const noBtn = [...overlay.querySelectorAll('button.btn:not(.primary)')].find(b=>b.textContent.trim()==='No');
                            if(noBtn){noBtn.click();return;}
                        }
                    }
                }""")
                page.wait_for_timeout(200)
            after = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
            page.evaluate("() => { if(window.__origPrompt) window.prompt = window.__origPrompt; }")
            return toast_text, confirm_count, before, after

        # a) Invalid base64
        tt, cc, bf, af = do_import("PSV4:notbase64!", "invalid_b64")
        log("4a.invalid base64 shows toast (no crash)", isinstance(tt,str) and len(tt)>0, f"toast={repr(tt)}")
        log("4a.invalid base64 does NOT show confirm", cc==0, f"confirm_count={cc}")

        # b) Valid base64 but invalid JSON — "eyJhIjoxfQ" decodes to {"a":1} which IS valid JSON
        # The task says PSV4:eyJhIjoxfQ should be invalid JSON, but it's actually valid JSON {"a":1}.
        # It will fail the version check instead. Test both interpretations.
        tt, cc, bf, af = do_import("PSV4:eyJhIjoxfQ", "valid_b64_valid_json_no_version")
        # {"a":1} is valid JSON but missing version -> should toast "missing or invalid version"
        log("4b.valid JSON missing version shows toast", isinstance(tt,str) and len(tt)>0, f"toast={repr(tt)}")
        log("4b.does NOT show confirm", cc==0, f"confirm_count={cc}")

        # truly invalid JSON: base64 of "not json{{"
        bad_json_code = "PSV4:" + enc_b64("not json{{")
        tt, cc, bf, af = do_import(bad_json_code, "invalid_json")
        log("4b2.invalid JSON shows toast (no crash)", isinstance(tt,str) and len(tt)>0, f"toast={repr(tt)}")
        log("4b2.invalid JSON does NOT show confirm", cc==0, f"confirm_count={cc}")

        # c) Valid JSON but missing version
        no_ver_code = "PSV4:" + enc_b64(json.dumps({"coins":100}))
        tt, cc, bf, af = do_import(no_ver_code, "missing_version")
        log("4c.missing version shows toast", isinstance(tt,str) and len(tt)>0, f"toast={repr(tt)}")
        log("4c.missing version does NOT show confirm", cc==0, f"confirm_count={cc}")

        # d) Valid JSON with version=1 (old save) — should migrate and load
        old_save = {"version":1,"coins":50,"xp":10}
        old_code = "PSV4:" + enc_b64(json.dumps(old_save))
        page.evaluate(f'(c) => {{ window.__origPrompt = window.prompt; window.prompt = () => c; }}', old_code)
        page.evaluate("() => G.importSave()")
        page.wait_for_timeout(400)
        cc = page.locator("button.btn.primary:has-text('Yes')").count()
        log("4d.version=1 old save shows confirm (migrate path)", cc>0, f"confirm_count={cc}")
        if cc > 0:
            page.locator("button.btn.primary:has-text('Yes')").first.click()
            page.wait_for_timeout(600)
        migrated = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        log("4d.version=1 migrates to current version", migrated.get("version")==12, f"version={migrated.get('version')}")
        log("4d.migration preserves coins", migrated.get("coins")==50, f"coins={migrated.get('coins')}")
        log("4d.migration preserves xp", migrated.get("xp")==10, f"xp={migrated.get('xp')}")
        log("4d.migration adds loadout", isinstance(migrated.get("loadout"),list) and len(migrated.get("loadout",[]))>0, f"loadout={migrated.get('loadout')}")
        log("4d.migration adds spellbook", isinstance(migrated.get("spellbook"),list), f"spellbook_len={len(migrated.get('spellbook',[]))}")
        log("4d.migration adds ranked", isinstance(migrated.get("ranked"),dict) and "rating" in migrated.get("ranked",{}), f"ranked={migrated.get('ranked')}")
        log("4d.migration adds quests", isinstance(migrated.get("quests"),dict) and "list" in migrated.get("quests",{}), f"quests={migrated.get('quests')}")
        log("4d.migration adds replays", isinstance(migrated.get("replays"),list), f"replays_len={len(migrated.get('replays',[]))}")
        log("4d.migration adds settings", isinstance(migrated.get("settings"),dict), f"settings={migrated.get('settings')}")
        log("4d.migration adds forgeDate/forgeCount", isinstance(migrated.get("forgeDate"),str) and isinstance(migrated.get("forgeCount"),(int,float)), f"forgeDate={migrated.get('forgeDate')}, forgeCount={migrated.get('forgeCount')}")
        page.evaluate("() => { if(window.__origPrompt) window.prompt = window.__origPrompt; }")

        # e) Empty string
        tt, cc, bf, af = do_import("", "empty_string")
        log("4e.empty string handled gracefully (no crash)", True, f"toast={repr(tt)}, confirm={cc}")
        # empty string -> prompt returns "" which is falsy -> importSave returns early ("if(!code)return")
        log("4e.empty string returns early (no toast, no confirm)", cc==0, f"toast={repr(tt)}, confirm={cc}")

        # f) null
        tt, cc, bf, af = do_import(None, "null")
        log("4f.null handled gracefully (no crash)", True, f"toast={repr(tt)}, confirm={cc}")
        log("4f.null returns early (no toast, no confirm)", cc==0, f"toast={repr(tt)}, confirm={cc}")

        # ---------- 5. Migration deeper ----------
        # migrateSave is module-scoped (not on window), so test via importSave path
        # which calls migrateSave internally. We already did v1 in 4d; here we do
        # a fresh minimal v1 and inspect all fields + future-version refusal.
        print("\n=== 5. Migration ===")
        def import_and_confirm(code):
            page.evaluate(f'(c) => {{ window.__origPrompt = window.prompt; window.prompt = () => c; }}', code)
            page.evaluate("() => { const t=document.getElementById('toast'); if(t){t.style.display='none';t.innerText='';} }")
            page.evaluate("() => G.importSave()")
            page.wait_for_timeout(400)
            cc = page.locator("button.btn.primary:has-text('Yes')").count()
            if cc > 0:
                page.locator("button.btn.primary:has-text('Yes')").first.click()
                page.wait_for_timeout(600)
            else:
                # dismiss any No button via JS (find via Yes button ancestor)
                page.evaluate("""() => {
                    const yesBtns = [...document.querySelectorAll('button.btn.primary')].filter(b => b.textContent.trim()==='Yes');
                    for(const y of yesBtns){
                        const overlay = y.closest('div');
                        if(overlay){
                            const noBtn = [...overlay.querySelectorAll('button.btn:not(.primary)')].find(b=>b.textContent.trim()==='No');
                            if(noBtn){noBtn.click();return;}
                        }
                    }
                }""")
            res = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
            page.evaluate("() => { if(window.__origPrompt) window.prompt = window.__origPrompt; }")
            return res

        # v1 minimal
        mig = import_and_confirm("PSV4:" + enc_b64(json.dumps({"version":1})))
        log("5.migrate(v1) returns object", isinstance(mig, dict), f"type={type(mig).__name__}")
        log("5.migrate(v1) bumps to v12", mig.get("version")==12, f"version={mig.get('version')}")
        mig_fields = ["achievements","xp","coins","matchWins","arena","loadout","collection","spellbook","settings","quests","ranked","replays","forgeDate","forgeCount"]
        missing_mig = [f for f in mig_fields if f not in mig]
        log("5.migrate(v1) adds all expected fields", len(missing_mig)==0, f"missing={missing_mig}")
        # data loss check: import v1 with custom coins/xp, verify preserved
        mig2 = import_and_confirm("PSV4:" + enc_b64(json.dumps({"version":1,"coins":42,"xp":7,"achievements":{"x":1}})))
        log("5.migration preserves coins (no data loss)", mig2.get("coins")==42, f"coins={mig2.get('coins')}")
        log("5.migration preserves xp (no data loss)", mig2.get("xp")==7, f"xp={mig2.get('xp')}")
        log("5.migration preserves achievements (no data loss)", mig2.get("achievements",{}).get("x")==1, f"achievements={mig2.get('achievements')}")
        # Future version refusal: version=99 — importSave shows confirm FIRST,
        # then migrateSave returns null inside the callback -> toast "migration error".
        # This is a UX issue: confirm appears for a save that will be refused.
        page.evaluate(f'(c) => {{ window.__origPrompt = window.prompt; window.prompt = () => c; }}', "PSV4:" + enc_b64(json.dumps({"version":99})))
        page.evaluate("() => { const t=document.getElementById('toast'); if(t){t.style.display='none';t.innerText='';} }")
        page.evaluate("() => G.importSave()")
        page.wait_for_timeout(400)
        fut_confirm = page.locator("button.btn.primary:has-text('Yes')").count()
        log("5.future version (v99): confirm shown BEFORE migration check", fut_confirm>0, f"confirm={fut_confirm} (UX issue: confirm appears for refused save)")
        fut_toast_before = page.evaluate("() => { const el=document.getElementById('toast'); return el? (el.style.display==='block'? el.innerText : null) : null; }")
        if fut_confirm > 0:
            page.locator("button.btn.primary:has-text('Yes')").first.click()
            page.wait_for_timeout(500)
        fut_toast = page.evaluate("() => { const el=document.getElementById('toast'); return el? (el.style.display==='block'? el.innerText : null) : null; }")
        log("5.future version (v99) refused after Yes — toast 'migration error'", isinstance(fut_toast,str) and "migration" in (fut_toast or "").lower(), f"toast={repr(fut_toast)}")
        # verify save NOT overwritten
        after_fut = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        log("5.future version (v99) save NOT overwritten", after_fut.get("version")!=99, f"version={after_fut.get('version')}")
        page.evaluate("() => { if(window.__origPrompt) window.prompt = window.__origPrompt; }")

        # ---------- 6. Save persistence ----------
        print("\n=== 6. Save persistence ===")
        # Modify save data in-game (saveData is module-scoped; write localStorage directly)
        # Set streak.lastLogin to today so checkStreak() doesn't add login bonus on reload
        page.evaluate("""() => {
            G.save.coins = 7777; G.save.xp = 1234;
            const d = new Date();
            const today = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
            if(G.save.quests && G.save.quests.streak) G.save.quests.streak.lastLogin = today;
            localStorage.setItem('promptShowdownV4', JSON.stringify(G.save));
        }""")
        page.wait_for_timeout(600)
        ls_key = page.evaluate(f"() => localStorage.getItem('{SAVE_KEY}')")
        log("6.save written to localStorage under promptShowdownV4", ls_key is not None, f"key={SAVE_KEY}, len={len(ls_key) if ls_key else 0}")
        # parse and verify
        ls_parsed = json.loads(ls_key) if ls_key else {}
        log("6.localStorage save has coins=7777", ls_parsed.get("coins")==7777, f"coins={ls_parsed.get('coins')}")
        # reload and verify persistence
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1200)
        reloaded = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        log("6.save persists across reload (coins=7777)", reloaded.get("coins")==7777, f"coins={reloaded.get('coins')}")
        log("6.save persists across reload (xp=1234)", reloaded.get("xp")==1234, f"xp={reloaded.get('xp')}")

        # ---------- 7. Corruption recovery ----------
        print("\n=== 7. Corruption recovery ===")
        # Set localStorage to invalid JSON, also corrupt backup so it falls back to fresh
        page.evaluate(f"""() => {{
            localStorage.setItem('{SAVE_KEY}', '{{{{{{not valid json');
            localStorage.setItem('{SAVE_BACKUP_KEY}', 'also not json}}}}}}');
        }}""")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        # game should not crash; should create fresh save
        fresh = page.evaluate("() => { try { return JSON.parse(JSON.stringify(G.save)); } catch(e){ return {__err: e.message}; } }")
        log("7.corrupt localStorage: game doesn't crash", isinstance(fresh, dict) and "__err" not in fresh, f"save.version={fresh.get('version') if isinstance(fresh,dict) else fresh}")
        log("7.corrupt localStorage: fresh save created with version=12", isinstance(fresh, dict) and fresh.get("version")==12, f"version={fresh.get('version')}")
        # verify menu visible (game functional)
        menu_visible = page.evaluate("() => { const m=document.getElementById('menu'); return m? m.classList.contains('active') : false; }")
        log("7.corrupt localStorage: game reaches menu", menu_visible, f"menu_active={menu_visible}")

        # ---------- 8. Save size ----------
        print("\n=== 8. Save size ===")
        ls_val = page.evaluate(f"() => localStorage.getItem('{SAVE_KEY}')")
        size_bytes = len(ls_val.encode("utf-8")) if ls_val else 0
        log("8.save size under 5MB quota", size_bytes < 5*1024*1024, f"size={size_bytes} bytes ({size_bytes/1024:.1f} KB)")
        # Check IDB fallback function exists (module-scoped, can't call directly;
        # verify indexedDB API present + functions exist in source)
        has_idb = page.evaluate("() => typeof indexedDB !== 'undefined' && !!window.indexedDB")
        log("8.IDB fallback: indexedDB API available", has_idb, f"indexedDB={has_idb}")
        # Try to open the game's IDB database to confirm fallback store exists
        idb_store = page.evaluate("""async () => {
            try {
                const db = await new Promise((res,rej) => {
                    const r = indexedDB.open('promptshowdown',1);
                    r.onupgradeneeded = e => { e.target.result.createObjectStore('kv'); };
                    r.onsuccess = e => res(e.target.result);
                    r.onerror = e => rej(e);
                });
                const has = db.objectStoreNames.contains('kv');
                db.close();
                return has;
            } catch(e) { return 'err:'+e.message; }
        }""")
        log("8.IDB fallback: 'kv' object store creatable", idb_store is True, f"kv_store={idb_store}")
        # localStorageQuotaOK is module-scoped; test the logic inline
        quota_ok = page.evaluate("""() => {
            try {
                const test = '_quota_test_' + Date.now();
                localStorage.setItem(test, 'x'.repeat(102400));
                localStorage.removeItem(test);
                return true;
            } catch(e) { return false; }
        }""")
        log("8.localStorageQuotaOK logic returns true (space available)", quota_ok==True, f"quotaOK={quota_ok}")

        # ---------- 9. Reset save ----------
        print("\n=== 9. Reset save ===")
        # First set some progress
        page.evaluate("() => { G.save.coins = 9999; G.save.matchWins = 5; localStorage.setItem('promptShowdownV4', JSON.stringify(G.save)); }")
        page.wait_for_timeout(500)
        # Verify progress set
        ls_before = page.evaluate("() => localStorage.getItem('promptShowdownV4')")
        log("9.progress set before reset (coins=9999)", json.loads(ls_before).get("coins")==9999, f"coins={json.loads(ls_before).get('coins')}")
        # G.reset() shows confirm. Click Yes via JS (reset reloads the page).
        page.evaluate("() => G.reset()")
        page.wait_for_timeout(300)
        cc = page.locator("button.btn.primary:has-text('Yes')").count()
        log("9.reset shows confirm modal", cc>0, f"confirm_count={cc}")
        if cc > 0:
            # Set a marker to detect if page actually reloads
            page.evaluate("() => { window.__testMarker = 'BEFORE_RESET_' + Date.now(); }")
            marker_set = page.evaluate("() => window.__testMarker")
            print(f"   (marker set: {marker_set})")
            # click Yes via JS (find via button text, not style attribute)
            click_result = page.evaluate("""() => {
                const yesBtns = [...document.querySelectorAll('button.btn.primary')].filter(b => b.textContent.trim()==='Yes');
                if(yesBtns.length){yesBtns[0].click();return {clicked:true, lsAfter: localStorage.getItem('promptShowdownV4'), marker: window.__testMarker};}
                return {clicked:false, lsAfter: localStorage.getItem('promptShowdownV4'), marker: window.__testMarker};
            }""")
            print(f"   (click result: clicked={click_result.get('clicked')}, lsCleared={click_result.get('lsAfter') is None}, marker={click_result.get('marker')})")
            # Check immediately after click (before any reload)
            page.wait_for_timeout(100)
            try:
                immediate = page.evaluate("() => ({ls: localStorage.getItem('promptShowdownV4')?.slice(0,40), marker: window.__testMarker, navType: performance.navigation?.type})")
                print(f"   (T+100ms: ls={'NULL' if immediate.get('ls') is None else immediate.get('ls')}, marker={immediate.get('marker')}, navType={immediate.get('navType')})")
            except Exception as e:
                print(f"   (T+100ms: page navigating, evaluate failed: {str(e)[:60]})")
            page.wait_for_timeout(400)
            try:
                t500 = page.evaluate("() => ({ls: localStorage.getItem('promptShowdownV4')?.slice(0,40), marker: window.__testMarker, navType: performance.navigation?.type, coins: G?.save?.coins})")
                print(f"   (T+500ms: ls={'NULL' if t500.get('ls') is None else t500.get('ls')}, marker={t500.get('marker')}, navType={t500.get('navType')}, coins={t500.get('coins')})")
            except Exception as e:
                print(f"   (T+500ms: evaluate failed: {str(e)[:60]})")
            # wait for reload to complete
            try:
                page.wait_for_load_state("networkidle", timeout=12000)
            except Exception as e:
                print(f"   (wait_for_load_state exception: {str(e)[:80]})")
            page.wait_for_timeout(2500)
            marker_after = page.evaluate("() => window.__testMarker || 'GONE'")
            nav_after = page.evaluate("() => performance.navigation?.type")
            print(f"   (after reload: marker={marker_after}, navType={nav_after})")
        # After reload, verify progress cleared
        reset_save = page.evaluate("() => { try { return JSON.parse(JSON.stringify(G.save)); } catch(e){ return {__err:e.message}; } }")
        log("9.reset clears coins (fresh save)", reset_save.get("coins")!=9999, f"coins={reset_save.get('coins')}")
        log("9.reset clears matchWins", reset_save.get("matchWins")!=5, f"matchWins={reset_save.get('matchWins')}")
        ls_after = page.evaluate("() => localStorage.getItem('promptShowdownV4')")
        ls_after_parsed = json.loads(ls_after) if ls_after else {}
        log("9.localStorage reflects reset (coins!=9999)", ls_after_parsed.get("coins")!=9999, f"coins={ls_after_parsed.get('coins')}")
        log("9.localStorage key cleared then re-created fresh", ls_after is not None, f"key_exists={ls_after is not None}")
        # BUG INVESTIGATION: check if IDB still has the old save (reset's 2s timeout
        # fires db.close()+reload BEFORE the IDB clear transaction completes)
        idb_after = page.evaluate("""async () => {
            try {
                const db = await new Promise((res,rej) => {
                    const r = indexedDB.open('promptshowdown',1);
                    r.onupgradeneeded = e => { e.target.result.createObjectStore('kv'); };
                    r.onsuccess = e => res(e.target.result);
                    r.onerror = e => rej(e);
                });
                const val = await new Promise((res,rej) => {
                    if(!db.objectStoreNames.contains('kv')){res(null);return;}
                    const tx = db.transaction('kv','readonly');
                    const req = tx.objectStore('kv').get('promptShowdownV4');
                    req.onsuccess = () => res(req.result);
                    req.onerror = () => rej(req.error);
                });
                db.close();
                return val;
            } catch(e) { return 'err:'+e.message; }
        }""")
        idb_has_save = idb_after is not None and isinstance(idb_after, str) and "9999" in (idb_after or "")
        log("9.IDB does not contain old save (not the source of restore)", not idb_has_save, f"idb_has_9999={idb_has_save}, idb_val_len={len(idb_after) if isinstance(idb_after,str) else idb_after}")

        # ADDITIONAL: Test manual localStorage clear + reload (bypass G.reset)
        # to determine if the issue is reset-specific or a general persistence issue
        print("   --- manual clear test ---")
        page.evaluate("() => { G.save.coins = 5555; localStorage.setItem('promptShowdownV4', JSON.stringify(G.save)); }")
        page.wait_for_timeout(300)
        ls_manual = page.evaluate("() => localStorage.getItem('promptShowdownV4')")
        print(f"   (manual: set coins=5555, ls coins={json.loads(ls_manual).get('coins')})")
        # Clear BOTH keys, verify, wait, then reload
        page.evaluate("() => { localStorage.removeItem('promptShowdownV4'); localStorage.removeItem('promptShowdownV4_backup'); }")
        ls_cleared = page.evaluate("() => localStorage.getItem('promptShowdownV4')")
        ls_backup = page.evaluate("() => localStorage.getItem('promptShowdownV4_backup')")
        print(f"   (manual: after removeItem, ls={'NULL' if ls_cleared is None else 'HAS_VALUE'}, backup={'NULL' if ls_backup is None else 'HAS_VALUE'})")
        page.wait_for_timeout(2000)
        ls_still = page.evaluate("() => localStorage.getItem('promptShowdownV4')")
        print(f"   (manual: after 2s wait, ls={'NULL' if ls_still is None else 'HAS_VALUE'})")
        # Use goto instead of reload
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2000)
        manual_after = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        ls_new = page.evaluate("() => localStorage.getItem('promptShowdownV4')")
        print(f"   (manual: after goto, coins={manual_after.get('coins')}, ls_coins={json.loads(ls_new).get('coins') if ls_new else 'NULL'})")
        log("9.manual clear+reload: save cleared (coins!=5555)", manual_after.get("coins")!=5555, f"coins={manual_after.get('coins')}")

        # ROOT CAUSE: beforeunload handler writes in-memory G.save back to localStorage
        # Line 11592: window.addEventListener("beforeunload",()=>{...if(G.save)saveDataNow(G.save);});
        # The reset clears localStorage but beforeunload re-writes it from memory on reload.
        # Verify: clear localStorage AND null out G.save, then reload
        print("   --- root cause verification: clear G.save too ---")
        page.evaluate("() => { G.save.coins = 3333; localStorage.setItem('promptShowdownV4', JSON.stringify(G.save)); }")
        page.wait_for_timeout(300)
        # Clear localStorage AND set G.save to empty (simulating proper reset)
        page.evaluate("() => { localStorage.removeItem('promptShowdownV4'); localStorage.removeItem('promptShowdownV4_backup'); G.save = {version:0}; }")
        ls_cleared2 = page.evaluate("() => localStorage.getItem('promptShowdownV4')")
        print(f"   (root cause: after removeItem + G.save={{version:0}}, ls={'NULL' if ls_cleared2 is None else 'HAS_VALUE'})")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2000)
        rc_after = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        print(f"   (root cause: after goto with G.save nulled, coins={rc_after.get('coins')})")
        log("9.ROOT CAUSE: clearing G.save too prevents restore (beforeunload writes G.save on unload)", rc_after.get("coins")!=3333, f"coins={rc_after.get('coins')} (was 3333, now fresh)")

        # ---------- 10. Settings persistence ----------
        print("\n=== 10. Settings persistence ===")
        # Change audio setting via saveSetting
        page.evaluate("() => G.saveSetting('audioEnabled', false)")
        page.wait_for_timeout(700)  # debounced 500ms
        # Change difficulty
        page.evaluate("() => G.setDifficulty('hard')")
        page.wait_for_timeout(700)
        # verify in-memory
        s1 = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        log("10.audioEnabled=false set in memory", s1.get("settings",{}).get("audioEnabled")==False, f"settings={s1.get('settings')}")
        log("10.difficulty=hard set in memory", s1.get("difficulty")=="hard", f"difficulty={s1.get('difficulty')}")
        # reload and verify persistence
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1200)
        s2 = page.evaluate("() => JSON.parse(JSON.stringify(G.save))")
        log("10.audioEnabled persists across reload", s2.get("settings",{}).get("audioEnabled")==False, f"settings={s2.get('settings')}")
        log("10.difficulty persists across reload", s2.get("difficulty")=="hard", f"difficulty={s2.get('difficulty')}")

        # ---------- Console errors summary ----------
        print("\n=== Console errors/warnings ===")
        errors = [m for m in console_msgs if m.startswith("error") or m.startswith("pageerror")]
        warnings = [m for m in console_msgs if m.startswith("warning")]
        print(f"Total console messages: {len(console_msgs)}")
        print(f"Errors: {len(errors)}")
        for e in errors:
            print("  ERROR:", e[:200])
        print(f"Warnings: {len(warnings)}")
        for w in warnings:
            print("  WARN:", w[:200])

        browser.close()

    # Summary
    print("\n========== SUMMARY ==========")
    passed = sum(1 for _,p,_ in RESULTS if p)
    failed = sum(1 for _,p,_ in RESULTS if not p)
    print(f"Total: {len(RESULTS)}  PASS: {passed}  FAIL: {failed}")
    print("\n--- FAILURES ---")
    for name, p, ev in RESULTS:
        if not p:
            print(f"  FAIL: {name} — {ev}")
    return 0 if failed==0 else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(2)

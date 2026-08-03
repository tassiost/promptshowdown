#!/usr/bin/env python3
"""
Generate varied units using the in-browser LLM forge.
Uses a headed browser (WebGPU required for web-llm).
Outputs generated units as JSON to generated_units.json.
"""
import json, time, sys
from playwright.sync_api import sync_playwright

# Creative prompts for varied units — cover different archetypes, body plans, weapons.
PROMPTS = [
    # Frontline / tanks
    "crystal golem with diamond fists",
    "samurai with a naginata",
    # Carry / ranged DPS
    "frost archer with ice arrows",
    "steamwork sniper with a long rifle",
    # Support
    "mushroom shaman with healing spores",
    # Counter / assassin
    "shadow ninja with chain sickle",
    "scorpion assassin with venom stinger",
    # Utility
    "clockwork engineer with gear turret",
    # Beast units
    "phoenix with fire wings",
    "ice wolf with frozen fangs",
    # Unique concepts
    "void mage with black hole magic",
    "plague doctor with leech syringe",
    "minotaur with battle axe",
    "harpy with wind blades",
    "goblin bomber with dynamite",
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: print(f"[console.{m.type}] {m.text}") if m.type in ("error", "warning") else None)

        print("Loading game...")
        page.goto("http://localhost:5173/", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)

        # Wait for web-llm to load (CDN fetch can take 20+ seconds)
        print("Waiting for web-llm module to load from CDN...")
        for i in range(45):
            page.wait_for_timeout(2000)
            llm_loaded = page.evaluate("window._getW && window._getW() !== null")
            if llm_loaded:
                print(f"  web-llm loaded at t={i*2}s")
                break
        else:
            print("ERROR: web-llm failed to load from CDN after 90s")
            browser.close()
            return

        # Trigger LLM preload
        print("Triggering LLM preload (model download)...")
        page.evaluate("""() => {
            if (typeof window.preloadAI === 'function') {
                window.preloadAI().catch(e => console.warn('preload error:', e.message));
            }
        }""")

        # Wait for LLM to be ready (model download can take 10+ minutes for 1.5B model)
        print("Waiting for LLM model to download and initialize (may take 10+ min for first download)...")
        for i in range(240):
            page.wait_for_timeout(5000)
            ready = page.evaluate("window._getLlmReady && window._getLlmReady()")
            loading = page.evaluate("window._getLlmLoading && window._getLlmLoading()")
            pct = page.evaluate("typeof aiProgress !== 'undefined' ? aiProgress.pct : 0")
            text = page.evaluate("typeof aiProgress !== 'undefined' ? aiProgress.text : ''")
            if i % 6 == 0:  # Print every 30 seconds
                print(f"  t={i*5}s: ready={ready} loading={loading} pct={pct}% {text[:60]}")
            if ready:
                print(f"  LLM ready at t={i*5}s!")
                break
        else:
            print("ERROR: LLM failed to initialize within 20 minutes")
            browser.close()
            return

        # Generate units
        generated = []
        for i, prompt in enumerate(PROMPTS):
            print(f"\n[{i+1}/{len(PROMPTS)}] Generating: '{prompt}'...")
            try:
                # Call generateUnit and wait for the result
                unit_json = page.evaluate("""async (prompt) => {
                    try {
                        const u = await window.generateUnit(prompt, 0);
                        return u ? JSON.stringify(u) : null;
                    } catch(e) {
                        return JSON.stringify({error: e.message});
                    }
                }""", prompt)
                if unit_json:
                    unit = json.loads(unit_json)
                    if "error" in unit:
                        print(f"  ERROR: {unit['error']}")
                    else:
                        print(f"  OK: {unit.get('n', '?')} — HP:{unit.get('h')} DMG:{unit.get('d')} "
                              f"R:{unit.get('r')} S:{unit.get('s')} ability:{unit.get('ability')} "
                              f"role:{unit.get('role')} body:{unit.get('bodyPlan')} "
                              f"weapon:{unit.get('weaponType')}")
                        generated.append(unit)
                else:
                    print("  ERROR: generateUnit returned null")
            except Exception as e:
                print(f"  EXCEPTION: {e}")

            # Save progress after each unit
            with open("generated_units.json", "w") as f:
                json.dump(generated, f, indent=2)

        print(f"\nGenerated {len(generated)} units. Saved to generated_units.json")
        if errors:
            print(f"\nPage errors ({len(errors)}):")
            for e in errors[:10]:
                print(f"  {e}")

        browser.close()

if __name__ == "__main__":
    run()

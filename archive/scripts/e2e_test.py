from playwright.sync_api import sync_playwright
import os, time, json

OUT_DIR = "e2e-screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

def shot(page, name):
    path = os.path.join(OUT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"screenshot: {path}")
    return path

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    logs = []
    errors = []
    page.on("console", lambda msg: logs.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda exc: errors.append(str(exc)))

    page.goto("http://localhost:8765/index.html")
    page.wait_for_timeout(4000)

    # Skip onboarding / ensure menu.
    page.evaluate("if(typeof G!=='undefined' && G._onboardSkip) G._onboardSkip(); else if(typeof G!=='undefined' && G.menu) G.menu();")
    page.wait_for_timeout(500)
    shot(page, "01-main-menu")

    # --- Forge: skip ad (template) ---
    page.click("#forgeMenuBtn")
    page.wait_for_timeout(500)
    shot(page, "02-forge-screen")

    page.fill("#forgePrompt", "ice dragon")
    page.click("#forgeSkipBtn")
    page.wait_for_timeout(1500)
    shot(page, "03-forge-skip-result")

    # --- Forge: watch ad ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    page.evaluate("G.save.forgeCount=0;")
    page.click("#forgeMenuBtn")
    page.wait_for_timeout(300)
    page.fill("#forgePrompt", "fire mage")
    page.click("#forgeGenBtn")
    page.wait_for_timeout(500)
    shot(page, "04-forge-confirmation")
    page.click("#forgeAdYes")
    page.wait_for_timeout(600)
    shot(page, "05-forge-ad-overlay")
    # wait for the result card to appear
    page.wait_for_selector("#forgeActions", state="visible", timeout=15000)
    shot(page, "06-forge-ad-result")

    # --- Deck ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    page.click("button:has-text('DECK')")
    page.wait_for_timeout(500)
    shot(page, "07-deck")

    # --- Codex ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    page.click("button:has-text('CODEX')")
    page.wait_for_timeout(500)
    shot(page, "08-codex")

    # --- Shop ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    page.click("button:has-text('SHOP')")
    page.wait_for_timeout(500)
    shot(page, "09-shop")

    # --- Upgrade ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    page.click("button:has-text('UPGRADE')")
    page.wait_for_timeout(500)
    shot(page, "10-upgrade")

    # --- Settings ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    page.click("button:has-text('Settings')")
    page.wait_for_timeout(500)
    shot(page, "11-settings")

    # --- Quick match ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(300)
    page.click("button:has-text('QUICK MATCH')")
    page.wait_for_timeout(1500)
    shot(page, "12-quick-match")

    # --- Main menu again ---
    page.evaluate("G.menu();")
    page.wait_for_timeout(500)
    shot(page, "13-main-menu-end")

    # Persist logs
    with open(os.path.join(OUT_DIR, "console-logs.json"), "w") as f:
        json.dump({"logs": logs, "errors": errors}, f, indent=2)

    print(f"errors: {len(errors)}")
    for e in errors[-10:]:
        print("  PAGEERROR:", e)

    browser.close()

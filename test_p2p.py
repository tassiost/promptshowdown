#!/usr/bin/env python3
"""
P2P multiplayer test script.
Opens two Chromium browsers, connects them via P2P, drafts armies, and fights.
"""
import asyncio
import sys
from playwright.async_api import async_playwright

URL = "http://localhost:8765/index.html"
ROOM_ID = "p2p-test-battle-001"
SCREENSHOT_DIR = "/Users/tassio/Downloads/promptshowdown/p2p-test-screenshots"

import os
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def wait_for_screen(page, screen_id, timeout=15000):
    """Wait until the given screen ID is active."""
    start = asyncio.get_event_loop().time()
    while asyncio.get_event_loop().time() - start < timeout / 1000:
        active = await page.evaluate("""(id) => {
            const el = document.getElementById(id);
            return el && el.classList.contains('active');
        }""", screen_id)
        if active:
            return True
        await asyncio.sleep(0.3)
    return False

async def get_active_screen(page):
    """Return the ID of the currently active screen."""
    return await page.evaluate("""() => {
        const el = document.querySelector('.screen.active');
        return el ? el.id : null;
    }""")

async def get_p2p_log(page):
    """Get the P2P test debug log."""
    return await page.evaluate("""() => {
        const el = document.getElementById('p2pTestLog');
        return el ? el.textContent : '';
    }""")

async def get_p2p_status(page):
    """Get P2P test status fields."""
    return await page.evaluate("""() => ({
        role: document.getElementById('p2pTestRole')?.textContent || '',
        connected: document.getElementById('p2pTestConnected')?.textContent || '',
        waitTime: document.getElementById('p2pTestWait')?.textContent || '',
        sent: document.getElementById('p2pTestSent')?.textContent || '',
        recv: document.getElementById('p2pTestRecv')?.textContent || '',
    })""")

async def pick_draft_cards(page, label, count=4):
    """Pick draft cards by clicking the first card repeatedly."""
    for i in range(count):
        await asyncio.sleep(0.5)
        clicked = await page.evaluate("""() => {
            const cards = document.querySelectorAll('#draftArea .card');
            if (cards.length > 0) {
                cards[0].click();
                return true;
            }
            return false;
        }""")
        if not clicked:
            print(f"  [{label}] No cards to pick at iteration {i+1}")
            return False
        print(f"  [{label}] Picked card {i+1}/{count}")
    return True

async def run_player(playwright, browser, player_name, is_host):
    """Run a single player through the P2P match flow using queue matchmaking."""
    context = await browser.new_context(
        viewport={"width": 420, "height": 800},
    )
    page = await context.new_page()

    # Collect console messages
    errors = []
    all_logs = []
    page.on("console", lambda msg: (errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None, all_logs.append(f"[{msg.type}] {msg.text}")))

    print(f"\n{'='*60}")
    print(f"[{player_name}] Navigating to game...")
    await page.goto(URL, wait_until="networkidle")

    # Use the FIGHT button (queue matchmaking) instead of P2P test mode
    print(f"[{player_name}] Clicking FIGHT (entering queue)...")
    await page.evaluate("G.startMatchmaking()")
    await asyncio.sleep(0.5)

    # Check we're on the matchmaking screen
    screen = await get_active_screen(page)
    if screen != "matchmaking":
        print(f"[{player_name}] Not on matchmaking screen. Current: {screen}")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-no-matchmaking.png")
        await context.close()
        return None

    status = await page.evaluate("() => document.getElementById('matchmakingStatus')?.textContent || ''")
    print(f"[{player_name}] Matchmaking status: {status}")
    await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-queue.png")

    # Wait for connection (up to 60 seconds — queue waits indefinitely)
    print(f"[{player_name}] Waiting in queue (up to 60s)...")
    connected = False
    for attempt in range(120):
        await asyncio.sleep(0.5)
        screen = await get_active_screen(page)
        # If we've left matchmaking screen, we either connected or cancelled
        if screen != "matchmaking":
            connected = True
            print(f"[{player_name}] Left matchmaking screen -> {screen}")
            break
        if attempt % 10 == 0:
            status = await page.evaluate("() => document.getElementById('matchmakingStatus')?.textContent || ''")
            print(f"[{player_name}] Still in queue... {status}")

    if not connected:
        print(f"[{player_name}] FAILED to connect within 60s")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-timeout.png")
        await context.close()
        return None

    # Wait for draft screen
    print(f"[{player_name}] Waiting for draft screen...")
    on_draft = await wait_for_screen(page, "draft", timeout=15000)
    if not on_draft:
        screen = await get_active_screen(page)
        print(f"[{player_name}] Not on draft screen. Current: {screen}")
        log = await get_p2p_log(page)
        print(f"[{player_name}] Log:\n{log}")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-no-draft.png")
        await context.close()
        return None

    print(f"[{player_name}] On draft screen! Picking cards...")
    await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-draft.png")

    # Pick draft cards
    success = await pick_draft_cards(page, player_name, count=4)
    if not success:
        screen = await get_active_screen(page)
        print(f"[{player_name}] Draft picking failed. Current screen: {screen}")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-draft-fail.png")
        await context.close()
        return None

    # Wait for scout screen
    await asyncio.sleep(1)
    screen = await get_active_screen(page)
    print(f"[{player_name}] After draft, on screen: {screen}")
    await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-scout.png")

    # Click "To Battle" if on scout screen
    if screen == "scout":
        print(f"[{player_name}] Clicking To Battle...")
        await page.evaluate("G.startBattle()")
        await asyncio.sleep(1)

    # Wait for battle screen (or result screen if battle already ended)
    print(f"[{player_name}] Waiting for battle screen...")
    on_battle = await wait_for_screen(page, "battle", timeout=10000)
    if not on_battle:
        screen = await get_active_screen(page)
        if screen == "result":
            print(f"[{player_name}] Battle already ended — on result screen (fast battle)")
        else:
            print(f"[{player_name}] Not on battle screen. Current: {screen}")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-no-battle.png")
            await context.close()
            return None
    else:
        print(f"[{player_name}] On battle screen!")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-battle.png")

        # Check battle HUD
        hud_info = await page.evaluate("""() => ({
            hudExists: !!document.getElementById('battleHUD'),
            playerName: document.getElementById('hudPlayerName')?.textContent || '',
            playerHearts: document.getElementById('hudPlayerHearts')?.innerHTML || '',
            enemyName: document.getElementById('hudEnemyName')?.textContent || '',
            enemyHearts: document.getElementById('hudEnemyHearts')?.innerHTML || '',
            round: document.getElementById('hudRound')?.textContent || '',
            battleHP: document.getElementById('battleHP')?.textContent || '',
            battleEnemy: document.getElementById('battleEnemy')?.textContent || '',
        })""")
        print(f"[{player_name}] Battle HUD: {hud_info}")

        # Run the battle - click tick/skip multiple times
        # Host: wait 2s before skipping so the guest has time to render
        if is_host:
            await asyncio.sleep(2)
        print(f"[{player_name}] Running battle (clicking skip)...")
        for i in range(10):
            await asyncio.sleep(1)
            # Try to skip the battle
            await page.evaluate("""() => {
                if (typeof G.skip === 'function') G.skip();
                else if (typeof G.tick === 'function') G.tick();
            }""")
            screen = await get_active_screen(page)
            if screen != "battle":
                print(f"[{player_name}] Battle ended! Now on: {screen}")
                break
            if i % 3 == 0:
                print(f"[{player_name}] Battle tick {i+1}/10, screen: {screen}")
                await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-battle-{i+1}.png")

    # Check final screen
    screen = await get_active_screen(page)
    print(f"[{player_name}] Final screen: {screen}")
    await page.screenshot(path=f"{SCREENSHOT_DIR}/{player_name}-final.png")

    # Get result info if on result screen
    if screen == "result":
        result_info = await page.evaluate("""() => ({
            text: document.querySelector('#result h2, #result h1, #result .result-victory, #result .result-defeat')?.textContent || '',
            bodyText: document.getElementById('result')?.textContent?.slice(0, 200) || '',
        })""")
        print(f"[{player_name}] Result: {result_info}")

    # Final P2P log
    log = await get_p2p_log(page)
    print(f"[{player_name}] Final P2P Log:\n{log}")

    # Console errors
    if errors:
        print(f"[{player_name}] Console errors: {errors[:5]}")  # first 5 only
    else:
        print(f"[{player_name}] No console errors!")
    
    # Console logs (for debugging)
    if all_logs:
        relevant = [l for l in all_logs if "roundResult" in l or "checkEnd" in l or "networkReceive" in l]
        if relevant:
            print(f"[{player_name}] Relevant console logs:")
            for l in relevant[:10]:
                print(f"  {l}")

    await asyncio.sleep(2)
    await context.close()
    return screen


async def main():
    print("="*60)
    print("P2P Multiplayer Test — Two Browser Match")
    print("="*60)
    print(f"URL: {URL}")
    print(f"Room: {ROOM_ID}")
    print(f"Screenshots: {SCREENSHOT_DIR}")

    async with async_playwright() as p:
        # Launch a single browser with two contexts (shares cookies/cache
        # but separate pages — trystero P2P works across contexts).
        browser = await p.chromium.launch(headless=True)

        # Run both players concurrently — both enter the queue at the same time.
        # The queue matchmaking will match them with each other.
        host_task = asyncio.create_task(
            run_player(p, browser, "PLAYER1", is_host=True)
        )
        # Small delay so player1 enters queue first
        await asyncio.sleep(1)
        guest_task = asyncio.create_task(
            run_player(p, browser, "PLAYER2", is_host=False)
        )

        host_result = await host_task
        guest_result = await guest_task

        await browser.close()

    print("\n" + "="*60)
    print("P2P TEST SUMMARY")
    print("="*60)
    print(f"Player1 final screen:  {host_result}")
    print(f"Player2 final screen: {guest_result}")

    if host_result and guest_result:
        print("\n✅ Both players completed the match!")
        if host_result == "result" and guest_result == "result":
            print("✅ Both reached the result screen — P2P match worked end-to-end!")
        else:
            print("⚠️  Match completed but one or both didn't reach result screen.")
    else:
        print("\n❌ P2P test FAILED — one or both players couldn't connect/complete.")
        print("   Check screenshots in:", SCREENSHOT_DIR)

    print(f"\nScreenshots saved to: {SCREENSHOT_DIR}/")
    print("  - *-connected.png  — P2P connection established")
    print("  - *-draft.png      — Draft screen")
    print("  - *-scout.png      — Scout screen")
    print("  - *-battle.png     — Battle screen")
    print("  - *-final.png      — Final screen")


if __name__ == "__main__":
    asyncio.run(main())

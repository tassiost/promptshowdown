---
name: test
description: Run the full E2E test suite (184 tests covering all game flows)
triggers:
  - user
allowed-tools:
  - read
  - exec
  - grep
permissions:
  allow:
    - Exec(python3 *)
    - Exec(lsof *)
    - Exec(kill *)
    - Exec(sleep *)
---

Run the Prompt Showdown E2E test suite. This covers 184 tests across all game flows:
page load, onboarding, all screens, settings, forge, deck, draft, battle edge cases,
all 21 abilities, all 11 spell effects, match flow, save/load, quests, achievements,
arena mechanics, replays, URL import, and console errors.

## Steps

1. Kill any existing server on port 8765:
   ```
   lsof -ti:8765 | xargs kill -9 2>/dev/null; sleep 1
   ```

2. Start a fresh HTTP server in the project directory:
   ```
   cd /Users/tassio/Downloads/promptshowdown && python3 -m http.server 8765 &>/dev/null &
   sleep 2
   ```

3. Run the canonical test suite:
   ```
   cd /Users/tassio/Downloads/promptshowdown && python3 e2e_test.py
   ```

4. Report the results. The test suite prints a summary at the end:
   ```
   PASS:     184
   FAIL:     0
   WARN:     0
   ERRORS:   0
   BUGS:     []
   ```

5. If any tests fail, investigate the failure details and report what broke.
   Do NOT fix bugs in this skill — use the /bughunt skill for that.

6. Clean up the server when done:
   ```
   lsof -ti:8765 | xargs kill -9 2>/dev/null
   ```

## Notes

- The test suite uses Playwright with headless Chromium.
- Tests take ~60-90 seconds to complete.
- The server must be on port 8765 (the tests hardcode this URL).
- CORS errors in console are filtered out (expected with localhost).
- If Playwright is not installed, run: `pip install playwright && python3 -m playwright install chromium`

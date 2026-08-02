---
name: bughunt
description: Hunt for bugs — static analysis of code + run E2E test suite
triggers:
  - user
allowed-tools:
  - read
  - exec
  - grep
  - glob
permissions:
  allow:
    - Exec(python3 *)
    - Exec(lsof *)
    - Exec(kill *)
    - Exec(sleep *)
    - Exec(git *)
---

Perform a systematic bug hunt on the Prompt Showdown codebase. This is a two-phase
process: static code analysis followed by E2E test verification.

## Phase 1: Static Analysis

Search for common bug patterns in `index.html` (the entire game is in one ~13K line file):

1. **Null/undefined access** — grep for patterns like `.length` on potentially undefined
   arrays, property access on optional chaining without null checks:
   ```
   grep -n "\.save\.\w+\." index.html  # save field access without guard
   grep -n "reduce\|map\|filter\|forEach" index.html  # array methods on possibly-empty arrays
   ```

2. **Race conditions** — grep for timer/interval patterns that might overlap:
   ```
   grep -n "setInterval\|setTimeout\|requestAnimationFrame" index.html
   grep -n "_draftPicking\|_initialized\|running" index.html  # state flags
   ```

3. **Status effect stacking** — check that all status effects use `Math.max` not `=`:
   ```
   grep -n "u\.shield\|u\.slow\|u\.poison\|u\.stun\|u\.regen" index.html
   ```

4. **Kill attribution** — every HP reduction must set `lastAttacker`:
   ```
   grep -n "u\.h\s*[-+]=" index.html  # find all HP modifications
   grep -n "lastAttacker" index.html  # verify attribution
   ```

5. **XSS vectors** — any `innerHTML` with user-generated strings:
   ```
   grep -n "innerHTML.*\${" index.html  # template literals in innerHTML
   grep -n "innerHTML.*u\.n\|innerHTML.*\.name" index.html  # unit/spell names
   ```

6. **Spell validation** — all spell enums validated before use:
   ```
   grep -n "SPELL_EFFECT\|SPELL_SHAPE\|SPELL_TARGET" index.html
   ```

7. **P2P security** — all incoming messages validated:
   ```
   grep -n "networkReceive\|applyRemoteSnapshot\|transmit" index.html
   ```

8. **Save migration** — check `migrateSave` covers all versions:
   ```
   grep -n "migrateSave\|save\.version" index.html
   ```

9. **Performance regressions** — check for `for...of` in hot paths and per-frame allocations:
   ```
   grep -n "for.*of this\.units\|for.*of this\.projectiles\|for.*of Battle\.particles" index.html
   grep -n "\.filter(\|\.map(\|\.reduce(" index.html | grep -v "// "
   ```

10. **Canvas state leaks** — check that `save()`/`restore()` are balanced, `globalAlpha`
    is reset, `fillStyle`/`strokeStyle` don't leak between draws:
    ```
    grep -n "c\.save()\|c\.restore()" index.html
    grep -n "globalAlpha" index.html
    ```

For each potential issue found, read the surrounding code to determine if it's a real bug
or a false positive. Log real bugs with severity (CRITICAL/MAJOR/MINOR).

## Phase 2: E2E Test Verification

After static analysis, run the E2E test suite to verify no regressions:

1. Kill existing server: `lsof -ti:8765 | xargs kill -9 2>/dev/null; sleep 1`
2. Start server: `cd /Users/tassio/Downloads/promptshowdown && python3 -m http.server 8765 &>/dev/null & sleep 2`
3. Run tests: `cd /Users/tassio/Downloads/promptshowdown && python3 e2e_test.py`
4. Clean up: `lsof -ti:8765 | xargs kill -9 2>/dev/null`

## Phase 3: Report

Summarize findings:
- **Bugs found**: list each with ID, severity, area, description, and suggested fix
- **E2E results**: pass/fail counts
- **Recommendations**: what to fix first, ordered by severity

## Bug Hunt Session Format

When doing a dedicated bug hunt session, create a `archive/bug-hunt/BUG_HUNT_SESSION_N.md`
file with:
- Date and scope
- Bugs found (with ID, severity, area, reproduction steps)
- Fixes applied (if any — normally bugs are only identified, not fixed, in this skill)
- Tests added (if any)
- Remaining issues

This creates a historical record that future sessions can reference to avoid re-finding
the same bugs.

## Important Rules

- **Do NOT fix bugs in this skill.** Only identify and report them. The user will decide
  what to fix and can ask you to fix specific bugs in a follow-up.
- **Do NOT modify `index.html`** during the bug hunt. Read-only analysis.
- **Check AGENTS.md** for the project's critical invariants before reporting something as a
  bug — it might be an intentional design decision documented there.
- **Use the /battle-rules, /system-rules, and /render-rules skills** for detailed knowledge
  about specific subsystems when analyzing code in those areas.
- **Check `docs/FILE_MAP.md`** to find the right line ranges for the subsystem you're analyzing.

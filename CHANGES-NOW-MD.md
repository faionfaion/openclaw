# Changes: Add NOW.md as Auto-Loaded Workspace Bootstrap File

**Date:** 2026-02-16
**File modified:** `src/agents/workspace.ts`

## Changes Made

1. **Added constant** `DEFAULT_NOW_FILENAME = "NOW.md"` (after `DEFAULT_AGENT_WORKSPACE_DIR`)

2. **Added to `WorkspaceBootstrapFileName` type union** — `typeof DEFAULT_NOW_FILENAME` as the first union member

3. **Added to `VALID_BOOTSTRAP_NAMES` set** — `DEFAULT_NOW_FILENAME` as the first entry

4. **Added to `loadWorkspaceBootstrapFiles` entries array** — as the FIRST entry (before AGENTS.md), so NOW.md appears first in the injected context

5. **NOT added to `MINIMAL_BOOTSTRAP_ALLOWLIST`** — subagents and cron sessions don't receive NOW.md

## Verification

- `npx tsc --noEmit` passes with exit code 0
- No other files needed modification

---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - INSTALL.md
  - packages/telegram/src/auth/pairing.ts
  - packages/cli/src/hooks/useWebSocket.ts
  - packages/gateway/test-stream.mjs
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "No non-migration references to AgentSpace remain in source code or docs"
    - "INSTALL.md git clone URL and cd commands reference tek, not AgentSpace"
    - "All JSDoc comments reference tek/Tek, not AgentSpace"
  artifacts:
    - path: "INSTALL.md"
      provides: "Installation documentation with correct repo name"
      contains: "git clone.*tek"
    - path: "packages/telegram/src/auth/pairing.ts"
      provides: "Corrected JSDoc comment"
    - path: "packages/cli/src/hooks/useWebSocket.ts"
      provides: "Corrected JSDoc comment"
    - path: "packages/gateway/test-stream.mjs"
      provides: "Corrected import path"
  key_links: []
---

<objective>
Replace remaining AgentSpace references with tek in install documentation and source code comments.

Purpose: Complete the Phase 13 rebrand by catching references that were missed in the initial pass -- specifically the INSTALL.md git clone URL, JSDoc comments in two source files, and an import in a test file.
Output: Clean codebase with no non-migration AgentSpace references.
</objective>

<execution_context>
@/Users/hitekmedia/.claude/get-shit-done/workflows/execute-plan.md
@/Users/hitekmedia/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@INSTALL.md
@packages/telegram/src/auth/pairing.ts
@packages/cli/src/hooks/useWebSocket.ts
@packages/gateway/test-stream.mjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update INSTALL.md repo references and remaining source comments</name>
  <files>INSTALL.md, packages/telegram/src/auth/pairing.ts, packages/cli/src/hooks/useWebSocket.ts, packages/gateway/test-stream.mjs</files>
  <action>
Update INSTALL.md:
- Line 15: Change `git clone https://github.com/hitekmedia/AgentSpace.git` to `git clone https://github.com/hitekmedia/tek.git`
- Line 16: Change `cd AgentSpace` to `cd tek`
- Line 79: Change `cd AgentSpace` to `cd tek`

Update packages/telegram/src/auth/pairing.ts:
- Line 38: Change "link the Telegram user to AgentSpace" to "link the Telegram user to Tek"

Update packages/cli/src/hooks/useWebSocket.ts:
- Line 18: Change "connection to the AgentSpace gateway" to "connection to the Tek gateway"

Update packages/gateway/test-stream.mjs:
- Line 3: Change `from '@agentspace/cli/vault'` to `from '@tek/cli/vault'`

DO NOT change any migration/backward-compat code:
- scripts/install.sh lines 60-68 (old config migration) -- intentional
- packages/cli/src/vault/keychain.ts (old keychain migration) -- intentional
- packages/cli/src/index.ts (old config dir migration) -- intentional
- packages/core/src/errors.ts AgentSpaceError alias -- intentional backward compat
  </action>
  <verify>
Run: `grep -rn --include='*.ts' --include='*.mjs' --include='*.md' 'AgentSpace\|agentspace\|@agentspace' --exclude-dir=node_modules --exclude-dir=.planning .` and confirm only intentional migration references remain (in keychain.ts, cli/src/index.ts, errors.ts, core/src/index.ts export, and install.sh migration block).
  </verify>
  <done>INSTALL.md shows tek repo URL, all JSDoc comments reference Tek, test file uses @tek scope. Only intentional migration/backward-compat code still references agentspace.</done>
</task>

</tasks>

<verification>
Run grep across the entire repo (excluding node_modules and .planning) for AgentSpace/agentspace. Only the following files should have matches, and only in migration/compat context:
- scripts/install.sh (old config migration)
- packages/cli/src/vault/keychain.ts (old keychain migration)
- packages/cli/src/index.ts (old config dir migration)
- packages/core/src/errors.ts (AgentSpaceError backward-compat alias)
- packages/core/src/index.ts (re-export of AgentSpaceError alias)
</verification>

<success_criteria>
Zero non-migration AgentSpace references in source code, scripts, and documentation.
</success_criteria>

<output>
After completion, create `.planning/quick/2-update-install-docs-with-new-tek-naming/2-SUMMARY.md`
</output>

---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [INSTALL.md]
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "INSTALL.md references tek gateway start instead of raw node commands"
    - "INSTALL.md documents tek uninstall command"
    - "INSTALL.md documents tek init re-run with skip support"
    - "INSTALL.md onboarding steps include model selection from catalog"
  artifacts:
    - path: "INSTALL.md"
      provides: "Accurate install/usage documentation reflecting Phase 14 changes"
      contains: "tek gateway start"
  key_links: []
---

<objective>
Update INSTALL.md to reflect all Phase 14 CLI changes: gateway subcommand, tek uninstall, skippable onboarding, and model catalog.

Purpose: Documentation is stale — still references raw `node ~/tek/packages/gateway/dist/index.js` commands and manual uninstall steps, doesn't mention re-runnable `tek init` or model selection during onboarding.
Output: Updated INSTALL.md accurate to current CLI capabilities.
</objective>

<execution_context>
@/Users/hitekmedia/.claude/get-shit-done/workflows/execute-plan.md
@/Users/hitekmedia/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@INSTALL.md
@.planning/phases/14-cli-setup-polish-gateway-subcommand-skippable-setup-steps-full-model-catalog-recommended-models-tek-uninstall/14-01-SUMMARY.md
@.planning/phases/14-cli-setup-polish-gateway-subcommand-skippable-setup-steps-full-model-catalog-recommended-models-tek-uninstall/14-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update INSTALL.md for Phase 14 changes</name>
  <files>INSTALL.md</files>
  <action>
Update INSTALL.md with the following changes (keep all existing structure and sections intact):

**Section "Run onboarding" (after PATH setup):**
- Update the onboarding step list to include model selection:
  1. Choosing a security mode (Full Control or Limited Control)
  2. Adding API keys (stored in macOS Keychain, not on disk)
  3. Selecting a default model from the full provider catalog (with recommendations marked)
  4. Configuring model aliases (fast, balanced, premium)
  5. Creating `~/.config/tek/config.json`
  6. Generating an auth token
- Add a note after the step list: "Already set up? Running `tek init` again lets you skip any step that already has a value — just select 'Keep current' to move on."

**Section "Start the gateway":**
- Replace `node ~/tek/packages/gateway/dist/index.js` with `tek gateway start`
- Update the comment from "Terminal 1:" to just show the command
- Add brief note: "Use `tek gateway stop` to shut it down, or `tek gateway status` to check if it's running."

**Section "Updating" — after-update restart:**
- Replace `node ~/tek/packages/gateway/dist/index.js` with `tek gateway start`

**Section "Uninstalling" (section 4):**
- Replace the manual uninstall steps with the `tek uninstall` command as the primary method:
  ```
  tek uninstall
  ```
  Describe what it does: removes install directory, config/data directory, API keys from Keychain, and launchd plist if present. Requires typing UNINSTALL to confirm.
- Keep a "Manual uninstall" subsection with the existing manual steps as a fallback (in case the CLI is already deleted or broken).
- Update the manual steps to also mention `tek uninstall` won't edit PATH — remind to remove the PATH entry manually.

**Section "Troubleshooting":**
- Update "Gateway won't start after update" to reference `tek gateway start` instead of raw node command.
  </action>
  <verify>
Grep INSTALL.md for "node ~/tek/packages/gateway" — should return zero matches.
Grep INSTALL.md for "tek gateway start" — should return matches in install, update, and troubleshooting sections.
Grep INSTALL.md for "tek uninstall" — should return matches.
Grep INSTALL.md for "Keep current" or "skip" — should return match in onboarding section.
  </verify>
  <done>INSTALL.md accurately documents tek gateway start/stop/status, tek uninstall, skippable onboarding with model catalog, and contains no references to raw node gateway commands.</done>
</task>

</tasks>

<verification>
- No references to `node ~/tek/packages/gateway/dist/index.js` remain in INSTALL.md
- `tek gateway start` appears in fresh install, update, and troubleshooting sections
- `tek uninstall` documented as primary uninstall method
- Onboarding steps include model selection and re-run skip support
</verification>

<success_criteria>
INSTALL.md is fully accurate to the current CLI after Phase 14. A new user following the doc would use `tek gateway start`, know about `tek uninstall`, and understand that `tek init` can be re-run with skip support.
</success_criteria>

<output>
After completion, create `.planning/quick/4-update-install-docs-and-scripts-for-phas/4-SUMMARY.md`
</output>

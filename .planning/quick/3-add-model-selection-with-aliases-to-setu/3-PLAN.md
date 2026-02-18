---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/core/src/config/schema.ts
  - packages/core/src/config/loader.ts
  - packages/cli/src/components/Onboarding.tsx
  - packages/cli/src/commands/init.ts
  - packages/cli/src/hooks/useSlashCommands.ts
  - packages/cli/src/hooks/useChat.ts
  - packages/cli/src/components/Chat.tsx
  - packages/gateway/src/llm/registry.ts
  - packages/gateway/src/session/types.ts
  - packages/gateway/src/ws/handlers.ts
autonomous: true
requirements:
  - model-selection-onboarding
  - model-aliases
  - swap-command
  - fix-default-model
must_haves:
  truths:
    - "User can select a default model during onboarding after configuring provider keys"
    - "User can assign short aliases to models during onboarding (e.g. 'sonnet', 'minimax')"
    - "User can type /swap sonnet in chat and the active model switches to the aliased provider:model"
    - "Default model respects user's configured provider choice instead of hardcoded anthropic sonnet"
    - "Model aliases persist in config.json across restarts"
  artifacts:
    - path: "packages/core/src/config/schema.ts"
      provides: "ModelAlias schema and modelAliases + defaultModel fields on AppConfig"
      contains: "modelAliases"
    - path: "packages/cli/src/components/Onboarding.tsx"
      provides: "Model selection and alias assignment steps in wizard"
      contains: "model-select"
    - path: "packages/cli/src/hooks/useSlashCommands.ts"
      provides: "/swap slash command"
      contains: "case \"swap\""
  key_links:
    - from: "packages/cli/src/hooks/useSlashCommands.ts"
      to: "packages/core/src/config/loader.ts"
      via: "loadConfig to resolve alias to provider:model"
      pattern: "loadConfig.*modelAliases"
    - from: "packages/gateway/src/ws/handlers.ts"
      to: "packages/core/src/config/loader.ts"
      via: "reads defaultModel from config instead of hardcoded DEFAULT_MODEL"
      pattern: "loadConfig.*defaultModel"
---

<objective>
Add model selection with aliases to the onboarding wizard and a /swap command in chat, plus fix the hardcoded default model issue.

Purpose: User set up Venice as their provider but the system ignores this and defaults to Anthropic Sonnet. This adds a model selection step to onboarding where users pick a default model, assign short aliases, and can /swap between them in chat.

Output: Updated onboarding wizard, config schema with model aliases, /swap command, and config-driven default model.
</objective>

<execution_context>
@/Users/hitekmedia/.claude/get-shit-done/workflows/execute-plan.md
@/Users/hitekmedia/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@packages/core/src/config/schema.ts
@packages/core/src/config/loader.ts
@packages/core/src/config/types.ts
@packages/cli/src/components/Onboarding.tsx
@packages/cli/src/commands/init.ts
@packages/cli/src/hooks/useSlashCommands.ts
@packages/cli/src/hooks/useChat.ts
@packages/cli/src/components/Chat.tsx
@packages/gateway/src/llm/registry.ts
@packages/gateway/src/session/types.ts
@packages/gateway/src/ws/handlers.ts
@packages/gateway/src/llm/router-rules.ts
@packages/cli/src/vault/providers.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add model aliases to config schema and fix default model resolution</name>
  <files>
    packages/core/src/config/schema.ts
    packages/core/src/config/loader.ts
    packages/core/src/config/index.ts
    packages/gateway/src/session/types.ts
    packages/gateway/src/ws/handlers.ts
    packages/cli/src/hooks/useChat.ts
  </files>
  <action>
1. In `packages/core/src/config/schema.ts`:
   - Add a `ModelAliasSchema` as `z.object({ alias: z.string(), modelId: z.string() })` where modelId is provider-qualified (e.g. "venice:minimax-01", "anthropic:claude-sonnet-4-5-20250929")
   - Add two new optional fields to `AppConfigSchema`:
     - `defaultModel: z.string().optional()` — provider-qualified model ID the user chose as default
     - `modelAliases: z.array(ModelAliasSchema).optional()` — array of alias-to-modelId mappings
   - Export `ModelAlias` type

2. In `packages/core/src/config/loader.ts`:
   - Add `resolveAlias(alias: string): string | null` function that loads config, searches modelAliases array for matching alias (case-insensitive), returns the modelId or null
   - Add `getDefaultModel(): string` function that loads config, returns `config.defaultModel` if set, otherwise falls back to the first available provider's standard model (NOT hardcoded anthropic). Logic: check which providers have keys via a simple config check, pick the first one found. If none, return "anthropic:claude-sonnet-4-5-20250929" as absolute fallback.
   - Export both functions from `packages/core/src/config/index.ts`

3. Fix the hardcoded DEFAULT_MODEL problem:
   - In `packages/gateway/src/session/types.ts`: remove the hardcoded `DEFAULT_MODEL` export (or keep it as an absolute fallback constant renamed to `FALLBACK_MODEL`)
   - In `packages/gateway/src/ws/handlers.ts` line ~259: instead of using `DEFAULT_MODEL` when `msg.model` is not provided, call `getDefaultModel()` from `@tek/core` to get the user's configured default. Import `getDefaultModel` from `@tek/core`.
   - In `packages/cli/src/hooks/useChat.ts` line ~49: replace the hardcoded `DEFAULT_MODEL = "claude-sonnet-4-5-20250929"` with a call to `getDefaultModel()` from `@tek/core` (note: this is a React hook file, so call it at module level or in the hook init). Since loadConfig is synchronous, this is safe to call at module level: `const DEFAULT_MODEL = getDefaultModel();`

Note: `getDefaultModel()` should use the vault's `getKey` from `@tek/cli/vault` to check which providers have keys. However, since `@tek/core` should not depend on `@tek/cli`, instead have `getDefaultModel()` just read `config.defaultModel` from config.json and fall back to "anthropic:claude-sonnet-4-5-20250929" if not set. The onboarding wizard will ensure defaultModel is always written. For the gateway handler, it can import `getDefaultModel` from `@tek/core` since it already imports from there.
  </action>
  <verify>
    Run `cd /Users/hitekmedia/Documents/GitHub/tek && npx tsc --noEmit -p packages/core/tsconfig.json` and `npx tsc --noEmit -p packages/gateway/tsconfig.json` and `npx tsc --noEmit -p packages/cli/tsconfig.json` — all pass with no errors.
  </verify>
  <done>
    - Config schema accepts modelAliases and defaultModel fields
    - resolveAlias() returns provider-qualified model ID for a given alias
    - getDefaultModel() returns user's chosen default from config, not hardcoded anthropic
    - Gateway and CLI both use config-driven default model
  </done>
</task>

<task type="auto">
  <name>Task 2: Add model selection step to onboarding wizard</name>
  <files>
    packages/cli/src/components/Onboarding.tsx
    packages/cli/src/commands/init.ts
  </files>
  <action>
1. In `packages/cli/src/components/Onboarding.tsx`:
   - Add new OnboardingStep values: "model-select" and "model-alias"
   - Add state: `defaultModel: string`, `modelAliases: Array<{alias: string, modelId: string}>`, `availableModels: Array<{label: string, value: string}>` (provider-qualified IDs)
   - After the "keys-more" / "keys-ask" flow completes (when transitioning to "summary"), instead transition to "model-select"
   - Build a list of well-known models per configured provider. Use a hardcoded map of popular models per provider:
     ```
     anthropic: claude-sonnet-4-5-20250929, claude-haiku-4-5-20250929, claude-opus-4-5-20250929
     openai: gpt-4o, gpt-4o-mini, o3-mini
     venice: minimax-01, llama-3.3-70b, dolphin-2.9.2-qwen2-72b
     google: gemini-2.5-pro-preview-05-06, gemini-2.0-flash
     ollama: (skip — user needs to know their local model names)
     ```
     Filter this list to only show models from providers the user just added keys for.
   - "model-select" step: Show a `<Select>` with available models (provider-qualified labels like "anthropic:claude-sonnet-4-5-20250929"). User picks default. Also show option "Skip — use first available" at the bottom.
   - After selecting default, transition to "model-alias" step
   - "model-alias" step: For each enabled model (the ones from the available list), ask the user to type a short alias or press Enter to skip. Use a sequential flow: show model name, `<TextInput>` for alias. After all models processed (or user types "done"), transition to "summary".
     Implementation: track `aliasIndex` state, show one model at a time. If user enters empty string, skip that model. If user types "done", skip remaining.
   - Update `OnboardingResult` interface to include `defaultModel?: string` and `modelAliases?: Array<{alias: string, modelId: string}>`
   - Show aliases in the "summary" step

2. In `packages/cli/src/commands/init.ts`:
   - In the `onComplete` callback, save `result.defaultModel` and `result.modelAliases` to the config object before calling `saveConfig(config)`:
     ```
     config.defaultModel = result.defaultModel;
     config.modelAliases = result.modelAliases;
     ```

Keep the UI simple — no fancy multi-select. One model at a time for alias assignment. The Select component from @inkjs/ui works for the default model selection.
  </action>
  <verify>
    Run `cd /Users/hitekmedia/Documents/GitHub/tek && npx tsc --noEmit -p packages/cli/tsconfig.json` — passes with no errors.
    Manually verify by running `node packages/cli/dist/index.js init` (after building) and checking the onboarding flow includes model selection.
  </verify>
  <done>
    - Onboarding wizard shows available models after provider key setup
    - User can select a default model from the list
    - User can assign short aliases to each available model
    - Default model and aliases are saved to config.json
    - Summary step shows the selected default and aliases
  </done>
</task>

<task type="auto">
  <name>Task 3: Add /swap slash command for model switching by alias</name>
  <files>
    packages/cli/src/hooks/useSlashCommands.ts
    packages/cli/src/components/Chat.tsx
  </files>
  <action>
1. In `packages/cli/src/hooks/useSlashCommands.ts`:
   - Import `loadConfig` from `@tek/core`
   - Add a "swap" case to the switch statement:
     ```
     case "swap": {
       const alias = args.join(" ").trim();
       if (!alias) {
         // Show available aliases from config
         const cfg = loadConfig();
         const aliases = cfg?.modelAliases ?? [];
         if (aliases.length === 0) {
           return { handled: true, message: systemMessage("No model aliases configured. Run 'tek init' to set up aliases.") };
         }
         const list = aliases.map(a => `  ${a.alias} -> ${a.modelId}`).join("\n");
         return { handled: true, message: systemMessage(`Available aliases:\n${list}\n\nUsage: /swap <alias>`) };
       }
       // Resolve alias
       const cfg = loadConfig();
       const found = cfg?.modelAliases?.find(a => a.alias.toLowerCase() === alias.toLowerCase());
       if (!found) {
         const available = cfg?.modelAliases?.map(a => a.alias).join(", ") ?? "none";
         return { handled: true, message: systemMessage(`Unknown alias: "${alias}". Available: ${available}`) };
       }
       return {
         handled: true,
         action: "model-switch",
         modelName: found.modelId,
         message: systemMessage(`Switched to ${found.alias} (${found.modelId})`),
       };
     }
     ```
   - Update HELP_TEXT to add: `/swap <alias>     Switch model by alias`
   - Keep the existing `/model <name>` command for direct provider:model switching

2. In `packages/cli/src/components/Chat.tsx`:
   - No changes needed — the existing `model-switch` action handler in `handleSubmit` already calls `setModel(result.modelName)` which will work with the provider-qualified modelId returned by /swap.

3. Verify the flow: /swap with no args shows aliases, /swap with unknown alias shows error with available aliases, /swap with valid alias switches model and shows confirmation.
  </action>
  <verify>
    Run `cd /Users/hitekmedia/Documents/GitHub/tek && npx tsc --noEmit -p packages/cli/tsconfig.json` — passes with no errors.
    Verify by checking the help text includes /swap and the switch statement handles the "swap" case.
  </verify>
  <done>
    - /swap with no args lists all configured aliases
    - /swap <alias> resolves alias to provider:model and switches active model
    - /swap with unknown alias shows error with available aliases
    - /help shows the /swap command
    - Existing /model command still works for direct model ID switching
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes for all three packages (core, gateway, cli)
2. Config schema accepts new fields without breaking existing configs (both fields are optional)
3. Gateway uses config-driven default model, not hardcoded anthropic
4. /swap command resolves aliases from config.json
5. Onboarding wizard includes model selection and alias steps
</verification>

<success_criteria>
- User who configured Venice during setup gets Venice model as default (not anthropic sonnet)
- User can type `/swap minimax` in chat and model switches to `venice:minimax-01`
- User can type `/swap` to see all available aliases
- Model aliases persist in `~/.config/tek/config.json`
- Existing configs without the new fields continue to work (backward compatible)
</success_criteria>

<output>
After completion, create `.planning/quick/3-add-model-selection-with-aliases-to-setu/3-SUMMARY.md`
</output>

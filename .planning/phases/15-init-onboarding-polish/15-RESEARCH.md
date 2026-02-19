# Phase 15: Init & Onboarding Polish - Research

**Researched:** 2026-02-18
**Domain:** CLI onboarding UX, Ink component library, Telegram integration, personality bootstrapping
**Confidence:** HIGH — based on direct codebase analysis + verified library APIs

## Summary

Phase 15 addresses four distinct concerns: (1) fixing the model alias flow to use checkbox multi-select instead of sequential text inputs, (2) integrating Telegram bot token setup into `tek init`, (3) streamlining the onboarding sequence with better skip support, and (4) adding a personality "Hatch" step per Phase 18 research recommendations.

The current onboarding wizard (`Onboarding.tsx`) is a single-file Ink component with 10 steps managed via React state. Phase 14 added skippable re-run support and model catalog integration, but the model alias assignment step remains awkward — it iterates through every model one-by-one asking for aliases via TextInput. The Telegram bot token is currently passed directly to `startTelegramBot(token)` but has no onboarding integration; users must manually configure it. The personality system currently consists of a 20-line generic SOUL.md template.

**Primary recommendation:** Use @inkjs/ui's built-in `MultiSelect` component for model alias selection, add a Telegram token step to the wizard after API keys, add a personality "Hatch" step at the end that creates BOOTSTRAP.md for deferred conversational setup, and extend the config schema with `telegramBotToken` and `agentName`/`userDisplayName` fields.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @inkjs/ui | 2.0.0 | MultiSelect, Select, TextInput, ConfirmInput, Spinner | Already installed; provides MultiSelect component needed for alias fix |
| ink | 6.0.0 | React-based terminal UI renderer | Already installed; powers the entire CLI |
| react | 19.0.0 | Component model for Onboarding wizard | Already installed; current wizard is React-based |
| zod | (existing) | Config schema validation | Already used for AppConfigSchema in @tek/core |
| grammy | (existing) | Telegram Bot API client | Already used in packages/telegram |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk | 5.x | Terminal color output | Already used for non-Ink console output in init.ts |
| commander | 12.x | CLI command framework | Already used for command definitions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @inkjs/ui MultiSelect | Custom checkbox component | MultiSelect is already installed and handles keyboard nav, visual state, submit |
| Storing Telegram token in config.json | Environment variable TELEGRAM_BOT_TOKEN | Config.json is consistent with existing pattern; env vars are external state |
| Storing Telegram token in config.json | OS keychain (like API keys) | Keychain is more secure but Telegram token is less sensitive than provider API keys; research from Phase 09 recommended keychain but config.json is simpler for wizard integration |

**Installation:**
```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/cli/src/
├── commands/
│   └── init.ts                    # init command (add Telegram + personality steps)
├── components/
│   └── Onboarding.tsx             # Onboarding wizard (refactor alias step, add steps)
├── lib/
│   └── models.ts                  # Model catalog (existing, no changes)
packages/core/src/config/
│   └── schema.ts                  # AppConfig schema (extend with telegram, personality)
packages/db/memory-files/
├── SOUL.md                        # Default soul template (expand)
├── MEMORY.md                      # Long-term memory template (existing)
├── BOOTSTRAP.md                   # NEW: first-run personality setup instructions
├── presets/                       # NEW: personality preset templates
│   ├── professional.md
│   ├── friendly.md
│   ├── technical.md
│   ├── opinionated.md
│   └── custom.md
└── daily/                         # Daily logs (existing)
```

### Pattern 1: MultiSelect for Model Aliases
**What:** Replace the sequential one-by-one alias assignment with a MultiSelect checkbox step where users select which models they want aliases for, then assign aliases to selected models only.
**When to use:** Model alias step in onboarding.
**Example:**
```typescript
// Source: @inkjs/ui MultiSelect component (verified from build/components/multi-select/multi-select.d.ts)
import { MultiSelect } from "@inkjs/ui";

// Step 1: User selects which models to alias (checkbox multi-select)
<MultiSelect
  options={availableModels.map(m => ({ label: m.label, value: m.value }))}
  defaultValue={existingConfig?.modelAliases?.map(a => a.modelId) ?? []}
  onSubmit={(selectedModelIds: string[]) => {
    // Step 2: For each selected model, prompt for alias name
    setModelsToAlias(selectedModelIds);
    setAliasIndex(0);
    setStep("model-alias-name");
  }}
/>
```

**Key API facts (verified from .d.ts):**
- `options: Option[]` — same `{ label, value }` format as Select
- `defaultValue?: string[]` — pre-check options
- `onSubmit?: (value: string[]) => void` — fires on Enter with array of selected values
- `visibleOptionCount?: number` — defaults to 5, good for long model lists
- `highlightText?: string` — useful for future filtering support

### Pattern 2: Wizard Step Extension
**What:** Add new steps to the existing OnboardingStep union type and state machine.
**When to use:** Adding Telegram and personality steps.
**Example:**
```typescript
// Current step flow:
// welcome -> mode -> workspace -> keys-ask -> keys-provider -> keys-input ->
// keys-more -> model-select -> model-alias -> summary -> done

// Extended step flow:
// welcome -> mode -> workspace -> keys-ask -> keys-provider -> keys-input ->
// keys-more -> telegram-ask -> telegram-input -> model-select ->
// model-alias-select -> model-alias-name -> hatch-ask -> summary -> done
```

### Pattern 3: BOOTSTRAP.md Deferred Personality Setup
**What:** If user skips the Hatch step, create a BOOTSTRAP.md file in the memory directory. On first `tek chat`, the agent detects BOOTSTRAP.md, reads it, and walks the user through personality setup conversationally. BOOTSTRAP.md is deleted after completion.
**When to use:** When user skips personality setup during init.
**Example:**
```typescript
// In init.ts onComplete handler:
if (!result.personalityConfigured) {
  // Copy BOOTSTRAP.md template to CONFIG_DIR/memory/BOOTSTRAP.md
  ensureMemoryFile("BOOTSTRAP.md", "BOOTSTRAP.md");
}
```

### Pattern 4: Config Schema Extension
**What:** Extend AppConfigSchema with new fields for Telegram and personality.
**When to use:** Storing Telegram bot token and personality metadata in config.json.
**Example:**
```typescript
// In packages/core/src/config/schema.ts
export const AppConfigSchema = z.object({
  // ... existing fields ...
  telegramBotToken: z.string().optional(),
  agentName: z.string().optional(),         // e.g. "Atlas", default "tek"
  userDisplayName: z.string().optional(),    // How agent addresses user
});
```

### Anti-Patterns to Avoid
- **Database-backed personality:** Phase 18 research explicitly warns against this. Markdown files ARE the personality system. Do not store personality in SQLite.
- **Form-based personality questionnaire:** Produces shallow, disconnected personality. Use BOOTSTRAP.md for conversational setup instead.
- **Custom NLP for style calibration:** The LLM itself is the best style analyzer. Feed writing samples to the LLM, let it generate personality files.
- **Overwriting personality files silently:** Never overwrite SOUL.md or other personality files without user confirmation. Check existence first.
- **Telegram token in plaintext config without disclosure:** If storing in config.json, warn user that it's stored on disk (not keychain-encrypted like API keys).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select checkboxes | Custom checkbox component with keyboard handling | `@inkjs/ui` `MultiSelect` component | Already installed, handles arrow keys, space toggle, enter submit, scroll |
| Telegram token validation | Custom HTTP request to Bot API | grammY's `Bot` constructor + `bot.api.getMe()` | grammY validates token format and can test connectivity |
| Personality presets | Custom preset format or database | Markdown template files in `memory-files/presets/` | Standard files, user-editable, version-controllable |
| Config schema extension | Manual JSON parsing | Zod schema extension (existing pattern) | Zod already used for AppConfigSchema, provides validation + type inference |
| First-run detection | Custom flag in database | Check for BOOTSTRAP.md file existence | File-based, no database dependency, self-cleaning (deleted after use) |

**Key insight:** The onboarding wizard is already an Ink React component with established patterns for step management, skip support, and config persistence. All changes are incremental extensions to this existing architecture.

## Common Pitfalls

### Pitfall 1: MultiSelect Visual Overflow
**What goes wrong:** With 20+ Venice models, the MultiSelect overflows the terminal.
**Why it happens:** Default `visibleOptionCount` is 5, which is fine, but users might not realize they can scroll.
**How to avoid:** Set `visibleOptionCount` to 8 and add a hint text like "Use arrow keys to scroll, space to select, enter to confirm."
**Warning signs:** Users only alias the first 5 visible models.

### Pitfall 2: Telegram Token Storage Security Mismatch
**What goes wrong:** API keys go in the OS keychain (encrypted), but Telegram token goes in config.json (plaintext). Users may assume equal security.
**Why it happens:** Convenience of having it in config.json for easy wizard integration.
**How to avoid:** Store the Telegram bot token in the keychain using the existing vault pattern (`addKey`/`getKey`), adding "telegram" to the PROVIDERS list. This is consistent with the Phase 09 research recommendation.
**Warning signs:** Config.json contains a plaintext bot token.

### Pitfall 3: Onboarding Step Count Bloat
**What goes wrong:** Adding Telegram + Hatch + MultiSelect alias steps makes the wizard feel long.
**Why it happens:** Each new feature adds a step. Linear wizards don't scale well past 7-8 steps.
**How to avoid:** Group related steps. Telegram ask/input can be a single conditional step. Hatch can be a simple "Set up personality now or later?" with two paths. Keep total step count under 12.
**Warning signs:** New users abandon init partway through.

### Pitfall 4: BOOTSTRAP.md Not Cleaned Up
**What goes wrong:** BOOTSTRAP.md persists after personality setup, causing repeated bootstrapping on every chat start.
**Why it happens:** No explicit deletion after conversational setup completes.
**How to avoid:** The gateway's context assembler should detect BOOTSTRAP.md, inject it into the system prompt, and after the agent confirms setup is complete, delete the file. Add a tool/mechanism for the agent to signal "bootstrap complete."
**Warning signs:** Agent asks personality questions every time user starts a new chat session.

### Pitfall 5: Model Alias Input Doesn't Clear Between Entries
**What goes wrong:** When assigning aliases sequentially, the TextInput retains the previous value.
**Why it happens:** React state management — TextInput value not reset between alias prompts. This is the existing bug mentioned in the phase description.
**How to avoid:** Use a `key` prop on TextInput that changes with each aliasIndex, forcing React to remount: `<TextInput key={`alias-${aliasIndex}`} ... />`. Or clear the internal state by controlling the value prop.
**Warning signs:** User types "sonnet" for first alias, sees "sonnet" pre-filled for next model.

## Code Examples

### Example 1: MultiSelect for Model Alias Selection
```typescript
// Source: @inkjs/ui v2.0.0 MultiSelect (verified from installed package)
import { MultiSelect } from "@inkjs/ui";

// In the "model-alias-select" step:
if (step === "model-alias-select") {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Select models to create aliases for:</Text>
      <Text dimColor>
        Space to toggle, Enter to confirm. Press Enter with none selected to skip.
      </Text>
      <Text />
      <MultiSelect
        options={availableModels}
        defaultValue={existingConfig?.modelAliases?.map(a => a.modelId) ?? []}
        visibleOptionCount={8}
        onSubmit={(selectedValues) => {
          if (selectedValues.length === 0) {
            setStep("summary");
            return;
          }
          setModelsToAlias(selectedValues);
          setAliasIndex(0);
          setStep("model-alias-name");
        }}
      />
    </Box>
  );
}
```

### Example 2: Telegram Bot Token Step
```typescript
// Telegram setup step — ask if user wants to configure Telegram
if (step === "telegram-ask") {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Set up Telegram integration?</Text>
      <Text dimColor>
        You'll need a bot token from @BotFather on Telegram.
      </Text>
      <Text />
      <ConfirmInput
        onConfirm={() => setStep("telegram-input")}
        onCancel={() => {
          // Skip Telegram, move to model selection
          const models = buildAvailableModels();
          if (models.length > 0) {
            setAvailableModels(models);
            setStep("model-select");
          } else {
            setStep("hatch-ask");
          }
        }}
      />
    </Box>
  );
}

if (step === "telegram-input") {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Enter your Telegram bot token:</Text>
      <Text dimColor>
        Get one from @BotFather: /newbot command, then copy the token.
      </Text>
      <Text />
      <TextInput
        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        onSubmit={(value) => {
          if (value.trim()) {
            setTelegramToken(value.trim());
          }
          // Move to model selection
          const models = buildAvailableModels();
          if (models.length > 0) {
            setAvailableModels(models);
            setStep("model-select");
          } else {
            setStep("hatch-ask");
          }
        }}
      />
    </Box>
  );
}
```

### Example 3: Personality Hatch Step
```typescript
// Hatch step — personality setup choice
if (step === "hatch-ask") {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Personalize your agent?</Text>
      <Text>
        Choose a personality preset or set up later via conversation.
      </Text>
      <Text />
      <Select
        options={[
          { label: "Professional — Concise, formal, business-appropriate", value: "professional" },
          { label: "Friendly — Conversational, warm, asks follow-ups", value: "friendly" },
          { label: "Technical — Detailed, code-heavy, precise", value: "technical" },
          { label: "Opinionated — Direct, has preferences, personality-forward", value: "opinionated" },
          { label: "Custom — Set up later via conversation", value: "custom" },
          { label: "Skip — Use default personality", value: "skip" },
        ]}
        onChange={(value) => {
          if (value === "skip") {
            setStep("summary");
          } else if (value === "custom") {
            // Create BOOTSTRAP.md for deferred conversational setup
            setPersonalityPreset("custom");
            setStep("hatch-name");
          } else {
            setPersonalityPreset(value);
            setStep("hatch-name");
          }
        }}
      />
    </Box>
  );
}
```

### Example 4: Config Schema Extension
```typescript
// Source: packages/core/src/config/schema.ts (extend existing)
export const AppConfigSchema = z.object({
  securityMode: SecurityModeSchema,
  workspaceDir: z.string().optional(),
  apiEndpoint: ApiEndpointConfigSchema.default(() => ({ port: 3271, host: "127.0.0.1" as const })),
  onboardingComplete: z.boolean().default(false),
  createdAt: z.string().datetime(),
  mcpServers: z.record(z.string(), MCPServerConfigSchema).optional(),
  toolApproval: ToolApprovalConfigSchema.optional(),
  skillsDir: z.string().optional(),
  ollamaEndpoints: z.array(OllamaEndpointSchema).optional(),
  defaultModel: z.string().optional(),
  modelAliases: z.array(ModelAliasSchema).optional(),
  // NEW: Phase 15 additions
  agentName: z.string().optional(),
  userDisplayName: z.string().optional(),
});
```

### Example 5: BOOTSTRAP.md Template
```markdown
# Bootstrap: First-Run Personality Setup

You are starting your first conversation with a new user.
Your job is to get to know them and configure your personality.

## Steps

1. Introduce yourself and ask the user what they'd like to call you
2. Ask how the user prefers to be addressed
3. Ask about their primary use case (development, writing, research, general)
4. Ask about their communication style preference (concise vs detailed, formal vs casual)
5. Based on their answers, update SOUL.md with personalized values
6. Confirm the setup is complete and delete this file

## Important

- Be warm and conversational, not clinical
- Keep it to 4-5 questions max
- After setup, delete this BOOTSTRAP.md file
- Write the user's preferences to SOUL.md Learned Preferences section
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential TextInput for each model alias | MultiSelect checkbox + targeted TextInput | @inkjs/ui 2.0.0 (available now) | Users select only models they want to alias, then name them |
| No Telegram setup in init | Telegram token as wizard step | Phase 15 | Users configure Telegram during onboarding, not manually |
| Generic 20-line SOUL.md | Preset-based personality with conversational refinement | Phase 18 research (2026-02) | Agents have distinct personalities from first interaction |
| Single-purpose init wizard | Two-phase onboarding (infrastructure + personality) | Phase 18 research (2026-02) | Personality setup happens via conversation, not forms |

## Open Questions

1. **Should Telegram bot token be stored in keychain or config.json?**
   - What we know: API provider keys use the OS keychain. Phase 09 research recommended keychain. But config.json is simpler for wizard flow.
   - What's unclear: Is the security difference meaningful enough to justify adding "telegram" to PROVIDERS?
   - Recommendation: Store in keychain for consistency. Add "telegram" to the PROVIDERS array in `providers.ts`. This matches the existing pattern and keeps secrets out of config.json.

2. **Should the Hatch step use presets only, or also allow inline naming?**
   - What we know: Phase 18 recommends 5 presets + agent naming in the Hatch step. Naming is two questions (agent name, user display name).
   - What's unclear: Does adding naming questions bloat the wizard too much?
   - Recommendation: Include naming. It's two quick TextInputs and makes the agent feel personal immediately. If user picks "Custom" preset, skip naming (BOOTSTRAP.md will handle it conversationally).

3. **How should BOOTSTRAP.md deletion be triggered?**
   - What we know: BOOTSTRAP.md is a one-time file. The agent should delete it after personality setup.
   - What's unclear: The agent needs a mechanism to delete files — is this an existing tool, or does it need a new system action?
   - Recommendation: The agent already has filesystem tools. After conversational setup, instruct the agent (in BOOTSTRAP.md itself) to delete the file. The context assembler can check for BOOTSTRAP.md existence as part of its regular memory loading.

4. **Should the MultiSelect step replace or supplement the existing alias flow?**
   - What we know: Current flow iterates through every model. Phase description says "fix model alias flow (checkbox multi-select, clear input)."
   - What's unclear: Should "done" and "keep" shortcuts still exist alongside MultiSelect?
   - Recommendation: Replace entirely. MultiSelect handles the "select which to alias" concern. Then sequential TextInput handles naming (with key prop fix for clearing). "keep" option should be a separate ConfirmInput before the MultiSelect when existing aliases exist.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `packages/cli/src/components/Onboarding.tsx` — current wizard implementation (464 lines)
- Direct codebase analysis: `packages/cli/src/commands/init.ts` — init command handler
- Direct codebase analysis: `packages/core/src/config/schema.ts` — AppConfig Zod schema
- Direct codebase analysis: `packages/db/src/memory/soul-manager.ts` — soul loading/evolution
- Direct codebase analysis: `packages/db/memory-files/SOUL.md` — current soul template (20 lines)
- Direct codebase analysis: `packages/cli/src/vault/providers.ts` — PROVIDERS array definition
- Installed package: `@inkjs/ui@2.0.0` MultiSelect component — verified .d.ts API
- Phase 18 research: `.planning/phases/18-onboarding-research/18-RECOMMENDATIONS.md`
- Phase 18 research: `.planning/phases/18-onboarding-research/18-RESEARCH.md`

### Secondary (MEDIUM confidence)
- Phase 14 plan: `.planning/phases/14-*/14-02-PLAN.md` — skippable wizard pattern, model catalog decisions
- Phase 09 research: `.planning/phases/09-telegram-channel/09-RESEARCH.md` — Telegram token storage recommendation

### Tertiary (LOW confidence)
- None — all findings are from direct codebase and installed package analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in node_modules
- Architecture: HIGH — extending existing well-understood patterns (Onboarding.tsx step machine, Zod config schema)
- Pitfalls: HIGH — identified from direct code reading (TextInput clearing bug, step count concerns)
- MultiSelect API: HIGH — verified from installed @inkjs/ui@2.0.0 .d.ts files
- BOOTSTRAP.md pattern: MEDIUM — concept from Phase 18 research, implementation details are editorial

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days — stable domain, no fast-moving dependencies)

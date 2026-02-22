---
phase: 9-fix-critical-bugs
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/gateway/src/session/store.ts
  - packages/gateway/src/ws/handlers.ts
  - packages/db/src/memory/ensure-memory.ts
autonomous: true
requirements: [BUG-FLOW-01, BUG-IDENTITY-01, BUG-BRAVE-01]
user_setup: []

must_haves:
  truths:
    - "Agent tool results are NOT added to session as user messages"
    - "Second session agent loop processes correct message history"
    - "Tool errors are caught and returned to client without hanging"
  artifacts:
    - path: packages/gateway/src/session/store.ts
      provides: "Session message append safety - no tool result contamination"
      min_lines: 100
    - path: packages/gateway/src/ws/handlers.ts
      provides: "Session message history construction for agent loop"
      exports: ["handleChatSend"]
    - path: packages/db/src/memory/ensure-memory.ts
      provides: "Personality file creation with full content templates"
      min_lines: 150
  key_links:
    - from: packages/gateway/src/ws/handlers.ts
      to: packages/gateway/src/session/store.ts
      via: "sessionManager.getMessages(sessionId)"
      pattern: "sessionManager\\.get|addMessage"
    - from: packages/gateway/src/agent/tool-loop.ts
      to: packages/gateway/src/ws/handlers.ts
      via: "tool execution context messages array"
      pattern: "messages.*from.*sessionManager|runAgentLoop"
---

<objective>
Fix three critical interconnected issues blocking agent functionality:
1. Tool flow bug where agent's tool results from LLM stream are being added to session history as user messages, corrupting second-turn agent loops
2. Agent personality data not fully written during onboarding (SOUL.md, IDENTITY.md, STYLE.md empty)
3. Brave search and other tool execution failures silently hanging without error feedback

Purpose: Restore agent loop correctness and personality persistence for multi-turn conversations
Output: Three focused fixes to session handling, onboarding templates, and tool error recovery
</objective>

<execution_context>
@/Users/drew-mini/.claude/get-shit-done/workflows/execute-plan.md
@/Users/drew-mini/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Fix tool flow bug: Prevent tool results from being added as user messages to session history</name>
  <files>
    packages/gateway/src/session/store.ts
    packages/gateway/src/ws/handlers.ts
    packages/gateway/src/agent/tool-loop.ts
  </files>
  <action>
ROOT CAUSE ANALYSIS:
The agent loop works correctly within a single request, but session message history is being corrupted. When the second turn happens, the session contains the tool call + tool result data mixed into the conversation history, and the new agent loop sees tool results as if they were user messages.

The issue is likely in how messages are added to the session during the agent loop. The agent loop correctly produces tool-call, tool-result, and text-delta events, but somewhere these are being persisted as "user" messages instead of remaining in the agent loop's internal state.

INVESTIGATION:
1. Open packages/gateway/src/session/store.ts and check the addMessage() function - it only takes role, content, and data. Verify it has no logic that could misclassify message roles.

2. Open packages/gateway/src/ws/handlers.ts and search for all places sessionManager.addMessage is called:
   - Line 327: sessionManager.addMessage(sessionId, "user", msg.content) — CORRECT, user input
   - Line 200-204: After streamChatResponse, addMessage with "assistant" — CORRECT
   - Check runAgentLoop path (around line 500-502): agentResponse should only be called ONCE after loop completes, not for each tool result

3. Open packages/gateway/src/agent/tool-loop.ts:
   - Verify that tool-result case (line 151-162) only sends to transport, does NOT call sessionManager
   - The fullText accumulation (line 112) should ONLY accumulate text-delta, not tool results

ACTION:
1. In packages/gateway/src/agent/tool-loop.ts, add a comment guard after line 162:
   ```typescript
   // CRITICAL: Tool results are for LLM context only.
   // They are NOT added to session history here.
   // Only the final assistant text (fullText) is persisted after loop completion.
   ```

2. In packages/gateway/src/session/store.ts, add validation to addMessage():
   - Add a guard: if role is neither "user" nor "assistant", log error and reject
   - This prevents accidental addition of tool-related messages
   - Add unit test (if tests exist) to verify only valid roles are accepted

3. In packages/gateway/src/ws/handlers.ts around line 500-502:
   - Add comment clarifying the flow:
   ```typescript
   // Agent loop returns accumulated assistant text.
   // Tool calls/results remain in LLM context (messages array passed to streamText).
   // Only the final assistant response is added to session.
   if (agentResponse) {
     sessionManager.addMessage(sessionId, "assistant", agentResponse);
   }
   ```

4. Verify getMessages() is used correctly in runAgentLoop call (line 467):
   - messages from context.messages should be a fresh read from session
   - Confirm context.messages is built fresh each request (line 331: assembleContext calls sessionManager.getMessages)

VERIFICATION:
- Read packages/gateway/src/session/store.ts to understand message schema
- Grep for "tool.result" being added to session (should find none)
- Check integration test or manually verify: send message → bot uses tool → check session.messages (should be [user msg, assistant msg], NOT [user msg, tool-result, assistant msg])
  </action>
  <verify>
1. npm test (if session tests exist): Verify addMessage() validation test passes
2. Manual verification:
   - Start gateway: npm run dev
   - Send chat message that triggers a tool call
   - In session store, inspect persisted messages: should be [{ role: "user", ... }, { role: "assistant", ... }]
   - Send second message: agent loop should have correct history without tool artifacts
3. Grep verification:
   - grep -r 'sessionManager.addMessage.*tool' packages/gateway/src/ — should return 0 matches
   - grep -r 'addMessage.*tool.result' packages/ — should return 0 matches
  </verify>
  <done>
Tool results are never persisted to session history. Session message array only contains user/assistant messages in correct order. Second-turn agent loops see clean history.
  </done>
</task>

<task type="auto">
  <name>Ensure personality files are fully populated during agent onboarding</name>
  <files>
    packages/db/src/memory/ensure-memory.ts
    packages/cli/src/commands/onboard.ts
  </files>
  <action>
ROOT CAUSE:
When agents are created, SOUL.md, IDENTITY.md, STYLE.md, and USER.md should be populated with actual content, not empty templates. The onboarding flow asks for personality preset (professional, friendly, technical, opinionated, custom, skip) but the personality files are not being written with preset-specific content.

Currently:
- onboard.ts applies personality preset (line 82) via applyPersonalityPreset()
- ensureMemoryFile() is called but may create empty stubs
- USER.md is written manually in onboard.ts (lines 91-95) with basic content
- SOUL.md is written with just agent name (lines 98-108)
- IDENTITY.md and STYLE.md are never explicitly written

ACTION:
1. In packages/db/src/memory/ensure-memory.ts:
   - Add a new function: ensurePersonalityFiles(agentId: string, personalityPreset: string, agentName: string)
   - This function should write SOUL.md, IDENTITY.md, STYLE.md, and USER.md with preset-specific content
   - Use these templates (minimal, personality-forward):

   **For personalityPreset = "professional":**
   - SOUL.md: Professional, precise, business-focused. Prefers clarity over elaboration. Respects hierarchies and deadlines.
   - IDENTITY.md: I operate in professional contexts. I value accuracy, timeliness, and business impact.
   - STYLE.md: Keep responses concise. Use formal language. Include action items. Avoid humor unless explicitly invited.
   - USER.md: [Seeded with user name or placeholder]

   **For personalityPreset = "friendly":**
   - SOUL.md: Warm, conversational, genuinely interested in people. Asks follow-up questions. Finds humor in situations.
   - IDENTITY.md: I'm the kind of assistant who remembers what matters to you and builds on our history together.
   - STYLE.md: Use conversational tone. Include emoji sparingly. Ask open-ended questions. Celebrate wins together.
   - USER.md: [Seeded with user name or placeholder]

   **For personalityPreset = "technical":**
   - SOUL.md: Deeply technical, loves precision and detail. Prefers code examples over descriptions. Seeks to understand systems deeply.
   - IDENTITY.md: I'm engineering-minded. I break down complex problems and document solutions thoroughly.
   - STYLE.md: Show code. Explain trade-offs. Use technical terminology accurately. Include references.
   - USER.md: [Seeded with user name or placeholder]

   **For personalityPreset = "opinionated":**
   - SOUL.md: Strong opinions backed by experience. Direct, sometimes blunt. Values principled stands. Not afraid to disagree.
   - IDENTITY.md: I have convictions. I push back on what I think is wrong and advocate for what I believe in.
   - STYLE.md: Be direct. State your position clearly. Explain why. Challenge assumptions. This is collaborative friction, not rudeness.
   - USER.md: [Seeded with user name or placeholder]

   **For personalityPreset = "custom" or "skip":**
   - SOUL.md: Minimal template with sections for agent to evolve (## Core Values, ## Learned Preferences, etc.)
   - IDENTITY.md: Empty section headers
   - STYLE.md: Empty section headers
   - USER.md: [Seeded with user name or placeholder]

2. In packages/cli/src/commands/onboard.ts (around line 76-108):
   - After applyPersonalityPreset is called, add:
   ```typescript
   // Ensure personality files have actual content, not just stubs
   if (result.personalityPreset && result.personalityPreset !== "skip") {
     ensurePersonalityFiles(agentId, result.personalityPreset, result.agentName);
   }
   ```
   - Replace the manual SOUL.md and USER.md writing (lines 91-108) with a single call to ensurePersonalityFiles()

3. Verify imports in onboard.ts include ensurePersonalityFiles from @tek/db

VERIFICATION:
- Create a new agent with personality preset "professional"
- Check agent directory: ls ~/.config/tek/agents/{agentId}/
- Verify SOUL.md, IDENTITY.md, STYLE.md, USER.md all exist and have content
- Read each file: should have 3-5 lines of personality-specific content, not empty
- Try second personality preset ("friendly") and verify content differs appropriately
  </action>
  <verify>
1. npm test (if exists for db/memory): Verify ensurePersonalityFiles() creates files correctly
2. Manual verification:
   - Delete any existing test agents: rm -rf ~/.config/tek/agents/test-*
   - Run: tek onboard --name "TestBot"
   - Select personality: "professional"
   - Check files created: wc -l ~/.config/tek/agents/test-bot/{SOUL,IDENTITY,STYLE,USER}.md
   - Each file should have 5+ lines (not empty)
   - Verify content mentions personality theme (e.g., "professional", "clarity", "deadlines")
3. Repeat with "friendly" preset and verify different content
4. Grep to confirm no empty personality files:
   - find ~/.config/tek/agents -name "SOUL.md" -exec sh -c 'wc -l "$1" | grep "^0 "' _ {} \; — should return 0 matches
  </verify>
  <done>
All personality files (SOUL.md, IDENTITY.md, STYLE.md, USER.md) created during onboarding contain personality-appropriate content. Empty stub files no longer exist.
  </done>
</task>

<task type="auto">
  <name>Add timeout and error recovery for tool execution (Brave search and other skills)</name>
  <files>
    packages/gateway/src/agent/tool-loop.ts
    packages/gateway/src/skills/brave-search.ts
  </files>
  <action>
ROOT CAUSE:
When tools like Brave search fail (timeout, API error, network issue), the error is caught but sometimes not properly returned to the client, leaving the stream hanging. The AI SDK's streamText with tools may have incomplete error handling in edge cases.

Currently:
- tool-loop.ts catches "tool-error" case (line 165-185) and sends to transport
- But some failures (e.g., Brave API timeouts) may not reach the error case
- Brave search doesn't have explicit timeout handling

ACTION:
1. In packages/gateway/src/skills/brave-search.ts:
   - Add a 10-second timeout to the fetch call
   - Wrap the fetch in Promise.race([fetch(...), timeout])
   - Return a structured error message instead of throwing
   ```typescript
   const BRAVE_TIMEOUT_MS = 10_000;

   async function fetchWithTimeout(url: string, init?: RequestInit) {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), BRAVE_TIMEOUT_MS);

     try {
       const response = await fetch(url, { ...init, signal: controller.signal });
       clearTimeout(timeoutId);
       return response;
     } catch (err) {
       clearTimeout(timeoutId);
       if (err instanceof Error && err.name === "AbortError") {
         throw new Error(`Brave search timed out after ${BRAVE_TIMEOUT_MS}ms`);
       }
       throw err;
     }
   }
   ```
   - Use fetchWithTimeout instead of fetch directly

2. In packages/gateway/src/agent/tool-loop.ts (around line 135-185):
   - Add explicit error recovery after the for-await loop
   - If streaming ends without tool results for pending tool calls, send error messages
   - Add a safety check in the catch block (line 268): ensure streaming is marked false
   ```typescript
   } finally {
     // Ensure streaming flag is always cleared, even on error
     if (connState.streaming) {
       connState.streaming = false;
       connState.streamRequestId = null;
     }
   }
   ```

3. Add comment to tool-error handler (line 165) explaining that this is the final word on that tool invocation:
   ```typescript
   case "tool-error": {
     // Tool error is final — client should see this as tool failure and agent will attempt recovery
   ```

VERIFICATION:
- Test Brave search timeout manually (set very short timeout): agent should return error message, not hang
- Check gateway logs for timeout messages
- Send message that triggers Brave search, then disconnect network: verify client receives error within 15 seconds
- Check tool.error messages are being sent to transport (grep logs for "tool.error")
  </action>
  <verify>
1. Manual verification - Timeout handling:
   - Edit packages/gateway/src/skills/brave-search.ts temporarily to use 1ms timeout
   - Send chat asking for search: "Tell me about recent AI news"
   - Should receive error within 2 seconds, not hang
   - Check logs: should see "Tool execution error [brave_search]" message

2. Manual verification - Network failure:
   - Start gateway and chat normally
   - Kill network (disconnect WiFi or disable interface)
   - Send message that would trigger a tool
   - Within 15 seconds should see error message, stream should end
   - Gateway logs should show error message

3. Code verification:
   - grep -n "ABORT_TIMEOUT\|AbortError" packages/gateway/src/skills/brave-search.ts — should find timeout handling
   - grep -n "finally.*streaming" packages/gateway/src/agent/tool-loop.ts — should find cleanup guarantee
  </verify>
  <done>
Tool execution failures (Brave search timeouts, API errors) are caught and returned to client as tool.error messages. Streams never hang indefinitely. Client receives clear error feedback within configured timeout.
  </done>
</task>

</tasks>

<verification>
After all three tasks complete:
1. Start gateway: npm run dev
2. Test single-turn flow: Chat with agent, verify tool calls work
3. Test multi-turn flow: Send second message, verify agent loop sees clean history without tool artifacts
4. Test personality: Create new agent with "professional" preset, chat with it, verify personality-aware responses
5. Test tool errors: Trigger a tool that would fail, verify error is returned cleanly
6. Check gateway logs: grep for "tool.result\|Tool results\|contamination" — should be no warnings
</verification>

<success_criteria>
- Agent tool results are NOT added to session history as user messages
- Second-turn agent loops have correct, clean message history
- Personality files are fully populated during onboarding for all presets
- Tool execution failures return errors within timeout window instead of hanging
- Gateway logs show no "tool result" contamination warnings
- Manual test: Send two messages in sequence, second message agent responds naturally without tool artifacts in context
</success_criteria>

<output>
After completion, create `.planning/quick/9-fix-tool-flow-agent-personality-base-tra/9-01-SUMMARY.md` with:
- Issue reproduction steps and proof of fix
- Test results showing agent loop correctness
- Personality file content samples
- Tool error handling test output
</output>

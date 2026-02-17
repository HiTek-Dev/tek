---
phase: 06-agent-capabilities
verified: 2026-02-17T01:30:00Z
status: passed
score: 5/5 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "User can approve, deny, or auto-approve tool calls per tool or per session with tiered approval levels — session-approve (S key) now calls recordSessionApproval, persisting the approval in the policy so subsequent calls skip the prompt"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Send a message that triggers a tool call, press S in the approval prompt, then send another message that triggers the same tool — verify the second call does NOT show an approval prompt"
    expected: "Second call to the same tool executes without prompting for approval in the same session"
    why_human: "Session state is runtime-only; cannot verify by grepping; requires an actual running gateway and CLI session"
  - test: "Send a message matching preflight heuristic (e.g. 200+ chars or containing 'refactor'), verify pre-flight checklist appears with steps, cost, and permissions"
    expected: "PreflightChecklist component renders with numbered steps, risk colors (green/yellow/red), estimated USD cost, and a permissions list before execution begins"
    why_human: "Requires LLM to be running and generateObject to produce structured output; cannot verify statically"
  - test: "In limited-control security mode, try to read a file outside the workspace directory"
    expected: "Error: Path is outside the allowed workspace"
    why_human: "Requires a configured workspaceDir and runtime execution to test the boundary enforcement"
---

# Phase 6: Agent Capabilities Verification Report

**Phase Goal:** The agent can use tools, access the filesystem and shell, and users have granular control over what the agent is allowed to do
**Verified:** 2026-02-17
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 05)

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent can discover and connect to user-configured MCP servers and execute tool calls with results displayed inline | VERIFIED | MCPClientManager lazy-connects via stdio/http/sse; tool-loop.ts sends `tool.call` and `tool.result` WS messages; useChat renders ToolCallMessage entries inline |
| 2 | User can approve, deny, or auto-approve tool calls per tool or per session with tiered approval levels | VERIFIED | Y/N/S all wired end-to-end. Session-approve now calls `recordSessionApproval(pending.toolName, connState.approvalPolicy)` in handlers.ts line 722. `pendingApprovals` Map stores `{ toolName, resolve }` so the handler has the tool name. TypeScript compiles cleanly. |
| 3 | Before complex tasks, agent generates a pre-flight checklist showing steps, estimated cost, required permissions, and risks; user can review and edit before execution begins | VERIFIED | `shouldTriggerPreflight` heuristic, `generatePreflight` via AI SDK `generateObject`, `PreflightChecklist` Ink component, and `handlePreflightApproval` handler all exist and are wired |
| 4 | Agent can read/write files in its workspace (or system-wide in Full Control mode) and execute shell commands with output displayed inline | VERIFIED | `createFilesystemTools` (read_file, write_file, list_files) and `createShellTool` (execute_command) exist with security mode enforcement; results flow through tool.result messages to CLI |
| 5 | Skills directory exists with SKILL.md metadata format supporting workspace and managed tiers | VERIFIED | `discoverSkills`, `getSkillsDirs`, `formatSkillsForContext` exist in @agentspace/core; gray-matter YAML parsing; workspace-over-managed precedence; context assembler injects skills |

**Score: 5/5 truths verified**

---

## Gap Closure Verification (Plan 05)

The single gap from the initial verification was closed by commit `3abe684` (fix: wire session-approve to actually call recordSessionApproval).

### Three Required Changes — All Confirmed:

**1. `packages/gateway/src/ws/connection.ts` — PendingApproval type updated**

```typescript
// Line 25 — VERIFIED
pendingApprovals: Map<string, { toolName: string; resolve: (approved: boolean) => void }>;
```

**2. `packages/gateway/src/agent/tool-loop.ts` — toolName stored in pendingApprovals.set**

```typescript
// Lines 212-219 — VERIFIED
connState.pendingApprovals.set(toolCallId, {
    toolName,
    resolve: (approved: boolean) => {
        clearTimeout(timer);
        connState.pendingApprovals.delete(toolCallId);
        resolve(approved);
    },
});
```

**3. `packages/gateway/src/ws/handlers.ts` — recordSessionApproval called on session-approve**

```typescript
// Lines 720-724 — VERIFIED
if (msg.sessionApprove && msg.approved && connState.approvalPolicy) {
    recordSessionApproval(pending.toolName, connState.approvalPolicy);
    logger.info(`Session-approved tool "${pending.toolName}" for toolCallId: ${msg.toolCallId}`);
}
```

**TypeScript compilation:** `npx tsc --noEmit` from `packages/gateway` — zero errors.

---

## Required Artifacts

### Plan 01: Tool Infrastructure

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/config/schema.ts` | MCPServerConfig, ToolApprovalConfig, skillsDir in AppConfigSchema | VERIFIED | All three schemas present and exported |
| `packages/gateway/src/mcp/client-manager.ts` | MCPClientManager with lazy connect and closeAll | VERIFIED | Singleton, stdio/http/sse transports, error-tolerant getTools |
| `packages/gateway/src/tools/filesystem.ts` | read_file, write_file, list_files AI SDK tools | VERIFIED | `checkWorkspace()` enforces limited-control boundary, 100KB read truncation |
| `packages/gateway/src/tools/shell.ts` | execute_command AI SDK tool with execa | VERIFIED | execaCommand with timeout, cwd restriction in limited-control mode |
| `packages/gateway/src/agent/tool-registry.ts` | buildToolRegistry merging MCP + built-in tools | VERIFIED | Merges filesystem + shell built-ins, namespaces MCP tools |
| `packages/gateway/src/agent/approval-gate.ts` | ApprovalPolicy type and wrapToolWithApproval | VERIFIED | ApprovalPolicy, createApprovalPolicy, checkApproval, recordSessionApproval all exported |

### Plan 02: Skills System

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/skills/types.ts` | SkillMetadata, SkillTier, LoadedSkill types | VERIFIED | SkillMetadataSchema Zod, SkillTier, LoadedSkill interface — all present |
| `packages/core/src/skills/loader.ts` | discoverSkills scanning directories for SKILL.md | VERIFIED | discoverSkills, getSkillsDirs, formatSkillsForContext — gray-matter parsing |
| `packages/core/src/skills/index.ts` | Barrel exports for skills module | VERIFIED | Exports all types and functions; re-exported from core index |

### Plan 03: Streaming + Wiring

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/gateway/src/ws/protocol.ts` | tool.call, tool.result, tool.approval.request, tool.approval.response, preflight.checklist, preflight.approval | VERIFIED | All 6 message types present in both ClientMessageSchema and ServerMessageSchema |
| `packages/gateway/src/agent/tool-loop.ts` | Agent tool loop with streamText, fullStream, approval handling | VERIFIED | runAgentLoop handles all event types; waitForApproval now accepts and stores toolName |
| `packages/gateway/src/context/assembler.ts` | Skills and tools sections populated | VERIFIED | Imports and calls discoverSkills, formatSkillsForContext for skills section |

### Plan 04: Preflight + CLI Experience

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/gateway/src/agent/preflight.ts` | generatePreflight and shouldTriggerPreflight | VERIFIED | Both exported with heuristics and generateObject structured output |
| `packages/cli/src/components/ToolApprovalPrompt.tsx` | Interactive approval prompt for tool calls | VERIFIED | Ink component with Y/N/S keyboard input |
| `packages/cli/src/components/PreflightChecklist.tsx` | Pre-flight checklist review component | VERIFIED | Ink component with risk-colored steps, cost, permissions |
| `packages/cli/src/lib/gateway-client.ts` | createToolApprovalResponse and createPreflightApprovalResponse | VERIFIED | Both factories present and return typed ClientMessage objects |

### Plan 05: Session-Approve Gap Closure

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/gateway/src/ws/connection.ts` | PendingApproval type with toolName and resolve fields | VERIFIED | Line 25: `{ toolName: string; resolve: (approved: boolean) => void }` |
| `packages/gateway/src/agent/tool-loop.ts` | Stores toolName in pendingApprovals alongside resolve | VERIFIED | Lines 212-219: `connState.pendingApprovals.set(toolCallId, { toolName, resolve: ... })` |
| `packages/gateway/src/ws/handlers.ts` | Calls recordSessionApproval when sessionApprove is true | VERIFIED | Lines 721-723: actual call with `pending.toolName` and `connState.approvalPolicy` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `filesystem.ts` | `@agentspace/core security` | `isPathWithinWorkspace` | VERIFIED | checkWorkspace() enforces workspace boundary in limited-control mode |
| `tool-registry.ts` | `mcp/client-manager.ts` | `mcpManager.getTools()` | VERIFIED | Loop over mcpConfigs calls mcpManager.getTools(serverName, config) |
| `approval-gate.ts` | `tool-registry.ts` | `wrapToolWithApproval` applied | VERIFIED | buildToolRegistry calls wrapToolWithApproval for all tools |
| `tool-loop.ts` | `tool-registry.ts` | `buildToolRegistry` provides tools | VERIFIED | handleChatSend calls buildToolRegistry, passes to runAgentLoop |
| `ws/handlers.ts` | `agent/tool-loop.ts` | `runAgentLoop` | VERIFIED | handleChatSend and handlePreflightApproval both call runAgentLoop |
| `context/assembler.ts` | `core/skills/loader.ts` | `discoverSkills + formatSkillsForContext` | VERIFIED | assembleContext calls both and injects skills section |
| `useChat.ts` | `ToolApprovalPrompt.tsx` | `tool.approval.request` triggers prompt | VERIFIED | pendingApproval state set on tool.approval.request; Chat.tsx renders prompt |
| `Chat.tsx` | `PreflightChecklist.tsx` | `preflight.checklist` triggers display | VERIFIED | pendingPreflight state set on preflight.checklist; Chat.tsx renders checklist |
| `ws/handlers.ts` | `agent/approval-gate.ts` | `recordSessionApproval` when sessionApprove=true | VERIFIED | Line 722: `recordSessionApproval(pending.toolName, connState.approvalPolicy)` — previously NOT_WIRED, now fully wired |

---

## Anti-Patterns Check (Re-verification)

Previously identified anti-patterns were reviewed:

| File | Line | Pattern | Severity | Status |
|------|------|---------|----------|--------|
| `packages/gateway/src/ws/handlers.ts` | 720-724 | Session-approve block | Previously WARNING | RESOLVED — now calls recordSessionApproval |
| `packages/gateway/src/agent/tool-loop.ts` | 6 | `recordSessionApproval` imported but never called locally | INFO | Acceptable — `checkApproval` in same import statement is used at line 121; `recordSessionApproval` in the import is not called locally but is not a compile error |

No new anti-patterns introduced by the gap closure changes.

---

## Human Verification Required

### 1. Session-Approve Key (S) End-to-End

**Test:** Start the agent, send a message that triggers a tool call (e.g. "list the files in this directory"), receive the approval prompt, press S. Then send another message that triggers the same tool.
**Expected:** The second call to the same tool executes without showing an approval prompt.
**Why human:** Session state is runtime-only; cannot verify by grepping; requires an actual running gateway and CLI session. Static analysis now confirms the wiring is correct.

### 2. Pre-flight Checklist Display

**Test:** Send a message with 200+ characters or containing "refactor", "delete", or "deploy". Observe the CLI before any agent response starts.
**Expected:** A pre-flight checklist appears with numbered steps, color-coded risk levels (green LOW, yellow MEDIUM, red HIGH), an estimated token/USD cost line, a permissions list, and Y/N prompt — all before the agent loop begins.
**Why human:** Requires a running gateway with a configured LLM and tool registry.

### 3. Workspace Boundary Enforcement

**Test:** In limited-control security mode (default), use the agent's read_file tool to request a file outside the configured workspaceDir (e.g. /etc/hosts when workspace is ~/projects/foo).
**Expected:** Tool returns an error: "Path '/etc/hosts' is outside the allowed workspace '~/projects/foo'"
**Why human:** Requires runtime execution with a configured workspace.

---

## Summary

All 5 success criteria for Phase 6 are now verified. The one gap from the initial verification (session-approve being non-functional) was closed in plan 05 by three targeted changes:

1. `connection.ts`: `pendingApprovals` Map type updated to carry `toolName` alongside `resolve`.
2. `tool-loop.ts`: `waitForApproval` accepts and stores `toolName` in the Map entry.
3. `handlers.ts`: `handleToolApprovalResponse` calls `recordSessionApproval(pending.toolName, connState.approvalPolicy)` when the client sends `sessionApprove: true`.

TypeScript compiles cleanly with zero errors. Commit `3abe684` is verified in git history.

Phase 6 goal is achieved: the agent can use tools, access the filesystem and shell, and users have granular control over what the agent is allowed to do — including per-tool and per-session approval tiers.

---

_Verified: 2026-02-17_
_Verifier: Claude (gsd-verifier)_

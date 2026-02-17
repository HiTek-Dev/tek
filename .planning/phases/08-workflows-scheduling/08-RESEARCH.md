# Phase 8: Workflows & Scheduling - Research

**Researched:** 2026-02-16
**Domain:** Workflow engine, cron scheduling, heartbeat monitoring, YAML/TypeScript workflow definitions, step execution with branching
**Confidence:** HIGH

## Summary

Phase 8 adds three capabilities to AgentSpace: (1) a multi-step workflow engine with branching logic, (2) a heartbeat monitoring system, and (3) cron-based task scheduling. The research reveals that these are best built as custom components within the existing gateway architecture rather than adopting a heavyweight workflow framework. The existing agent tool loop (`runAgentLoop` in `packages/gateway/src/agent/tool-loop.ts`) already implements step-by-step execution with tool calling and approval gates -- the workflow engine extends this pattern to multi-step orchestration with explicit branching and state persistence.

For scheduling, **Croner** (v10.0.x) is the clear standard: zero dependencies, full TypeScript support, IANA timezone handling, pause/resume/stop lifecycle, `maxRuns` for one-shot tasks, and OCPS 1.0-1.4 compliance with extended cron syntax (seconds, L/W/# modifiers). It is used by pm2, Uptime Kuma, and ZWave JS. For YAML workflow parsing, the `yaml` npm package (v2.x) is the standard YAML 1.2 parser with zero dependencies and full TypeScript types.

The workflow engine design follows a **durable execution** pattern: each workflow execution is persisted to SQLite after every step, enabling resumption after process restarts or approval gate pauses. Workflow definitions live as `.yaml` or `.ts` files in a `workflows/` directory alongside the existing `skills/` directory, following the same filesystem-based discovery pattern. The heartbeat is a specialized workflow type that runs on a cron schedule, reads a user-defined `HEARTBEAT.md` checklist, executes each check via the agent loop, and only alerts when action is needed.

**Primary recommendation:** Use Croner for scheduling, the `yaml` package for YAML parsing, build a custom workflow engine with SQLite-persisted state following the durable execution pattern, extend the existing WebSocket protocol with workflow lifecycle messages, and implement the heartbeat as a cron-triggered workflow that reads `HEARTBEAT.md`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `croner` | ^10.0.1 | Cron expression parsing + job scheduling | Zero dependencies, full TypeScript, IANA timezone support, pause/resume/stop, `maxRuns` for one-shot, `startAt`/`stopAt` for active hours. Used by pm2, Uptime Kuma. |
| `yaml` | ^2.7.0 | Parse YAML workflow definitions | Zero dependencies, YAML 1.2 compliant, full TypeScript types, AST access for validation. De facto standard (50M+ weekly downloads). |
| `ai` | ^6.0.86 (already installed) | LLM calls within workflow steps | Workflow steps that "call models" use `generateText`/`streamText` from the existing AI SDK integration. |
| `zod` | ^4.3.6 (already installed) | Schema validation for workflow definitions, step configs, schedule configs | Already used throughout for all schemas. |
| `drizzle-orm` | ^0.45.0 (already installed) | Persist workflow state, execution logs, schedule configs | Already used for all DB operations. Extend with new tables. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gray-matter` | ^4.0.3 (already in core) | Parse YAML frontmatter from HEARTBEAT.md | Heartbeat checklist parsing (same pattern as SKILL.md) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Croner | `node-cron` | node-cron lacks timezone support, no `nextRun()` introspection, no pause/resume, needs `@types/node-cron`. Croner is strictly superior for this use case. |
| Croner | `cron` (kelektiv) | v3 added TypeScript but still heavier API, no `maxRuns`, no `startAt`/`stopAt` for active hours. |
| Custom workflow engine | `workflow-es`, `ts-edge`, `flowsteps` | These are general-purpose workflow libs that add abstraction layers we don't need. Our engine needs tight integration with the existing agent loop, approval gates, tool registry, and WebSocket protocol. Custom is the right call. |
| `yaml` | `js-yaml` | js-yaml requires separate `@types` package, is YAML 1.1 (not 1.2), and has less precise error reporting. `yaml` is the modern standard. |

**Installation:**

```bash
# New dependencies for gateway
pnpm --filter @agentspace/gateway add croner yaml

# New dependencies for core (workflow types/schemas)
# No new deps needed - yaml parsing happens in gateway
```

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── gateway/
│   └── src/
│       ├── workflow/                    # NEW: Workflow engine
│       │   ├── engine.ts               # WorkflowEngine: load, execute, resume workflows
│       │   ├── executor.ts             # StepExecutor: run individual steps with branching
│       │   ├── loader.ts               # Load .yaml/.ts workflow definitions
│       │   ├── state.ts                # WorkflowState persistence (SQLite)
│       │   ├── types.ts                # WorkflowDefinition, StepDefinition, BranchConfig
│       │   └── index.ts
│       ├── scheduler/                   # NEW: Cron scheduler
│       │   ├── scheduler.ts            # CronScheduler: manages Croner jobs
│       │   ├── heartbeat.ts            # HeartbeatRunner: cron-triggered checklist executor
│       │   ├── store.ts                # Persist schedule configs to SQLite
│       │   ├── types.ts                # ScheduleConfig, HeartbeatConfig types
│       │   └── index.ts
│       ├── agent/                      # EXTEND
│       │   ├── tool-loop.ts            # Existing - reused by workflow steps
│       │   ├── approval-gate.ts        # Existing - reused for workflow approval gates
│       │   └── ...
│       ├── ws/
│       │   ├── protocol.ts             # EXTEND: Add workflow.*, schedule.*, heartbeat.* messages
│       │   ├── handlers.ts             # EXTEND: Add workflow/schedule handlers
│       │   └── ...
│       └── ...
├── db/
│   └── src/
│       └── schema/
│           ├── workflows.ts            # NEW: workflows, workflow_executions, workflow_steps tables
│           ├── schedules.ts            # NEW: schedules table (cron configs)
│           └── ...
├── core/
│   └── src/
│       └── config/
│           └── schema.ts               # EXTEND: Add heartbeat and workflow directory config
└── ...
```

### Pattern 1: Workflow Definition Schema (YAML)

**What:** YAML workflow definitions with sequential steps, conditional branching, tool invocations, and model calls. Inspired by GitHub Actions structure but simplified for agent orchestration.

**When to use:** WKFL-01 (TypeScript or YAML definitions).

**Example:**

```yaml
# workflows/deploy-check.yaml
name: deploy-check
description: Check if deployment is healthy and rollback if needed
trigger: manual  # or cron expression

steps:
  - id: check-health
    action: tool
    tool: execute_command
    args:
      command: "curl -s -o /dev/null -w '%{http_code}' https://api.example.com/health"
    on_success: evaluate-response
    on_failure: alert-team

  - id: evaluate-response
    action: model
    prompt: |
      The health check returned: {{steps.check-health.result}}
      Is the service healthy? Respond with JSON: {"healthy": true/false, "reason": "..."}
    output_schema:
      healthy: boolean
      reason: string
    branches:
      - condition: "result.healthy === true"
        goto: done
      - condition: "result.healthy === false"
        goto: rollback

  - id: rollback
    action: tool
    tool: execute_command
    args:
      command: "kubectl rollout undo deployment/api"
    approval_required: true  # Pause for user confirmation
    on_success: alert-team
    on_failure: alert-team

  - id: alert-team
    action: model
    prompt: |
      Summarize what happened during the deployment check:
      {{steps | json}}
      Format as a brief alert message.

  - id: done
    action: noop
```

### Pattern 2: TypeScript Workflow Definition

**What:** Workflows defined as TypeScript files exporting a `WorkflowDefinition` object. Provides full type safety and allows dynamic step logic.

**When to use:** When YAML is insufficient (complex conditions, dynamic tool args).

**Example:**

```typescript
// workflows/backup-rotate.workflow.ts
import type { WorkflowDefinition } from "@agentspace/gateway";

const workflow: WorkflowDefinition = {
  name: "backup-rotate",
  description: "Backup database and rotate old backups",
  steps: [
    {
      id: "backup",
      action: "tool",
      tool: "execute_command",
      args: { command: "pg_dump mydb > /backups/$(date +%Y%m%d).sql" },
      approvalRequired: true,
      onSuccess: "rotate",
      onFailure: "alert",
    },
    {
      id: "rotate",
      action: "tool",
      tool: "execute_command",
      args: { command: "find /backups -name '*.sql' -mtime +30 -delete" },
      approvalRequired: true,
      onSuccess: "done",
      onFailure: "alert",
    },
    {
      id: "alert",
      action: "model",
      prompt: "The backup workflow encountered an error: {{error}}. Draft an alert.",
    },
    { id: "done", action: "noop" },
  ],
};

export default workflow;
```

### Pattern 3: Durable Workflow Execution with SQLite Persistence

**What:** Each workflow execution is persisted step-by-step in SQLite. When a step completes (or pauses for approval), the state is saved. On resume (after approval or process restart), execution picks up from the last completed step.

**When to use:** All workflow executions. This is the core durability pattern.

**Example:**

```typescript
// Workflow execution state persisted to SQLite
interface WorkflowExecution {
  id: string;                          // Unique execution ID
  workflowId: string;                  // Reference to workflow definition
  status: "running" | "paused" | "completed" | "failed";
  currentStepId: string;               // Which step is executing/paused
  stepResults: Record<string, {        // Results from completed steps
    output: unknown;
    status: "success" | "failure";
    completedAt: string;
  }>;
  startedAt: string;
  pausedAt?: string;                   // Set when paused at approval gate
  completedAt?: string;
  error?: string;
  triggeredBy: "manual" | "cron" | "heartbeat";
}

// Step execution flow
async function executeStep(
  execution: WorkflowExecution,
  step: StepDefinition,
  tools: Record<string, unknown>,
  model: string,
): Promise<StepResult> {
  // 1. Check approval gate
  if (step.approvalRequired) {
    execution.status = "paused";
    execution.pausedAt = new Date().toISOString();
    await persistExecution(execution);
    // Send approval request via WebSocket
    // Return will resume when approval arrives
    return { status: "paused", awaitingApproval: true };
  }

  // 2. Execute based on action type
  switch (step.action) {
    case "tool":
      return executeToolStep(step, tools, execution.stepResults);
    case "model":
      return executeModelStep(step, model, execution.stepResults);
    case "noop":
      return { status: "success", output: null };
  }
}
```

### Pattern 4: Cron Scheduler with Active Hours

**What:** Croner-based scheduler that manages cron jobs with active hours filtering. Jobs are persisted in SQLite so they survive restarts. Active hours use `startAt`/`stopAt` or a custom guard function.

**When to use:** WKFL-05/07/08 (heartbeat scheduling, one-shot and recurring tasks, active hours).

**Example:**

```typescript
import { Cron } from "croner";

interface ScheduleConfig {
  id: string;
  name: string;
  cronExpression: string;           // "*/30 * * * *" for every 30 min
  timezone?: string;                // IANA timezone
  activeHours?: {
    start: string;                  // "09:00"
    end: string;                    // "17:00"
    daysOfWeek?: number[];          // 1-7 (Mon-Sun)
  };
  maxRuns?: number;                 // 1 for one-shot
  workflowId?: string;             // Workflow to trigger
  enabled: boolean;
}

class CronScheduler {
  private jobs = new Map<string, Cron>();

  schedule(config: ScheduleConfig, handler: () => Promise<void>): void {
    const job = new Cron(config.cronExpression, {
      timezone: config.timezone,
      maxRuns: config.maxRuns,
      paused: !config.enabled,
      name: config.id,
      catch: (err) => {
        logger.error(`Scheduled job "${config.name}" failed: ${err}`);
      },
    }, async () => {
      // Active hours guard
      if (config.activeHours && !isWithinActiveHours(config.activeHours)) {
        logger.info(`Skipping "${config.name}" - outside active hours`);
        return;
      }
      await handler();
    });

    this.jobs.set(config.id, job);
  }

  pause(id: string): void { this.jobs.get(id)?.pause(); }
  resume(id: string): void { this.jobs.get(id)?.resume(); }
  stop(id: string): void {
    this.jobs.get(id)?.stop();
    this.jobs.delete(id);
  }
  stopAll(): void {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
  }
  nextRun(id: string): Date | null {
    return this.jobs.get(id)?.nextRun() ?? null;
  }
}

function isWithinActiveHours(hours: { start: string; end: string; daysOfWeek?: number[] }): boolean {
  const now = new Date();
  const currentDay = now.getDay() || 7; // Convert 0 (Sun) to 7
  if (hours.daysOfWeek && !hours.daysOfWeek.includes(currentDay)) return false;

  const [startH, startM] = hours.start.split(":").map(Number);
  const [endH, endM] = hours.end.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
```

### Pattern 5: Heartbeat as Specialized Workflow

**What:** The heartbeat reads a `HEARTBEAT.md` file (markdown checklist), converts each checklist item into an agent prompt, runs the agent loop for each item, and only alerts the user when the agent determines action is needed.

**When to use:** WKFL-05/06/07 (heartbeat with checklist, alert-only, active hours).

**Example:**

```typescript
// HEARTBEAT.md format (user-defined)
// ---
// interval: 30    # minutes (default 30)
// timezone: America/New_York
// activeHours:
//   start: "09:00"
//   end: "17:00"
//   daysOfWeek: [1, 2, 3, 4, 5]  # Mon-Fri
// ---
// - [ ] Check if the API health endpoint returns 200
// - [ ] Check if disk usage is below 80%
// - [ ] Check if there are any unread urgent emails
// - [ ] Check if the CI pipeline has any failed builds

interface HeartbeatCheck {
  description: string;
  actionNeeded: boolean;
  details?: string;
}

async function runHeartbeat(
  checklistItems: string[],
  model: string,
  tools: Record<string, unknown>,
): Promise<HeartbeatCheck[]> {
  const results: HeartbeatCheck[] = [];

  for (const item of checklistItems) {
    // Use generateText (not streaming) for each check
    const result = await generateText({
      model: languageModel,
      system: `You are a monitoring agent. Check the following item and determine if any action is needed.
Respond with JSON: {"actionNeeded": boolean, "details": "brief explanation"}
Only set actionNeeded to true if the user MUST take action.`,
      prompt: `Check: ${item}\nUse the available tools to verify this.`,
      tools,
      maxSteps: 5,
    });

    // Parse the agent's assessment
    results.push({
      description: item,
      ...parseHeartbeatResult(result.text),
    });
  }

  return results;
}
```

### Pattern 6: Step Result Templating

**What:** Workflow steps reference results from previous steps using `{{steps.step-id.result}}` template syntax. This enables chaining results between steps.

**When to use:** WKFL-03 (chain results between steps).

**Example:**

```typescript
/**
 * Resolve template expressions in step arguments.
 * Supports: {{steps.stepId.result}}, {{steps | json}}, {{error}}
 */
function resolveTemplates(
  template: string,
  context: {
    steps: Record<string, { output: unknown; status: string }>;
    error?: string;
  },
): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_, expr: string) => {
    const trimmed = expr.trim();

    if (trimmed === "steps | json") {
      return JSON.stringify(context.steps, null, 2);
    }
    if (trimmed === "error") {
      return context.error ?? "No error";
    }
    // Match steps.{id}.result or steps.{id}.output
    const stepMatch = trimmed.match(/^steps\.([^.]+)\.(\w+)$/);
    if (stepMatch) {
      const [, stepId, field] = stepMatch;
      const stepResult = context.steps[stepId];
      if (!stepResult) return `[step "${stepId}" not found]`;
      if (field === "result" || field === "output") {
        return typeof stepResult.output === "string"
          ? stepResult.output
          : JSON.stringify(stepResult.output);
      }
      return String((stepResult as any)[field] ?? `[unknown field "${field}"]`);
    }

    return `[unknown expression: ${trimmed}]`;
  });
}
```

### Anti-Patterns to Avoid

- **Blocking the event loop during workflow execution:** Workflow steps can be long-running (LLM calls, shell commands). Never use synchronous execution. Always use async and the existing tool-loop patterns.
- **Storing workflow definitions in the database:** Definitions belong in the filesystem (`.yaml`/`.ts` files) like skills. Only execution state goes in SQLite. This keeps definitions version-controllable.
- **Running heartbeat checks in parallel:** Heartbeat items may depend on each other or share resources. Run sequentially to avoid interference. Use Croner's `protect` option to prevent overlapping heartbeat runs.
- **Tight coupling between scheduler and workflow engine:** The scheduler triggers workflow execution but does not manage workflow state. Keep them decoupled: scheduler calls `engine.execute(workflowId)` and the engine handles everything from there.
- **In-memory-only schedule state:** If the process restarts, all scheduled jobs are lost. Persist schedule configs to SQLite and reload on startup. Croner jobs are recreated from persisted configs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron expression parsing | Custom regex parser | Croner `Cron` class | Cron syntax has 6-7 fields, L/W/# modifiers, nicknames, timezone rules. Croner handles all edge cases. |
| Cron scheduling loop | `setInterval` + date checks | Croner scheduled jobs | Croner handles DST transitions, missed runs, timezone-aware scheduling, overrun protection. `setInterval` drifts. |
| YAML parsing | `js-yaml` or regex | `yaml` v2.x | Full YAML 1.2 spec, better TypeScript types, better error messages, zero deps. |
| Active hours filtering | Complex date/time math | Croner `startAt`/`stopAt` + custom guard | Croner handles timezone-aware scheduling natively. Guard function adds active hours logic. |
| Template resolution | Full template engine (handlebars, etc.) | Simple `{{}}` regex replacement | Workflow templates are simple key lookups, not complex rendering. A regex handler is sufficient and avoids a dependency. |

**Key insight:** The workflow engine itself is custom because it must integrate tightly with the existing agent loop, tool registry, approval gates, and WebSocket protocol. But scheduling (Croner) and YAML parsing (`yaml`) should use proven libraries.

## Common Pitfalls

### Pitfall 1: Workflow State Lost on Process Restart
**What goes wrong:** Workflow execution state is only in memory. Process crashes or restarts lose all in-progress workflows.
**Why it happens:** Tempting to keep state in memory for simplicity.
**How to avoid:** Persist execution state to SQLite after every step transition. On startup, scan for `status: "running"` or `status: "paused"` executions and resume them.
**Warning signs:** Workflows silently disappear after gateway restarts.

### Pitfall 2: Heartbeat Alert Fatigue
**What goes wrong:** Heartbeat alerts on every check, including when nothing is wrong. Users disable it.
**Why it happens:** No "action needed" filtering. Agent reports every check result.
**How to avoid:** Heartbeat prompt explicitly instructs the agent to ONLY flag items requiring action. Default behavior is silence (no alert = everything is fine). Agent must explain WHY action is needed, not just that it checked.
**Warning signs:** Users complaining about too many notifications.

### Pitfall 3: Approval Gate Deadlock in Scheduled Workflows
**What goes wrong:** A cron-triggered workflow hits an approval gate but no one is online to approve. Workflow hangs forever.
**Why it happens:** Approval timeout logic from interactive sessions doesn't apply to background workflows.
**How to avoid:** Scheduled workflows should have a configurable approval timeout (default: 1 hour for background tasks vs 60s for interactive). On timeout, either auto-deny with notification or auto-approve with audit log (configurable per workflow).
**Warning signs:** Growing number of `status: "paused"` workflows with old `pausedAt` timestamps.

### Pitfall 4: Cron Jobs Not Restored After Restart
**What goes wrong:** Cron jobs registered with Croner are in-memory. After restart, no jobs are running.
**Why it happens:** Croner is a runtime scheduler, not a persistence layer.
**How to avoid:** Store all schedule configs in a `schedules` SQLite table. On gateway startup, load all enabled schedules and create Croner jobs from them. The SQLite table is the source of truth; Croner jobs are derived.
**Warning signs:** Heartbeat stops running after gateway restart until user manually re-enables it.

### Pitfall 5: Template Injection in Workflow Steps
**What goes wrong:** A previous step's output contains `{{steps.other.result}}` template syntax, which gets resolved when used as input to a later step, causing unexpected behavior.
**Why it happens:** Template resolution runs on all string fields without sanitization.
**How to avoid:** Only resolve templates in the `prompt` and `args` fields of step definitions, never in step results/outputs. Step results are data, not templates.
**Warning signs:** Unexpected step behavior when tool output contains curly braces.

### Pitfall 6: Overlapping Heartbeat Runs
**What goes wrong:** Heartbeat runs at 30-min intervals, but a single run takes 45 minutes (slow LLM calls, network issues). Two runs overlap, causing duplicate alerts.
**Why it happens:** Croner fires on schedule regardless of whether the previous run finished.
**How to avoid:** Use Croner's `protect: true` option, which skips a trigger if the previous run hasn't completed. Log a warning when this happens.
**Warning signs:** Duplicate alerts for the same check within a short time window.

## Code Examples

### DB Schema for Workflows and Schedules

```typescript
// packages/db/src/schema/workflows.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),                    // UUID
  name: text("name").notNull(),
  description: text("description"),
  definitionPath: text("definition_path").notNull(), // path to .yaml or .ts file
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const workflowExecutions = sqliteTable("workflow_executions", {
  id: text("id").primaryKey(),                    // UUID
  workflowId: text("workflow_id").notNull().references(() => workflows.id),
  status: text("status").notNull(),               // running | paused | completed | failed
  currentStepId: text("current_step_id"),
  stepResults: text("step_results"),              // JSON string
  triggeredBy: text("triggered_by").notNull(),    // manual | cron | heartbeat
  startedAt: text("started_at").notNull(),
  pausedAt: text("paused_at"),
  completedAt: text("completed_at"),
  error: text("error"),
});

// packages/db/src/schema/schedules.ts
export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),                    // UUID
  name: text("name").notNull(),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone"),
  activeHoursStart: text("active_hours_start"),   // "09:00"
  activeHoursEnd: text("active_hours_end"),       // "17:00"
  activeHoursDays: text("active_hours_days"),     // JSON array "[1,2,3,4,5]"
  maxRuns: integer("max_runs"),                   // null = unlimited, 1 = one-shot
  workflowId: text("workflow_id").references(() => workflows.id),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

### WebSocket Protocol Extensions

```typescript
// New client messages for Phase 8
const WorkflowTriggerSchema = z.object({
  type: z.literal("workflow.trigger"),
  id: z.string(),
  workflowId: z.string(),
  input: z.record(z.unknown()).optional(),
});

const WorkflowApprovalSchema = z.object({
  type: z.literal("workflow.approval"),
  id: z.string(),
  executionId: z.string(),
  stepId: z.string(),
  approved: z.boolean(),
});

const WorkflowListSchema = z.object({
  type: z.literal("workflow.list"),
  id: z.string(),
});

const ScheduleCreateSchema = z.object({
  type: z.literal("schedule.create"),
  id: z.string(),
  name: z.string(),
  cronExpression: z.string(),
  timezone: z.string().optional(),
  workflowId: z.string().optional(),
  activeHours: z.object({
    start: z.string(),
    end: z.string(),
    daysOfWeek: z.array(z.number()).optional(),
  }).optional(),
  maxRuns: z.number().optional(),
});

const ScheduleUpdateSchema = z.object({
  type: z.literal("schedule.update"),
  id: z.string(),
  scheduleId: z.string(),
  enabled: z.boolean().optional(),
  cronExpression: z.string().optional(),
  activeHours: z.object({
    start: z.string(),
    end: z.string(),
    daysOfWeek: z.array(z.number()).optional(),
  }).optional(),
});

const ScheduleListSchema = z.object({
  type: z.literal("schedule.list"),
  id: z.string(),
});

const HeartbeatConfigSchema = z.object({
  type: z.literal("heartbeat.configure"),
  id: z.string(),
  interval: z.number().default(30),       // minutes
  timezone: z.string().optional(),
  activeHours: z.object({
    start: z.string(),
    end: z.string(),
    daysOfWeek: z.array(z.number()).optional(),
  }).optional(),
  enabled: z.boolean().default(true),
});

// New server messages for Phase 8
const WorkflowStatusSchema = z.object({
  type: z.literal("workflow.status"),
  executionId: z.string(),
  workflowId: z.string(),
  status: z.enum(["running", "paused", "completed", "failed"]),
  currentStepId: z.string().optional(),
  stepResults: z.record(z.unknown()).optional(),
});

const WorkflowApprovalRequestSchema = z.object({
  type: z.literal("workflow.approval.request"),
  executionId: z.string(),
  workflowId: z.string(),
  stepId: z.string(),
  stepDescription: z.string(),
  args: z.unknown().optional(),
});

const WorkflowListResultSchema = z.object({
  type: z.literal("workflow.list.result"),
  id: z.string(),
  workflows: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    definitionPath: z.string(),
  })),
});

const ScheduleListResultSchema = z.object({
  type: z.literal("schedule.list.result"),
  id: z.string(),
  schedules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    cronExpression: z.string(),
    timezone: z.string().optional(),
    enabled: z.boolean(),
    nextRun: z.string().optional(),
    workflowId: z.string().optional(),
  })),
});

const HeartbeatAlertSchema = z.object({
  type: z.literal("heartbeat.alert"),
  checks: z.array(z.object({
    description: z.string(),
    actionNeeded: z.boolean(),
    details: z.string().optional(),
  })),
  timestamp: z.string(),
});
```

### Workflow Definition Zod Schema

```typescript
// Validate YAML workflow definitions after parsing
const StepDefinitionSchema = z.object({
  id: z.string(),
  action: z.enum(["tool", "model", "noop"]),
  tool: z.string().optional(),               // tool name from registry
  args: z.record(z.unknown()).optional(),     // tool arguments (may contain templates)
  prompt: z.string().optional(),             // model prompt (may contain templates)
  outputSchema: z.record(z.unknown()).optional(), // expected output shape
  approvalRequired: z.boolean().optional().default(false),
  onSuccess: z.string().optional(),          // step ID to go to on success
  onFailure: z.string().optional(),          // step ID to go to on failure
  branches: z.array(z.object({
    condition: z.string(),                   // JS expression evaluated against result
    goto: z.string(),                        // step ID
  })).optional(),
  timeout: z.number().optional(),            // step timeout in ms
});

const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trigger: z.union([
    z.literal("manual"),
    z.string(),                              // cron expression
  ]).optional().default("manual"),
  steps: z.array(StepDefinitionSchema).min(1),
});
```

### HEARTBEAT.md Configuration Format

```typescript
// HEARTBEAT.md uses the same gray-matter frontmatter as SKILL.md
const HeartbeatConfigSchema = z.object({
  interval: z.number().default(30),          // minutes
  timezone: z.string().optional(),
  activeHours: z.object({
    start: z.string(),
    end: z.string(),
    daysOfWeek: z.array(z.number()).optional(),
  }).optional(),
});

function loadHeartbeatConfig(heartbeatPath: string): {
  config: HeartbeatConfig;
  checklistItems: string[];
} {
  const raw = readFileSync(heartbeatPath, "utf-8");
  const { data, content } = matter(raw);
  const config = HeartbeatConfigSchema.parse(data);

  // Parse markdown checklist items
  const items = content
    .split("\n")
    .filter(line => /^\s*-\s*\[[ x]\]\s+/.test(line))
    .map(line => line.replace(/^\s*-\s*\[[ x]\]\s+/, "").trim())
    .filter(Boolean);

  return { config, checklistItems: items };
}
```

### Condition Evaluation for Branching

```typescript
/**
 * Safely evaluate a branch condition against a step result.
 * Uses Function constructor (NOT eval) with a restricted scope.
 * Only allows access to `result` variable.
 */
function evaluateCondition(
  condition: string,
  result: unknown,
): boolean {
  try {
    // Create a function that only has access to 'result'
    const fn = new Function("result", `"use strict"; return (${condition});`);
    return Boolean(fn(result));
  } catch {
    return false;
  }
}

// Usage in step execution:
function resolveNextStep(
  step: StepDefinition,
  result: StepResult,
): string | null {
  // 1. Check explicit branches first
  if (step.branches) {
    for (const branch of step.branches) {
      if (evaluateCondition(branch.condition, result.output)) {
        return branch.goto;
      }
    }
  }

  // 2. Fall back to on_success / on_failure
  if (result.status === "success" && step.onSuccess) return step.onSuccess;
  if (result.status === "failure" && step.onFailure) return step.onFailure;

  // 3. Default: next step in array order (sequential)
  return null; // engine advances to next index
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-cron` for scheduling | Croner (zero deps, TypeScript, timezone, active hours) | 2024-2025 | Better timezone handling, `maxRuns` for one-shot, `protect` for overlap prevention |
| `js-yaml` for YAML parsing | `yaml` v2.x (YAML 1.2, zero deps, TypeScript) | 2023+ | Better spec compliance, better error messages, built-in TypeScript types |
| External workflow engines (Temporal, Windmill) | Custom lightweight engine for embedded use | N/A | External engines are too heavy for a single-process embedded system. Custom engine integrates with existing agent loop. |
| `setInterval` for heartbeat | Croner with `protect` + active hours guard | N/A | Croner prevents drift, handles DST, prevents overlapping runs |
| YAML-only workflow definitions | YAML + TypeScript dual format | Emerging | TypeScript definitions provide type safety and dynamic logic; YAML for simple cases |

**Deprecated/outdated:**
- `node-cron`: Lacks timezone, no pause/resume, no `nextRun()` introspection. Use Croner instead.
- `js-yaml`: YAML 1.1 only, needs separate types package. Use `yaml` v2.x instead.
- `setInterval` for scheduling: Drifts over time, no DST handling, no overrun protection. Use Croner.

## Open Questions

1. **Branch condition safety**
   - What we know: Branches need to evaluate conditions like `result.healthy === true`. Using `new Function()` is safer than `eval()` but still allows arbitrary code execution.
   - What's unclear: Whether to allow arbitrary JS expressions or restrict to a safe subset (comparisons only).
   - Recommendation: Start with `new Function()` restricted to the `result` variable. For v1 this is acceptable since workflow definitions are authored by the user (not external input). Document the security boundary. Consider a safe expression evaluator (like `expr-eval`) for v2 if needed.

2. **Workflow definition hot-reload**
   - What we know: Workflows live as files on disk. Users will edit them.
   - What's unclear: Whether to watch the filesystem for changes or require a reload command.
   - Recommendation: Start with a `/workflow reload` slash command. File watching adds complexity (debouncing, error handling) that can be deferred. The workflow engine loads definitions on-demand, so editing a file takes effect on next trigger.

3. **Heartbeat notification channel**
   - What we know: Heartbeat alerts should go to the user. Phase 9 adds Telegram. Phase 8 only has CLI/WebSocket.
   - What's unclear: What happens when no client is connected? Alerts are lost.
   - Recommendation: Store heartbeat results in SQLite (a `heartbeat_results` table). When a client connects, show any unread alerts. This bridges the gap until Telegram is added in Phase 9. Consider this a "notification queue" pattern.

4. **Workflow step timeout defaults**
   - What we know: Tool steps and model steps can hang. Need timeouts.
   - What's unclear: What reasonable defaults are for different step types.
   - Recommendation: Tool steps: 30s default (matches existing shell tool). Model steps: 120s default (LLM calls can be slow). Approval gates: 1 hour for background workflows, 60s for interactive. All configurable per-step.

5. **Concurrent workflow execution limit**
   - What we know: Multiple workflows could run simultaneously (cron-triggered).
   - What's unclear: Whether to limit concurrency and how.
   - Recommendation: Start without a limit but track active executions. Log warnings when >5 workflows run simultaneously. Add a `maxConcurrent` config option for v2.

## Sources

### Primary (HIGH confidence)
- [Croner GitHub](https://github.com/Hexagon/croner) - Full API documentation, CronOptions, methods, version 10.0.1
- [Croner npm](https://www.npmjs.com/package/croner) - Package details, usage examples, TypeScript support
- [yaml npm](https://www.npmjs.com/package/yaml) - v2.x YAML 1.2 parser, TypeScript types
- [yaml GitHub](https://github.com/eemeli/yaml) - API documentation, parse/stringify/document modes

### Secondary (MEDIUM confidence)
- [Better Stack: Node.js Schedulers Comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) - Comparison of croner, node-cron, cron, node-schedule
- [Gunnar Morling: Durable Execution Engine with SQLite](https://www.morling.dev/blog/building-durable-execution-engine-with-sqlite/) - Persistence pattern for workflow state
- [GitHub Actions Workflow Syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) - Inspiration for YAML workflow definition format

### Tertiary (LOW confidence)
- Workflow engine libraries (ts-edge, flowsteps, TsWorkflow): Reviewed for patterns but not recommended for direct use due to integration mismatch with AgentSpace's existing architecture.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Croner and yaml are well-established, actively maintained, zero-dependency libraries with full TypeScript support. Verified via npm and GitHub.
- Architecture: HIGH - Patterns derived from existing codebase conventions (agent tool loop, approval gates, WS protocol, SQLite persistence). Durable execution pattern is well-established.
- Workflow engine design: MEDIUM - Custom build with no reference implementation. Design is sound and follows durable execution principles, but needs validation during implementation.
- Heartbeat design: MEDIUM - Novel feature combining cron + agent loop + markdown checklist. No prior art for this exact pattern. Individual components are well-understood.
- Pitfalls: HIGH - Overlapping cron runs, approval deadlocks, state persistence are well-documented problems with known solutions.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - Croner and yaml are stable; workflow patterns are evergreen)

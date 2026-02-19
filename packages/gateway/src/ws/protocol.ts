import { z } from "zod";

// ── Client Messages (inbound) ──────────────────────────────────────────

const ChatSendSchema = z.object({
	type: z.literal("chat.send"),
	id: z.string(),
	sessionId: z.string().optional(),
	content: z.string(),
	model: z.string().optional(),
});

const ContextInspectSchema = z.object({
	type: z.literal("context.inspect"),
	id: z.string(),
	sessionId: z.string(),
});

const UsageQuerySchema = z.object({
	type: z.literal("usage.query"),
	id: z.string(),
	sessionId: z.string().optional(),
});

const SessionListSchema = z.object({
	type: z.literal("session.list"),
	id: z.string(),
});

const ChatRouteConfirmSchema = z.object({
	type: z.literal("chat.route.confirm"),
	id: z.string(),
	requestId: z.string(), // matches the proposal's requestId
	accept: z.boolean(),
	override: z
		.object({
			provider: z.string(),
			model: z.string(),
		})
		.optional(), // present when accept=false
});

// ── Memory & Thread Client Messages ────────────────────────────────────

const MemorySearchSchema = z.object({
	type: z.literal("memory.search"),
	id: z.string(),
	query: z.string(),
	topK: z.number().optional(),
	threadId: z.string().optional(),
});

const ThreadCreateSchema = z.object({
	type: z.literal("thread.create"),
	id: z.string(),
	title: z.string(),
	systemPrompt: z.string().optional(),
});

const ThreadListSchema = z.object({
	type: z.literal("thread.list"),
	id: z.string(),
	includeArchived: z.boolean().optional(),
});

const ThreadUpdateSchema = z.object({
	type: z.literal("thread.update"),
	id: z.string(),
	threadId: z.string(),
	title: z.string().optional(),
	systemPrompt: z.string().optional(),
	archived: z.boolean().optional(),
});

const PromptSetSchema = z.object({
	type: z.literal("prompt.set"),
	id: z.string(),
	name: z.string(),
	content: z.string(),
	priority: z.number().optional(),
});

const PromptListSchema = z.object({
	type: z.literal("prompt.list"),
	id: z.string(),
});

// ── Workflow Client Messages ──────────────────────────────────────────

const WorkflowTriggerSchema = z.object({
	type: z.literal("workflow.trigger"),
	id: z.string(),
	workflowId: z.string(),
	input: z.record(z.string(), z.unknown()).optional(),
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

const WorkflowExecutionListSchema = z.object({
	type: z.literal("workflow.execution.list"),
	id: z.string(),
	workflowId: z.string().optional(),
	status: z.string().optional(),
});

// ── Schedule Client Messages ──────────────────────────────────────────

const ActiveHoursShape = z.object({
	start: z.string(),
	end: z.string(),
	daysOfWeek: z.array(z.number()).optional(),
});

const ScheduleCreateSchema = z.object({
	type: z.literal("schedule.create"),
	id: z.string(),
	name: z.string(),
	cronExpression: z.string(),
	timezone: z.string().optional(),
	workflowId: z.string().optional(),
	activeHours: ActiveHoursShape.optional(),
	maxRuns: z.number().optional(),
});

const ScheduleUpdateSchema = z.object({
	type: z.literal("schedule.update"),
	id: z.string(),
	scheduleId: z.string(),
	enabled: z.boolean().optional(),
	cronExpression: z.string().optional(),
	activeHours: ActiveHoursShape.optional(),
});

const ScheduleDeleteSchema = z.object({
	type: z.literal("schedule.delete"),
	id: z.string(),
	scheduleId: z.string(),
});

const ScheduleListSchema = z.object({
	type: z.literal("schedule.list"),
	id: z.string(),
});

// ── Heartbeat Client Messages ──────────────────────────────────────────

const HeartbeatConfigureSchema = z.object({
	type: z.literal("heartbeat.configure"),
	id: z.string(),
	heartbeatPath: z.string(),
	interval: z.number().default(30),
	timezone: z.string().optional(),
	activeHours: ActiveHoursShape.optional(),
	enabled: z.boolean().default(true),
});

// ── Terminal Client Messages ──────────────────────────────────────────

const TerminalSnapshotSchema = z.object({
	type: z.literal("terminal.snapshot"),
	id: z.string(),
	sessionId: z.string(),
	content: z.string(),
	timestamp: z.number(),
});

const TerminalControlGrantSchema = z.object({
	type: z.literal("terminal.control.grant"),
	id: z.string(),
	sessionId: z.string(),
});

const TerminalControlRevokeSchema = z.object({
	type: z.literal("terminal.control.revoke"),
	id: z.string(),
	sessionId: z.string(),
});

// ── Claude Code Client Messages ──────────────────────────────────────

const ClaudeCodeStartSchema = z.object({
	type: z.literal("claude-code.start"),
	id: z.string(),
	prompt: z.string(),
	cwd: z.string(),
	allowedTools: z.array(z.string()).optional(),
	sessionId: z.string().optional(),
});

const ClaudeCodeAbortSchema = z.object({
	type: z.literal("claude-code.abort"),
	id: z.string(),
	sessionId: z.string(),
});

// ── Tool & Preflight Client Messages ──────────────────────────────────

const ToolApprovalResponseSchema = z.object({
	type: z.literal("tool.approval.response"),
	id: z.string(),
	toolCallId: z.string(),
	approved: z.boolean(),
	sessionApprove: z.boolean().optional(),
});

const PreflightApprovalSchema = z.object({
	type: z.literal("preflight.approval"),
	id: z.string(),
	requestId: z.string(),
	approved: z.boolean(),
	editedSteps: z
		.array(
			z.object({
				description: z.string(),
				toolName: z.string().optional(),
				skip: z.boolean().optional(),
			}),
		)
		.optional(),
});

const SoulEvolutionResponseSchema = z.object({
	type: z.literal("soul.evolution.response"),
	id: z.string(),
	requestId: z.string(),
	approved: z.boolean(),
	editedContent: z.string().optional(),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
	ChatSendSchema,
	ContextInspectSchema,
	UsageQuerySchema,
	SessionListSchema,
	ChatRouteConfirmSchema,
	MemorySearchSchema,
	ThreadCreateSchema,
	ThreadListSchema,
	ThreadUpdateSchema,
	PromptSetSchema,
	PromptListSchema,
	ClaudeCodeStartSchema,
	ClaudeCodeAbortSchema,
	ToolApprovalResponseSchema,
	PreflightApprovalSchema,
	TerminalSnapshotSchema,
	TerminalControlGrantSchema,
	TerminalControlRevokeSchema,
	WorkflowTriggerSchema,
	WorkflowApprovalSchema,
	WorkflowListSchema,
	WorkflowExecutionListSchema,
	ScheduleCreateSchema,
	ScheduleUpdateSchema,
	ScheduleDeleteSchema,
	ScheduleListSchema,
	HeartbeatConfigureSchema,
	SoulEvolutionResponseSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ChatSend = z.infer<typeof ChatSendSchema>;
export type ContextInspect = z.infer<typeof ContextInspectSchema>;
export type UsageQuery = z.infer<typeof UsageQuerySchema>;
export type SessionList = z.infer<typeof SessionListSchema>;
export type ChatRouteConfirm = z.infer<typeof ChatRouteConfirmSchema>;
export type MemorySearch = z.infer<typeof MemorySearchSchema>;
export type ThreadCreate = z.infer<typeof ThreadCreateSchema>;
export type ThreadList = z.infer<typeof ThreadListSchema>;
export type ThreadUpdate = z.infer<typeof ThreadUpdateSchema>;
export type PromptSet = z.infer<typeof PromptSetSchema>;
export type PromptList = z.infer<typeof PromptListSchema>;
export type ClaudeCodeStart = z.infer<typeof ClaudeCodeStartSchema>;
export type ClaudeCodeAbort = z.infer<typeof ClaudeCodeAbortSchema>;
export type ToolApprovalResponse = z.infer<typeof ToolApprovalResponseSchema>;
export type PreflightApproval = z.infer<typeof PreflightApprovalSchema>;
export type TerminalSnapshot = z.infer<typeof TerminalSnapshotSchema>;
export type TerminalControlGrant = z.infer<typeof TerminalControlGrantSchema>;
export type TerminalControlRevoke = z.infer<typeof TerminalControlRevokeSchema>;
export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>;
export type WorkflowApproval = z.infer<typeof WorkflowApprovalSchema>;
export type WorkflowList = z.infer<typeof WorkflowListSchema>;
export type WorkflowExecutionList = z.infer<typeof WorkflowExecutionListSchema>;
export type ScheduleCreate = z.infer<typeof ScheduleCreateSchema>;
export type ScheduleUpdate = z.infer<typeof ScheduleUpdateSchema>;
export type ScheduleDelete = z.infer<typeof ScheduleDeleteSchema>;
export type ScheduleList = z.infer<typeof ScheduleListSchema>;
export type HeartbeatConfigure = z.infer<typeof HeartbeatConfigureSchema>;
export type SoulEvolutionResponse = z.infer<typeof SoulEvolutionResponseSchema>;

// ── Server Messages (outbound) ─────────────────────────────────────────

const ChatStreamStartSchema = z.object({
	type: z.literal("chat.stream.start"),
	requestId: z.string(),
	sessionId: z.string(),
	model: z.string(),
	routing: z
		.object({
			tier: z.enum(["high", "standard", "budget"]),
			reason: z.string(),
		})
		.optional(),
});

const ChatRouteProposalSchema = z.object({
	type: z.literal("chat.route.propose"),
	requestId: z.string(),
	sessionId: z.string(),
	routing: z.object({
		tier: z.enum(["high", "standard", "budget"]),
		provider: z.string(),
		model: z.string(),
		reason: z.string(),
		confidence: z.number(),
	}),
	alternatives: z.array(
		z.object({
			provider: z.string(),
			model: z.string(),
			tier: z.enum(["high", "standard", "budget"]),
		}),
	),
});

const ChatStreamDeltaSchema = z.object({
	type: z.literal("chat.stream.delta"),
	requestId: z.string(),
	delta: z.string(),
});

const ChatStreamEndSchema = z.object({
	type: z.literal("chat.stream.end"),
	requestId: z.string(),
	usage: z.object({
		inputTokens: z.number(),
		outputTokens: z.number(),
		totalTokens: z.number(),
	}),
	cost: z.object({
		inputCost: z.number(),
		outputCost: z.number(),
		totalCost: z.number(),
	}),
});

const ContextInspectionSchema = z.object({
	type: z.literal("context.inspection"),
	requestId: z.string(),
	sections: z.array(
		z.object({
			name: z.string(),
			content: z.string(),
			byteCount: z.number(),
			tokenEstimate: z.number(),
			costEstimate: z.number(),
		}),
	),
	totals: z.object({
		byteCount: z.number(),
		tokenEstimate: z.number(),
		costEstimate: z.number(),
	}),
});

const UsageReportSchema = z.object({
	type: z.literal("usage.report"),
	requestId: z.string(),
	perModel: z.record(
		z.string(),
		z.object({
			inputTokens: z.number(),
			outputTokens: z.number(),
			totalTokens: z.number(),
			totalCost: z.number(),
			requestCount: z.number(),
		}),
	),
	grandTotal: z.object({
		totalCost: z.number(),
		totalTokens: z.number(),
		requestCount: z.number(),
	}),
});

const ErrorSchema = z.object({
	type: z.literal("error"),
	requestId: z.string().optional(),
	code: z.string(),
	message: z.string(),
});

const SessionCreatedSchema = z.object({
	type: z.literal("session.created"),
	sessionId: z.string(),
	sessionKey: z.string(),
});

const SessionListResponseSchema = z.object({
	type: z.literal("session.list"),
	requestId: z.string(),
	sessions: z.array(
		z.object({
			sessionId: z.string(),
			sessionKey: z.string(),
			model: z.string(),
			createdAt: z.string(),
			messageCount: z.number(),
		}),
	),
});

// ── Memory & Thread Server Messages ────────────────────────────────────

const MemorySearchResultSchema = z.object({
	type: z.literal("memory.search.result"),
	id: z.string(),
	results: z.array(
		z.object({
			content: z.string(),
			memoryType: z.string(),
			distance: z.number(),
			createdAt: z.string(),
		}),
	),
});

const ThreadCreatedSchema = z.object({
	type: z.literal("thread.created"),
	id: z.string(),
	thread: z.object({
		id: z.string(),
		title: z.string(),
		systemPrompt: z.string().optional(),
		createdAt: z.string(),
	}),
});

const ThreadListResultSchema = z.object({
	type: z.literal("thread.list.result"),
	id: z.string(),
	threads: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			systemPrompt: z.string().nullable(),
			archived: z.boolean().nullable(),
			createdAt: z.string(),
			lastActiveAt: z.string(),
		}),
	),
});

const ThreadUpdatedSchema = z.object({
	type: z.literal("thread.updated"),
	id: z.string(),
	threadId: z.string(),
});

const PromptSetResultSchema = z.object({
	type: z.literal("prompt.set.result"),
	id: z.string(),
	promptId: z.number(),
});

const PromptListResultSchema = z.object({
	type: z.literal("prompt.list.result"),
	id: z.string(),
	prompts: z.array(
		z.object({
			id: z.number(),
			name: z.string(),
			content: z.string(),
			isActive: z.boolean().nullable(),
			priority: z.number().nullable(),
			createdAt: z.string(),
		}),
	),
});

// ── Tool & Preflight Server Messages ──────────────────────────────────

const ToolCallNotifySchema = z.object({
	type: z.literal("tool.call"),
	requestId: z.string(),
	toolCallId: z.string(),
	toolName: z.string(),
	args: z.unknown(),
});

const ToolResultNotifySchema = z.object({
	type: z.literal("tool.result"),
	requestId: z.string(),
	toolCallId: z.string(),
	toolName: z.string(),
	result: z.unknown(),
});

const ToolApprovalRequestSchema = z.object({
	type: z.literal("tool.approval.request"),
	requestId: z.string(),
	toolCallId: z.string(),
	toolName: z.string(),
	args: z.unknown(),
	risk: z.enum(["low", "medium", "high"]).optional(),
});

const SoulEvolutionProposeSchema = z.object({
	type: z.literal("soul.evolution.propose"),
	requestId: z.string(),
	file: z.string(),
	section: z.string(),
	currentContent: z.string(),
	proposedContent: z.string(),
	reason: z.string(),
});

const PreflightChecklistSchema = z.object({
	type: z.literal("preflight.checklist"),
	requestId: z.string(),
	steps: z.array(
		z.object({
			description: z.string(),
			toolName: z.string().optional(),
			risk: z.enum(["low", "medium", "high"]),
			needsApproval: z.boolean(),
		}),
	),
	estimatedCost: z.object({
		inputTokens: z.number(),
		outputTokens: z.number(),
		estimatedUSD: z.number(),
	}),
	requiredPermissions: z.array(z.string()),
	warnings: z.array(z.string()),
});

const FailureDetectedSchema = z.object({
	type: z.literal("failure.detected"),
	requestId: z.string(),
	pattern: z.enum([
		"repeated-tool-error",
		"no-progress",
		"max-steps-approaching",
		"tool-rejection-loop",
	]),
	description: z.string(),
	suggestedAction: z.string(),
	affectedTool: z.string().optional(),
});

// ── Workflow Server Messages ──────────────────────────────────────────

const WorkflowStatusSchema = z.object({
	type: z.literal("workflow.status"),
	executionId: z.string(),
	workflowId: z.string(),
	status: z.enum(["running", "paused", "completed", "failed"]),
	currentStepId: z.string().optional(),
	stepResults: z.record(z.string(), z.unknown()).optional(),
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
	workflows: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			description: z.string().optional(),
			definitionPath: z.string(),
		}),
	),
});

const WorkflowExecutionListResultSchema = z.object({
	type: z.literal("workflow.execution.list.result"),
	id: z.string(),
	executions: z.array(
		z.object({
			id: z.string(),
			workflowId: z.string(),
			status: z.string(),
			currentStepId: z.string().optional(),
			startedAt: z.string(),
			completedAt: z.string().optional(),
		}),
	),
});

// ── Schedule Server Messages ──────────────────────────────────────────

const ScheduleListResultSchema = z.object({
	type: z.literal("schedule.list.result"),
	id: z.string(),
	schedules: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			cronExpression: z.string(),
			timezone: z.string().optional(),
			enabled: z.boolean(),
			nextRun: z.string().optional(),
			workflowId: z.string().optional(),
		}),
	),
});

const ScheduleCreatedSchema = z.object({
	type: z.literal("schedule.created"),
	id: z.string(),
	scheduleId: z.string(),
});

const ScheduleUpdatedSchema = z.object({
	type: z.literal("schedule.updated"),
	id: z.string(),
	scheduleId: z.string(),
});

// ── Heartbeat Server Messages ──────────────────────────────────────────

const HeartbeatAlertSchema = z.object({
	type: z.literal("heartbeat.alert"),
	checks: z.array(
		z.object({
			description: z.string(),
			actionNeeded: z.boolean(),
			details: z.string().optional(),
		}),
	),
	timestamp: z.string(),
});

const HeartbeatConfiguredSchema = z.object({
	type: z.literal("heartbeat.configured"),
	id: z.string(),
	scheduleId: z.string(),
});

// ── Terminal Server Messages ──────────────────────────────────────────

const TerminalInputSchema = z.object({
	type: z.literal("terminal.input"),
	requestId: z.string(),
	data: z.string(),
});

const TerminalProxyStartSchema = z.object({
	type: z.literal("terminal.proxy.start"),
	requestId: z.string(),
	command: z.string(),
	args: z.array(z.string()).optional(),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
	ChatStreamStartSchema,
	ChatStreamDeltaSchema,
	ChatStreamEndSchema,
	ChatRouteProposalSchema,
	ContextInspectionSchema,
	UsageReportSchema,
	ErrorSchema,
	SessionCreatedSchema,
	SessionListResponseSchema,
	MemorySearchResultSchema,
	ThreadCreatedSchema,
	ThreadListResultSchema,
	ThreadUpdatedSchema,
	PromptSetResultSchema,
	PromptListResultSchema,
	ToolCallNotifySchema,
	ToolResultNotifySchema,
	ToolApprovalRequestSchema,
	PreflightChecklistSchema,
	FailureDetectedSchema,
	TerminalInputSchema,
	TerminalProxyStartSchema,
	WorkflowStatusSchema,
	WorkflowApprovalRequestSchema,
	WorkflowListResultSchema,
	WorkflowExecutionListResultSchema,
	ScheduleListResultSchema,
	ScheduleCreatedSchema,
	ScheduleUpdatedSchema,
	HeartbeatAlertSchema,
	HeartbeatConfiguredSchema,
	SoulEvolutionProposeSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ChatStreamStart = z.infer<typeof ChatStreamStartSchema>;
export type ChatStreamDelta = z.infer<typeof ChatStreamDeltaSchema>;
export type ChatStreamEnd = z.infer<typeof ChatStreamEndSchema>;
export type ChatRouteProposal = z.infer<typeof ChatRouteProposalSchema>;
export type ContextInspection = z.infer<typeof ContextInspectionSchema>;
export type UsageReport = z.infer<typeof UsageReportSchema>;
export type ErrorMessage = z.infer<typeof ErrorSchema>;
export type SessionCreated = z.infer<typeof SessionCreatedSchema>;
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;
export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;
export type ThreadCreated = z.infer<typeof ThreadCreatedSchema>;
export type ThreadListResult = z.infer<typeof ThreadListResultSchema>;
export type ThreadUpdated = z.infer<typeof ThreadUpdatedSchema>;
export type PromptSetResult = z.infer<typeof PromptSetResultSchema>;
export type PromptListResult = z.infer<typeof PromptListResultSchema>;
export type ToolCallNotify = z.infer<typeof ToolCallNotifySchema>;
export type ToolResultNotify = z.infer<typeof ToolResultNotifySchema>;
export type ToolApprovalRequest = z.infer<typeof ToolApprovalRequestSchema>;
export type PreflightChecklist = z.infer<typeof PreflightChecklistSchema>;
export type FailureDetected = z.infer<typeof FailureDetectedSchema>;
export type TerminalInput = z.infer<typeof TerminalInputSchema>;
export type TerminalProxyStart = z.infer<typeof TerminalProxyStartSchema>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type WorkflowApprovalRequest = z.infer<typeof WorkflowApprovalRequestSchema>;
export type WorkflowListResult = z.infer<typeof WorkflowListResultSchema>;
export type WorkflowExecutionListResult = z.infer<typeof WorkflowExecutionListResultSchema>;
export type ScheduleListResult = z.infer<typeof ScheduleListResultSchema>;
export type ScheduleCreated = z.infer<typeof ScheduleCreatedSchema>;
export type ScheduleUpdated = z.infer<typeof ScheduleUpdatedSchema>;
export type HeartbeatAlert = z.infer<typeof HeartbeatAlertSchema>;
export type HeartbeatConfigured = z.infer<typeof HeartbeatConfiguredSchema>;
export type SoulEvolutionPropose = z.infer<typeof SoulEvolutionProposeSchema>;

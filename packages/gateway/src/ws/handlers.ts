import type { Transport } from "../transport.js";
import { createLogger, loadConfig, getDefaultModel } from "@tek/core";
import type {
	ChatSend,
	ChatRouteConfirm,
	ContextInspect,
	UsageQuery,
	MemorySearch,
	ThreadCreate,
	ThreadList,
	ThreadUpdate,
	PromptSet,
	PromptList,
	ClaudeCodeStart,
	ClaudeCodeAbort,
	ToolApprovalResponse,
	WorkflowTrigger,
	WorkflowApproval,
	WorkflowList,
	WorkflowExecutionList,
	ScheduleCreate,
	ScheduleUpdate,
	ScheduleDelete,
	ScheduleList,
	HeartbeatConfigure,
	SoulEvolutionResponse,
} from "./protocol.js";
import type { ConnectionState } from "./connection.js";
import { sessionManager } from "../session/index.js";
import {
	streamChatResponse,
	resolveModelId,
	routeMessage,
	isProviderAvailable,
	getAvailableProviders,
} from "../llm/index.js";
import { assembleContext } from "../context/index.js";
import { inspectContext } from "../context/index.js";
import type { AssembledContext } from "../context/types.js";
import { calculateCost } from "../usage/pricing.js";
import { usageTracker } from "../usage/index.js";
import { MemoryManager, MemoryPressureDetector, ThreadManager } from "../memory/index.js";
import {
	runAgentLoop,
	buildToolRegistry,
	createApprovalPolicy,
	recordSessionApproval,
	shouldTriggerPreflight,
	generatePreflight,
} from "../agent/index.js";
import type { PreflightApproval } from "./protocol.js";
import { MCPClientManager } from "../mcp/client-manager.js";
import { loadMCPConfigs } from "../mcp/config.js";
import { getKey } from "@tek/cli/vault";
import { updateIdentityFileSection, migrateToMultiFile } from "@tek/db";

const logger = createLogger("ws-handlers");

/** Module-level migration flag — ensures migration runs only once per process */
let migrationRan = false;

/**
 * Run identity file migration on first chat.send after upgrade.
 * Non-fatal: logs and continues if migration fails.
 */
function ensureMigration(): void {
	if (migrationRan) return;
	migrationRan = true;
	try {
		const result = migrateToMultiFile();
		if (result.migrated) {
			logger.info(`Identity files migrated to v2 (backup: ${result.backup})`);
		}
	} catch (err) {
		logger.warn(`Migration failed (non-fatal): ${err}`);
	}
}

/** Lazy-init singletons */
let memoryManagerInstance: MemoryManager | null = null;
let threadManagerInstance: ThreadManager | null = null;
let pressureDetectorInstance: MemoryPressureDetector | null = null;

function getMemoryManager(): MemoryManager {
	if (!memoryManagerInstance) memoryManagerInstance = new MemoryManager();
	return memoryManagerInstance;
}

function getThreadManager(): ThreadManager {
	if (!threadManagerInstance) threadManagerInstance = new ThreadManager();
	return threadManagerInstance;
}

function getPressureDetector(): MemoryPressureDetector {
	if (!pressureDetectorInstance) pressureDetectorInstance = new MemoryPressureDetector();
	return pressureDetectorInstance;
}

/**
 * Check memory pressure after context assembly and flush if needed.
 * Best-effort: if flush fails, proceed anyway.
 */
async function checkAndFlushPressure(context: AssembledContext): Promise<void> {
	const detector = getPressureDetector();
	const manager = getMemoryManager();

	// Compute token counts from assembled context sections
	const systemTokens = context.sections
		.filter((s) => ["system_prompt", "soul", "long_term_memory", "recent_activity"].includes(s.name))
		.reduce((sum, s) => sum + s.tokenEstimate, 0);
	const conversationTokens = context.sections
		.filter((s) => ["history", "user_message"].includes(s.name))
		.reduce((sum, s) => sum + s.tokenEstimate, 0);
	const memoryTokens = context.sections
		.filter((s) => ["skills", "tools"].includes(s.name))
		.reduce((sum, s) => sum + s.tokenEstimate, 0);

	const pressure = detector.check({
		system: systemTokens,
		memory: memoryTokens,
		conversation: conversationTokens,
	});

	if (pressure.shouldFlush) {
		logger.info(`Memory pressure at ${(pressure.usage * 100).toFixed(1)}%, flushing older messages to daily log`);
		try {
			// Summarize older conversation messages for flush
			const historySection = context.sections.find((s) => s.name === "history");
			if (historySection?.content) {
				const lines = historySection.content.split("\n");
				// Flush the first half of history (older messages)
				const halfPoint = Math.floor(lines.length / 2);
				const olderMessages = lines.slice(0, halfPoint).join("\n");
				if (olderMessages.trim()) {
					await manager.flushToDaily(`[Memory Pressure Flush]\n\n${olderMessages}`);
				}
			}
		} catch (err) {
			logger.error(`Memory flush failed (non-fatal): ${err instanceof Error ? err.message : "unknown"}`);
		}
	}
}

/**
 * Shared streaming helper: streams an LLM response to the client.
 *
 * Extracted from handleChatSend to be reused by handleChatRouteConfirm.
 */
async function streamToClient(
	transport: Transport,
	model: string,
	sessionId: string,
	requestId: string,
	context: Pick<AssembledContext, "messages" | "system">,
	connState: ConnectionState,
	routingInfo?: { tier: "high" | "standard" | "budget"; reason: string },
): Promise<void> {
	connState.streaming = true;
	connState.streamRequestId = requestId;

	transport.send({
		type: "chat.stream.start",
		requestId,
		sessionId,
		model,
		...(routingInfo ? { routing: routingInfo } : {}),
	});

	let fullResponse = "";

	try {
		for await (const chunk of streamChatResponse(
			model,
			context.messages,
			context.system,
		)) {
			if (chunk.type === "delta") {
				fullResponse += chunk.text;
				transport.send({
					type: "chat.stream.delta",
					requestId,
					delta: chunk.text,
				});
			} else if (chunk.type === "done") {
				const { inputTokens, outputTokens, totalTokens } = chunk.usage;
				const cost = calculateCost(model, inputTokens, outputTokens);

				// Record usage
				usageTracker.record({
					sessionId,
					model,
					inputTokens,
					outputTokens,
					totalTokens,
					cost: cost.totalCost,
					timestamp: new Date().toISOString(),
				});

				// Add assistant message to session
				sessionManager.addMessage(
					sessionId,
					"assistant",
					fullResponse,
				);

				// Send stream end with usage and cost
				transport.send({
					type: "chat.stream.end",
					requestId,
					usage: { inputTokens, outputTokens, totalTokens },
					cost,
				});
			}
		}
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "Unknown LLM error";
		logger.error(`LLM streaming error: ${message}`);
		transport.send({
			type: "error",
			requestId,
			code: "LLM_ERROR",
			message,
		});
	} finally {
		connState.streaming = false;
		connState.streamRequestId = null;
	}
}

/**
 * Handle chat.send: stream an LLM response to the client.
 *
 * Routing behavior:
 * - If msg.model is explicitly set: skip routing (user chose the model)
 * - Otherwise: auto mode (route silently, include tier in stream.start)
 */
export async function handleChatSend(
	transport: Transport,
	msg: ChatSend,
	connState: ConnectionState,
): Promise<void> {
	// Run identity file migration on first chat.send (once, non-blocking)
	ensureMigration();

	// Extract agentId from config for agent-aware identity loading
	const agentId = loadConfig()?.agents?.defaultAgentId ?? "default";

	// Guard against concurrent streams
	if (connState.streaming) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "STREAM_IN_PROGRESS",
			message: "Please wait for the current response to complete",
		});
		return;
	}

	// Resolve or create session
	let sessionId: string;
	let model: string;
	const explicitModel = !!msg.model;

	if (msg.sessionId) {
		const session = sessionManager.get(msg.sessionId);
		if (!session) {
			transport.send({
				type: "error",
				requestId: msg.id,
				code: "SESSION_NOT_FOUND",
				message: `Session ${msg.sessionId} not found`,
			});
			return;
		}
		sessionId = session.id;
		model = session.model;

		// Mid-conversation model switching: if msg.model differs, update session
		if (msg.model) {
			const resolvedMsgModel = resolveModelId(msg.model);
			if (resolvedMsgModel !== model) {
				sessionManager.updateModel(sessionId, resolvedMsgModel);
				model = resolvedMsgModel;
			}
		}
	} else {
		const defaultModel = getDefaultModel();
		const requestedModel = msg.model
			? resolveModelId(msg.model)
			: defaultModel ?? undefined;
		const session = sessionManager.create("default", requestedModel);
		sessionId = session.id;
		model = session.model;
		transport.send({
			type: "session.created",
			sessionId: session.id,
			sessionKey: session.sessionKey,
		});
	}

	connState.sessionId = sessionId;

	// Ensure model is provider-qualified for downstream use
	model = resolveModelId(model);

	// Validate that the resolved provider is actually registered
	const providerPrefix = model.split(":")[0];
	if (!isProviderAvailable(providerPrefix)) {
		const available = getAvailableProviders();
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "PROVIDER_NOT_CONFIGURED",
			message: `Provider "${providerPrefix}" is not configured. Available providers: ${available.join(", ")}. Run: tek keys add ${providerPrefix}`,
		});
		return;
	}

	// Add user message to session
	sessionManager.addMessage(sessionId, "user", msg.content);

	// Assemble context
	const sessionMessages = sessionManager.getMessages(sessionId);
	const context = assembleContext(sessionMessages, msg.content, model, undefined, undefined, agentId);

	// Check memory pressure and flush if needed (best-effort)
	await checkAndFlushPressure(context);

	// Routing decision (only when no explicit model)
	let routingInfo: { tier: "high" | "standard" | "budget"; reason: string } | undefined;

	if (!explicitModel) {
		// Auto mode: route silently, include routing info in stream.start
		const decision = routeMessage(msg.content, sessionMessages.length);
		model = `${decision.provider}:${decision.model}`;
		routingInfo = { tier: decision.tier, reason: decision.reason };
		logger.info(
			`Auto-routed to ${model} (tier: ${decision.tier}, confidence: ${decision.confidence})`,
		);
	}

	// Build tool registry lazily (cached on connection state)
	let tools: Record<string, unknown> | null = connState.tools;
	if (!tools) {
		try {
			const config = loadConfig();
			if (config) {
				const mcpManager = MCPClientManager.getInstance();
				const mcpConfigs = loadMCPConfigs(config);
				const approvalPolicy = createApprovalPolicy(config.toolApproval);
				connState.approvalPolicy = approvalPolicy;

				tools = await buildToolRegistry({
					mcpManager,
					mcpConfigs,
					securityMode: config.securityMode ?? "limited-control",
					workspaceDir: config.workspaceDir,
					approvalPolicy,
					openaiApiKey: getKey("openai") ?? undefined,
					veniceApiKey: getKey("venice") ?? undefined,
				});
				connState.tools = tools;
			}
		} catch (err) {
			logger.warn(
				`Failed to build tool registry, falling back to text-only: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// Pre-flight checklist: for complex tasks, generate a checklist and wait for approval
	if (tools && Object.keys(tools).length > 0 && shouldTriggerPreflight(msg.content, tools)) {
		try {
			const checklist = await generatePreflight(model, msg.content, tools);

			// Store pending preflight context so we can resume after approval
			connState.pendingPreflight = {
				requestId: msg.id,
				sessionId,
				model,
				content: msg.content,
				context: { messages: context.messages, system: context.system ?? "" },
				tools,
				routingInfo,
			};

			// Send checklist to client for review
			transport.send({
				type: "preflight.checklist",
				requestId: msg.id,
				steps: checklist.steps,
				estimatedCost: checklist.estimatedCost,
				requiredPermissions: checklist.requiredPermissions,
				warnings: checklist.warnings,
			});

			// Return and wait for preflight.approval message
			return;
		} catch (err) {
			// If preflight generation fails, proceed without it
			logger.warn(
				`Preflight generation failed, proceeding without: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	connState.streaming = true;
	connState.streamRequestId = msg.id;

	transport.send({
		type: "chat.stream.start",
		requestId: msg.id,
		sessionId,
		model,
		...(routingInfo ? { routing: routingInfo } : {}),
	});

	if (tools && Object.keys(tools).length > 0 && connState.approvalPolicy) {
		// Agent mode: tool-aware streaming with multi-step loop
		try {
			await runAgentLoop({
				transport,
				model,
				messages: context.messages,
				system: context.system ?? "",
				tools,
				requestId: msg.id,
				sessionId,
				connState,
				approvalPolicy: connState.approvalPolicy,
				onUsage: (usage) => {
					const inputTokens = usage.inputTokens ?? 0;
					const outputTokens = usage.outputTokens ?? 0;
					const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
					const cost = calculateCost(model, inputTokens, outputTokens);

					usageTracker.record({
						sessionId,
						model,
						inputTokens,
						outputTokens,
						totalTokens,
						cost: cost.totalCost,
						timestamp: new Date().toISOString(),
					});

					transport.send({
						type: "chat.stream.end",
						requestId: msg.id,
						usage: { inputTokens, outputTokens, totalTokens },
						cost,
					});
				},
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown agent error";
			logger.error(`Agent loop error: ${message}`);
			transport.send({
				type: "error",
				requestId: msg.id,
				code: "AGENT_ERROR",
				message,
			});
		} finally {
			connState.streaming = false;
			connState.streamRequestId = null;
		}
	} else {
		// Fallback: text-only streaming (no tools available)
		await streamToClient(
			transport,
			model,
			sessionId,
			msg.id,
			context,
			connState,
			routingInfo,
		);
	}
}

/**
 * Handle chat.route.confirm: continue streaming after a manual routing proposal.
 *
 * If accept=true, use the originally proposed model.
 * If accept=false and override provided, use the override model.
 */
export async function handleChatRouteConfirm(
	transport: Transport,
	msg: ChatRouteConfirm,
	connState: ConnectionState,
): Promise<void> {
	const pending = connState.pendingRouting;
	if (!pending) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "NO_PENDING_ROUTING",
			message: "No pending routing proposal to confirm",
		});
		return;
	}

	let model: string;
	if (msg.accept) {
		model = pending.routedModel;
	} else if (msg.override) {
		model = resolveModelId(`${msg.override.provider}:${msg.override.model}`);
	} else {
		// accept=false with no override: use the original proposed model
		model = pending.routedModel;
	}

	const { sessionId, content, requestId } = pending;
	connState.pendingRouting = null;

	// Re-assemble context (messages already added during original handleChatSend)
	const sessionMessages = sessionManager.getMessages(sessionId);
	const context = assembleContext(sessionMessages, content, model);

	await streamToClient(transport, model, sessionId, requestId, context, connState);
}

/**
 * Handle context.inspect: return section-by-section breakdown.
 */
export async function handleContextInspect(
	transport: Transport,
	msg: ContextInspect,
): Promise<void> {
	const session = sessionManager.get(msg.sessionId);
	if (!session) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "SESSION_NOT_FOUND",
			message: `Session ${msg.sessionId} not found`,
		});
		return;
	}

	const sessionMessages = sessionManager.getMessages(session.id);
	const inspection = inspectContext(sessionMessages, session.model);

	transport.send({
		type: "context.inspection",
		requestId: msg.id,
		sections: inspection.sections,
		totals: inspection.totals,
	});
}

/**
 * Handle usage.query: return per-model usage breakdown.
 */
export async function handleUsageQuery(
	transport: Transport,
	msg: UsageQuery,
): Promise<void> {
	if (msg.sessionId) {
		// Session-specific usage
		const rows = usageTracker.querySession(msg.sessionId);

		// Aggregate into per-model breakdown
		const perModel: Record<
			string,
			{
				inputTokens: number;
				outputTokens: number;
				totalTokens: number;
				totalCost: number;
				requestCount: number;
			}
		> = {};
		let grandTotalCost = 0;
		let grandTotalTokens = 0;
		let grandTotalRequests = 0;

		for (const row of rows) {
			if (!perModel[row.model]) {
				perModel[row.model] = {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					totalCost: 0,
					requestCount: 0,
				};
			}
			perModel[row.model].inputTokens += row.inputTokens;
			perModel[row.model].outputTokens += row.outputTokens;
			perModel[row.model].totalTokens += row.totalTokens;
			perModel[row.model].totalCost += row.cost;
			perModel[row.model].requestCount += 1;
			grandTotalCost += row.cost;
			grandTotalTokens += row.totalTokens;
			grandTotalRequests += 1;
		}

		transport.send({
			type: "usage.report",
			requestId: msg.id,
			perModel,
			grandTotal: {
				totalCost: grandTotalCost,
				totalTokens: grandTotalTokens,
				requestCount: grandTotalRequests,
			},
		});
	} else {
		// Global totals
		const totals = usageTracker.queryTotals();
		transport.send({
			type: "usage.report",
			requestId: msg.id,
			perModel: totals.perModel,
			grandTotal: totals.grandTotal,
		});
	}
}

// ── Memory & Thread Handlers ───────────────────────────────────────────

/**
 * Handle memory.search: semantic search over stored memories.
 */
export async function handleMemorySearch(
	transport: Transport,
	msg: MemorySearch,
): Promise<void> {
	const manager = getMemoryManager();
	try {
		const results = await manager.search(msg.query, {
			topK: msg.topK,
			threadId: msg.threadId,
		});
		transport.send({
			type: "memory.search.result",
			id: msg.id,
			results: results.map((r) => ({
				content: r.content,
				memoryType: r.memoryType,
				distance: r.distance,
				createdAt: r.createdAt,
			})),
		});
	} catch (err) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "MEMORY_SEARCH_ERROR",
			message: err instanceof Error ? err.message : "Memory search failed",
		});
	}
}

/**
 * Handle thread.create: create a new conversation thread.
 */
export async function handleThreadCreate(
	transport: Transport,
	msg: ThreadCreate,
): Promise<void> {
	const manager = getThreadManager();
	const thread = manager.createThread(msg.title, msg.systemPrompt);
	transport.send({
		type: "thread.created",
		id: msg.id,
		thread: {
			id: thread.id,
			title: thread.title,
			systemPrompt: thread.systemPrompt ?? undefined,
			createdAt: thread.createdAt,
		},
	});
}

/**
 * Handle thread.list: list conversation threads.
 */
export async function handleThreadList(
	transport: Transport,
	msg: ThreadList,
): Promise<void> {
	const manager = getThreadManager();
	const threads = manager.listThreads(msg.includeArchived);
	transport.send({
		type: "thread.list.result",
		id: msg.id,
		threads,
	});
}

/**
 * Handle thread.update: update a conversation thread.
 */
export async function handleThreadUpdate(
	transport: Transport,
	msg: ThreadUpdate,
): Promise<void> {
	const manager = getThreadManager();
	manager.updateThread(msg.threadId, {
		title: msg.title,
		systemPrompt: msg.systemPrompt,
		archived: msg.archived,
	});
	transport.send({
		type: "thread.updated",
		id: msg.id,
		threadId: msg.threadId,
	});
}

/**
 * Handle prompt.set: add or create a global system prompt.
 */
export async function handlePromptSet(
	transport: Transport,
	msg: PromptSet,
): Promise<void> {
	const manager = getThreadManager();
	const { id: promptId } = manager.addGlobalPrompt(
		msg.name,
		msg.content,
		msg.priority,
	);
	transport.send({
		type: "prompt.set.result",
		id: msg.id,
		promptId,
	});
}

/**
 * Handle prompt.list: list all global system prompts.
 */
export async function handlePromptList(
	transport: Transport,
	msg: PromptList,
): Promise<void> {
	const manager = getThreadManager();
	const prompts = manager.listGlobalPrompts();
	transport.send({
		type: "prompt.list.result",
		id: msg.id,
		prompts,
	});
}

// ── Tool Approval Handlers ──────────────────────────────────────────

/**
 * Handle tool.approval.response: resolve a pending tool approval.
 * If sessionApprove is true, record the tool as approved for the session.
 */
export function handleToolApprovalResponse(
	_transport: Transport,
	msg: ToolApprovalResponse,
	connState: ConnectionState,
): void {
	const pending = connState.pendingApprovals.get(msg.toolCallId);
	if (!pending) {
		logger.warn(`No pending approval for toolCallId: ${msg.toolCallId}`);
		return;
	}

	// If session-approve, record it so future calls skip approval
	if (msg.sessionApprove && msg.approved && connState.approvalPolicy) {
		recordSessionApproval(pending.toolName, connState.approvalPolicy);
		logger.info(`Session-approved tool "${pending.toolName}" for toolCallId: ${msg.toolCallId}`);
	}

	pending.resolve(msg.approved);
}

// ── Preflight Approval Handler ──────────────────────────────────────

/**
 * Handle preflight.approval: proceed with or cancel the agent loop
 * after the user reviews the pre-flight checklist.
 *
 * If approved: run the agent loop with the stored context.
 * If rejected: send an error message and clean up.
 */
export async function handlePreflightApproval(
	transport: Transport,
	msg: PreflightApproval,
	connState: ConnectionState,
): Promise<void> {
	const pending = connState.pendingPreflight;
	if (!pending) {
		logger.warn(`No pending preflight for requestId: ${msg.requestId}`);
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "NO_PENDING_PREFLIGHT",
			message: "No pending preflight checklist to approve",
		});
		return;
	}

	// Clear the pending preflight
	connState.pendingPreflight = null;

	if (!msg.approved) {
		transport.send({
			type: "error",
			requestId: pending.requestId,
			code: "PREFLIGHT_REJECTED",
			message: "Pre-flight checklist rejected by user",
		});
		return;
	}

	// Proceed with the agent loop using stored context
	const { model, sessionId, context, tools, requestId, routingInfo } = pending;

	connState.streaming = true;
	connState.streamRequestId = requestId;

	transport.send({
		type: "chat.stream.start",
		requestId,
		sessionId,
		model,
		...(routingInfo ? { routing: routingInfo } : {}),
	});

	if (connState.approvalPolicy) {
		try {
			await runAgentLoop({
				transport,
				model,
				messages: context.messages,
				system: context.system,
				tools,
				requestId,
				sessionId,
				connState,
				approvalPolicy: connState.approvalPolicy,
				onUsage: (usage) => {
					const inputTokens = usage.inputTokens ?? 0;
					const outputTokens = usage.outputTokens ?? 0;
					const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
					const cost = calculateCost(model, inputTokens, outputTokens);

					usageTracker.record({
						sessionId,
						model,
						inputTokens,
						outputTokens,
						totalTokens,
						cost: cost.totalCost,
						timestamp: new Date().toISOString(),
					});

					transport.send({
						type: "chat.stream.end",
						requestId,
						usage: { inputTokens, outputTokens, totalTokens },
						cost,
					});
				},
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown agent error";
			logger.error(`Agent loop error (post-preflight): ${message}`);
			transport.send({
				type: "error",
				requestId,
				code: "AGENT_ERROR",
				message,
			});
		} finally {
			connState.streaming = false;
			connState.streamRequestId = null;
		}
	} else {
		// Fallback: text-only streaming
		await streamToClient(transport, model, sessionId, requestId, context, connState, routingInfo);
	}
}

// ── Workflow Handlers ──────────────────────────────────────────────────

/**
 * Handle workflow.trigger: execute a workflow and stream status updates.
 */
export async function handleWorkflowTrigger(
	transport: Transport,
	msg: WorkflowTrigger,
	connState: ConnectionState,
): Promise<void> {
	const { getDb, workflows } = await import("@tek/db");
	const { eq } = await import("drizzle-orm");
	const { workflowEngine } = await import("../workflow/engine.js");

	const db = getDb();
	const workflow = db
		.select()
		.from(workflows)
		.where(eq(workflows.id, msg.workflowId))
		.get();

	if (!workflow) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "WORKFLOW_NOT_FOUND",
			message: `Workflow ${msg.workflowId} not found`,
		});
		return;
	}

	const tools = connState.tools ?? {};

	const execution = await workflowEngine.execute(
		msg.workflowId,
		workflow.definitionPath,
		"manual",
		tools,
		(executionId, stepId, step) => {
			// Store pending approval for later resolution
			connState.pendingWorkflowApprovals.set(
				`${executionId}:${stepId}`,
				{
					executionId,
					resolve: () => {}, // placeholder; actual resolve set below
				},
			);

			transport.send({
				type: "workflow.approval.request",
				executionId,
				workflowId: msg.workflowId,
				stepId,
				stepDescription: step.prompt ?? step.id,
				args: step.args,
			});
		},
	);

	transport.send({
		type: "workflow.status",
		executionId: execution.id,
		workflowId: msg.workflowId,
		status: execution.status,
		currentStepId: execution.currentStepId,
		stepResults: execution.stepResults,
	});
}

/**
 * Handle workflow.approval: approve or deny a workflow approval gate.
 */
export async function handleWorkflowApproval(
	transport: Transport,
	msg: WorkflowApproval,
	connState: ConnectionState,
): Promise<void> {
	const { workflowEngine } = await import("../workflow/engine.js");

	const key = `${msg.executionId}:${msg.stepId}`;
	const pending = connState.pendingWorkflowApprovals.get(key);

	if (!pending) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "NO_PENDING_APPROVAL",
			message: `No pending workflow approval for execution ${msg.executionId} step ${msg.stepId}`,
		});
		return;
	}

	connState.pendingWorkflowApprovals.delete(key);

	if (!msg.approved) {
		transport.send({
			type: "workflow.status",
			executionId: msg.executionId,
			workflowId: "",
			status: "failed",
			stepResults: {},
		});
		return;
	}

	// Resume the workflow from the approved step
	const tools = connState.tools ?? {};
	const execution = await workflowEngine.resume(
		msg.executionId,
		tools,
		(executionId, stepId, step) => {
			connState.pendingWorkflowApprovals.set(
				`${executionId}:${stepId}`,
				{
					executionId,
					resolve: () => {},
				},
			);

			transport.send({
				type: "workflow.approval.request",
				executionId,
				workflowId: execution.workflowId,
				stepId,
				stepDescription: step.prompt ?? step.id,
				args: step.args,
			});
		},
	);

	transport.send({
		type: "workflow.status",
		executionId: execution.id,
		workflowId: execution.workflowId,
		status: execution.status,
		currentStepId: execution.currentStepId,
		stepResults: execution.stepResults,
	});
}

/**
 * Handle workflow.list: list all registered workflows.
 */
export async function handleWorkflowList(
	transport: Transport,
	msg: WorkflowList,
): Promise<void> {
	const { getDb, workflows } = await import("@tek/db");

	const db = getDb();
	const rows = db.select().from(workflows).all();

	transport.send({
		type: "workflow.list.result",
		id: msg.id,
		workflows: rows.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description ?? undefined,
			definitionPath: r.definitionPath,
		})),
	});
}

/**
 * Handle workflow.execution.list: list workflow executions with optional filters.
 */
export async function handleWorkflowExecutionList(
	transport: Transport,
	msg: WorkflowExecutionList,
): Promise<void> {
	const { listExecutions } = await import("../workflow/state.js");

	const executions = listExecutions(msg.workflowId, msg.status);

	transport.send({
		type: "workflow.execution.list.result",
		id: msg.id,
		executions: executions.map((e) => ({
			id: e.id,
			workflowId: e.workflowId,
			status: e.status,
			currentStepId: e.currentStepId,
			startedAt: e.startedAt,
			completedAt: e.completedAt,
		})),
	});
}

// ── Schedule Handlers ──────────────────────────────────────────────────

/**
 * Handle schedule.create: create a new schedule and optionally register with scheduler.
 */
export async function handleScheduleCreate(
	transport: Transport,
	msg: ScheduleCreate,
): Promise<void> {
	const { nanoid } = await import("nanoid");
	const { saveSchedule } = await import("../scheduler/store.js");
	const { cronScheduler } = await import("../scheduler/scheduler.js");

	const scheduleId = nanoid();
	const config = {
		id: scheduleId,
		name: msg.name,
		cronExpression: msg.cronExpression,
		timezone: msg.timezone,
		activeHours: msg.activeHours,
		maxRuns: msg.maxRuns,
		workflowId: msg.workflowId,
		enabled: true,
	};

	saveSchedule(config);

	if (msg.workflowId) {
		cronScheduler.scheduleWorkflow(config, {});
	}

	transport.send({
		type: "schedule.created",
		id: msg.id,
		scheduleId,
	});
}

/**
 * Handle schedule.update: update an existing schedule.
 */
export async function handleScheduleUpdate(
	transport: Transport,
	msg: ScheduleUpdate,
): Promise<void> {
	const { updateSchedule, getSchedule } = await import("../scheduler/store.js");
	const { cronScheduler } = await import("../scheduler/scheduler.js");

	const updates: Record<string, unknown> = {};
	if (msg.enabled !== undefined) updates.enabled = msg.enabled;
	if (msg.cronExpression !== undefined) updates.cronExpression = msg.cronExpression;
	if (msg.activeHours !== undefined) updates.activeHours = msg.activeHours;

	updateSchedule(msg.scheduleId, updates);

	// Stop old job and re-schedule if still enabled
	cronScheduler.stop(msg.scheduleId);
	const updated = getSchedule(msg.scheduleId);
	if (updated && updated.enabled && updated.workflowId) {
		cronScheduler.scheduleWorkflow(updated, {});
	}

	transport.send({
		type: "schedule.updated",
		id: msg.id,
		scheduleId: msg.scheduleId,
	});
}

/**
 * Handle schedule.delete: remove a schedule.
 */
export async function handleScheduleDelete(
	transport: Transport,
	msg: ScheduleDelete,
): Promise<void> {
	const { deleteSchedule } = await import("../scheduler/store.js");
	const { cronScheduler } = await import("../scheduler/scheduler.js");

	cronScheduler.stop(msg.scheduleId);
	deleteSchedule(msg.scheduleId);

	transport.send({
		type: "schedule.updated",
		id: msg.id,
		scheduleId: msg.scheduleId,
	});
}

/**
 * Handle schedule.list: list all schedules with next run times.
 */
export async function handleScheduleList(
	transport: Transport,
	msg: ScheduleList,
): Promise<void> {
	const { loadSchedules } = await import("../scheduler/store.js");
	const { cronScheduler } = await import("../scheduler/scheduler.js");

	const configs = loadSchedules();

	transport.send({
		type: "schedule.list.result",
		id: msg.id,
		schedules: configs.map((c) => {
			const nextRun = cronScheduler.nextRun(c.id);
			return {
				id: c.id,
				name: c.name,
				cronExpression: c.cronExpression,
				timezone: c.timezone,
				enabled: c.enabled,
				nextRun: nextRun?.toISOString(),
				workflowId: c.workflowId,
			};
		}),
	});
}

// ── Claude Code Handlers ──────────────────────────────────────────────

/**
 * Handle claude-code.start: spawn a Claude Code session with approval proxying.
 * Uses dynamic import to avoid circular dependencies.
 */
export async function handleClaudeCodeStart(
	transport: Transport,
	msg: ClaudeCodeStart,
	connState: ConnectionState,
): Promise<void> {
	const { ClaudeCodeSessionManager } = await import("../claude-code/index.js");
	const { createApprovalProxy } = await import("../claude-code/approval-proxy.js");

	// Get or create singleton session manager (stored on module level)
	if (!claudeCodeManagerInstance) {
		claudeCodeManagerInstance = new ClaudeCodeSessionManager();
	}

	const approvalProxy = createApprovalProxy(transport, msg.id, connState);

	const session = claudeCodeManagerInstance.spawn(
		{
			prompt: msg.prompt,
			cwd: msg.cwd,
			allowedTools: msg.allowedTools,
			canUseTool: approvalProxy,
		},
		transport,
		msg.id,
	);

	// Track session on the connection
	connState.claudeCodeSessions.set(session.id, msg.id);

	// Send stream start to indicate session has begun
	transport.send({
		type: "chat.stream.start",
		requestId: msg.id,
		sessionId: session.id,
		model: "claude-code",
	});
}

/**
 * Handle claude-code.abort: abort a running Claude Code session.
 */
export async function handleClaudeCodeAbort(
	transport: Transport,
	msg: ClaudeCodeAbort,
	connState: ConnectionState,
): Promise<void> {
	if (!claudeCodeManagerInstance) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "NO_SESSION_MANAGER",
			message: "No Claude Code session manager initialized",
		});
		return;
	}

	const aborted = claudeCodeManagerInstance.abort(msg.sessionId);
	if (!aborted) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "SESSION_NOT_FOUND",
			message: `Claude Code session ${msg.sessionId} not found`,
		});
		return;
	}

	connState.claudeCodeSessions.delete(msg.sessionId);
}

/** Lazy singleton for ClaudeCodeSessionManager */
let claudeCodeManagerInstance: InstanceType<typeof import("../claude-code/session-manager.js").ClaudeCodeSessionManager> | null = null;

/**
 * Get the singleton ClaudeCodeSessionManager (creates on first access).
 * Exported for use by the workflow tool.
 */
export function getClaudeCodeManager(): typeof claudeCodeManagerInstance {
	return claudeCodeManagerInstance;
}

// ── Soul Evolution Handlers ────────────────────────────────────────────

/** Pending soul evolution proposals keyed by requestId */
const pendingSoulEvolutions = new Map<string, { file: string; section: string; proposedContent: string }>();

/** Per-connection evolution proposal counter for rate limiting (max 1 per session) */
const evolutionCountByConnection = new Map<string, number>();

/**
 * Register a soul evolution proposal for later resolution.
 * Rate limited to max 1 evolution proposal per connection/session.
 */
export function registerSoulEvolution(
	requestId: string,
	file: string,
	section: string,
	proposedContent: string,
	connectionId: string,
): void {
	const count = evolutionCountByConnection.get(connectionId) ?? 0;
	if (count >= 1) {
		logger.warn(`Soul evolution rate limit reached for connection ${connectionId} (max 1 per session)`);
		throw new Error("Rate limit: max 1 soul evolution proposal per session");
	}
	evolutionCountByConnection.set(connectionId, count + 1);
	pendingSoulEvolutions.set(requestId, { file, section, proposedContent });
}

/**
 * Clean up rate limit counter when connection closes.
 */
export function clearEvolutionRateLimit(connectionId: string): void {
	evolutionCountByConnection.delete(connectionId);
}

/**
 * Handle soul.evolution.response: apply or reject a soul evolution proposal.
 */
export function handleSoulEvolutionResponse(
	_transport: Transport,
	msg: SoulEvolutionResponse,
	_state: ConnectionState,
): void {
	const pending = pendingSoulEvolutions.get(msg.requestId);
	if (!pending) {
		logger.warn(`No pending soul evolution for requestId ${msg.requestId}`);
		return;
	}
	pendingSoulEvolutions.delete(msg.requestId);

	if (!msg.approved) {
		logger.info(`Soul evolution rejected for ${pending.file}#${pending.section}`);
		return;
	}

	const content = msg.editedContent ?? pending.proposedContent;
	updateIdentityFileSection(pending.file, pending.section, content);
	logger.info(`Soul evolution applied to ${pending.file}#${pending.section}`);
}

// ── Heartbeat Handler ──────────────────────────────────────────────────

/**
 * Handle heartbeat.configure: set up a heartbeat cron schedule.
 */
export async function handleHeartbeatConfigure(
	transport: Transport,
	msg: HeartbeatConfigure,
	connState: ConnectionState,
): Promise<void> {
	const { nanoid } = await import("nanoid");
	const { saveSchedule } = await import("../scheduler/store.js");
	const { cronScheduler } = await import("../scheduler/scheduler.js");

	const scheduleId = `heartbeat-${nanoid()}`;
	const cronExpression = `*/${msg.interval} * * * *`;

	const config = {
		id: scheduleId,
		name: `Heartbeat (every ${msg.interval}min)`,
		cronExpression,
		timezone: msg.timezone,
		activeHours: msg.activeHours,
		enabled: msg.enabled,
	};

	saveSchedule(config);

	// Obtain a model from the registry for AI-powered heartbeat checks
	const { getRegistry } = await import("../llm/registry.js");
	const registry = getRegistry();
	const heartbeatModel = getDefaultModel() ?? "ollama:llama3";
	const model = registry.languageModel(heartbeatModel as never);

	const tools = connState.tools ?? {};

	// Schedule heartbeat with real HeartbeatRunner and WebSocket alert callback
	cronScheduler.scheduleHeartbeat(
		config,
		msg.heartbeatPath,
		tools,
		model,
		(results) => {
			transport.send({
				type: "heartbeat.alert",
				checks: results.map((r) => ({
					description: r.description,
					actionNeeded: r.actionNeeded,
					details: r.details,
				})),
				timestamp: new Date().toISOString(),
			});
		},
	);

	transport.send({
		type: "heartbeat.configured",
		id: msg.id,
		scheduleId,
	});
}

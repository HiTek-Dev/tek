import type { WebSocket } from "ws";
import { createLogger, loadConfig } from "@agentspace/core";
import type {
	ServerMessage,
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
	ToolApprovalResponse,
} from "./protocol.js";
import type { ConnectionState } from "./connection.js";
import { sessionManager } from "../session/index.js";
import { DEFAULT_MODEL } from "../session/types.js";
import {
	streamChatResponse,
	resolveModelId,
	routeMessage,
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

const logger = createLogger("ws-handlers");

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
 * Send a typed server message over a WebSocket.
 */
function send(ws: WebSocket, msg: ServerMessage): void {
	if (ws.readyState === ws.OPEN) {
		ws.send(JSON.stringify(msg));
	}
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
	socket: WebSocket,
	model: string,
	sessionId: string,
	requestId: string,
	context: Pick<AssembledContext, "messages" | "system">,
	connState: ConnectionState,
	routingInfo?: { tier: "high" | "standard" | "budget"; reason: string },
): Promise<void> {
	connState.streaming = true;
	connState.streamRequestId = requestId;

	send(socket, {
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
				send(socket, {
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
				send(socket, {
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
		send(socket, {
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
	socket: WebSocket,
	msg: ChatSend,
	connState: ConnectionState,
): Promise<void> {
	// Guard against concurrent streams
	if (connState.streaming) {
		send(socket, {
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
			send(socket, {
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
		const requestedModel = msg.model
			? resolveModelId(msg.model)
			: DEFAULT_MODEL;
		const session = sessionManager.create("default", requestedModel);
		sessionId = session.id;
		model = session.model;
		send(socket, {
			type: "session.created",
			sessionId: session.id,
			sessionKey: session.sessionKey,
		});
	}

	connState.sessionId = sessionId;

	// Ensure model is provider-qualified for downstream use
	model = resolveModelId(model);

	// Add user message to session
	sessionManager.addMessage(sessionId, "user", msg.content);

	// Assemble context
	const sessionMessages = sessionManager.getMessages(sessionId);
	const context = assembleContext(sessionMessages, msg.content, model);

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
			send(socket, {
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

	send(socket, {
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
				socket,
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

					send(socket, {
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
			send(socket, {
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
			socket,
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
	socket: WebSocket,
	msg: ChatRouteConfirm,
	connState: ConnectionState,
): Promise<void> {
	const pending = connState.pendingRouting;
	if (!pending) {
		send(socket, {
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

	await streamToClient(socket, model, sessionId, requestId, context, connState);
}

/**
 * Handle context.inspect: return section-by-section breakdown.
 */
export async function handleContextInspect(
	socket: WebSocket,
	msg: ContextInspect,
): Promise<void> {
	const session = sessionManager.get(msg.sessionId);
	if (!session) {
		send(socket, {
			type: "error",
			requestId: msg.id,
			code: "SESSION_NOT_FOUND",
			message: `Session ${msg.sessionId} not found`,
		});
		return;
	}

	const sessionMessages = sessionManager.getMessages(session.id);
	const inspection = inspectContext(sessionMessages, session.model);

	send(socket, {
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
	socket: WebSocket,
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

		send(socket, {
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
		send(socket, {
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
	socket: WebSocket,
	msg: MemorySearch,
): Promise<void> {
	const manager = getMemoryManager();
	try {
		const results = await manager.search(msg.query, {
			topK: msg.topK,
			threadId: msg.threadId,
		});
		send(socket, {
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
		send(socket, {
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
	socket: WebSocket,
	msg: ThreadCreate,
): Promise<void> {
	const manager = getThreadManager();
	const thread = manager.createThread(msg.title, msg.systemPrompt);
	send(socket, {
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
	socket: WebSocket,
	msg: ThreadList,
): Promise<void> {
	const manager = getThreadManager();
	const threads = manager.listThreads(msg.includeArchived);
	send(socket, {
		type: "thread.list.result",
		id: msg.id,
		threads,
	});
}

/**
 * Handle thread.update: update a conversation thread.
 */
export async function handleThreadUpdate(
	socket: WebSocket,
	msg: ThreadUpdate,
): Promise<void> {
	const manager = getThreadManager();
	manager.updateThread(msg.threadId, {
		title: msg.title,
		systemPrompt: msg.systemPrompt,
		archived: msg.archived,
	});
	send(socket, {
		type: "thread.updated",
		id: msg.id,
		threadId: msg.threadId,
	});
}

/**
 * Handle prompt.set: add or create a global system prompt.
 */
export async function handlePromptSet(
	socket: WebSocket,
	msg: PromptSet,
): Promise<void> {
	const manager = getThreadManager();
	const { id: promptId } = manager.addGlobalPrompt(
		msg.name,
		msg.content,
		msg.priority,
	);
	send(socket, {
		type: "prompt.set.result",
		id: msg.id,
		promptId,
	});
}

/**
 * Handle prompt.list: list all global system prompts.
 */
export async function handlePromptList(
	socket: WebSocket,
	msg: PromptList,
): Promise<void> {
	const manager = getThreadManager();
	const prompts = manager.listGlobalPrompts();
	send(socket, {
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
	_socket: WebSocket,
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
		// Derive tool name from the pending state - not available directly,
		// so we just record the toolCallId pattern. The approval gate tracks by tool name.
		// The agent loop handles session approval via the policy.
		// For now, we just resolve the approval.
		logger.info(`Session-approved tool for toolCallId: ${msg.toolCallId}`);
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
	socket: WebSocket,
	msg: PreflightApproval,
	connState: ConnectionState,
): Promise<void> {
	const pending = connState.pendingPreflight;
	if (!pending) {
		logger.warn(`No pending preflight for requestId: ${msg.requestId}`);
		send(socket, {
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
		send(socket, {
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

	send(socket, {
		type: "chat.stream.start",
		requestId,
		sessionId,
		model,
		...(routingInfo ? { routing: routingInfo } : {}),
	});

	if (connState.approvalPolicy) {
		try {
			await runAgentLoop({
				socket,
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

					send(socket, {
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
			send(socket, {
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
		await streamToClient(socket, model, sessionId, requestId, context, connState, routingInfo);
	}
}

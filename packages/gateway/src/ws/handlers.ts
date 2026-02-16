import type { WebSocket } from "ws";
import { createLogger } from "@agentspace/core";
import type {
	ServerMessage,
	ChatSend,
	ChatRouteConfirm,
	ContextInspect,
	UsageQuery,
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

const logger = createLogger("ws-handlers");

/**
 * Send a typed server message over a WebSocket.
 */
function send(ws: WebSocket, msg: ServerMessage): void {
	if (ws.readyState === ws.OPEN) {
		ws.send(JSON.stringify(msg));
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

	// Stream response
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

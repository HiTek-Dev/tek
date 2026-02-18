import { createLogger } from "@tek/core";
import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { Transport } from "../transport.js";
import type { ClaudeCodeSession } from "./types.js";

const logger = createLogger("claude-code-relay");

/**
 * Lifecycle callbacks for the session manager to hook into relay events.
 */
export interface RelayCallbacks {
	/** Called when a result event is received (session completed) */
	onResult?: () => void;
	/** Called when the generator finishes iterating (done or error) */
	onDone?: () => void;
}

/**
 * Consume the SDK async generator and relay events to the transport
 * as existing ServerMessage types (chat.stream.delta, chat.stream.end,
 * tool.call, error). This allows existing CLI and Telegram UIs to
 * render Claude Code output with zero changes.
 */
export async function consumeAndRelay(
	session: ClaudeCodeSession,
	queryInstance: Query,
	transport: Transport,
	requestId: string,
	callbacks?: RelayCallbacks,
): Promise<void> {
	try {
		for await (const message of queryInstance) {
			relayMessage(message, session, transport, requestId, callbacks);
		}
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logger.error("Claude Code relay error", {
			sessionId: session.id,
			error: errorMessage,
		});

		session.status = "error";
		session.completedAt = new Date();

		transport.send({
			type: "error",
			requestId,
			code: "claude-code-error",
			message: errorMessage,
		});
	} finally {
		callbacks?.onDone?.();
	}
}

/**
 * Map a single SDK message to the appropriate transport ServerMessage.
 */
function relayMessage(
	message: SDKMessage,
	session: ClaudeCodeSession,
	transport: Transport,
	requestId: string,
	callbacks?: RelayCallbacks,
): void {
	switch (message.type) {
		case "stream_event": {
			// Partial assistant message streaming
			const event = message.event;
			if (
				event.type === "content_block_delta" &&
				event.delta.type === "text_delta"
			) {
				transport.send({
					type: "chat.stream.delta",
					requestId,
					delta: event.delta.text,
				});
			}
			break;
		}

		case "assistant": {
			// Complete assistant message -- relay tool_use blocks
			const msg = message.message;
			if (msg.content && Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (block.type === "tool_use") {
						transport.send({
							type: "tool.call",
							requestId,
							toolCallId: block.id,
							toolName: block.name,
							args: block.input,
						});
					}
				}
			}
			break;
		}

		case "result": {
			// Session completed (success or error)
			const costUsd = message.total_cost_usd ?? 0;
			const usage = message.usage ?? {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadInputTokens: 0,
				cacheCreationInputTokens: 0,
			};

			session.status = "completed";
			session.completedAt = new Date();
			session.totalCostUsd = costUsd;

			transport.send({
				type: "chat.stream.end",
				requestId,
				usage: {
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens,
					totalTokens: usage.inputTokens + usage.outputTokens,
				},
				cost: {
					inputCost: costUsd,
					outputCost: 0,
					totalCost: costUsd,
				},
			});

			callbacks?.onResult?.();
			break;
		}

		// System messages (init, status, hooks, etc.) -- log but don't relay
		case "system": {
			logger.info("Claude Code system event", {
				sessionId: session.id,
				subtype: message.subtype,
			});
			break;
		}

		default:
			// user, tool_progress, tool_use_summary, auth_status etc. -- log only
			break;
	}
}

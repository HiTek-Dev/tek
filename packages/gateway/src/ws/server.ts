import type { FastifyInstance, FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { createLogger } from "@agentspace/core";
import { ClientMessageSchema } from "./protocol.js";
import type { ServerMessage } from "./protocol.js";
import {
	initConnection,
	getConnectionState,
	removeConnection,
} from "./connection.js";
import { sessionManager } from "../session/index.js";
import {
	handleChatSend,
	handleChatRouteConfirm,
	handleContextInspect,
	handleUsageQuery,
	handleMemorySearch,
	handleThreadCreate,
	handleThreadList,
	handleThreadUpdate,
	handlePromptSet,
	handlePromptList,
	handleToolApprovalResponse,
	handlePreflightApproval,
} from "./handlers.js";

const logger = createLogger("gateway-ws");

/**
 * Send a typed server message over a WebSocket.
 */
function send(ws: WebSocket, msg: ServerMessage): void {
	if (ws.readyState === ws.OPEN) {
		ws.send(JSON.stringify(msg));
	}
}

/**
 * Register the WebSocket gateway endpoint on a Fastify instance.
 * Adds a /gateway route that handles typed JSON messages.
 */
export async function registerGatewayWebSocket(
	fastify: FastifyInstance,
): Promise<void> {
	await fastify.register(websocket, {
		options: { maxPayload: 1048576 }, // 1MB max
	});

	// Register the /gateway route in a scoped plugin
	await fastify.register(async (scoped) => {
		// Localhost-only access check
		scoped.addHook(
			"preValidation",
			async (request: FastifyRequest) => {
				const ip = request.ip;
				if (ip !== "127.0.0.1" && ip !== "::1" && ip !== "::ffff:127.0.0.1") {
					throw new Error("Gateway is localhost-only");
				}
			},
		);

		scoped.get(
			"/gateway",
			{ websocket: true },
			(socket: WebSocket, _req: FastifyRequest) => {
				// CRITICAL: Attach handlers synchronously (Pitfall 2)
				const connState = initConnection(socket);
				logger.info("WebSocket client connected");

				socket.on("message", (raw: Buffer | string) => {
					let data: unknown;
					try {
						data = JSON.parse(
							typeof raw === "string" ? raw : raw.toString("utf-8"),
						);
					} catch {
						send(socket, {
							type: "error",
							code: "INVALID_MESSAGE",
							message: "Invalid JSON",
						});
						return;
					}

					const result = ClientMessageSchema.safeParse(data);
					if (!result.success) {
						send(socket, {
							type: "error",
							code: "INVALID_MESSAGE",
							message: `Invalid message: ${result.error.issues.map((i: { message: string }) => i.message).join(", ")}`,
						});
						return;
					}

					const msg = result.data;

					switch (msg.type) {
						case "session.list": {
							const sessions = sessionManager.list();
							send(socket, {
								type: "session.list",
								requestId: msg.id,
								sessions,
							});
							break;
						}

						case "chat.send": {
							logger.info(`chat.send from client (requestId: ${msg.id})`);
							handleChatSend(socket, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled chat.send error: ${err.message}`);
								},
							);
							break;
						}

						case "chat.route.confirm": {
							logger.info(`chat.route.confirm from client (requestId: ${msg.requestId})`);
							handleChatRouteConfirm(socket, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled chat.route.confirm error: ${err.message}`);
								},
							);
							break;
						}

						case "context.inspect": {
							logger.info(`context.inspect for session ${msg.sessionId}`);
							handleContextInspect(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled context.inspect error: ${err.message}`);
								},
							);
							break;
						}

						case "usage.query": {
							logger.info("usage.query from client");
							handleUsageQuery(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled usage.query error: ${err.message}`);
								},
							);
							break;
						}

						case "memory.search": {
							logger.info(`memory.search query: "${msg.query.slice(0, 50)}"`);
							handleMemorySearch(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled memory.search error: ${err.message}`);
								},
							);
							break;
						}

						case "thread.create": {
							logger.info(`thread.create: "${msg.title}"`);
							handleThreadCreate(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled thread.create error: ${err.message}`);
								},
							);
							break;
						}

						case "thread.list": {
							logger.info("thread.list from client");
							handleThreadList(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled thread.list error: ${err.message}`);
								},
							);
							break;
						}

						case "thread.update": {
							logger.info(`thread.update: ${msg.threadId}`);
							handleThreadUpdate(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled thread.update error: ${err.message}`);
								},
							);
							break;
						}

						case "prompt.set": {
							logger.info(`prompt.set: "${msg.name}"`);
							handlePromptSet(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled prompt.set error: ${err.message}`);
								},
							);
							break;
						}

						case "prompt.list": {
							logger.info("prompt.list from client");
							handlePromptList(socket, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled prompt.list error: ${err.message}`);
								},
							);
							break;
						}

						case "tool.approval.response": {
							logger.info(`tool.approval.response for toolCallId: ${msg.toolCallId}`);
							handleToolApprovalResponse(socket, msg, connState);
							break;
						}

						case "preflight.approval": {
							logger.info(`preflight.approval from client (requestId: ${msg.requestId})`);
							handlePreflightApproval(socket, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled preflight.approval error: ${err.message}`);
								},
							);
							break;
						}

						case "terminal.snapshot": {
							connState.lastTerminalSnapshot = msg.content;
							logger.info(`terminal.snapshot received (${msg.content.length} chars)`);
							break;
						}

						case "terminal.control.grant": {
							connState.terminalControlGranted = true;
							logger.info("terminal.control.grant — agent can now observe and send input");
							break;
						}

						case "terminal.control.revoke": {
							connState.terminalControlGranted = false;
							logger.info("terminal.control.revoke — agent input disabled");
							break;
						}
					}
				});

				socket.on("close", () => {
					logger.info("WebSocket client disconnected");
					removeConnection(socket);
				});

				socket.on("error", (err: Error) => {
					logger.error(`WebSocket error: ${err.message}`);
					removeConnection(socket);
				});
			},
		);
	});
}

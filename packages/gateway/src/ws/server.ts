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
							// If no sessionId, create a new session
							if (!msg.sessionId) {
								const session = sessionManager.create(
									"default",
									msg.model,
								);
								connState.sessionId = session.id;
								send(socket, {
									type: "session.created",
									sessionId: session.id,
									sessionKey: session.sessionKey,
								});
							} else {
								// Validate session exists
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
								connState.sessionId = session.id;
							}

							// Stub: actual LLM streaming will be implemented in Plan 02-02
							send(socket, {
								type: "error",
								requestId: msg.id,
								code: "NOT_IMPLEMENTED",
								message:
									"chat.send streaming not yet implemented",
							});
							break;
						}

						case "context.inspect": {
							send(socket, {
								type: "error",
								requestId: msg.id,
								code: "NOT_IMPLEMENTED",
								message:
									"context.inspect not yet implemented",
							});
							break;
						}

						case "usage.query": {
							send(socket, {
								type: "error",
								requestId: msg.id,
								code: "NOT_IMPLEMENTED",
								message: "usage.query not yet implemented",
							});
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

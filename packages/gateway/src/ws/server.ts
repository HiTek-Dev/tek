import type { FastifyInstance, FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { createLogger } from "@tek/core";
import { ClientMessageSchema } from "./protocol.js";
import { WebSocketTransport } from "../transport.js";
import {
	initConnection,
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
	handleWorkflowTrigger,
	handleWorkflowApproval,
	handleWorkflowList,
	handleWorkflowExecutionList,
	handleScheduleCreate,
	handleScheduleUpdate,
	handleScheduleDelete,
	handleScheduleList,
	handleHeartbeatConfigure,
	handleClaudeCodeStart,
	handleClaudeCodeAbort,
	handleSoulEvolutionResponse,
	clearEvolutionRateLimit,
} from "./handlers.js";
import {
	handleVaultKeysList,
	handleVaultKeysSet,
	handleVaultKeysDelete,
	handleVaultKeysTest,
	handleConfigGet,
	handleConfigUpdate,
	handleOllamaDiscover,
	handleProviderModelsList,
} from "./vault-handlers.js";
import {
	handleAgentIdentityRead,
	handleAgentIdentityWrite,
	handleAgentCreate,
	handleAgentUpdate,
	handleAgentDelete,
	handleTelegramUsersList,
	handleTelegramUsersUpdate,
} from "./agent-handlers.js";

const logger = createLogger("gateway-ws");

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
				// Generate a unique ID for this connection using built-in crypto (synchronous)
				const transport = new WebSocketTransport(socket, crypto.randomUUID());

				// CRITICAL: Attach handlers synchronously (Pitfall 2)
				const connState = initConnection(transport.transportId);
				logger.info("WebSocket client connected");

				socket.on("message", (raw: Buffer | string) => {
					let data: unknown;
					try {
						data = JSON.parse(
							typeof raw === "string" ? raw : raw.toString("utf-8"),
						);
					} catch {
						transport.send({
							type: "error",
							code: "INVALID_MESSAGE",
							message: "Invalid JSON",
						});
						return;
					}

					const result = ClientMessageSchema.safeParse(data);
					if (!result.success) {
						transport.send({
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
							transport.send({
								type: "session.list",
								requestId: msg.id,
								sessions,
							});
							break;
						}

						case "chat.send": {
							logger.info(`chat.send from client (requestId: ${msg.id})`);
							handleChatSend(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled chat.send error: ${err.message}`);
								},
							);
							break;
						}

						case "chat.route.confirm": {
							logger.info(`chat.route.confirm from client (requestId: ${msg.requestId})`);
							handleChatRouteConfirm(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled chat.route.confirm error: ${err.message}`);
								},
							);
							break;
						}

						case "context.inspect": {
							logger.info(`context.inspect for session ${msg.sessionId}`);
							handleContextInspect(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled context.inspect error: ${err.message}`);
								},
							);
							break;
						}

						case "usage.query": {
							logger.info("usage.query from client");
							handleUsageQuery(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled usage.query error: ${err.message}`);
								},
							);
							break;
						}

						case "memory.search": {
							logger.info(`memory.search query: "${msg.query.slice(0, 50)}"`);
							handleMemorySearch(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled memory.search error: ${err.message}`);
								},
							);
							break;
						}

						case "thread.create": {
							logger.info(`thread.create: "${msg.title}"`);
							handleThreadCreate(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled thread.create error: ${err.message}`);
								},
							);
							break;
						}

						case "thread.list": {
							logger.info("thread.list from client");
							handleThreadList(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled thread.list error: ${err.message}`);
								},
							);
							break;
						}

						case "thread.update": {
							logger.info(`thread.update: ${msg.threadId}`);
							handleThreadUpdate(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled thread.update error: ${err.message}`);
								},
							);
							break;
						}

						case "prompt.set": {
							logger.info(`prompt.set: "${msg.name}"`);
							handlePromptSet(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled prompt.set error: ${err.message}`);
								},
							);
							break;
						}

						case "prompt.list": {
							logger.info("prompt.list from client");
							handlePromptList(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled prompt.list error: ${err.message}`);
								},
							);
							break;
						}

						case "tool.approval.response": {
							logger.info(`tool.approval.response for toolCallId: ${msg.toolCallId}`);
							handleToolApprovalResponse(transport, msg, connState);
							break;
						}

						case "preflight.approval": {
							logger.info(`preflight.approval from client (requestId: ${msg.requestId})`);
							handlePreflightApproval(transport, msg, connState).catch(
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

						case "workflow.trigger": {
							logger.info(`workflow.trigger: ${msg.workflowId}`);
							handleWorkflowTrigger(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled workflow.trigger error: ${err.message}`);
								},
							);
							break;
						}

						case "workflow.approval": {
							logger.info(`workflow.approval: ${msg.executionId} step ${msg.stepId}`);
							handleWorkflowApproval(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled workflow.approval error: ${err.message}`);
								},
							);
							break;
						}

						case "workflow.list": {
							logger.info("workflow.list from client");
							handleWorkflowList(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled workflow.list error: ${err.message}`);
								},
							);
							break;
						}

						case "workflow.execution.list": {
							logger.info("workflow.execution.list from client");
							handleWorkflowExecutionList(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled workflow.execution.list error: ${err.message}`);
								},
							);
							break;
						}

						case "schedule.create": {
							logger.info(`schedule.create: ${msg.name}`);
							handleScheduleCreate(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled schedule.create error: ${err.message}`);
								},
							);
							break;
						}

						case "schedule.update": {
							logger.info(`schedule.update: ${msg.scheduleId}`);
							handleScheduleUpdate(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled schedule.update error: ${err.message}`);
								},
							);
							break;
						}

						case "schedule.delete": {
							logger.info(`schedule.delete: ${msg.scheduleId}`);
							handleScheduleDelete(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled schedule.delete error: ${err.message}`);
								},
							);
							break;
						}

						case "schedule.list": {
							logger.info("schedule.list from client");
							handleScheduleList(transport, msg).catch(
								(err: Error) => {
									logger.error(`Unhandled schedule.list error: ${err.message}`);
								},
							);
							break;
						}

						case "heartbeat.configure": {
							logger.info(`heartbeat.configure: interval=${msg.interval}`);
							handleHeartbeatConfigure(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled heartbeat.configure error: ${err.message}`);
								},
							);
							break;
						}

						case "claude-code.start": {
							logger.info(`claude-code.start from client (requestId: ${msg.id})`);
							handleClaudeCodeStart(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled claude-code.start error: ${err.message}`);
								},
							);
							break;
						}

						case "claude-code.abort": {
							logger.info(`claude-code.abort for session: ${msg.sessionId}`);
							handleClaudeCodeAbort(transport, msg, connState).catch(
								(err: Error) => {
									logger.error(`Unhandled claude-code.abort error: ${err.message}`);
								},
							);
							break;
						}

						case "soul.evolution.response": {
							logger.info(`soul.evolution.response for requestId: ${msg.requestId}`);
							handleSoulEvolutionResponse(transport, msg, connState);
							break;
						}

						// ── Vault & Config ──────────────────────────────

						case "vault.keys.list": {
							handleVaultKeysList(transport, msg);
							break;
						}

						case "vault.keys.set": {
							handleVaultKeysSet(transport, msg);
							break;
						}

						case "vault.keys.delete": {
							handleVaultKeysDelete(transport, msg);
							break;
						}

						case "vault.keys.test": {
							handleVaultKeysTest(transport, msg).catch((err: Error) => {
								logger.error(`Unhandled vault.keys.test error: ${err.message}`);
							});
							break;
						}

						case "config.get": {
							handleConfigGet(transport, msg);
							break;
						}

						case "config.update": {
							handleConfigUpdate(transport, msg);
							break;
						}

						case "ollama.discover": {
							handleOllamaDiscover(transport, msg).catch((err: Error) => {
								logger.error(`Unhandled ollama.discover error: ${err.message}`);
							});
							break;
						}

						case "provider.models.list": {
							handleProviderModelsList(transport, msg);
							break;
						}

						// ── Agent Management ────────────────────────────

						case "agent.identity.read": {
							handleAgentIdentityRead(transport, msg);
							break;
						}

						case "agent.identity.write": {
							handleAgentIdentityWrite(transport, msg);
							break;
						}

						case "agent.create": {
							handleAgentCreate(transport, msg);
							break;
						}

						case "agent.update": {
							handleAgentUpdate(transport, msg);
							break;
						}

						case "agent.delete": {
							handleAgentDelete(transport, msg);
							break;
						}

						case "telegram.users.list": {
							handleTelegramUsersList(transport, msg).catch((err: Error) => {
								logger.error(`Unhandled telegram.users.list error: ${err.message}`);
							});
							break;
						}

						case "telegram.users.update": {
							handleTelegramUsersUpdate(transport, msg).catch((err: Error) => {
								logger.error(`Unhandled telegram.users.update error: ${err.message}`);
							});
							break;
						}

						// ── Chat Model Switch & Context ─────────────────

						case "chat.model.switch": {
							logger.info(`chat.model.switch to ${msg.newModel}`);
							// TODO: implement full model switch handler
							transport.send({
								type: "chat.model.switched",
								id: msg.id,
								sessionId: msg.sessionId,
								newModel: msg.newModel,
								preserved: msg.keepContext,
							});
							break;
						}

						case "context.dump": {
							logger.info(`context.dump for session ${msg.sessionId}`);
							// TODO: implement full context dump handler
							transport.send({
								type: "context.dump.result",
								id: msg.id,
								sessionId: msg.sessionId,
								messageCount: 0,
								byteCount: 0,
							});
							break;
						}

						// ── Gateway Logs & Status ───────────────────────

						case "gateway.logs.subscribe": {
							logger.info("gateway.logs.subscribe from client");
							// TODO: implement log subscription
							break;
						}

						case "gateway.logs.unsubscribe": {
							logger.info("gateway.logs.unsubscribe from client");
							// TODO: implement log unsubscription
							break;
						}

						case "gateway.status": {
							const startTime = process.uptime();
							transport.send({
								type: "gateway.status.result",
								id: msg.id,
								uptime: Math.floor(startTime),
								port: 3271,
								pid: process.pid,
								connections: 1,
								sessions: 0,
								providers: [],
							});
							break;
						}
					}
				});

				socket.on("close", () => {
					logger.info("WebSocket client disconnected");
					clearEvolutionRateLimit(transport.transportId);
					removeConnection(transport.transportId);
				});

				socket.on("error", (err: Error) => {
					logger.error(`WebSocket error: ${err.message}`);
					clearEvolutionRateLimit(transport.transportId);
					removeConnection(transport.transportId);
				});
			},
		);
	});
}

// Transport abstraction
export { WebSocketTransport } from "./transport.js";
export type { Transport } from "./transport.js";

export { createKeyServer } from "./key-server/index.js";
export { registerGatewayWebSocket } from "./ws/index.js";
export {
	ClientMessageSchema,
	ServerMessageSchema,
} from "./ws/index.js";
export type {
	ClientMessage,
	ServerMessage,
	ErrorMessage,
	SessionCreated,
	SessionListResponse,
} from "./ws/index.js";
export { sessionManager, FALLBACK_MODEL } from "./session/index.js";
export type { Session, SessionSummary, MessageRow } from "./session/index.js";

// LLM module
export { getAnthropicProvider, streamChatResponse } from "./llm/index.js";
export type { StreamChunk, StreamDelta, StreamDone } from "./llm/index.js";

// Context module
export { assembleContext, inspectContext } from "./context/index.js";
export type { ContextSection, AssembledContext } from "./context/index.js";

// Usage module
export { MODEL_PRICING, getModelPricing, calculateCost } from "./usage/index.js";
export { usageTracker } from "./usage/index.js";
export type { UsageRecord, UsageRow, UsageTotals } from "./usage/index.js";

// Memory module
export { MemoryManager, MemoryPressureDetector, ThreadManager } from "./memory/index.js";
export type { ThreadRow, GlobalPromptRow } from "./memory/index.js";

// MCP module
export { MCPClientManager, loadMCPConfigs } from "./mcp/index.js";

// Tools module
export { createFilesystemTools } from "./tools/index.js";
export { createShellTool } from "./tools/index.js";

// Agent module
export {
	buildToolRegistry,
	createApprovalPolicy,
	checkApproval,
	recordSessionApproval,
	wrapToolWithApproval,
} from "./agent/index.js";
export type { ToolRegistryOptions, ApprovalPolicy } from "./agent/index.js";

// System skills
export {
	createWebSearchTool,
	createImageGenTool,
	getPlaywrightMcpConfig,
	createGoogleWorkspaceTools,
	createGoogleAuth,
} from "./skills/index.js";
export type { GoogleAuthConfig } from "./skills/index.js";

// Handler functions (for cross-channel use, e.g., Telegram)
export { handleChatSend } from "./ws/handlers.js";
export { initConnection, getConnectionState, removeConnection } from "./ws/connection.js";
export type { ConnectionState } from "./ws/connection.js";
export type { ChatSend } from "./ws/protocol.js";

// When run directly, start the key server with WebSocket gateway
const isDirectRun =
	process.argv[1] &&
	(process.argv[1].endsWith("/gateway/dist/index.js") ||
		process.argv[1].endsWith("/gateway/src/index.ts"));

if (isDirectRun) {
	const { createKeyServer } = await import("./key-server/index.js");
	const { registerGatewayWebSocket } = await import("./ws/index.js");

	// createKeyServer returns the Fastify instance after listen.
	// We need to register WS BEFORE listen, so we refactor:
	// Use the new createServer() that returns the instance pre-listen.
	const { createServer } = await import("./key-server/server.js");
	const { server, start } = await createServer();
	await registerGatewayWebSocket(server);
	await start();
}

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
export { sessionManager, DEFAULT_MODEL } from "./session/index.js";
export type { Session, SessionSummary, MessageRow } from "./session/index.js";

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

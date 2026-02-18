import { writeFileSync, unlinkSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import bearerAuth from "@fastify/bearer-auth";
import { loadConfig, RUNTIME_PATH, createLogger } from "@tek/core";
import { getAuthKeys } from "./auth.js";
import { registerHealthRoute, registerKeyRoutes } from "./routes.js";

const logger = createLogger("key-server");

const DEFAULT_PORT = 3271;
const MAX_PORT_RETRIES = 10;

/**
 * Create a Fastify instance with key-server routes registered but NOT yet listening.
 * Returns the server instance and a start() function to begin listening.
 * This allows additional plugins (e.g., WebSocket gateway) to be registered
 * before the server starts.
 */
export async function createServer(opts?: { port?: number }): Promise<{
	server: FastifyInstance;
	start: () => Promise<FastifyInstance>;
}> {
	const config = loadConfig();
	const basePort = opts?.port ?? config?.apiEndpoint?.port ?? DEFAULT_PORT;

	const server = Fastify({
		logger: {
			level: "info",
			serializers: {
				req(request) {
					return {
						method: request.method,
						url: request.url,
						remoteAddress: request.ip,
						// NEVER log the Authorization header
					};
				},
			},
		},
	});

	// Register health route in root scope (no auth required)
	await server.register(registerHealthRoute);

	// Register key routes in a scoped plugin WITH bearer-auth
	await server.register(async (scopedServer) => {
		const keys = getAuthKeys();
		await scopedServer.register(bearerAuth, { keys });
		await scopedServer.register(registerKeyRoutes);
	});

	const start = async (): Promise<FastifyInstance> => {
		// Try binding to port, retry on EADDRINUSE
		let boundPort = basePort;
		for (let attempt = 0; attempt <= MAX_PORT_RETRIES; attempt++) {
			const port = basePort + attempt;
			try {
				await server.listen({ port, host: "127.0.0.1" });
				boundPort = port;
				if (attempt > 0) {
					logger.info(
						`Port ${basePort} was in use, bound to port ${boundPort} instead`,
					);
				}
				break;
			} catch (err: unknown) {
				const error = err as NodeJS.ErrnoException;
				if (error.code === "EADDRINUSE" && attempt < MAX_PORT_RETRIES) {
					continue;
				}
				throw err;
			}
		}

		// Write runtime.json with PID and port
		const runtimeData = {
			pid: process.pid,
			port: boundPort,
			startedAt: new Date().toISOString(),
		};
		writeFileSync(
			RUNTIME_PATH,
			JSON.stringify(runtimeData, null, 2),
			"utf-8",
		);
		logger.info(`Runtime info written to ${RUNTIME_PATH}`);

		// Clean up runtime.json on process exit
		const cleanup = () => {
			try {
				unlinkSync(RUNTIME_PATH);
			} catch {
				// Ignore if already cleaned up
			}
		};

		process.on("SIGTERM", () => {
			cleanup();
			process.exit(0);
		});

		process.on("SIGINT", () => {
			cleanup();
			process.exit(0);
		});

		return server;
	};

	return { server, start };
}

/**
 * Create and start the key-serving API server.
 * Convenience wrapper that calls createServer() then start().
 * Binds to 127.0.0.1 only. Applies bearer-auth to /keys/* routes.
 * Writes runtime.json with PID and port on successful startup.
 */
export async function createKeyServer(
	opts?: { port?: number },
): Promise<FastifyInstance> {
	const { server, start } = await createServer(opts);
	await start();
	return server;
}

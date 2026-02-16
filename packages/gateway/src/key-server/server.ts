import { writeFileSync, unlinkSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import bearerAuth from "@fastify/bearer-auth";
import { loadConfig, RUNTIME_PATH, createLogger } from "@agentspace/core";
import { getAuthKeys } from "./auth.js";
import { registerHealthRoute, registerKeyRoutes } from "./routes.js";

const logger = createLogger("key-server");

const DEFAULT_PORT = 3271;
const MAX_PORT_RETRIES = 10;

/**
 * Create and start the key-serving API server.
 * Binds to 127.0.0.1 only. Applies bearer-auth to /keys/* routes.
 * Writes runtime.json with PID and port on successful startup.
 */
export async function createKeyServer(
	opts?: { port?: number },
): Promise<FastifyInstance> {
	const config = loadConfig();
	const basePort =
		opts?.port ?? config?.apiEndpoint?.port ?? DEFAULT_PORT;

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
	writeFileSync(RUNTIME_PATH, JSON.stringify(runtimeData, null, 2), "utf-8");
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
}

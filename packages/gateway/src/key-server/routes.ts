import type { FastifyInstance } from "fastify";
import { getKey, validateProvider } from "@agentspace/cli/vault";
import { recordAuditEvent } from "@agentspace/db";

/**
 * Register the health check route (no auth required).
 * This should be registered in a scope WITHOUT bearer-auth.
 */
export async function registerHealthRoute(
	server: FastifyInstance,
): Promise<void> {
	server.get("/health", async () => {
		return { status: "ok", uptime: process.uptime() };
	});
}

/**
 * Register the key-serving routes (require bearer auth).
 * This should be registered in a scope WITH bearer-auth.
 */
export async function registerKeyRoutes(
	server: FastifyInstance,
): Promise<void> {
	server.get<{ Params: { provider: string } }>(
		"/keys/:provider",
		async (request, reply) => {
			const { provider: providerInput } = request.params;

			let provider;
			try {
				provider = validateProvider(providerInput);
			} catch {
				return reply.code(400).send({
					error: `Unknown provider: "${providerInput}". Valid providers: anthropic, openai, ollama`,
				});
			}

			const key = getKey(provider);
			if (key === null) {
				return reply.code(404).send({
					error: `No key configured for provider: ${provider}`,
				});
			}

			recordAuditEvent({
				event: "key_accessed",
				provider,
				sourceIp: request.ip,
			});

			return { provider, key };
		},
	);
}

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createLogger, type MCPServerConfig } from "@tek/core";

const logger = createLogger("mcp");

/**
 * Manages lazy connections to MCP servers.
 * Singleton pattern consistent with SessionManager/UsageTracker.
 */
export class MCPClientManager {
	private static instance: MCPClientManager | null = null;
	private clients = new Map<string, MCPClient>();

	private constructor() {
		const cleanup = () => {
			this.closeAll().catch(() => {});
		};
		process.on("exit", cleanup);
		process.on("SIGTERM", cleanup);
	}

	static getInstance(): MCPClientManager {
		if (!MCPClientManager.instance) {
			MCPClientManager.instance = new MCPClientManager();
		}
		return MCPClientManager.instance;
	}

	/**
	 * Lazy-connect to an MCP server and return its tools.
	 * Caches the client connection for reuse.
	 */
	async getTools(
		serverName: string,
		config: MCPServerConfig,
	): Promise<Record<string, unknown>> {
		try {
			let client = this.clients.get(serverName);

			if (!client) {
				client = await this.connect(serverName, config);
				this.clients.set(serverName, client);
			}

			return await client.tools();
		} catch (err) {
			logger.warn(
				`Failed to get tools from MCP server '${serverName}': ${err instanceof Error ? err.message : String(err)}`,
			);
			return {};
		}
	}

	private async connect(
		serverName: string,
		config: MCPServerConfig,
	): Promise<MCPClient> {
		// Determine transport type
		const transportType =
			config.transport ?? (config.command ? "stdio" : "http");

		if (transportType === "stdio" && config.command) {
			logger.info(
				`Connecting to MCP server '${serverName}' via stdio: ${config.command}`,
			);
			const transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: config.env as Record<string, string> | undefined,
			});
			return createMCPClient({
				transport,
				name: `agentspace-${serverName}`,
			});
		}

		if (config.url) {
			const type = transportType === "sse" ? "sse" : "http";
			logger.info(
				`Connecting to MCP server '${serverName}' via ${type}: ${config.url}`,
			);
			return createMCPClient({
				transport: { type, url: config.url },
				name: `agentspace-${serverName}`,
			});
		}

		throw new Error(
			`MCP server '${serverName}' has no valid transport configuration`,
		);
	}

	/**
	 * Close all active MCP client connections.
	 */
	async closeAll(): Promise<void> {
		const closePromises = Array.from(this.clients.entries()).map(
			async ([name, client]) => {
				try {
					await client.close();
					logger.info(`Closed MCP server '${name}'`);
				} catch (err) {
					logger.warn(
						`Error closing MCP server '${name}': ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			},
		);

		await Promise.allSettled(closePromises);
		this.clients.clear();
	}

	/** Reset singleton for testing */
	static resetInstance(): void {
		MCPClientManager.instance = null;
	}
}

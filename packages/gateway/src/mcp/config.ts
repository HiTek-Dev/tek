import type { AppConfig, MCPServerConfig } from "@tek/core";

/**
 * Extract MCP server configurations from the loaded AppConfig.
 * Returns an empty record if no MCP servers are configured.
 */
export function loadMCPConfigs(
	config: AppConfig,
): Record<string, MCPServerConfig> {
	return config.mcpServers ?? {};
}

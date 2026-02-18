import type { MCPServerConfig } from "@tek/core";

/**
 * Server name constant for Playwright MCP configuration keying.
 */
export const PLAYWRIGHT_SERVER_NAME = "playwright";

/**
 * Get the MCP server configuration for Playwright browser automation.
 * When added to mcpServers config, Playwright tools (browser_navigate,
 * browser_click, etc.) are auto-namespaced as "playwright.toolName"
 * via the existing MCPClientManager infrastructure.
 */
export function getPlaywrightMcpConfig(): MCPServerConfig {
	return {
		command: "npx",
		args: ["@playwright/mcp@latest", "--headless"],
	};
}

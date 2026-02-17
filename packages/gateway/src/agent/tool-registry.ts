import { createLogger, type SecurityMode } from "@agentspace/core";
import type { MCPServerConfig } from "@agentspace/core";
import type { MCPClientManager } from "../mcp/client-manager.js";
import { createFilesystemTools } from "../tools/filesystem.js";
import { createShellTool } from "../tools/shell.js";
import {
	wrapToolWithApproval,
	type ApprovalPolicy,
} from "./approval-gate.js";

const logger = createLogger("tool-registry");

export interface ToolRegistryOptions {
	mcpManager: MCPClientManager;
	mcpConfigs: Record<string, MCPServerConfig>;
	securityMode: SecurityMode;
	workspaceDir?: string;
	approvalPolicy?: ApprovalPolicy;
}

/**
 * Build a unified tool registry merging built-in tools with MCP server tools.
 * MCP tools are namespaced as "serverName.toolName" to avoid collisions.
 * Approval policy wrappers are applied if provided.
 */
export async function buildToolRegistry(
	options: ToolRegistryOptions,
): Promise<Record<string, unknown>> {
	const {
		mcpManager,
		mcpConfigs,
		securityMode,
		workspaceDir,
		approvalPolicy,
	} = options;

	const tools: Record<string, unknown> = {};

	// 1. Add built-in filesystem tools
	const fsTools = createFilesystemTools(securityMode, workspaceDir);
	for (const [name, t] of Object.entries(fsTools)) {
		tools[name] = approvalPolicy
			? wrapToolWithApproval(name, t as Record<string, unknown>, approvalPolicy)
			: t;
	}

	// 2. Add built-in shell tool
	const shellTool = createShellTool(securityMode, workspaceDir);
	const shellName = "execute_command";
	tools[shellName] = approvalPolicy
		? wrapToolWithApproval(shellName, shellTool as unknown as Record<string, unknown>, approvalPolicy)
		: shellTool;

	// 3. Add MCP server tools (lazy-connected)
	for (const [serverName, config] of Object.entries(mcpConfigs)) {
		try {
			const mcpTools = await mcpManager.getTools(serverName, config);
			for (const [toolName, t] of Object.entries(mcpTools)) {
				const namespacedName = `${serverName}.${toolName}`;
				tools[namespacedName] = approvalPolicy
					? wrapToolWithApproval(
							namespacedName,
							t as Record<string, unknown>,
							approvalPolicy,
						)
					: t;
			}
			logger.info(
				`Loaded ${Object.keys(mcpTools).length} tools from MCP server '${serverName}'`,
			);
		} catch (err) {
			logger.warn(
				`Failed to load tools from MCP server '${serverName}': ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	logger.info(`Tool registry built with ${Object.keys(tools).length} tools`);
	return tools;
}

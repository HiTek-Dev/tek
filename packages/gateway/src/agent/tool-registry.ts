import { createLogger, getSkillsDirs, loadConfig, type SecurityMode, PROJECT_NAME, CONFIG_DIR_NAME } from "@tek/core";
import type { MCPServerConfig } from "@tek/core";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import type { MCPClientManager } from "../mcp/client-manager.js";
import { createFilesystemTools } from "../tools/filesystem.js";
import { createShellTool } from "../tools/shell.js";
import {
	createSkillDraftTool,
	createSkillRegisterTool,
} from "../tools/skill.js";
import {
	wrapToolWithApproval,
	type ApprovalPolicy,
} from "./approval-gate.js";
import { createMemoryReadTool, createMemoryWriteTool } from "../tools/memory.js";
import {
	createWebSearchTool,
	createImageGenTool,
	createStabilityImageGenTool,
	createGoogleAuth,
	createGoogleWorkspaceTools,
	createVeniceImageTool,
	createVeniceVideoTool,
} from "../skills/index.js";

const logger = createLogger("tool-registry");

export interface ToolRegistryOptions {
	mcpManager: MCPClientManager;
	mcpConfigs: Record<string, MCPServerConfig>;
	securityMode: SecurityMode;
	workspaceDir?: string;
	approvalPolicy?: ApprovalPolicy;
	tavilyApiKey?: string;
	openaiApiKey?: string;
	stabilityApiKey?: string;
	googleAuth?: { clientId: string; clientSecret: string; refreshToken: string };
	veniceApiKey?: string;
	agentId?: string;
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
		tavilyApiKey,
		openaiApiKey,
		stabilityApiKey,
		googleAuth,
		veniceApiKey,
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

	// 4. Add skill authoring tools
	const sandboxDir = join(
		tmpdir(),
		`${PROJECT_NAME}-skill-sandbox-${randomUUID()}`,
	);
	const skillsDirs = getSkillsDirs({
		workspaceDir,
	});
	const workspaceSkillsDir =
		skillsDirs.workspace ??
		join(homedir(), ".config", CONFIG_DIR_NAME, "skills");

	const skillDraft = createSkillDraftTool(sandboxDir);
	tools.skill_draft = approvalPolicy
		? wrapToolWithApproval(
				"skill_draft",
				skillDraft as unknown as Record<string, unknown>,
				approvalPolicy,
			)
		: skillDraft;

	const skillRegister = createSkillRegisterTool(
		sandboxDir,
		workspaceSkillsDir,
	);
	tools.skill_register = approvalPolicy
		? wrapToolWithApproval(
				"skill_register",
				skillRegister as unknown as Record<string, unknown>,
				approvalPolicy,
			)
		: skillRegister;

	// Enforce "always" approval for skill_register if policy exists
	if (approvalPolicy) {
		approvalPolicy.perTool.skill_register = "always";
	}

	// 5. Add system skill tools (conditionally based on API key availability)
	let systemSkillCount = 0;

	if (tavilyApiKey) {
		const webSearch = createWebSearchTool(tavilyApiKey);
		const webSearchName = "web_search";
		tools[webSearchName] = approvalPolicy
			? wrapToolWithApproval(
					webSearchName,
					webSearch as unknown as Record<string, unknown>,
					approvalPolicy,
				)
			: webSearch;
		// Search is read-only: use "auto" tier
		if (approvalPolicy) {
			approvalPolicy.perTool[webSearchName] = "auto";
		}
		systemSkillCount++;
	}

	if (openaiApiKey) {
		const imageGen = createImageGenTool(openaiApiKey);
		const imageGenName = "image_generate";
		tools[imageGenName] = approvalPolicy
			? wrapToolWithApproval(
					imageGenName,
					imageGen as unknown as Record<string, unknown>,
					approvalPolicy,
				)
			: imageGen;
		// Image gen costs money: use "session" tier
		if (approvalPolicy) {
			approvalPolicy.perTool[imageGenName] = "session";
		}
		systemSkillCount++;
	}

	if (stabilityApiKey) {
		const stabilityImageGen = createStabilityImageGenTool(stabilityApiKey);
		const stabilityImageGenName = "stability_image_generate";
		tools[stabilityImageGenName] = approvalPolicy
			? wrapToolWithApproval(
					stabilityImageGenName,
					stabilityImageGen as unknown as Record<string, unknown>,
					approvalPolicy,
				)
			: stabilityImageGen;
		// Image gen costs money: use "session" tier
		if (approvalPolicy) {
			approvalPolicy.perTool[stabilityImageGenName] = "session";
		}
		systemSkillCount++;
	}

	if (veniceApiKey) {
		const veniceImageGen = createVeniceImageTool(veniceApiKey);
		const veniceImageGenName = "venice_image_generate";
		tools[veniceImageGenName] = approvalPolicy
			? wrapToolWithApproval(
					veniceImageGenName,
					veniceImageGen as unknown as Record<string, unknown>,
					approvalPolicy,
				)
			: veniceImageGen;
		if (approvalPolicy) {
			approvalPolicy.perTool[veniceImageGenName] = "session";
		}

		const veniceVideoGen = createVeniceVideoTool(veniceApiKey);
		const veniceVideoGenName = "venice_video_generate";
		tools[veniceVideoGenName] = approvalPolicy
			? wrapToolWithApproval(
					veniceVideoGenName,
					veniceVideoGen as unknown as Record<string, unknown>,
					approvalPolicy,
				)
			: veniceVideoGen;
		if (approvalPolicy) {
			approvalPolicy.perTool[veniceVideoGenName] = "session";
		}

		systemSkillCount += 2;
	}

	if (systemSkillCount > 0) {
		logger.info(`Registered ${systemSkillCount} system skill(s)`);
	}

	// 6. Add Google Workspace tools (conditionally based on OAuth credentials)
	if (googleAuth) {
		const auth = createGoogleAuth(googleAuth);
		const gTools = createGoogleWorkspaceTools(auth);

		// Read operations: auto approval tier
		const readOps = [
			"gmail_search",
			"gmail_read",
			"drive_search",
			"drive_read",
			"calendar_list",
			"docs_read",
		];
		// Write operations: session approval tier
		const writeOps = ["calendar_create", "docs_create"];

		for (const [name, t] of Object.entries(gTools)) {
			tools[name] = approvalPolicy
				? wrapToolWithApproval(
						name,
						t as Record<string, unknown>,
						approvalPolicy,
					)
				: t;

			if (approvalPolicy) {
				if (readOps.includes(name)) {
					approvalPolicy.perTool[name] = "auto";
				} else if (writeOps.includes(name)) {
					approvalPolicy.perTool[name] = "session";
				}
			}
		}

		logger.info(
			`Registered ${Object.keys(gTools).length} Google Workspace tool(s)`,
		);
	}

	// Note: Playwright browser automation tools are handled by the MCP tool
	// loading loop (step 3) when "playwright" is included in mcpConfigs.
	// Add { playwright: getPlaywrightMcpConfig() } to mcpServers to enable.

	// 7. Add memory tools (always available, bypasses workspace restrictions)
	const currentAgentId = options.agentId || loadConfig()?.agents?.defaultAgentId || undefined;
	const memoryRead = createMemoryReadTool(currentAgentId);
	const memoryWrite = createMemoryWriteTool();

	tools.memory_read = approvalPolicy
		? wrapToolWithApproval("memory_read", memoryRead as unknown as Record<string, unknown>, approvalPolicy)
		: memoryRead;
	tools.memory_write = approvalPolicy
		? wrapToolWithApproval("memory_write", memoryWrite as unknown as Record<string, unknown>, approvalPolicy)
		: memoryWrite;

	// Memory read is safe (auto tier), memory write needs session approval
	if (approvalPolicy) {
		approvalPolicy.perTool.memory_read = "auto";
		approvalPolicy.perTool.memory_write = "session";
	}

	logger.info(`Tool registry built with ${Object.keys(tools).length} tools`);
	return tools;
}
